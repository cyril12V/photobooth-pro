import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { sounds } from '@shared/lib/sounds';
import { poseSrc } from '@shared/lib/poseAssets';
import type { TemplateConfig } from '@shared/types';

export function CaptureScreen() {
  const { setScreen, setCurrentPhoto, pushPhoto, clearPhotos, mode, selectedPose, settings } = useAppStore();
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

  return (
    <Screen className="flex items-center justify-center bg-black">
      {/* Bouton retour */}
      <button
        onClick={() => setScreen('home')}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-black/40 border border-white/20 text-white/80 hover:text-white backdrop-blur transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Annuler</span>
      </button>

      {/* Indicateur multi-photo */}
      {totalSlots > 1 && streamReady && !error && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full"
          style={{
            background: 'rgba(250,246,239,0.95)',
            border: '1px solid rgba(212,165,116,0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="text-sm font-medium" style={{ color: '#5a3e2b' }}>
            Photo {Math.min(capturedCount + 1, totalSlots)} / {totalSlots}
          </span>
        </div>
      )}

      {/* Pose à imiter (mode challenge) */}
      {mode === 'challenge' && selectedPose && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-6 right-6 z-30 rounded-3xl p-4 w-48"
          style={{
            background: 'rgba(250,246,239,0.92)',
            border: '1px solid rgba(212,165,116,0.3)',
            boxShadow: '0 8px 32px rgba(90,60,40,0.15)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-xs uppercase tracking-widest mb-2 font-sans font-medium" style={{ color: '#c8956a' }}>
            À imiter
          </p>
          <img
            src={poseSrc(selectedPose.image_path)}
            alt={selectedPose.label}
            className="w-full h-32 object-contain rounded-xl mb-2"
          />
          <p className="text-sm font-medium text-center" style={{ color: '#2a1a10' }}>
            {selectedPose.label}
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

      {/* Guide de recadrage — ratio du template */}
      {streamReady && !error && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <div
            className="relative h-[88vh] rounded-3xl"
            style={{
              aspectRatio: aspectRatioString,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              border: '2px solid rgba(212,165,116,0.7)',
            }}
          />
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(250,246,239,0.95)', backdropFilter: 'blur(20px)' }}>
          <div
            className="rounded-3xl p-12 max-w-lg text-center"
            style={{
              background: 'rgba(255,255,255,0.8)',
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
              Oups...
            </h3>
            <p className="text-lg mb-6 font-light" style={{ color: '#5a3e2b' }}>{error}</p>
            <button
              onClick={() => setScreen('home')}
              className="px-6 py-3 rounded-full bg-white/80 border border-[#d4a574]/30 hover:bg-white transition-colors font-medium"
              style={{ color: '#5a3e2b' }}
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      )}

      {/* Compte à rebours géant */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="relative">
              <div className="absolute inset-0 blur-3xl" style={{ background: 'rgba(212,165,116,0.35)' }} />
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

      {/* Souriez ! */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-32 left-1/2 -translate-x-1/2 px-10 py-5 rounded-full z-30"
            style={{
              background: 'rgba(250,246,239,0.95)',
              border: '1px solid rgba(212,165,116,0.4)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <span
              className="block text-center"
              style={{
                fontFamily: '"Allura", cursive',
                fontSize: '3rem',
                lineHeight: 1,
                color: '#2a1a10',
                whiteSpace: 'nowrap',
              }}
            >
              Souriez !
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash */}
      {isFlashing && <div className="flash-overlay flash-active" />}
    </Screen>
  );
}
