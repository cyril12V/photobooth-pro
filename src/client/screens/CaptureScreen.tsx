import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdArrowBack, MdErrorOutline } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { sounds } from '@shared/lib/sounds';
import { poseSrc } from '@shared/lib/poseAssets';
import {
  buildVideoTrackConstraints,
  type CaptureResolution,
} from '@shared/lib/mediaCapture';
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
  // null = aucun template : la photo garde le cadrage de la caméra (horizontal en général).
  const [templateRatio, setTemplateRatio] = useState<{ w: number; h: number } | null>(null);
  const [totalSlots, setTotalSlots] = useState(1);
  const [capturedCount, setCapturedCount] = useState(0);
  // Ref pour lire capturedCount synchroniquement dans les callbacks
  const capturedCountRef = useRef(0);

  const countdownDuration = settings?.countdown_seconds ?? 3;
  const soundsOn = settings?.sound_enabled ?? true;
  const flashOn = settings?.flash_enabled ?? true;
  // Appareil Canon en USB : vraie photo déclenchée sur l'appareil. L'aperçu vient
  // de la caméra vidéo sélectionnée (Cam Link HDMI) ou du LiveView USB de l'appareil.
  const canonMode = settings?.capture_source === 'canon';
  const usbPreview = canonMode && settings?.canon_preview === 'usb';
  const [canonConnected, setCanonConnected] = useState(false);
  const ready = streamReady && (!canonMode || canonConnected);
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);
  const canonFrameSeenRef = useRef(false);
  const aliveRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

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
          const elements = Array.isArray(config.elements) ? config.elements : [];
          const slots = elements.filter((el) => el.type === 'photo-slot').length;
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
    let noFrameTimer = 0;
    setCanonConnected(false);
    if (canonMode) {
      canonFrameSeenRef.current = false;
      (async () => {
        const conn = await window.api.canon.connect();
        if (cancelled) return;
        if (!conn.ok) {
          setError(conn.error);
          return;
        }
        setCanonConnected(true);
        if (!usbPreview) return;
        const lv = await window.api.canon.liveview(true);
        if (cancelled) return;
        if (!lv.ok) {
          setError(lv.error);
          return;
        }
        noFrameTimer = window.setTimeout(() => {
          if (!canonFrameSeenRef.current) {
            setError("L'aperçu de l'appareil ne démarre pas. Vérifie qu'il est allumé et en mode photo.");
          }
        }, 10_000);
      })();
    }
    if (usbPreview) {
      return () => {
        cancelled = true;
        window.clearTimeout(noFrameTimer);
        window.api.canon.liveview(false);
      };
    }
    (async () => {
      try {
        // On demande à la caméra sa meilleure résolution disponible — la même
        // que celle réglée pour la vidéo. Plus la source est haute résolution,
        // plus la photo finale est nette (le crop centré 1200×1800 conserve
        // un maximum de détail).
        const resKey = (settings?.photo_resolution ?? '1080p') as CaptureResolution;
        const constraints: MediaStreamConstraints = {
          video: buildVideoTrackConstraints(resKey, settings?.camera_device_id),
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
  }, [canonMode, usbPreview, settings?.camera_device_id, settings?.photo_resolution]);

  const onCanonFirstFrame = useCallback(() => {
    canonFrameSeenRef.current = true;
    setStreamReady(true);
  }, []);

  // ─── Recadre une image source au ratio du template ─────────────────────
  const cropToTemplate = useCallback((source: CanvasImageSource, vw: number, vh: number, mirror: boolean) => {
    // Sans template : image entière, côté long limité à 2400 px (assez pour un tirage 10×15).
    const scale = templateRatio ? 1 : Math.min(1, 2400 / Math.max(vw, vh));
    const targetW = templateRatio ? templateRatio.w : Math.round(vw * scale);
    const targetH = templateRatio ? templateRatio.h : Math.round(vh * scale);
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mirror) {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
    // PNG lossless : élimine la 1re compression — le composer recompresse en
    // JPEG 0.95 une seule fois, pas de cumul d'artefacts.
    return canvas.toDataURL('image/png');
  }, [templateRatio]);

  // ─── Capture une photo et push dans le store ────────────────────────────
  const captureOne = useCallback(async (): Promise<string | null> => {
    if (!ready) return null;
    if (canonMode) {
      // La photo de l'appareil n'est pas inversée (seul l'aperçu l'est, effet miroir).
      const shot = await window.api.canon.capture();
      if (!aliveRef.current) return null;
      if (!shot.ok) {
        setError(shot.error);
        return null;
      }
      const img = new Image();
      img.src = shot.result.url;
      await img.decode();
      return cropToTemplate(img, img.naturalWidth, img.naturalHeight, false);
    }
    const video = videoRef.current;
    if (!video) return null;
    return cropToTemplate(video, video.videoWidth, video.videoHeight, true);
  }, [canonMode, cropToTemplate, ready]);

  const triggerShutterEffects = useCallback(() => {
    if (soundsOn) sounds.shutter();
    if (flashOn) {
      setIsFlashing(true);
      later(() => setIsFlashing(false), 500);
    }
  }, [soundsOn, flashOn]);

  // ─── Séquence de capture (1 ou N photos) ───────────────────────────────
  const runCapture = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    let dataUrl: string | null = null;
    try {
      if (canonMode) {
        // L'appareil met ~1 s (mise au point + transfert) : le flash part au déclenchement.
        triggerShutterEffects();
        setCapturing(true);
      }
      dataUrl = await captureOne();
    } catch (e) {
      console.error('[Capture] échec', e);
      if (aliveRef.current) setError("La photo n'a pas pu être récupérée. Réessaie.");
    } finally {
      capturingRef.current = false;
      if (aliveRef.current) setCapturing(false);
    }
    // L'invité a pu annuler pendant la prise (jusqu'à plusieurs secondes avec l'appareil) :
    // ne plus toucher au store ni naviguer.
    if (!dataUrl || !aliveRef.current) return;
    if (!canonMode) triggerShutterEffects();

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
      later(() => setScreen('preview'), 600);
    } else {
      // Pas encore fini : push et relancer un compte à rebours après une pause
      pushPhoto(dataUrl);
      later(() => setCountdown(countdownDuration), 1500);
    }
  }, [canonMode, captureOne, triggerShutterEffects, totalSlots, setCurrentPhoto, pushPhoto, setScreen, countdownDuration]);

  // ─── Lance le compte à rebours auto une fois prêt ───────────────────────
  useEffect(() => {
    if (!ready || error) return;
    // Vide les photos précédentes avant une nouvelle séquence
    clearPhotos();
    capturedCountRef.current = 0;
    setCapturedCount(0);
    const startTimer = setTimeout(() => setCountdown(countdownDuration), 1500);
    return () => clearTimeout(startTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, error, countdownDuration]);

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

  const aspectRatioString = templateRatio ? `${templateRatio.w} / ${templateRatio.h}` : '';
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
          fontSize: '0.8125rem',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <MdArrowBack size={18} />
        <span>Annuler</span>
      </button>

      {/* Label discret en haut (sans pastille pleine) */}
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 z-30"
        style={{
          color: '#FAF6EE',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.32em',
          opacity: 0.85,
        }}
      >
        {totalSlots > 1
          ? `Cliché ${Math.min(capturedCount + 1, totalSlots)} sur ${totalSlots}`
          : 'Capture'}
      </div>

      {/* Pose à imiter — card discrète bas-droite */}
      {mode === 'challenge' && currentPose && (
        <motion.div
          key={currentPose.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute z-30"
          style={{
            bottom: '3rem',
            right: '3rem',
            width: '11rem',
            padding: '0.875rem',
            backgroundColor: '#FAF6EE',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.625rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#6B5D4F',
              marginBottom: '0.5rem',
            }}
          >
            À imiter
          </p>
          <img
            src={poseSrc(currentPose.image_path)}
            alt={currentPose.label}
            className="w-full object-contain"
            style={{ height: '6rem', borderRadius: '2px', marginBottom: '0.5rem' }}
          />
          <p
            className="text-center"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500,
              fontSize: '0.875rem',
              color: '#1A1A1A',
              letterSpacing: '0.01em',
            }}
          >
            {currentPose.label}
          </p>
        </motion.div>
      )}

      {/* Aperçu plein écran (inversé façon miroir) */}
      {usbPreview ? (
        <CanonLiveView
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          onFirstFrame={onCanonFirstFrame}
        />
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

      {capturing && !error && (
        <div
          className="absolute z-30"
          style={{ bottom: '4rem', left: '50%', transform: 'translateX(-50%)' }}
        >
          <span
            style={{
              color: '#FAF6EE',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}
          >
            Photo en cours…
          </span>
        </div>
      )}

      {/* Guide de recadrage — cadre éditorial fin doré (seulement avec un template) */}
      {ready && !error && templateRatio && (
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
                fontSize: 'clamp(8rem, 20vw, 16rem)',
                fontWeight: 700,
                color: '#FAF6EE',
                letterSpacing: '-0.03em',
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-30"
            style={{ bottom: '4rem', left: '50%', transform: 'translateX(-50%)' }}
          >
            <span
              style={{
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.75rem',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                opacity: 0.85,
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

