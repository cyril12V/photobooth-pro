import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MdArrowBack, MdErrorOutline, MdMic, MdStop } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { sounds } from '@shared/lib/sounds';
import { InterviewTimecodeBuilder } from '@shared/lib/videoTimecode';
import type { InterviewQuestion } from '@shared/types';

type Phase = 'loading' | 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

const RES_MAP = {
  '4k': { width: 3840, height: 2160 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
} as const;

// Bitrate adapté à la résolution. Compromis qualité / charge CPU :
// un bitrate trop élevé charge l'encodeur software et fait laguer la
// prévisualisation. On reste raisonnable pour garder l'enregistrement fluide.
const BITRATE_MAP: Record<keyof typeof RES_MAP, number> = {
  '4k': 8_000_000,
  '1080p': 4_000_000,
  '720p': 2_000_000,
  '480p': 1_000_000,
};

/**
 * Choisit le mimeType supporté le plus efficace.
 * VP9 compresse mieux que VP8 (essentiel en 4K).
 */
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

export function VideoInterviewScreen() {
  const { settings, setScreen, setVideoCapture } = useAppStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickerRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(0);
  const builderRef = useRef<InterviewTimecodeBuilder | null>(null);

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [flashOverlay, setFlashOverlay] = useState(false);

  const beepEnabled = settings?.video_interview_beep ?? true;
  const flashEnabled = settings?.video_interview_flash ?? true;
  const soundsOn = settings?.sound_enabled ?? true;
  const resolution = settings?.video_resolution ?? '1080p';
  const initialCountdown = settings?.countdown_seconds ?? 3;

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;

  useEffect(() => {
    (async () => {
      try {
        const list = await window.api.question.list();
        if (list.length === 0) {
          setError(
            "Aucune question configurée. Demandez à l'organisateur d'ajouter des questions dans l'admin.",
          );
          setPhase('error');
          return;
        }
        setQuestions(list);
        setPhase('preparing');
      } catch (e) {
        console.error(e);
        setError('Impossible de charger les questions');
        setPhase('error');
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'preparing') return;
    let cancelled = false;
    (async () => {
      try {
        const res = RES_MAP[resolution];
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: res.width },
            height: { ideal: res.height },
            // frameRate fixé à 30 fps : élimine les saccades dues à un fps variable.
            frameRate: { ideal: 30, max: 30 },
            deviceId: settings?.camera_device_id
              ? { exact: settings.camera_device_id }
              : undefined,
          },
          audio: settings?.microphone_device_id
            ? { deviceId: { exact: settings.microphone_device_id } }
            : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
  }, [
    phase,
    resolution,
    settings?.camera_device_id,
    settings?.microphone_device_id,
    initialCountdown,
  ]);

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
    if (phase !== 'recording' || !currentQuestion) return;
    setQuestionElapsed(0);
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      setQuestionElapsed(Math.floor((performance.now() - startedAt) / 1000));
    }, 250);
    tickerRef.current = id;

    const advanceTimer = window.setTimeout(
      () => advanceQuestion(),
      currentQuestion.duration_seconds * 1000,
    );

    return () => {
      window.clearInterval(id);
      window.clearTimeout(advanceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIdx, currentQuestion?.id]);

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
    // VP8 prioritaire : c'est le codec WebM le plus largement supporté par
    // les builds ffmpeg-static (VP9 peut manquer du support de décodage et
    // faire échouer la compilation).
    // VP9 priorisé (compression bien meilleure en 4K), fallback VP8.
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
      console.error('MediaRecorder init failed', e);
      setError("Le navigateur ne supporte pas l'enregistrement vidéo dans ce format.");
      setPhase('error');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => finalize(mime);
    recorder.onerror = (ev) => {
      console.error('MediaRecorder error', ev);
      setError("Erreur lors de l'enregistrement.");
      setPhase('error');
    };

    recorderRef.current = recorder;
    t0Ref.current = performance.now();
    builderRef.current = new InterviewTimecodeBuilder(t0Ref.current);
    // Slices plus petits → moins de buffering en RAM, moins de saccades visibles
    recorder.start(500);

    setCurrentIdx(0);
    setPhase('recording');
  };

  const recordCurrentTimecode = (idx: number, startMs: number, endMs: number) => {
    if (!builderRef.current || !questions[idx]) return;
    builderRef.current.push({
      index: questions[idx].order_index,
      text: questions[idx].label,
      startMs,
      endMs,
    });
  };

  const questionStartMsRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== 'recording' || !builderRef.current) return;
    questionStartMsRef.current = builderRef.current.elapsed();
  }, [phase, currentIdx]);

  const advanceQuestion = () => {
    if (!builderRef.current) return;
    const startMs = questionStartMsRef.current;
    const endMs = builderRef.current.elapsed();
    recordCurrentTimecode(currentIdx, startMs, endMs);

    if (currentIdx + 1 >= totalQuestions) {
      stopRecording();
      return;
    }

    if (beepEnabled && soundsOn) sounds.questionChange();
    if (flashEnabled) {
      setFlashOverlay(true);
      setTimeout(() => setFlashOverlay(false), 350);
    }
    setCurrentIdx((i) => i + 1);
  };

  const stopRecording = () => {
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
      const durationMs = builderRef.current
        ? builderRef.current.elapsed()
        : Math.round(performance.now() - t0Ref.current);
      const log = builderRef.current?.list() ?? [];

      if (soundsOn) sounds.recordingEnd();

      const blobUrl = URL.createObjectURL(blob);
      setVideoCapture({
        blob,
        blobUrl,
        mime,
        durationMs,
        interviewLog: log,
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

  const remainingPerQuestion = useMemo(
    () => Math.max(0, (currentQuestion?.duration_seconds ?? 0) - questionElapsed),
    [currentQuestion, questionElapsed],
  );

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

      {/* Bandeau top */}
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
        Interview en cours
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Indicateur REC */}
      {phase === 'recording' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-8 right-8 z-30 flex items-center gap-3 px-4 py-2"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '4px',
          }}
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
            {currentIdx + 1} / {totalQuestions}
          </span>
        </motion.div>
      )}

      {/* Question courante — card éditoriale ivoire */}
      {phase === 'recording' && currentQuestion && (
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[80%] px-10 py-6 text-center"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '4px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          }}
        >
          <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
            Question {currentIdx + 1} sur {totalQuestions}
          </p>
          <p
            className="font-editorial"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              color: '#1A1A1A',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {currentQuestion.label}
          </p>
        </motion.div>
      )}

      {/* Barre de progression */}
      {phase === 'recording' && currentQuestion && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
          <div
            className="w-80 h-1 overflow-hidden"
            style={{ backgroundColor: 'rgba(250,246,238,0.2)' }}
          >
            <motion.div
              key={currentQuestion.id}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: currentQuestion.duration_seconds, ease: 'linear' }}
              className="h-full"
              style={{ backgroundColor: '#FAF6EE' }}
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
            {remainingPerQuestion}s restantes
          </p>
          <button
            onClick={advanceQuestion}
            className="mt-1 px-5 py-2"
            style={{
              backgroundColor: 'transparent',
              color: '#FAF6EE',
              border: '1px solid #FAF6EE',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Question suivante
          </button>
        </div>
      )}

      {/* Bouton terminer */}
      {phase === 'recording' && (
        <button
          onClick={stopRecording}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-3"
          style={{
            backgroundColor: '#FAF6EE',
            color: '#1A1A1A',
            borderRadius: '4px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <MdStop size={18} />
          <span>Terminer maintenant</span>
        </button>
      )}

      {/* Compte à rebours initial */}
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
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '4px',
          }}
        >
          <MdMic size={16} style={{ color: '#1A1A1A' }} />
          <span
            className="label-editorial"
            style={{ color: '#1A1A1A', fontSize: '0.75rem' }}
          >
            Préparez-vous, on enregistre dans...
          </span>
        </motion.div>
      )}

      {/* Flash transition */}
      <AnimatePresence>
        {flashOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 z-20 pointer-events-none"
            style={{ background: '#FAF6EE' }}
          />
        )}
      </AnimatePresence>

      {/* Finishing */}
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

      {/* Erreur */}
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
