import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, Mic, StopCircle } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { sounds } from '@shared/lib/sounds';
import { InterviewTimecodeBuilder } from '@shared/lib/videoTimecode';
import type { InterviewQuestion } from '@shared/types';

type Phase = 'loading' | 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

const RES_MAP = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
} as const;

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

  // ─── Charge les questions ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = await window.api.question.list();
        if (list.length === 0) {
          setError(
            'Aucune question configurée. Demandez à l\'organisateur d\'ajouter des questions dans l\'admin.',
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

  // ─── Démarre la caméra dès qu'on est prêt ──────────────────────────────
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

  // ─── Tick du countdown initial ─────────────────────────────────────────
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

  // ─── Tick de la question courante (durée + elapsed display) ────────────
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

  // ─── Cleanup au démontage ──────────────────────────────────────────────
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

  // ─── Démarrer l'enregistrement ─────────────────────────────────────────
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
      setError('Erreur lors de l\'enregistrement.');
      setPhase('error');
    };

    recorderRef.current = recorder;
    t0Ref.current = performance.now();
    builderRef.current = new InterviewTimecodeBuilder(t0Ref.current);
    recorder.start(1000);

    // Démarre la 1ère question
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

  // Au démarrage de chaque question, on note startMs ; à la sortie endMs.
  // On stocke le startMs par question dans une ref pour fermer l'entrée à la sortie.
  const questionStartMsRef = useRef<number>(0);

  // Au changement de currentIdx en mode recording, fixer le startMs.
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

      // Stop le flux caméra avant de quitter
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setScreen('video-preview');
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la finalisation.");
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
    <Screen className="flex items-center justify-center bg-black">
      <button
        onClick={cancel}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-black/40 border border-white/20 text-white/80 hover:text-white backdrop-blur transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Annuler</span>
      </button>

      {/* Vidéo plein écran */}
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
          className="absolute top-6 right-6 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-black/55 backdrop-blur border border-red-500/30"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-red-500 inline-block"
          />
          <span className="text-white text-sm font-semibold tracking-widest">REC</span>
          <span className="text-white/70 text-xs tabular-nums">
            {currentIdx + 1} / {totalQuestions}
          </span>
        </motion.div>
      )}

      {/* Question courante */}
      {phase === 'recording' && currentQuestion && (
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[80%] px-10 py-6 rounded-3xl text-center"
          style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(212,165,116,0.45)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          <p
            className="text-xs uppercase tracking-[0.4em] mb-3 font-medium"
            style={{ color: '#e8c79a' }}
          >
            Question {currentIdx + 1} / {totalQuestions}
          </p>
          <p
            className="text-white leading-tight"
            style={{
              fontFamily: '"Allura", cursive',
              fontSize: 'clamp(2.2rem, 4vw, 3.6rem)',
              lineHeight: 1.15,
            }}
          >
            {currentQuestion.label}
          </p>
        </motion.div>
      )}

      {/* Barre de progression de la question */}
      {phase === 'recording' && currentQuestion && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
          <div className="w-80 h-2 rounded-full overflow-hidden bg-white/15">
            <motion.div
              key={currentQuestion.id}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{
                duration: currentQuestion.duration_seconds,
                ease: 'linear',
              }}
              className="h-full"
              style={{
                background: 'linear-gradient(90deg, #f0a090 0%, #d46855 100%)',
              }}
            />
          </div>
          <p className="text-white/60 text-xs tabular-nums">
            {remainingPerQuestion}s restantes
          </p>
          <button
            onClick={advanceQuestion}
            className="mt-1 px-5 py-2 rounded-full text-xs uppercase tracking-widest font-semibold text-white/90 hover:text-white transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.25)',
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
          className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur transition-colors"
          style={{
            background: 'rgba(228,110,90,0.85)',
            color: '#fff',
            boxShadow: '0 6px 22px rgba(228,110,90,0.4)',
          }}
        >
          <StopCircle size={18} />
          <span className="text-sm font-semibold tracking-wide">Terminer maintenant</span>
        </button>
      )}

      {/* Compte à rebours initial */}
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
            <Mic size={16} /> Préparez-vous, on enregistre dans…
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
            style={{ background: '#ffffff' }}
          />
        )}
      </AnimatePresence>

      {/* Finishing */}
      {phase === 'finishing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40">
          <p
            className="text-white"
            style={{
              fontFamily: '"Allura", cursive',
              fontSize: '3rem',
            }}
          >
            Sauvegarde en cours…
          </p>
        </div>
      )}

      {/* Erreur */}
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
