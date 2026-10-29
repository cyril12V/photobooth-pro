import { useEffect, useRef, useState } from 'react';
import { MdCameraAlt, MdCheck } from 'react-icons/md';
import {
  CAPTURE_RESOLUTION_MAP,
  CAPTURE_RESOLUTIONS,
  buildVideoTrackConstraints,
  type CaptureResolution,
} from '@shared/lib/mediaCapture';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';
import type { AppSettings } from '@shared/types';
import { CanonCameraPanel } from './CanonCameraPanel';

const CAPTURE_SOURCES: Array<{ id: AppSettings['capture_source']; label: string; description: string }> = [
  { id: 'webcam', label: 'Webcam / flux vidéo', description: "La photo est une image tirée du flux de la caméra sélectionnée ci-dessous." },
  { id: 'canon', label: 'Appareil Canon (USB)', description: "L'app déclenche l'appareil et récupère la vraie photo en pleine résolution." },
];

const CANON_PREVIEWS: Array<{ id: AppSettings['canon_preview']; label: string; description: string }> = [
  { id: 'video', label: 'Caméra vidéo sélectionnée', description: 'Aperçu fluide depuis la Cam Link (HDMI), comme pour la vidéo.' },
  { id: 'usb', label: "Aperçu USB de l'appareil", description: "Moins défini, mais n'a besoin que du câble USB." },
];

export function CameraSettings() {
  const { settings, setSettings } = useAppStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState(settings?.camera_device_id ?? '');
  const [flashEnabled, setFlashEnabled] = useState(settings?.flash_enabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(settings?.sound_enabled ?? true);
  const [countdown, setCountdown] = useState(settings?.countdown_seconds ?? 3);
  const [photoResolution, setPhotoResolution] = useState<CaptureResolution>(
    settings?.photo_resolution ?? '1080p',
  );
  const [captureSource, setCaptureSource] = useState<AppSettings['capture_source']>(
    settings?.capture_source ?? 'webcam',
  );
  const [canonPreview, setCanonPreview] = useState<AppSettings['canon_preview']>(
    settings?.canon_preview ?? 'video',
  );
  const [saved, setSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {}
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'videoinput'));
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: buildVideoTrackConstraints(photoResolution, selectedId),
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [photoResolution, selectedId]);

  const save = async () => {
    await window.api.settings.set('camera_device_id', selectedId);
    await window.api.settings.set('flash_enabled', flashEnabled);
    await window.api.settings.set('sound_enabled', soundEnabled);
    await window.api.settings.set('countdown_seconds', countdown);
    await window.api.settings.set('photo_resolution', photoResolution);
    await window.api.settings.set('capture_source', captureSource);
    await window.api.settings.set('canon_preview', canonPreview);
    const newSettings = await window.api.settings.get();
    setSettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader
        title="Caméra"
        description="Choisissez votre caméra et configurez le déclenchement"
      />

      <div className="space-y-4">
        <AdminCard title="Source des photos">
          <div className="grid grid-cols-2 gap-3">
            {CAPTURE_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => setCaptureSource(source.id)}
                className="p-4 text-left transition-colors"
                style={{
                  backgroundColor: captureSource === source.id ? '#1A1A1A' : '#F4ECDD',
                  color: captureSource === source.id ? '#FAF6EE' : '#1A1A1A',
                  border: '1px solid rgba(212, 184, 150, 0.3)',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >
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
                  <button
                    key={p.id}
                    onClick={() => setCanonPreview(p.id)}
                    className="p-4 text-left transition-colors"
                    style={{
                      backgroundColor: canonPreview === p.id ? '#1A1A1A' : '#F4ECDD',
                      color: canonPreview === p.id ? '#FAF6EE' : '#1A1A1A',
                      border: '1px solid rgba(212, 184, 150, 0.3)',
                      borderRadius: '4px',
                      fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block mt-1" style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                      {p.description}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="mt-3" style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}>
            Les vidéos utilisent toujours la caméra sélectionnée plus bas (Cam Link). N'oublie pas « Enregistrer ».
          </p>
        </AdminCard>

        {captureSource === 'canon' && <CanonCameraPanel videoDeviceId={selectedId} />}

        <AdminCard title="Sélection caméra">
          {devices.length === 0 ? (
            <p style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>Aucune caméra détectée. Branchez votre webcam ou reflex.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => setSelectedId(d.deviceId)}
                  className="w-full flex items-center gap-3 p-3.5 text-left transition-colors"
                  style={{
                    backgroundColor: selectedId === d.deviceId ? '#1A1A1A' : '#F4ECDD',
                    color: selectedId === d.deviceId ? '#FAF6EE' : '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.3)',
                    borderRadius: '4px',
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  <MdCameraAlt size={18} style={{ color: selectedId === d.deviceId ? '#D4B896' : '#6B5D4F' }} />
                  <span className="flex-1 text-sm truncate font-medium">
                    {d.label || `Caméra ${d.deviceId.slice(0, 8)}`}
                  </span>
                  {selectedId === d.deviceId && <MdCheck size={16} style={{ color: '#D4B896' }} />}
                </button>
              ))}
            </div>
          )}

          {selectedId && (
            <div className="mt-5">
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>Aperçu</p>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 object-contain"
                style={{ backgroundColor: '#1A1A1A', borderRadius: '4px', transform: 'scaleX(-1)' }}
              />
            </div>
          )}
        </AdminCard>

        <AdminCard title="Capture">
          <div className="space-y-4">
            <div>
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Qualité photo
              </p>
              <div className="grid grid-cols-4 gap-3">
                {CAPTURE_RESOLUTIONS.map((resolution) => (
                  <button
                    key={resolution}
                    onClick={() => setPhotoResolution(resolution)}
                    className="p-3 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: photoResolution === resolution ? '#1A1A1A' : '#F4ECDD',
                      color: photoResolution === resolution ? '#FAF6EE' : '#1A1A1A',
                      border: '1px solid rgba(212, 184, 150, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {resolution === '4k' ? '4K' : resolution}
                  </button>
                ))}
              </div>
              <p
                className="mt-2"
                style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}
              >
                Source caméra photo : {CAPTURE_RESOLUTION_MAP[photoResolution].width}×{CAPTURE_RESOLUTION_MAP[photoResolution].height}
              </p>
              <p
                className="mt-1"
                style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}
              >
                Indépendant de la vidéo : tu peux capturer les photos en 4K et garder la vidéo en 1080p (réglage séparé dans Vidéo › Vidéo).
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
              <AdminToggle
                label="Effet flash à la prise"
                description="Un éclair blanc rapide simule le flash"
                value={flashEnabled}
                onChange={setFlashEnabled}
              />
              <AdminToggle
                label="Sons (compte à rebours et déclic)"
                value={soundEnabled}
                onChange={setSoundEnabled}
              />
            </div>
          </div>
        </AdminCard>

        <Button
          variant="primary"
          onClick={save}
          icon={saved ? <MdCheck size={20} /> : undefined}
          fullWidth
        >
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
