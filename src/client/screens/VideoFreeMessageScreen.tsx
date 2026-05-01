import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MdArrowBack, MdErrorOutline, MdMic, MdStop } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { sounds } from '@shared/lib/sounds';

type Phase = 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

const RES_MAP = {
  '4k': { width: 3840, height: 2160 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
} as const;

const BITRATE_MAP: Record<keyof typeof RES_MAP, number> = {
  '4k': 8_000_000,
  '1080p': 4_000_000,
  '720p': 2_000_000,
  '480p': 1_000_000,
};

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return 'video/webm';
}

export function VideoFreeMessageScreen() {
  const { settings, setScreen, setVideoCapture } = useAppStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const t0Ref = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [elapsed, setElapsed] = useState(0);

  const maxSeconds = settings?.video_max_duration_seconds ?? 30;
  const initialCountdown = settings?.countdown_seconds ?? 3;
  const soundsOn = settings?.sound_enabled ?? true;
  const resolution = settings?.video_resolution ?? '1080p';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = RES_MAP[resolution];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: res.width },
            height: { ideal: res.height },
            frameRate: { ideal: 30, max: 30 },
            deviceId: settings?.camera_device_id
              ? { exact: settings.camera_device_id }
              : undefined,
          },
          audio: settings?.microphone_device_id
            ? { deviceId: { exact: settings.microphone_device_id } }
            : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCountdown(initialCountdown);
        setPhase('countdown');
      } catch (e: unknown) {
        const err = e as { name?: string };
        setError(
          err.name === 'NotAllowedError'
            ? 'Accès à la caméra ou au micro refusé. Vérifiez les autorisations.'
            : 'Aucune caméra/micro disponible.',
        );
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      startRecording();
      return;
    }
    if (soundsOn) sounds.tick();
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase]);

  useEffect(() => {
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    // VP9 priorisé pour la 4K (compression bien meilleure), fallback VP8.
    const mime = pickMimeType();
    const videoBitsPerSecond = BITRATE_MAP[resolution];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, {
        mimeType: mime,
        videoBitsPerSecond,
        audioBitsPerSecond: 128_000,
      });
    } catch (e) {
      console.error(e);
      setError("Le navigateur ne supporte pas l'enregistrement vidéo.");
      setPhase('error');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => finalize(mime);
    recorder.onerror = () => {
      setError("Erreur d'enregistrement.");
      setPhase('error');
    };

    recorderRef.current = recorder;
    t0Ref.current = performance.now();
    recorder.start(500);

    tickerRef.current = window.setInterval(() => {
      const e = (performance.now() - t0Ref.current) / 1000;
      setElapsed(e);
      if (e >= maxSeconds) {
        stopRecording();
      }
    }, 200) as unknown as number;

    setPhase('recording');
  };

  const stopRecording = () => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setPhase('finishing');
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const finalize = (mime: string) => {
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      const durationMs = Math.round(performance.now() - t0Ref.current);

      if (soundsOn) sounds.recordingEnd();

      const blobUrl = URL.createObjectURL(blob);
      setVideoCapture({
        blob,
        blobUrl,
        mime,
        durationMs,
        interviewLog: [],
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setScreen('video-preview');
    } catch (e) {
      console.error(e);
      setError('Erreur lors de la finalisation.');
      setPhase('error');
    }
  };

  const cancel = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScreen('video-home');
  };

  const remaining = Math.max(0, maxSeconds - elapsed);
  const progressPct = Math.min(100, (elapsed / maxSeconds) * 100);

  return (
    <Screen className="flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: '#1A1A1A' }} />

      <button
        onClick={cancel}
        className="absolute top-8 left-8 z-30 flex items-center gap-2 px-3 py-2"
        style={{
          color: '#FAF6EE',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <MdArrowBack size={18} />
        <span>Annuler</span>
      </button>

      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 z-30"
        style={{
          color: '#FAF6EE',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
        }}
      >
        Message libre
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {phase === 'recording' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-8 right-8 z-30 flex items-center gap-3 px-4 py-2"
          style={{ backgroundColor: '#FAF6EE', borderRadius: '4px' }}
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-2.5 h-2.5 inline-block"
            style={{ backgroundColor: '#1A1A1A', borderRadius: '50%' }}
          />
          <span
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.25em',
            }}
          >
            REC
          </span>
          <span
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
            }}
          >
            {remaining.toFixed(0)}s
          </span>
        </motion.div>
      )}

      {phase === 'recording' && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
          <div
            className="w-96 h-1 overflow-hidden"
            style={{ backgroundColor: 'rgba(250,246,238,0.2)' }}
          >
            <div
              className="h-full transition-all"
              style={{ width: `${progressPct}%`, backgroundColor: '#FAF6EE' }}
            />
          </div>
          <p
            style={{
              color: '#FAF6EE',
              opacity: 0.7,
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
              letterSpacing: '0.15em',
            }}
          >
            {elapsed.toFixed(1)}s sur {maxSeconds}s
          </p>
          <button
            onClick={stopRecording}
            className="mt-2 flex items-center gap-2 px-5 py-2.5"
            style={{
              backgroundColor: '#FAF6EE',
              color: '#1A1A1A',
              border: 'none',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <MdStop size={16} />
            <span>Terminer</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {phase === 'countdown' && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <span
              className="font-editorial leading-none"
              style={{
                fontSize: 'clamp(14rem, 30vw, 28rem)',
                fontWeight: 900,
                color: '#FAF6EE',
                letterSpacing: '-0.05em',
                textShadow: '0 0 80px rgba(0,0,0,0.5)',
              }}
            >
              {countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'countdown' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 px-8 py-4 z-30 flex items-center gap-3"
          style={{ backgroundColor: '#FAF6EE', borderRadius: '4px' }}
        >
          <MdMic size={16} style={{ color: '#1A1A1A' }} />
          <span
            className="label-editorial"
            style={{ color: '#1A1A1A', fontSize: '0.75rem' }}
          >
            Vous avez {maxSeconds}s pour votre message
          </span>
        </motion.div>
      )}

      {phase === 'finishing' && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40"
          style={{ backgroundColor: 'rgba(26,26,26,0.85)' }}
        >
          <p
            className="font-editorial"
            style={{
              color: '#FAF6EE',
              fontSize: '2.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Sauvegarde en cours...
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40"
          style={{ backgroundColor: '#F4ECDD' }}
        >
          <div className="card-editorial p-12 max-w-lg text-center">
            <MdErrorOutline size={48} className="mx-auto mb-6" style={{ color: '#1A1A1A' }} />
            <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
              Erreur
            </p>
            <h3
              className="font-editorial mb-4"
              style={{
                fontSize: '2rem',
                color: '#1A1A1A',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Oups
            </h3>
            <p
              className="mb-8"
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
              }}
            >
              {error}
            </p>
            <button onClick={() => setScreen('video-home')} className="btn-editorial-primary">
              Retour
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}
