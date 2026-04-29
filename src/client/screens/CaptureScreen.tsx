import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdArrowBack, MdErrorOutline } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { sounds } from '@shared/lib/sounds';
import { poseSrc } from '@shared/lib/poseAssets';
import type { TemplateConfig } from '@shared/types';

export function CaptureScreen() {
  const { setScreen, setCurrentPhoto, pushPhoto, clearPhotos, mode, selectedPose, selectedPoses, settings } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  // Données du template actif (ratio + nombre de slots)
  const [templateRatio, setTemplateRatio] = useState<{ w: number; h: number }>({ w: 1200, h: 1800 });
  const [totalSlots, setTotalSlots] = useState(1);
  const [capturedCount, setCapturedCount] = useState(0);
  // Ref pour lire capturedCount synchroniquement dans les callbacks
  const capturedCountRef = useRef(0);

  const countdownDuration = settings?.countdown_seconds ?? 3;
  const soundsOn = settings?.sound_enabled ?? true;
  const flashOn = settings?.flash_enabled ?? true;

  // ─── Charge le template actif au montage ───────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const templates = await window.api.template.list();
        if (templates.length > 0) {
          const config = JSON.parse(templates[0].config_json) as TemplateConfig;
          const w = config.canvas_width || 1200;
          const h = config.canvas_height || 1800;
          setTemplateRatio({ w, h });
          const slots = config.elements.filter((el) => el.type === 'photo-slot').length;
          setTotalSlots(slots > 0 ? slots : 1);
        }
      } catch {
        // Fallback portrait 2:3
      }
    })();
  }, []);

  // ─── Démarre la caméra ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            deviceId: settings?.camera_device_id
              ? { exact: settings.camera_device_id }
              : undefined,
          },
          audio: false,
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
          setStreamReady(true);
        }
      } catch (e: unknown) {
        const err = e as { name?: string };
        setError(
          err.name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Vérifiez les autorisations.'
            : 'Aucune caméra disponible. Vérifiez le branchement.',
        );
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [settings?.camera_device_id]);

  // ─── Capture une photo et push dans le store ────────────────────────────
  const captureOne = useCallback((): string | null => {
    if (!videoRef.current || !streamReady) return null;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const targetW = templateRatio.w;
    const targetH = templateRatio.h;
    const targetRatioVal = targetW / targetH;
    const videoRatio = vw / vh;

    let srcW: number, srcH: number, srcX: number, srcY: number;
    if (videoRatio > targetRatioVal) {
      srcH = vh;
      srcW = Math.round(vh * targetRatioVal);
      srcX = Math.round((vw - srcW) / 2);
      srcY = 0;
    } else {
      srcW = vw;
      srcH = Math.round(vw / targetRatioVal);
      srcX = 0;
      srcY = Math.round((vh - srcH) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [streamReady, templateRatio]);

  // ─── Séquence de capture (1 ou N photos) ───────────────────────────────
  const runCapture = useCallback(() => {
    const dataUrl = captureOne();
    if (!dataUrl) return;

    if (soundsOn) sounds.shutter();
    if (flashOn) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 500);
    }

    const next = capturedCountRef.current + 1;
    capturedCountRef.current = next;
    setCapturedCount(next);

    if (next >= totalSlots) {
      // Dernière photo : on finalise
      if (totalSlots === 1) {
        // Mode 1 photo : utilise setCurrentPhoto (rétrocompat)
        setCurrentPhoto(dataUrl, null);
      } else {
        // Multi-photo : on push la dernière puis on navigue
        pushPhoto(dataUrl);
      }
      setTimeout(() => setScreen('preview'), 600);
    } else {
      // Pas encore fini : push et relancer un compte à rebours après une pause
      pushPhoto(dataUrl);
      setTimeout(() => {
        setCountdown(countdownDuration);
      }, 1500);
    }
  }, [captureOne, totalSlots, soundsOn, flashOn, setCurrentPhoto, pushPhoto, setScreen, countdownDuration]);

  // ─── Lance le compte à rebours auto une fois prêt ───────────────────────
  useEffect(() => {
    if (!streamReady || error) return;
    // Vide les photos précédentes avant une nouvelle séquence
    clearPhotos();
    capturedCountRef.current = 0;
    setCapturedCount(0);
    const startTimer = setTimeout(() => setCountdown(countdownDuration), 1500);
    return () => clearTimeout(startTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamReady, error, countdownDuration]);

  // ─── Tick du compte à rebours ───────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      runCapture();
      setCountdown(null);
      return;
    }
    if (soundsOn) sounds.tick();
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, runCapture, soundsOn]);

  const aspectRatioString = `${templateRatio.w} / ${templateRatio.h}`;
  const currentPose = selectedPoses[capturedCount] ?? selectedPose;

  return (
    <Screen className="flex items-center justify-center" >
      {/* Fond éditorial noir pour la prise (contraste, focus sur la photo) */}
      <div className="absolute inset-0" style={{ backgroundColor: '#1A1A1A' }} />

      {/* Bouton retour ghost */}
      <button
        onClick={() => setScreen('home')}
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

      {/* Bandeau top — label éditorial */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 z-30 px-6"
        style={{
          color: '#FAF6EE',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
        }}
      >
        {totalSlots > 1
          ? `Cliché ${Math.min(capturedCount + 1, totalSlots)} sur ${totalSlots}`
          : 'Capture en cours'}
      </div>

      {/* Pose à imiter — card éditoriale crème */}
      {mode === 'challenge' && currentPose && (
        <motion.div
          key={currentPose.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-20 right-8 z-30 p-4 w-52"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '4px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <p
            className="mb-2"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#1A1A1A',
            }}
          >
            À imiter
          </p>
          <img
            src={poseSrc(currentPose.image_path)}
            alt={currentPose.label}
            className="w-full h-32 object-contain mb-2"
            style={{ borderRadius: '2px' }}
          />
          <p
            className="text-center"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 600,
              fontSize: '1rem',
              color: '#1A1A1A',
              letterSpacing: '0.02em',
            }}
          >
            {currentPose.label}
          </p>
        </motion.div>
      )}

      {/* Vidéo plein écran */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Guide de recadrage — cadre éditorial fin doré */}
      {streamReady && !error && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <div
            className="relative h-[86vh]"
            style={{
              aspectRatio: aspectRatioString,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              border: '1px solid #FAF6EE',
              borderRadius: '4px',
            }}
          >
            {/* Coins éditoriaux */}
            <div className="absolute -top-1 -left-1 w-8 h-8" style={{ borderTop: '2px solid #FAF6EE', borderLeft: '2px solid #FAF6EE' }} />
            <div className="absolute -top-1 -right-1 w-8 h-8" style={{ borderTop: '2px solid #FAF6EE', borderRight: '2px solid #FAF6EE' }} />
            <div className="absolute -bottom-1 -left-1 w-8 h-8" style={{ borderBottom: '2px solid #FAF6EE', borderLeft: '2px solid #FAF6EE' }} />
            <div className="absolute -bottom-1 -right-1 w-8 h-8" style={{ borderBottom: '2px solid #FAF6EE', borderRight: '2px solid #FAF6EE' }} />
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40"
          style={{ backgroundColor: '#F4ECDD' }}
        >
          <div
            className="p-12 max-w-lg text-center"
            style={{
              backgroundColor: '#FAF6EE',
              borderRadius: '4px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
            }}
          >
            <MdErrorOutline size={48} className="mx-auto mb-6" style={{ color: '#1A1A1A' }} />
            <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
              Erreur
            </p>
            <h3
              className="font-editorial mb-4"
              style={{ fontSize: '2.5rem', color: '#1A1A1A', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              Caméra indisponible
            </h3>
            <p
              className="mb-8"
              style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.6 }}
            >
              {error}
            </p>
            <button onClick={() => setScreen('home')} className="btn-editorial-primary">
              Retour à l'accueil
            </button>
          </div>
        </div>
      )}

      {/* Compte à rebours éditorial — Didone géant blanc */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
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

      {/* "Souriez" éditorial — pas en mode challenge */}
      <AnimatePresence>
        {mode !== 'challenge' && countdown !== null && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-30"
            style={{ bottom: '7rem', left: '50%', transform: 'translateX(-50%)' }}
          >
            <span
              className="label-editorial px-8 py-4"
              style={{
                color: '#1A1A1A',
                backgroundColor: '#FAF6EE',
                fontSize: '0.875rem',
                letterSpacing: '0.4em',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Souriez
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash */}
      {isFlashing && <div className="flash-overlay flash-active" />}
    </Screen>
  );
}
