import { useEffect, useRef, useState } from 'react';
import { MdCameraAlt, MdCheck } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

export function CameraSettings() {
  const { settings, setSettings } = useAppStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState(settings?.camera_device_id ?? '');
  const [flashEnabled, setFlashEnabled] = useState(settings?.flash_enabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(settings?.sound_enabled ?? true);
  const [countdown, setCountdown] = useState(settings?.countdown_seconds ?? 3);
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
          video: { deviceId: { exact: selectedId } },
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
      }
    };
  }, [selectedId]);

  const save = async () => {
    await window.api.settings.set('camera_device_id', selectedId);
    await window.api.settings.set('flash_enabled', flashEnabled);
    await window.api.settings.set('sound_enabled', soundEnabled);
    await window.api.settings.set('countdown_seconds', countdown);
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
