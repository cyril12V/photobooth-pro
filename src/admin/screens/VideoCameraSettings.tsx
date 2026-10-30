import { useState } from 'react';
import { MdCheck, MdMic } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Button } from '@shared/components/Button';
import type { AppSettings } from '@shared/types';
import { AdminCard, AdminPageHeader } from '../components/AdminUI';
import { CameraList, CameraPreview, CanonMovieSwitch, CanonUsbPreview, useMediaInputs } from '../components/CameraTools';
import { MicLevel } from '../components/VideoTests';

const VIDEO_SOURCES: Array<{ id: AppSettings['video_source']; label: string; description: string }> = [
  {
    id: 'canon_hdmi',
    label: 'Appareil Canon + Cam Link (recommandé)',
    description: "Bascule auto en mode vidéo par USB, l'app enregistre la sortie HDMI propre : fluide et sans attente.",
  },
  {
    id: 'webcam',
    label: 'Caméra seule',
    description: "L'app enregistre la caméra choisie ci-dessous. Un appareil branché en HDMI doit déjà être en mode vidéo.",
  },
  {
    id: 'canon',
    label: 'Appareil Canon seul (USB)',
    description: "L'appareil enregistre lui-même (jusqu'en 4K) puis la vidéo est rapatriée : attente après chaque vidéo.",
  },
];

const note: React.CSSProperties = { color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' };

const optionStyle = (active: boolean): React.CSSProperties => ({
  backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
  color: active ? '#FAF6EE' : '#1A1A1A',
  border: '1px solid rgba(212, 184, 150, 0.3)',
  borderRadius: '4px',
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
});

/** Vidéo › Caméra vidéo : source, caméra et micro des vidéos, avec aperçu image et son. */
export function VideoCameraSettings() {
  const { settings, setSettings } = useAppStore();
  const cameras = useMediaInputs('videoinput');
  const mics = useMediaInputs('audioinput');
  const [videoSource, setVideoSource] = useState<AppSettings['video_source']>(settings?.video_source ?? 'webcam');
  const [cameraId, setCameraId] = useState(settings?.video_camera_device_id ?? '');
  const [micId, setMicId] = useState(settings?.microphone_device_id ?? '');
  const [restartKey, setRestartKey] = useState(0);
  const [saved, setSaved] = useState(false);

  const resolution = settings?.video_capture_resolution ?? '1080p';
  // Vide : même caméra que les photos.
  const effectiveCamera = cameraId || settings?.camera_device_id || '';
  const photoCamera = cameras.find((c) => c.deviceId === settings?.camera_device_id)?.label;

  const save = async () => {
    await window.api.settings.set('video_source', videoSource);
    await window.api.settings.set('video_camera_device_id', cameraId);
    await window.api.settings.set('microphone_device_id', micId);
    setSettings(await window.api.settings.get());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader title="Caméra vidéo" description="Choisis la caméra et le micro des vidéos, et vérifie l'image et le son en direct" />

      <div className="space-y-4">
        <AdminCard title="Source vidéo">
          <div className="grid grid-cols-3 gap-3">
            {VIDEO_SOURCES.map((s) => (
              <button key={s.id} onClick={() => setVideoSource(s.id)} className="p-4 text-left transition-colors" style={optionStyle(videoSource === s.id)}>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block mt-1" style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                  {s.description}
                </span>
              </button>
            ))}
          </div>
          {videoSource === 'canon_hdmi' && (
            <p className="mt-3" style={note}>
              Branche l'appareil en USB-C (pour la bascule) et en HDMI sur la Cam Link, choisie ci-dessous. Sa molette reste
              sur P, Av ou M : l'app le passe en mode vidéo pour chaque vidéo puis le remet en photo. Une seule fois sur
              l'appareil, en mode vidéo : règle l'affichage HDMI pour qu'il sorte sans les informations (touche INFO).
            </p>
          )}
          {videoSource === 'canon' && (
            <p className="mt-3" style={note}>
              L'appareil passe tout seul en mode vidéo puis revient en photo : sa molette reste sur P, Av ou M, et la Cam
              Link n'est plus nécessaire. La qualité (4K ou Full HD) se règle dans le menu vidéo de l'appareil, en mode
              standard (pas HDR). Le son vient de l'appareil. Les vidéos restent aussi sur sa carte, en sauvegarde.
            </p>
          )}
        </AdminCard>

        <AdminCard title="Caméra des vidéos">
          {videoSource === 'canon' ? (
            <>
              <p className="mb-3" style={note}>
                L'appareil filme lui-même : voici son aperçu USB en mode vidéo, celui que voient les invités.
              </p>
              <CanonUsbPreview movie />
            </>
          ) : (
            <>
              <CameraList
                devices={cameras}
                value={cameraId}
                onChange={setCameraId}
                emptyOption={{
                  label: 'Même caméra que les photos',
                  description: photoCamera ? `Actuellement : ${photoCamera} (Photo › Caméra photo).` : 'Celle choisie dans Photo › Caméra photo.',
                }}
              />
              <p className="label-editorial mt-5 mb-3" style={{ color: '#6B5D4F' }}>
                Aperçu ({resolution === '4k' ? '4K' : resolution}, réglable dans Vidéo › Vidéo)
              </p>
              <CameraPreview deviceId={effectiveCamera} resolution={resolution} restartKey={restartKey} />
              {videoSource === 'canon_hdmi' && <CanonMovieSwitch onSwitched={() => setRestartKey((k) => k + 1)} />}
            </>
          )}
        </AdminCard>

        <AdminCard title="Micro des vidéos">
          {videoSource === 'canon' ? (
            <p style={note}>Source « Appareil Canon seul » : le son est enregistré par l'appareil, ce réglage n'est pas utilisé.</p>
          ) : (
            <>
              <div className="space-y-2">
                {[{ deviceId: '', label: '' } as Pick<MediaDeviceInfo, 'deviceId' | 'label'>, ...mics].map((d) => {
                  const active = micId === d.deviceId;
                  return (
                    <button
                      key={d.deviceId || 'auto'}
                      onClick={() => setMicId(d.deviceId)}
                      className="w-full flex items-center gap-3 p-3.5 text-left transition-colors"
                      style={optionStyle(active)}
                    >
                      <MdMic size={18} style={{ color: active ? '#D4B896' : '#6B5D4F' }} />
                      <span className="flex-1 text-sm font-medium truncate">
                        {d.deviceId ? (
                          d.label || `Micro ${d.deviceId.slice(0, 8)}`
                        ) : (
                          <>
                            Automatique : son de la caméra (recommandé)
                            <span className="block text-xs font-normal" style={{ opacity: 0.75 }}>
                              Avec la Cam Link : le micro de l'appareil ou celui branché dessus. Sinon, le micro par défaut de Windows.
                            </span>
                          </>
                        )}
                      </span>
                      {active && <MdCheck size={16} style={{ color: '#D4B896' }} />}
                    </button>
                  );
                })}
              </div>
              <MicLevel micId={micId} cameraId={effectiveCamera} />
            </>
          )}
        </AdminCard>

        <Button variant="primary" onClick={save} icon={saved ? <MdCheck size={20} /> : undefined} fullWidth>
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
