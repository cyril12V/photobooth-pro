import { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
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
            <p className="text-neutral-500 text-sm">Aucune caméra détectée. Branchez votre webcam ou reflex.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => setSelectedId(d.deviceId)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-colors
                    ${selectedId === d.deviceId
                      ? 'bg-neutral-900 text-white border border-neutral-900'
                      : 'bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                    }`}
                >
                  <Camera size={18} className={selectedId === d.deviceId ? 'text-[#d4a574]' : 'text-neutral-400'} />
                  <span className="flex-1 text-sm truncate font-medium">
                    {d.label || `Caméra ${d.deviceId.slice(0, 8)}`}
                  </span>
                  {selectedId === d.deviceId && <Check size={16} className="text-[#d4a574]" />}
                </button>
              ))}
            </div>
          )}

          {selectedId && (
            <div className="mt-5">
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">Aperçu</p>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 object-contain bg-neutral-900 rounded-xl"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          )}
        </AdminCard>

        <AdminCard title="Capture">
          <div className="space-y-4">
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Compte à rebours : {countdown} seconde{countdown > 1 ? 's' : ''}
              </p>
              <input
                type="range"
                min={1}
                max={10}
                value={countdown}
                onChange={(e) => setCountdown(Number(e.target.value))}
                className="w-full accent-neutral-900"
              />
            </div>
            <div className="divide-y divide-neutral-100">
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
          variant="secondary"
          onClick={save}
          icon={saved ? <Check size={20} /> : undefined}
          fullWidth
        >
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
