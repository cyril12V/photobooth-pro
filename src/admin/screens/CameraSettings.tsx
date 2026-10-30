import { useEffect, useState } from 'react';
import { MdCheck } from 'react-icons/md';
import { CAPTURE_RESOLUTION_MAP, CAPTURE_RESOLUTIONS, type CaptureResolution } from '@shared/lib/mediaCapture';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';
import type { AppSettings } from '@shared/types';
import { CameraList, CameraPreview, CanonUsbPreview, useMediaInputs } from '../components/CameraTools';

const CAPTURE_SOURCES: Array<{ id: AppSettings['capture_source']; label: string; description: string }> = [
  { id: 'webcam', label: 'Webcam / flux vidéo', description: "La photo est une image tirée du flux de la caméra sélectionnée ci-dessous." },
  { id: 'canon', label: 'Appareil Canon (USB)', description: "L'app déclenche l'appareil et récupère la vraie photo en pleine résolution." },
];

const CANON_PREVIEWS: Array<{ id: AppSettings['canon_preview']; label: string; description: string }> = [
  { id: 'video', label: 'Caméra vidéo sélectionnée', description: 'Aperçu fluide depuis la Cam Link (HDMI), choisie ci-dessous.' },
  { id: 'usb', label: "Aperçu USB de l'appareil", description: "Moins défini, mais n'a besoin que du câble USB." },
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

/** État de l'appareil Canon en une ligne ; connexion, photo test et rapport : Tests › Caméra. */
function CanonStatusLine() {
  const [text, setText] = useState("Recherche de l'appareil…");
  useEffect(() => {
    const refresh = () =>
      window.api.canon.status().then((r) => {
        if (!r.ok || !r.result) return setText(`Appareil Canon : ${r.ok ? 'état inconnu' : r.error}`);
        const s = r.result;
        setText(
          s.connected
            ? `Appareil Canon : ${s.model ?? 'connecté'}, prêt.`
            : s.cameras.length
              ? `Appareil Canon détecté (${s.cameras[0]}), il se connectera à la 1re photo.`
              : 'Aucun appareil Canon détecté : vérifie le câble USB et que l\'appareil est allumé.',
        );
      });
    void refresh();
    return window.api.canon.onState(() => void refresh());
  }, []);
  return (
    <p className="mt-3" style={{ ...note, color: '#1A1A1A', fontWeight: 600 }}>
      {text} <span style={{ fontWeight: 400, color: '#6B5D4F' }}>Connexion, photo test et rapport : Tests › Caméra.</span>
    </p>
  );
}

/** Photo › Caméra photo : source, caméra et aperçu des photos, réglages de la prise de vue. */
export function CameraSettings() {
  const { settings, setSettings } = useAppStore();
  const cameras = useMediaInputs('videoinput');
  const [selectedId, setSelectedId] = useState(settings?.camera_device_id ?? '');
  const [flashEnabled, setFlashEnabled] = useState(settings?.flash_enabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(settings?.sound_enabled ?? true);
  const [countdown, setCountdown] = useState(settings?.countdown_seconds ?? 3);
  const [photoResolution, setPhotoResolution] = useState<CaptureResolution>(settings?.photo_resolution ?? '1080p');
  const [captureSource, setCaptureSource] = useState<AppSettings['capture_source']>(settings?.capture_source ?? 'webcam');
  const [canonPreview, setCanonPreview] = useState<AppSettings['canon_preview']>(settings?.canon_preview ?? 'video');
  const [saved, setSaved] = useState(false);

  const usbPreview = captureSource === 'canon' && canonPreview === 'usb';

  const save = async () => {
    await window.api.settings.set('camera_device_id', selectedId);
    await window.api.settings.set('flash_enabled', flashEnabled);
    await window.api.settings.set('sound_enabled', soundEnabled);
    await window.api.settings.set('countdown_seconds', countdown);
    await window.api.settings.set('photo_resolution', photoResolution);
    await window.api.settings.set('capture_source', captureSource);
    await window.api.settings.set('canon_preview', canonPreview);
    setSettings(await window.api.settings.get());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader title="Caméra photo" description="Choisis comment les photos sont prises et vérifie l'aperçu en direct" />

      <div className="space-y-4">
        <AdminCard title="Source des photos">
          <div className="grid grid-cols-2 gap-3">
            {CAPTURE_SOURCES.map((source) => (
              <button key={source.id} onClick={() => setCaptureSource(source.id)} className="p-4 text-left transition-colors" style={optionStyle(captureSource === source.id)}>
                <span className="block text-sm font-medium">{source.label}</span>
                <span className="block mt-1" style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                  {source.description}
                </span>
              </button>
            ))}
          </div>
          {captureSource === 'canon' && (
            <>
              <p className="label-editorial mt-5 mb-3" style={{ color: '#6B5D4F' }}>
                Aperçu pendant la photo
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CANON_PREVIEWS.map((p) => (
                  <button key={p.id} onClick={() => setCanonPreview(p.id)} className="p-4 text-left transition-colors" style={optionStyle(canonPreview === p.id)}>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block mt-1" style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                      {p.description}
                    </span>
                  </button>
                ))}
              </div>
              <CanonStatusLine />
            </>
          )}
        </AdminCard>

        <AdminCard title="Caméra et aperçu">
          {usbPreview ? (
            <>
              <p className="mb-3" style={note}>
                Aperçu USB de l'appareil, celui que voient les invités avant la photo.
              </p>
              <CanonUsbPreview movie={false} />
            </>
          ) : (
            <>
              <CameraList devices={cameras} value={selectedId} onChange={setSelectedId} />
              <p className="label-editorial mt-5 mb-3" style={{ color: '#6B5D4F' }}>
                Aperçu des invités
              </p>
              <CameraPreview deviceId={selectedId} resolution={photoResolution} />
            </>
          )}
          <p className="mt-3" style={note}>
            Les vidéos ont leur propre réglage de caméra et de micro : Vidéo › Caméra vidéo. N'oublie pas « Enregistrer ».
          </p>
        </AdminCard>

        <AdminCard title="Prise de vue">
          <div className="space-y-4">
            <div>
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Qualité de l'aperçu {captureSource === 'canon' ? '' : 'et des photos'}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {CAPTURE_RESOLUTIONS.map((resolution) => (
                  <button
                    key={resolution}
                    onClick={() => setPhotoResolution(resolution)}
                    className="p-3 text-sm font-medium transition-colors"
                    style={optionStyle(photoResolution === resolution)}
                  >
                    {resolution === '4k' ? '4K' : resolution}
                  </button>
                ))}
              </div>
              <p className="mt-2" style={note}>
                Caméra en {CAPTURE_RESOLUTION_MAP[photoResolution].width}×{CAPTURE_RESOLUTION_MAP[photoResolution].height}.
                {captureSource === 'canon' && " Avec l'appareil Canon, la photo est toujours en pleine résolution : ce réglage ne concerne que l'aperçu."}
              </p>
            </div>
            <div>
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Compte à rebours : {countdown} seconde{countdown > 1 ? 's' : ''}
              </p>
              <input
                type="range"
                min={1}
                max={10}
                value={countdown}
                onChange={(e) => setCountdown(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#1A1A1A' }}
              />
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(212, 184, 150, 0.2)' }}>
              <AdminToggle label="Effet flash à la prise" description="Un éclair blanc rapide simule le flash" value={flashEnabled} onChange={setFlashEnabled} />
              <AdminToggle label="Sons (compte à rebours et déclic)" value={soundEnabled} onChange={setSoundEnabled} />
            </div>
          </div>
        </AdminCard>

        <Button variant="primary" onClick={save} icon={saved ? <MdCheck size={20} /> : undefined} fullWidth>
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
