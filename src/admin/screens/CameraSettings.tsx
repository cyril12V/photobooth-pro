import { useEffect, useRef, useState } from 'react';
import { MdCameraAlt, MdCheck, MdCameraEnhance, MdVideocam } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

type CaptureSource = 'webcam' | 'dslr';

export function CameraSettings() {
  const { settings, setSettings } = useAppStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState(settings?.camera_device_id ?? '');
  const [flashEnabled, setFlashEnabled] = useState(settings?.flash_enabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(settings?.sound_enabled ?? true);
  const [countdown, setCountdown] = useState(settings?.countdown_seconds ?? 3);
  const [captureSource, setCaptureSource] = useState<CaptureSource>(
    settings?.capture_source ?? 'webcam',
  );
  const [dslrStatus, setDslrStatus] = useState<{
    detected: boolean;
    description?: string;
    testing: boolean;
    testMsg?: string;
    testOk?: boolean;
  }>({ detected: false, testing: false });
  const [saved, setSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (captureSource !== 'dslr') return;
    (async () => {
      const r = await window.api.dslr.detect();
      if (r.found) {
        setDslrStatus({ detected: true, description: r.description, testing: false });
      } else {
        setDslrStatus({ detected: false, testing: false });
      }
    })();
  }, [captureSource]);

  const testDslr = async () => {
    setDslrStatus((s) => ({ ...s, testing: true, testMsg: undefined, testOk: undefined }));
    try {
      const r = await window.api.dslr.start();
      setDslrStatus((s) => ({
        ...s,
        testing: false,
        testOk: r.ok,
        testMsg: r.ok
          ? 'Caméra Canon connectée. Configurée en JPEG Large Fine + SaveTo PC.'
          : r.reason ?? 'Échec',
      }));
    } catch (e) {
      setDslrStatus((s) => ({
        ...s,
        testing: false,
        testOk: false,
        testMsg: e instanceof Error ? e.message : 'Erreur inconnue',
      }));
    }
  };

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
    await window.api.settings.set('capture_source', captureSource);
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
        <AdminCard title="Source de capture">
          <p style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Webcam UVC pour les caméras standards. DSLR (Canon EDSDK) pour piloter
            une Canon en USB tethering — qualité capteur native (24-32 MP) au lieu
            de 1080p UVC bridé. Aucune appli externe nécessaire.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCaptureSource('webcam')}
              className="p-4 text-left transition-colors"
              style={{
                backgroundColor: captureSource === 'webcam' ? '#1A1A1A' : '#F4ECDD',
                color: captureSource === 'webcam' ? '#FAF6EE' : '#1A1A1A',
                border: '1px solid rgba(212, 184, 150, 0.3)',
                borderRadius: '4px',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
            >
              <MdVideocam size={20} style={{ color: captureSource === 'webcam' ? '#D4B896' : '#6B5D4F', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Webcam</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>UVC standard, jusqu'à 1080p</p>
            </button>
            <button
              onClick={() => setCaptureSource('dslr')}
              className="p-4 text-left transition-colors"
              style={{
                backgroundColor: captureSource === 'dslr' ? '#1A1A1A' : '#F4ECDD',
                color: captureSource === 'dslr' ? '#FAF6EE' : '#1A1A1A',
                border: '1px solid rgba(212, 184, 150, 0.3)',
                borderRadius: '4px',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
            >
              <MdCameraEnhance size={20} style={{ color: captureSource === 'dslr' ? '#D4B896' : '#6B5D4F', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>DSLR (Canon)</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>EDSDK direct, full résolution</p>
            </button>
          </div>

          {captureSource === 'dslr' && (
            <div className="mt-5 space-y-3">
              <div
                className="p-3"
                style={{
                  backgroundColor: dslrStatus.detected ? 'rgba(212, 184, 150, 0.15)' : 'rgba(220, 80, 80, 0.1)',
                  borderRadius: '4px',
                  border: '1px solid ' + (dslrStatus.detected ? 'rgba(212, 184, 150, 0.4)' : 'rgba(220, 80, 80, 0.3)'),
                }}
              >
                <p style={{ fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', color: '#1A1A1A' }}>
                  {dslrStatus.detected
                    ? `✓ Caméra détectée : ${dslrStatus.description}`
                    : '✕ Aucune caméra Canon détectée. Branche la cam en USB, allume-la, et vérifie qu\'aucune autre appli ne l\'utilise (EOS Webcam Utility, digiCamControl).'}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={testDslr}
                disabled={!dslrStatus.detected || dslrStatus.testing}
                fullWidth
              >
                {dslrStatus.testing ? 'Test en cours…' : 'Tester la connexion caméra'}
              </Button>
              {dslrStatus.testMsg && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: dslrStatus.testOk ? '#1A1A1A' : '#A33',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {dslrStatus.testOk ? '✓' : '✕'} {dslrStatus.testMsg}
                </p>
              )}
              <div
                className="p-3"
                style={{
                  backgroundColor: '#FAF6EE',
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 184, 150, 0.3)',
                  fontSize: '0.75rem',
                  fontFamily: 'Inter, sans-serif',
                  color: '#6B5D4F',
                  lineHeight: 1.6,
                }}
              >
                <strong>Prérequis :</strong>
                <ol style={{ paddingLeft: '1.2rem', marginTop: '0.4rem' }}>
                  <li>Brancher la Canon en USB, allumée, en mode photo</li>
                  <li>Aucune autre appli ne doit utiliser la cam (quitter EOS Webcam Utility, digiCamControl, etc.)</li>
                </ol>
              </div>
            </div>
          )}
        </AdminCard>

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
