import { useEffect, useRef, useState } from 'react';
import { MdCameraAlt, MdContentCopy, MdLink, MdLinkOff, MdRefresh, MdVisibility } from 'react-icons/md';
import { Button } from '@shared/components/Button';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { resolveMicrophone } from '@shared/lib/mediaCapture';
import type { CanonCapture, CanonResult, CanonStatus, CanonWindowsCheck } from '@shared/types';
import { AdminCard } from '../components/AdminUI';

const text: React.CSSProperties = { color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', lineHeight: 1.6 };
const strong: React.CSSProperties = { ...text, color: '#1A1A1A', fontWeight: 600 };
const box: React.CSSProperties = { backgroundColor: '#F4ECDD', borderRadius: '4px', padding: '0.875rem 1rem' };

/** Images reçues de la caméra vidéo (Cam Link) avant, pendant et après le déclenchement. */
interface VideoFeedCheck {
  before: number;
  during: number;
  after: number;
}

type PhotoTest = (CanonCapture & { width: number; height: number; feed?: VideoFeedCheck }) | { error: string };

function battery(level?: number) {
  if (level === undefined) return null;
  if (level > 100) return 'sur secteur';
  return `batterie ${level} %`;
}

/**
 * Compte les images livrées par la caméra vidéo pendant `run`, pour vérifier
 * que la sortie HDMI de l'appareil (Cam Link) reste active quand il est piloté en USB.
 */
async function measureVideoFeed<T>(deviceId: string, run: () => Promise<T>): Promise<{ result: T; feed?: VideoFeedCheck }> {
  const Processor = (window as unknown as { MediaStreamTrackProcessor?: new (o: { track: MediaStreamTrack }) => { readable: ReadableStream<{ close(): void }> } }).MediaStreamTrackProcessor;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
  } catch {
    return { result: await run() };
  }
  if (!Processor) {
    stream.getTracks().forEach((t) => t.stop());
    return { result: await run() };
  }
  const stamps: number[] = [];
  const reader = new Processor({ track: stream.getVideoTracks()[0] }).readable.getReader();
  let reading = true;
  (async () => {
    while (reading) {
      const { value, done } = await reader.read();
      if (done) break;
      stamps.push(performance.now());
      value?.close();
    }
  })();
  const count = (from: number, to: number) => Math.round((stamps.filter((t) => t >= from && t < to).length / ((to - from) / 1000)) * 10) / 10;
  try {
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 2000));
    const t1 = performance.now();
    const result = await run();
    const t2 = performance.now();
    await new Promise((r) => setTimeout(r, 3000));
    const t3 = performance.now();
    return { result, feed: { before: count(t0, t1), during: count(t1, t2), after: count(t2, t3) } };
  } finally {
    reading = false;
    reader.cancel().catch(() => {});
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Explique pourquoi le SDK ne trouve pas l'appareil, d'après ce que Windows voit en USB. */
function WindowsDiagnosis({ check }: { check: CanonWindowsCheck }) {
  const item = (t: string) => <li>{t}</li>;
  return (
    <div style={box}>
      <p style={strong}>Diagnostic</p>
      {check.error ? (
        <p style={text}>Diagnostic Windows impossible : {check.error}</p>
      ) : check.usb.length === 0 ? (
        <>
          <p style={{ ...text, color: '#9B2C2C', fontWeight: 600 }}>Windows ne voit aucun appareil Canon branché en USB.</p>
          <ul className="list-disc pl-5" style={text}>
            {item("L'appareil est-il allumé ?")}
            {item('Le câble USB-C transmet-il les données ? Beaucoup de câbles ne font que charger : essaie celui fourni avec l’appareil.')}
            {item('Branche-le directement sur le PC, sans hub ni rallonge.')}
          </ul>
        </>
      ) : (
        <>
          <p style={text}>
            Windows voit : {check.usb.map((d) => `${d.name} (${d.kind}, ${d.status})`).join(' · ')}
          </p>
          <p style={{ ...text, color: '#9B2C2C', fontWeight: 600 }}>… mais le SDK Canon ne peut pas s'y connecter :</p>
          <ul className="list-disc pl-5" style={text}>
            {item("Désactive le Wi-Fi et le Bluetooth de l'appareil (mode avion) : tant qu'ils sont actifs, il refuse la connexion USB à un logiciel.")}
            {item('Ferme EOS Utility, EOS Webcam Utility et l’import de photos de Windows.')}
            {item('Débranche puis rebranche le câble, attends 5 secondes et clique sur « Détecter ».')}
          </ul>
        </>
      )}
      {check.canonApps.length > 0 && (
        <p className="mt-2" style={{ ...text, color: '#9B2C2C', fontWeight: 600 }}>
          Logiciels Canon ouverts : {check.canonApps.join(', ')}. Ferme-les, y compris près de l'horloge Windows.
        </p>
      )}
    </div>
  );
}

/** Réglages et tests de l'appareil Canon branché en USB (pilotage EDSDK). */
export function CanonCameraPanel({ videoDeviceId }: { videoDeviceId: string }) {
  const [status, setStatus] = useState<CanonStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [photoTest, setPhotoTest] = useState<PhotoTest | null>(null);
  const [winCheck, setWinCheck] = useState<CanonWindowsCheck | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(false);

  const refreshLogs = async () => setLogs(await window.api.canon.logs());

  const run = async <T,>(label: string, fn: () => Promise<T>) => {
    setBusy(label);
    try {
      return await fn();
    } finally {
      setBusy(null);
      refreshLogs();
    }
  };

  const applyStatus = (r: CanonResult<CanonStatus>) => {
    if (r.ok) {
      setStatus(r.result);
      setStatusError(null);
    } else {
      setStatusError(r.error);
    }
  };

  const detect = () =>
    run('detect', async () => {
      const r = await window.api.canon.status();
      applyStatus(r);
      const missing = !r.ok || (!r.result.connected && r.result.cameras.length === 0);
      setWinCheck(missing ? await window.api.canon.windowsCheck() : null);
    });
  const connect = () =>
    run('connect', async () => {
      const r = await window.api.canon.connect();
      applyStatus(r);
      setWinCheck(r.ok ? null : await window.api.canon.windowsCheck());
    });
  const disconnect = () =>
    run('disconnect', async () => {
      setPreview(false);
      applyStatus(await window.api.canon.disconnect());
    });

  const togglePreview = () =>
    run('preview', async () => {
      const on = !previewRef.current;
      const r = await window.api.canon.liveview(on);
      applyStatus(r);
      if (r.ok) setPreview(on);
    });

  const testPhoto = () =>
    run('photo', async () => {
      const capture = () => window.api.canon.capture();
      const { result: r, feed } = videoDeviceId ? await measureVideoFeed(videoDeviceId, capture) : { result: await capture(), feed: undefined };
      if (!r.ok) {
        setPhotoTest({ error: r.error });
        return;
      }
      const img = new Image();
      img.src = r.result.url;
      await img.decode().catch(() => {});
      setPhotoTest({ ...r.result, width: img.naturalWidth, height: img.naturalHeight, feed });
    });

  const copyReport = async () => {
    const version = await window.api.app.version();
    const settings = await window.api.settings.get();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mic = await resolveMicrophone(settings.microphone_device_id, settings.camera_device_id);
    const report = {
      app: `PhotoBooth Pro ${version}`,
      date: new Date().toISOString(),
      status: status ?? statusError,
      videoDevice: videoDeviceId || null,
      // Son des vidéos : micro réellement utilisé et entrées son vues par l'app.
      audio: {
        setting: settings.microphone_device_id ? 'choisi' : 'automatique',
        used: mic.label,
        fromCamera: mic.fromCamera,
        cameras: devices.filter((d) => d.kind === 'videoinput').map((d) => d.label),
        inputs: devices.filter((d) => d.kind === 'audioinput').map((d) => d.label),
      },
      windows: winCheck ?? (await window.api.canon.windowsCheck()),
      photoTest,
      logs: await window.api.canon.logs(),
    };
    await window.api.app.copyText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    detect();
    const off = window.api.canon.onState((s) => {
      if (!s.connected) setPreview(false);
      window.api.canon.status().then(applyStatus);
    });
    return () => {
      off();
      if (previewRef.current) window.api.canon.liveview(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = !!status?.connected;
  const feed = photoTest && !('error' in photoTest) ? photoTest.feed : undefined;
  const feedCut = feed && feed.before >= 10 && (feed.during < 5 || feed.after < 5);

  return (
    <AdminCard title="Appareil Canon (USB)">
      <div className="space-y-5">
        <div style={box}>
          <p style={text}>
            Photos : branche l'appareil (EOS R50…) en USB-C et allume-le. Désactive son Wi-Fi et son Bluetooth
            (mode avion), ferme EOS Utility et EOS Webcam Utility, désactive l'arrêt automatique et mets la molette
            sur un mode photo (P, Av ou M).
            <br />
            Vidéo : la Cam Link (HDMI) reste la caméra sélectionnée plus bas. Règle l'affichage HDMI de l'appareil
            « sans informations », sinon les réglages apparaissent à l'image.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            {statusError ? (
              <p style={{ ...strong, color: '#9B2C2C' }}>{statusError}</p>
            ) : !status ? (
              <p style={text}>Recherche…</p>
            ) : !status.sdkLoaded ? (
              <p style={{ ...strong, color: '#9B2C2C' }}>SDK Canon indisponible : {status.sdkError}</p>
            ) : connected ? (
              <p style={strong}>
                Connecté : {status.model}
                {battery(status.battery) ? ` — ${battery(status.battery)}` : ''}
              </p>
            ) : status.cameras.length ? (
              <p style={strong}>Détecté : {status.cameras.join(', ')} (non connecté)</p>
            ) : (
              <p style={strong}>Aucun appareil Canon détecté</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="md" onClick={detect} disabled={!!busy} icon={<MdRefresh size={18} />}>
              Détecter
            </Button>
            {connected ? (
              <Button variant="secondary" size="md" onClick={disconnect} disabled={!!busy} icon={<MdLinkOff size={18} />}>
                Déconnecter
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={connect} disabled={!!busy} icon={<MdLink size={18} />}>
                {busy === 'connect' ? 'Connexion…' : 'Connecter'}
              </Button>
            )}
          </div>
        </div>

        {!connected && winCheck && <WindowsDiagnosis check={winCheck} />}

        {connected && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" onClick={testPhoto} disabled={!!busy} icon={<MdCameraAlt size={18} />}>
                {busy === 'photo' ? 'Photo en cours…' : 'Photo test'}
              </Button>
              <Button variant="secondary" size="md" onClick={togglePreview} disabled={!!busy} icon={<MdVisibility size={18} />}>
                {preview ? "Arrêter l'aperçu USB" : 'Aperçu USB'}
              </Button>
            </div>
            {videoDeviceId && (
              <p style={text}>
                La photo test vérifie aussi que la Cam Link continue de recevoir l'image pendant et après le déclenchement.
              </p>
            )}

            {preview && (
              <CanonLiveView
                className="w-full max-h-80 object-contain"
                style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }}
              />
            )}
          </>
        )}

        {photoTest && (
          <div style={box}>
            <p style={strong}>Photo test</p>
            {'error' in photoTest ? (
              <p style={{ ...text, color: '#9B2C2C' }}>{photoTest.error}</p>
            ) : (
              <div className="flex gap-4 items-start mt-2">
                <img src={photoTest.url} alt="" className="w-40 object-contain" style={{ borderRadius: '2px' }} />
                <p style={text}>
                  {photoTest.width}×{photoTest.height} — {(photoTest.bytes / 1e6).toFixed(1)} Mo
                  <br />
                  Déclenchement + transfert : {(photoTest.ms / 1000).toFixed(1)} s
                  {photoTest.afFallback && (
                    <>
                      <br />
                      La mise au point a échoué, photo prise sans autofocus.
                    </>
                  )}
                  {feed && (
                    <>
                      <br />
                      Cam Link : {feed.before} i/s avant · {feed.during} i/s pendant · {feed.after} i/s après
                    </>
                  )}
                  <br />
                  Original gardé dans : {photoTest.path}
                </p>
              </div>
            )}
            {feedCut && (
              <p className="mt-2" style={{ ...text, color: '#9B2C2C', fontWeight: 600 }}>
                La sortie HDMI se coupe quand l'appareil est piloté en USB : choisis « Aperçu USB de l'appareil » ci-dessus
                pour les photos. Les vidéos libèrent l'USB et repassent par la Cam Link.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <p style={text}>Un souci ? Fais les tests puis envoie le rapport à ton prestataire.</p>
          <Button variant="ghost" size="md" onClick={copyReport} icon={<MdContentCopy size={18} />}>
            {copied ? 'Copié !' : 'Copier le rapport'}
          </Button>
        </div>

        {logs.length > 0 && (
          <details>
            <summary style={{ ...text, cursor: 'pointer' }}>Journal de l'appareil ({logs.length} lignes)</summary>
            <pre
              className="mt-2 overflow-auto max-h-60"
              style={{ ...text, fontFamily: 'Consolas, monospace', fontSize: '0.6875rem', whiteSpace: 'pre-wrap' }}
            >
              {logs.join('\n')}
            </pre>
          </details>
        )}
      </div>
    </AdminCard>
  );
}
