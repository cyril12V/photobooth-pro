import { useEffect, useRef, useState } from 'react';
import { MdCameraAlt, MdCheck } from 'react-icons/md';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { Button } from '@shared/components/Button';
import { releaseCanonMovie, switchCanonToMovieForHdmi } from '@shared/lib/canonMovie';
import { buildVideoTrackConstraints, type CaptureResolution } from '@shared/lib/mediaCapture';

const small: React.CSSProperties = { color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' };
const previewBox: React.CSSProperties = { backgroundColor: '#1A1A1A', borderRadius: '4px' };

const optionStyle = (active: boolean): React.CSSProperties => ({
  backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
  color: active ? '#FAF6EE' : '#1A1A1A',
  border: '1px solid rgba(212, 184, 150, 0.3)',
  borderRadius: '4px',
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
});

/** Caméras branchées, mises à jour quand on en branche ou débranche une (Cam Link…). */
export function useMediaInputs(kind: 'videoinput' | 'audioinput') {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const load = async () => setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind));
    void load();
    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => navigator.mediaDevices.removeEventListener('devicechange', load);
  }, [kind]);
  return devices;
}

/** Choix d'une caméra ; `emptyOption` ajoute en tête un choix « valeur vide ». */
export function CameraList({
  devices,
  value,
  onChange,
  emptyOption,
}: {
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (id: string) => void;
  emptyOption?: { label: string; description: string };
}) {
  const missing = value && !devices.some((d) => d.deviceId === value);
  const row = (id: string, label: React.ReactNode) => (
    <button
      key={id || 'empty'}
      onClick={() => onChange(id)}
      className="w-full flex items-center gap-3 p-3.5 text-left transition-colors"
      style={optionStyle(value === id)}
    >
      <MdCameraAlt size={18} style={{ color: value === id ? '#D4B896' : '#6B5D4F' }} />
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
      {value === id && <MdCheck size={16} style={{ color: '#D4B896' }} />}
    </button>
  );
  return (
    <div className="space-y-2">
      {emptyOption &&
        row(
          '',
          <>
            {emptyOption.label}
            <span className="block text-xs font-normal" style={{ opacity: 0.75 }}>
              {emptyOption.description}
            </span>
          </>,
        )}
      {devices.map((d) => row(d.deviceId, d.label || `Caméra ${d.deviceId.slice(0, 8)}`))}
      {devices.length === 0 && (
        <p style={{ ...small, fontSize: '0.875rem' }}>Aucune caméra détectée. Branche la Cam Link ou la webcam.</p>
      )}
      {missing && (
        <p style={{ ...small, color: '#9B2C2C', fontWeight: 600 }}>
          La caméra enregistrée n'est pas branchée : rebranche-la ou choisis-en une autre.
        </p>
      )}
    </div>
  );
}

/**
 * Aperçu en direct d'une caméra, en miroir comme sur l'écran des invités, avec la
 * résolution et les images par seconde réellement reçues.
 */
