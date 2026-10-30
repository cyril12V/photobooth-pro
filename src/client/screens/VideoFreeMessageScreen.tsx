import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { sounds } from '@shared/lib/sounds';
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
import { ContactBack } from '../components/ContactHeader';
import { VideoNegative, formatTimecode } from '../components/VideoNegative';
import '../../styles/contact-video.css';

type Phase = 'preparing' | 'countdown' | 'recording' | 'finishing' | 'error';

export function VideoFreeMessageScreen() {
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
  const t0Ref = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [elapsed, setElapsed] = useState(0);

  const maxSeconds = settings?.video_max_duration_seconds ?? 30;
  const initialCountdown = settings?.countdown_seconds ?? 3;
  const soundsOn = settings?.sound_enabled ?? true;
  const resolution = (settings?.video_capture_resolution ?? '1080p') as CaptureResolution;
  const previewResolution = settings?.video_preview_resolution ?? '1080p';

  useEffect(() => {
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
    } else if (gpuRecorderRef.current) {
      gpuRecorderRef.current.start();
      t0Ref.current = performance.now();
    } else {
      if (!streamRef.current) return;
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
      recorder.start(VIDEO_RECORDING_SLICE_MS);
    }

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
    const durationMs = Math.round(performance.now() - t0Ref.current);
    if (soundsOn) sounds.recordingEnd();
    const movie = await finishCanonMovie(setDownloadPercent);
    if (typeof movie === 'string') {
      setError(movie);
      setPhase('error');
      return;
    }
    setCameraVideoCapture({ filepath: movie.path, url: movie.url, durationMs, interviewLog: [] });
    setScreen('video-preview');
  };

  const finalize = (mime: string, recorded?: Blob) => {
    try {
      const blob = recorded ?? new Blob(chunksRef.current, { type: mime });
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
    gpuRecorderRef.current?.cancel();
    gpuRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScreen('video-home');
  };

  const remaining = Math.max(0, maxSeconds - elapsed);
  const progressPct = Math.min(100, (elapsed / maxSeconds) * 100);

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
          <VideoNegative event={event} frame={1} timecode={`${formatTimecode(elapsed)} / ${formatTimecode(maxSeconds)}`}>
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
            {phase === 'preparing' ? (
              <p className="darkroom-heading">Un instant, la caméra s'allume.</p>
            ) : (
              <>
                <h1 className="darkroom-heading">Dites un mot aux mariés.</h1>
                {phase === 'countdown' && (
                  <p className="contact-lede">
                    Vous avez {maxSeconds} secondes. L'enregistrement commence après le décompte.
                  </p>
                )}
                {phase === 'recording' && (
                  <>
                    <p className="contact-lede">Encore {remaining.toFixed(0)} s</p>
                    <div className="darkroom-progress">
                      <div className="transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="darkroom-actions">
                      <button onClick={stopRecording} className="btn-editorial-primary">
                        Terminer le message
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

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
          <h1 className="contact-title">Impossible d'enregistrer la vidéo.</h1>
          <p className="contact-lede">{error}</p>
          <button onClick={() => setScreen('video-home')} className="btn-editorial-primary">
            Retour au choix du message
          </button>
        </div>
      )}
    </Screen>
  );
}
