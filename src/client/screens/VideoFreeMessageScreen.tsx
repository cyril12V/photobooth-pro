import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, Mic, StopCircle } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { sounds } from '@shared/lib/sounds';

type Phase = 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

const RES_MAP = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
} as const;

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

  // ─── Démarre la caméra ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = RES_MAP[resolution];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: res.width },
            height: { ideal: res.height },
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

  // ─── Tick countdown ────────────────────────────────────────────────────
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

  // ─── Cleanup ───────────────────────────────────────────────────────────
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
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, {
        mimeType: mime,
        videoBitsPerSecond: 2_500_000,
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
    recorder.start(1000);

    // Ticker pour la barre de progression
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
    <Screen className="flex items-center justify-center bg-black">
      <button
        onClick={cancel}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-black/40 border border-white/20 text-white/80 hover:text-white backdrop-blur transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Annuler</span>
      </button>

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
          className="absolute top-6 right-6 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-black/55 backdrop-blur border border-red-500/30"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-red-500 inline-block"
          />
          <span className="text-white text-sm font-semibold tracking-widest">REC</span>
          <span className="text-white/70 text-xs tabular-nums">{remaining.toFixed(0)}s</span>
        </motion.div>
      )}

      {/* Barre de progression durée max */}
      {phase === 'recording' && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
          <div className="w-96 h-2 rounded-full overflow-hidden bg-white/15">
            <div
              className="h-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #f0a090 0%, #d46855 100%)',
              }}
            />
          </div>
          <p className="text-white/60 text-xs tabular-nums">
            {elapsed.toFixed(1)}s / {maxSeconds}s
          </p>
          <button
            onClick={stopRecording}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur transition-colors"
            style={{
              background: 'rgba(228,110,90,0.85)',
              color: '#fff',
              boxShadow: '0 6px 22px rgba(228,110,90,0.4)',
            }}
          >
            <StopCircle size={16} />
            <span className="text-xs font-semibold tracking-wide uppercase">Terminer</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {phase === 'countdown' && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="relative">
              <div
                className="absolute inset-0 blur-3xl"
                style={{ background: 'rgba(212,165,116,0.35)' }}
              />
              <span
                className="relative leading-none text-gradient-gold"
                style={{
                  fontFamily: '"Allura", cursive',
                  fontSize: '20rem',
                  fontWeight: 300,
                }}
              >
                {countdown}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'countdown' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-32 left-1/2 -translate-x-1/2 px-8 py-4 rounded-full z-30"
          style={{
            background: 'rgba(250,246,239,0.95)',
            border: '1px solid rgba(212,165,116,0.4)',
          }}
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: '#5a3e2b' }}>
            <Mic size={16} /> Vous avez {maxSeconds}s pour votre message
          </span>
        </motion.div>
      )}

      {phase === 'finishing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40">
          <p
            className="text-white"
            style={{ fontFamily: '"Allura", cursive', fontSize: '3rem' }}
          >
            Sauvegarde en cours…
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(250,246,239,0.95)', backdropFilter: 'blur(20px)' }}
        >
          <div
            className="rounded-3xl p-12 max-w-lg text-center"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(212,165,116,0.25)',
              boxShadow: '0 8px 32px rgba(90,60,40,0.1)',
            }}
          >
            <AlertCircle size={48} className="mx-auto mb-6" style={{ color: '#d46855' }} />
            <h3
              className="mb-3"
              style={{
                fontFamily: '"Allura", cursive',
                fontSize: '2.5rem',
                color: '#2a1a10',
              }}
            >
              Oups…
            </h3>
            <p className="text-base mb-6 font-light" style={{ color: '#5a3e2b' }}>
              {error}
            </p>
            <Button variant="ghost" size="md" onClick={() => setScreen('video-home')}>
              Retour
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