export function CameraPreview({
  deviceId,
  resolution,
  paused = false,
  restartKey = 0,
}: {
  deviceId: string;
  resolution: CaptureResolution;
  /** Libère la caméra (pendant un test qui l'utilise). */
  paused?: boolean;
  /** Changer la valeur rouvre la caméra (après une bascule photo/vidéo de l'appareil). */
  restartKey?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [info, setInfo] = useState<{ text: string; bad: boolean }>({ text: 'Ouverture de la caméra…', bad: false });

  useEffect(() => {
    if (paused) {
      setInfo({ text: 'Aperçu en pause pendant le test.', bad: false });
      return;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let frames = 0;
    setInfo({ text: 'Ouverture de la caméra…', bad: false });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: buildVideoTrackConstraints(resolution, deviceId || undefined) });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const onFrame = () => {
          frames++;
          if (!stopped) video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
        const track = stream.getVideoTracks()[0];
        timer = window.setInterval(() => {
          const s = track.getSettings();
          setInfo(
            frames === 0
              ? { text: `${track.label} : aucune image reçue. Vérifie le câble HDMI et que l'appareil est allumé.`, bad: true }
              : { text: `${track.label} · ${s.width}×${s.height} · ${frames} i/s`, bad: frames < 20 },
          );
          frames = 0;
        }, 1000);
      } catch (e) {
        const name = (e as { name?: string }).name;
        setInfo({
          text:
            name === 'NotReadableError'
              ? 'Caméra déjà utilisée par un autre logiciel (EOS Utility, OBS, Zoom…) : ferme-le.'
              : name === 'OverconstrainedError' || name === 'NotFoundError'
                ? 'Caméra introuvable : rebranche-la ou choisis-en une autre.'
                : `Aperçu impossible : ${e instanceof Error ? e.message : String(e)}`,
          bad: true,
        });
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [deviceId, resolution, paused, restartKey]);

  return (
    <div>
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full max-h-72 object-contain"
        style={{ ...previewBox, transform: 'scaleX(-1)', display: paused ? 'none' : 'block' }}
      />
      <p className="mt-2" style={{ ...small, color: info.bad ? '#9B2C2C' : '#6B5D4F', fontWeight: info.bad ? 600 : 400 }}>
        {info.text}
      </p>
    </div>
  );
}

/**
 * Aperçu USB de l'appareil Canon (LiveView), en mode photo ou vidéo.
 * Démarré à l'affichage, arrêté (et l'appareil remis en photo) en le quittant.
 */
export function CanonUsbPreview({ movie }: { movie: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const steps = [
        () => window.api.canon.connect(),
        ...(movie ? [() => window.api.canon.movieMode(true)] : []),
        () => window.api.canon.liveview(true),
      ];
      for (const step of steps) {
        const r = await step();
        if (stopped) return;
        if (!r.ok) return setError(r.error);
      }
      setLive(true);
    })();
    return () => {
      stopped = true;
      void (movie ? releaseCanonMovie(false) : window.api.canon.liveview(false));
    };
  }, [movie]);

  if (error) return <p style={{ ...small, color: '#9B2C2C', fontWeight: 600 }}>Aperçu USB impossible : {error}</p>;
  return (
    <div>
      <CanonLiveView className="w-full max-h-72 object-contain" style={{ ...previewBox, transform: 'scaleX(-1)' }} />
      <p className="mt-2" style={small}>
        {live ? `Aperçu USB de l'appareil (${movie ? 'mode vidéo' : 'mode photo'}).` : "Connexion à l'appareil…"}
      </p>
    </div>
  );
}

/**
 * Source « Appareil Canon + Cam Link » : passe l'appareil en mode vidéo pour voir l'image
 * HDMI propre et entendre son son, comme pendant une vidéo. Remis en photo en quittant.
 */
export function CanonMovieSwitch({ onSwitched, disabled = false }: { onSwitched: () => void; disabled?: boolean }) {
  const [state, setState] = useState<'photo' | 'switching' | 'movie'>('photo');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () => () => {
      if (stateRef.current !== 'photo') void releaseCanonMovie(false);
    },
    [],
  );

  const toggle = async () => {
    setError(null);
    const toMovie = state === 'photo';
    setState('switching');
    if (toMovie) {
      const err = await switchCanonToMovieForHdmi();
      if (err) {
        setError(err);
        setState('photo');
        return;
      }
    } else {
      await releaseCanonMovie(false);
      await new Promise((r) => setTimeout(r, 1500));
    }
    setState(toMovie ? 'movie' : 'photo');
    onSwitched();
  };

  return (
    <div className="mt-3">
      <Button variant="secondary" size="md" onClick={toggle} disabled={disabled || state === 'switching'}>
        {state === 'switching'
          ? 'Bascule de l’appareil…'
          : state === 'movie'
            ? 'Remettre l’appareil en mode photo'
            : 'Voir comme pendant une vidéo (appareil en mode vidéo)'}
      </Button>
      <p className="mt-2" style={{ ...small, color: error ? '#9B2C2C' : '#6B5D4F' }}>
        {error ??
          (state === 'movie'
            ? "Appareil en mode vidéo : l'image doit être propre (sans les réglages) et la barre du micro doit bouger quand on parle."
            : "En mode photo, la sortie HDMI montre les réglages de l'appareil et ne transmet pas le son.")}
      </p>
    </div>
  );
}
