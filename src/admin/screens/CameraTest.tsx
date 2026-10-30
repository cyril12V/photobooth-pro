import { useState } from 'react';
import { useAppStore } from '@shared/store';
import { videoCameraId } from '@shared/lib/mediaCapture';
import { AdminCard, AdminPageHeader } from '../components/AdminUI';
import { CameraPreview, CanonMovieSwitch, CanonUsbPreview } from '../components/CameraTools';
import { CanonVideoTest, MicLevel, RecordingTest } from '../components/VideoTests';
import { CanonCameraPanel } from './CanonCameraPanel';

const note: React.CSSProperties = { color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' };

const tabStyle = (active: boolean): React.CSSProperties => ({
  backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
  color: active ? '#FAF6EE' : '#1A1A1A',
  border: '1px solid rgba(212, 184, 150, 0.3)',
  borderRadius: '4px',
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
});

/**
 * Tests › Caméra : tout vérifier avant l'évènement avec les réglages enregistrés
 * (Photo › Caméra photo et Vidéo › Caméra vidéo) : appareil Canon, aperçus, enregistrement.
 */
export function CameraTest() {
  const { settings } = useAppStore();
  const [view, setView] = useState<'photo' | 'video'>('photo');
  const [testing, setTesting] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [switchKey, setSwitchKey] = useState(0);

  const photoCamera = settings?.camera_device_id ?? '';
  const videoCamera = videoCameraId(settings);
  const videoSource = settings?.video_source ?? 'webcam';
  const usesCanon = settings?.capture_source === 'canon' || videoSource !== 'webcam';
  const photoUsb = settings?.capture_source === 'canon' && settings?.canon_preview === 'usb';
  const videoResolution = settings?.video_capture_resolution ?? '1080p';

  return (
    <>
      <AdminPageHeader
        title="Tester la caméra"
        description="Vérifie l'appareil, l'image et le son avant l'évènement, avec les réglages enregistrés"
      />

      <div className="space-y-4">
        {usesCanon ? (
          <CanonCameraPanel videoDeviceId={photoUsb ? '' : photoCamera} />
        ) : (
          <AdminCard title="Appareil Canon (USB)">
            <p style={note}>Aucun réglage n'utilise l'appareil Canon (Photo › Caméra photo et Vidéo › Caméra vidéo).</p>
          </AdminCard>
        )}

        <AdminCard title="Aperçu des invités">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button className="p-3 text-sm font-medium" style={tabStyle(view === 'photo')} onClick={() => setView('photo')}>
              Photo
            </button>
            <button className="p-3 text-sm font-medium" style={tabStyle(view === 'video')} onClick={() => setView('video')}>
              Vidéo
            </button>
          </div>
          {view === 'photo' ? (
            photoUsb ? (
              <CanonUsbPreview movie={false} />
            ) : (
              <CameraPreview deviceId={photoCamera} resolution={settings?.photo_resolution ?? '1080p'} />
            )
          ) : videoSource === 'canon' ? (
            <CanonUsbPreview movie />
          ) : (
            <>
              <CameraPreview deviceId={videoCamera} resolution={videoResolution} paused={testing} restartKey={restartKey} />
              {/* Le test bascule l'appareil lui-même puis le remet en photo : bouton remis à zéro après. */}
              {videoSource === 'canon_hdmi' && (
                <CanonMovieSwitch key={switchKey} disabled={testing} onSwitched={() => setRestartKey((k) => k + 1)} />
              )}
              <MicLevel micId={settings?.microphone_device_id ?? ''} cameraId={videoCamera} />
            </>
          )}
          <p className="mt-4" style={note}>
            À changer dans Photo › Caméra photo et Vidéo › Caméra vidéo (puis « Enregistrer »).
          </p>
        </AdminCard>

        <AdminCard title="Test d'enregistrement vidéo">
          {videoSource === 'canon' ? (
            <>
              <p style={note}>Vidéo de 5 s filmée par l'appareil puis rapatriée en USB, comme pendant l'évènement.</p>
              <CanonVideoTest />
            </>
          ) : (
            <>
              <p style={note}>
                Filme 5 s comme pendant l'évènement ({videoResolution === '4k' ? '4K' : videoResolution}, même caméra, même micro) :
                vérifie que l'image reste fluide et que le son arrive. Parle pendant le test.
              </p>
              <RecordingTest
                resolution={videoResolution}
                cameraId={videoCamera}
                micId={settings?.microphone_device_id ?? ''}
                canonSwitch={videoSource === 'canon_hdmi'}
                onRunningChange={(running) => {
                  setTesting(running);
                  if (running) setView('video');
                  else setSwitchKey((k) => k + 1);
                }}
              />
            </>
          )}
        </AdminCard>
      </div>
    </>
  );
}
