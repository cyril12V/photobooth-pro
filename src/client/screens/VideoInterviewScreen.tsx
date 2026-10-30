import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { finishCanonMovie, prepareCanonMovie, releaseCanonMovie, startCanonMovie, switchCanonToMovieForHdmi } from '@shared/lib/canonMovie';
import { GPU_RECORDER_MIME, GpuRecorder } from '@shared/lib/gpuRecorder';
import {
  VIDEO_BITRATE_MAP,
  VIDEO_RECORDING_SLICE_MS,
  applyPreviewElementSize,
  applyRealtimeCaptureHints,
  resolveMicrophone,
  videoCameraId,
  buildVideoTrackConstraints,
  pickRecorderMimeType,
  type CaptureResolution,
} from '@shared/lib/mediaCapture';
import { sounds } from '@shared/lib/sounds';
import { InterviewTimecodeBuilder } from '@shared/lib/videoTimecode';
import type { InterviewQuestion } from '@shared/types';
import { ContactBack } from '../components/ContactHeader';
import { VideoNegative, formatTimecode } from '../components/VideoNegative';
import '../../styles/contact-video.css';

type Phase = 'loading' | 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

export function VideoInterviewScreen() {
  const { event, settings, setScreen, setVideoCapture, setCameraVideoCapture } = useAppStore();
  // Appareil Canon en USB : il enregistre lui-même, l'aperçu vient de son LiveView.
  const canonVideo = settings?.video_source === 'canon';
  // Appareil Canon + Cam Link : bascule auto en mode vidéo par USB, l'app enregistre la Cam Link.
  const canonHdmi = settings?.video_source === 'canon_hdmi';
  const canonRecordingRef = useRef(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  // Encodeur de la carte graphique prêt (MP4 H.264, le processeur reste libre), sinon MediaRecorder.
  const gpuRecorderRef = useRef<GpuRecorder | null>(null);
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
  const resolution = (settings?.video_capture_resolution ?? '1080p') as CaptureResolution;
  const previewResolution = settings?.video_preview_resolution ?? '1080p';
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
        if (canonVideo) {
          const err = await prepareCanonMovie();
          if (cancelled) return;
          if (err) {
            setError(err);
            setPhase('error');
            return;
          }
          setCountdown(initialCountdown);
          setPhase('countdown');
          return;
        }
        if (canonHdmi) {
          // Appareil en mode vidéo par USB : sa sortie HDMI (Cam Link) devient propre.
          // Sans USB, on enregistre quand même la Cam Link plutôt que d'afficher une erreur à l'invité.
          const err = await switchCanonToMovieForHdmi();
          if (err) console.warn('[video] bascule en mode vidéo par USB impossible :', err);
          if (cancelled) return;
        } else if (settings?.capture_source === 'canon') {
          // Libère l'appareil Canon piloté en USB pour les photos : la vidéo passe par la caméra sélectionnée.
          await window.api.canon.disconnect();
        }
        // Par défaut, le son de la caméra (Cam Link : micro de l'appareil ou micro branché dessus).
        const mic = await resolveMicrophone(settings?.microphone_device_id, videoCameraId(settings));
        const stream = await navigator.mediaDevices.getUserMedia({
          video: buildVideoTrackConstraints(resolution, videoCameraId(settings)),
          audio: mic.audio,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        applyRealtimeCaptureHints(stream);
        // Démarre l'encodeur de la carte graphique maintenant, pour que l'enregistrement parte sans à-coup.
        const gpu = await GpuRecorder.prepare(stream, VIDEO_BITRATE_MAP[resolution]);
        if (cancelled) {
          gpu?.cancel();
          return;
        }
        gpuRecorderRef.current = gpu;
        if (videoRef.current) {
          applyPreviewElementSize(videoRef.current, previewResolution);
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
    previewResolution,
    settings?.camera_device_id,
    settings?.video_camera_device_id,
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
      gpuRecorderRef.current?.cancel();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Annule un enregistrement en cours et remet l'appareil en mode photo.
      if (canonVideo || canonHdmi) releaseCanonMovie(canonRecordingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    if (canonVideo) {
      const err = await startCanonMovie();
      if (err) {
        setError(err);
        setPhase('error');
        return;
      }
      canonRecordingRef.current = true;
      t0Ref.current = performance.now();
      builderRef.current = new InterviewTimecodeBuilder(t0Ref.current);
      setCurrentIdx(0);
      setPhase('recording');
      return;
    }
    if (!streamRef.current) return;
    if (gpuRecorderRef.current) {
      gpuRecorderRef.current.start();
      t0Ref.current = performance.now();
      builderRef.current = new InterviewTimecodeBuilder(t0Ref.current);
      setCurrentIdx(0);
      setPhase('recording');
      return;
    }
    const mime = pickRecorderMimeType();
    const videoBitsPerSecond = VIDEO_BITRATE_MAP[resolution];

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
    recorder.start(VIDEO_RECORDING_SLICE_MS);

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
    if (canonVideo) {
      finishCanonRecording();
      return;
    }
    if (gpuRecorderRef.current) {
      const rec = gpuRecorderRef.current;
      gpuRecorderRef.current = null;
      rec
        .stop()
        .then((blob) => finalize(GPU_RECORDER_MIME, blob))
        .catch((e) => {
          console.error(e);
          setError(e instanceof Error ? e.message : String(e));
          setPhase('error');
        });
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
  };

  /** L'appareil arrête l'enregistrement puis la vidéo est rapatriée en USB. */
  const finishCanonRecording = async () => {
    if (!canonRecordingRef.current) return;
    canonRecordingRef.current = false;
    const durationMs = builderRef.current
      ? builderRef.current.elapsed()
      : Math.round(performance.now() - t0Ref.current);
    const log = builderRef.current?.list() ?? [];
    if (soundsOn) sounds.recordingEnd();
    const movie = await finishCanonMovie(setDownloadPercent);
    if (typeof movie === 'string') {
      setError(movie);
      setPhase('error');
      return;
    }
    setCameraVideoCapture({ filepath: movie.path, url: movie.url, durationMs, interviewLog: log });
    setScreen('video-preview');
  };

  const finalize = (mime: string, recorded?: Blob) => {
    try {
      const blob = recorded ?? new Blob(chunksRef.current, { type: mime });
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
    gpuRecorderRef.current?.cancel();
    gpuRecorderRef.current = null;
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

  const lastQuestion = currentIdx + 1 >= totalQuestions;

  return (
    <Screen className="overflow-hidden">
      <div className="contact-darkroom absolute inset-0">
        <ContactBack onBack={cancel} label="Annuler" />

        {phase === 'recording' && (
          <div className="darkroom-rec">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="darkroom-rec-dot"
            />
            <span className="contact-edgeprint">Enregistrement</span>
          </div>
        )}

        <div className="darkroom">
          {/* Chaque question est une nouvelle image de la pellicule. */}
          <VideoNegative
            event={event}
            frame={phase === 'recording' ? currentIdx + 1 : 1}
            timecode={formatTimecode(phase === 'recording' ? questionElapsed : 0)}
          >
            {canonVideo ? (
              <CanonLiveView className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            <AnimatePresence>
              {phase === 'countdown' && countdown > 0 && (
                <motion.div
                  key={countdown}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="darkroom-count"
                >
                  {countdown}
                </motion.div>
              )}
            </AnimatePresence>
          </VideoNegative>

          <div className="darkroom-caption">
            {currentQuestion && (phase === 'recording' || phase === 'finishing') ? (
              <>
                <p className="contact-edgeprint">
                  Question {currentIdx + 1} / {totalQuestions}
                </p>
                <motion.h1
                  key={currentQuestion.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="darkroom-heading"
                >
                  {currentQuestion.label}
                </motion.h1>
                <p className="contact-lede">Encore {remainingPerQuestion} s</p>
                <div className="darkroom-progress">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: currentQuestion.duration_seconds, ease: 'linear' }}
                  />
                </div>
                {phase === 'recording' && (
                  <div className="darkroom-actions">
                    <button onClick={advanceQuestion} className="btn-editorial-primary">
                      {lastQuestion ? "Terminer l'interview" : 'Question suivante'}
                    </button>
                    {!lastQuestion && (
                      <button onClick={stopRecording} className="btn-editorial-secondary">
                        Terminer maintenant
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : phase === 'loading' || phase === 'preparing' ? (
              <p className="darkroom-heading">Un instant, la caméra s'allume.</p>
            ) : (
              <>
                {totalQuestions > 0 && <p className="contact-edgeprint">{totalQuestions} questions</p>}
                <h1 className="darkroom-heading">Préparez-vous.</h1>
                <p className="contact-lede">
                  Les questions s'affichent ici, l'une après l'autre. Répondez en regardant la caméra.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Flash au changement de question */}
        <AnimatePresence>
          {flashOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 z-20 pointer-events-none"
              style={{ background: 'var(--paper)' }}
            />
          )}
        </AnimatePresence>

        {phase === 'finishing' && (
          <div className="darkroom-overlay">
            <p className="darkroom-heading">
              {downloadPercent === null ? 'Sauvegarde de la vidéo…' : `Récupération de la vidéo : ${downloadPercent} %`}
            </p>
          </div>
        )}
      </div>

      {phase === 'error' && (
        <div className="darkroom-error contact-paper">
          <h1 className="contact-title">Impossible d'enregistrer l'interview.</h1>
          <p className="contact-lede">{error}</p>
          <button onClick={() => setScreen('video-home')} className="btn-editorial-primary">
            Retour au choix du message
          </button>
        </div>
      )}
    </Screen>
  );
}
