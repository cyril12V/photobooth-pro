import { useEffect, useState, useRef } from 'react';
import { Button } from '@shared/components/Button';
import { CanonLiveView } from '@shared/components/CanonLiveView';
import { finishCanonMovie, prepareCanonMovie, releaseCanonMovie, startCanonMovie, switchCanonToMovieForHdmi } from '@shared/lib/canonMovie';
import { GpuRecorder } from '@shared/lib/gpuRecorder';
import {
  VIDEO_BITRATE_MAP,
  VIDEO_RECORDING_SLICE_MS,
  buildVideoTrackConstraints,
  pickRecorderMimeType,
  resolveMicrophone,
  type CaptureResolution,
  type MicrophoneChoice,
} from '@shared/lib/mediaCapture';

/**
 * Niveau sonore en direct du micro des vidéos (choix automatique compris) : si la barre
 * ne bouge pas quand on parle, ce micro n'enregistre rien.
 */
export function MicLevel({ micId, cameraId }: { micId: string; cameraId: string }) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mic, setMic] = useState<MicrophoneChoice | null>(null);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    setError(null);
    (async () => {
      try {
        const choice = await resolveMicrophone(micId, cameraId);
        if (stopped) return;
        setMic(choice);
        stream = await navigator.mediaDevices.getUserMedia({ audio: choice.audio });
        if (stopped) return;
        ctx = new AudioContext();
        await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let peak = 0;
          for (const v of samples) peak = Math.max(peak, Math.abs(v));
          setLevel(peak);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!stopped) setError('Micro inaccessible.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [micId, cameraId]);

  return (
    <div className="mt-4">
      <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-2">
        Niveau du micro{mic ? ` : ${mic.label}${mic.fromCamera ? ' (son de la caméra)' : ''}` : ''}
      </p>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E8DFD0' }}>
        <div
          className="h-full"
          style={{ width: `${Math.min(100, level * 140)}%`, backgroundColor: level > 0.02 ? '#2F6B3A' : '#B8A88F' }}
        />
      </div>
      <p className="text-neutral-400 text-xs mt-2">
        {error ??
          (mic?.fromCamera
            ? "Son HDMI de l'appareil par la Cam Link : il n'arrive que quand l'appareil est en mode vidéo. Vérifie-le avec « Tester l'enregistrement » (dans Qualité), qui le bascule."
            : 'Parle près du micro : la barre doit bouger. Si elle reste vide, les vidéos seront sans son : choisis un autre micro.')}
      </p>
    </div>
  );
}

type CanonVideoTestResult =
  | { ok: true; size: string; seconds: number; mb: number; downloadS: number }
  | { ok: false; error: string };

/** Vidéo de 5 s par l'appareil : bascule en vidéo, enregistrement, rapatriement, retour en photo. */
export function CanonVideoTest() {
  const [step, setStep] = useState<'idle' | 'preparing' | 'recording' | 'downloading'>('idle');
  const [percent, setPercent] = useState<number | null>(null);
  const [result, setResult] = useState<CanonVideoTestResult | null>(null);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    setResult(null);
    setPercent(null);
    setStep('preparing');
    let recording = false;
    try {
      const prepareError = await prepareCanonMovie();
      if (prepareError) throw new Error(prepareError);
      await sleep(1000);
      const startError = await startCanonMovie();
      if (startError) throw new Error(startError);
      recording = true;
      setStep('recording');
      await sleep(5000);
      recording = false;
      setStep('downloading');
      const movie = await finishCanonMovie(setPercent);
      if (typeof movie === 'string') throw new Error(movie);
      const video = document.createElement('video');
      video.src = movie.url;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("La vidéo a été rapatriée mais l'app ne sait pas la lire."));
      });
      setResult({
        ok: true,
        size: `${video.videoWidth}×${video.videoHeight}`,
        seconds: Math.round(video.duration * 10) / 10,
        mb: movie.bytes / 1e6,
        downloadS: movie.downloadMs / 1000,
      });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      await releaseCanonMovie(recording);
      setStep('idle');
    }
  };

  const label = {
    idle: "Tester la vidéo par l'appareil (5 s)",
    preparing: 'Passage en mode vidéo…',
    recording: 'Enregistrement (5 s)…',
    downloading: `Rapatriement de la vidéo${percent !== null ? ` : ${percent} %` : '…'}`,
  }[step];

  return (
    <div className="mt-4">
      <Button variant="secondary" size="md" onClick={run} disabled={step !== 'idle'}>
        {label}
      </Button>
      {(step === 'preparing' || step === 'recording') && (
        <CanonLiveView className="mt-3 w-full max-h-64 object-contain" style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }} />
      )}
      {result &&
        (result.ok ? (
          <p className="text-xs mt-2" style={{ color: '#2F6B3A', fontWeight: 600 }}>
            OK : vidéo {result.size}, {result.seconds} s, {result.mb.toFixed(1)} Mo, rapatriée en {result.downloadS.toFixed(1)} s.
            Pour un message de 30 s, compte environ {Math.round((result.downloadS * 30) / Math.max(1, result.seconds))} s
            d'attente après l'enregistrement. L'appareil est revenu en mode photo.
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: '#9B2C2C', fontWeight: 600 }}>
            {result.error}
          </p>
        ))}
    </div>
  );
}

type RecordingTestResult =
  | {
      ok: true;
      size: string;
      before: number;
      during: number;
      threads: number;
      gpu: { fps: number } | null;
      /** Niveau crête du son pendant l'enregistrement (0 à 1), null sans micro. */
      sound: { label: string; peak: number } | null;
    }
  | { ok: false; error: string };

/** Niveau crête (0 à 1) du son d'un flux, mesuré en continu jusqu'à close(). */
function audioPeakMeter(stream: MediaStream) {
  if (!stream.getAudioTracks().length) return null;
  const ctx = new AudioContext();
  void ctx.resume();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let peak = 0;
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
  }, 40);
  return {
    reset: () => (peak = 0),
    peak: () => peak,
    close: () => {
      window.clearInterval(timer);
      void ctx.close();
    },
  };
}

/**
 * Filme 5 s comme pendant une vraie session (même caméra, même résolution, même
 * encodage) et mesure la fluidité de l'aperçu : si l'encodage est trop lourd
 * pour ce PC, l'image ralentit pendant l'enregistrement.
 */
export function RecordingTest({
  resolution,
  cameraId,
  micId,
  canonSwitch,
  onRunningChange,
}: {
  resolution: CaptureResolution;
  cameraId: string;
  micId: string;
  /** Source « Appareil Canon + Cam Link » : bascule l'appareil en vidéo avant, en photo après. */
  canonSwitch: boolean;
  /** Prévient l'écran pour qu'il libère la caméra (aperçu) pendant le test. */
  onRunningChange?: (running: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RecordingTestResult | null>(null);

  const run = async () => {
    setRunning(true);
    onRunningChange?.(true);
    setResult(null);
    let stream: MediaStream | null = null;
    let gpuRecorder: GpuRecorder | null = null;
    let meter: ReturnType<typeof audioPeakMeter> = null;
    try {
      if (canonSwitch) {
        const err = await switchCanonToMovieForHdmi();
        if (err) throw new Error(err);
      }
      const mic = await resolveMicrophone(micId, cameraId);
      stream = await navigator.mediaDevices.getUserMedia({
        video: buildVideoTrackConstraints(resolution, cameraId),
        audio: mic.audio,
      });
      meter = audioPeakMeter(stream);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const frames: number[] = [];
      const onFrame = (now: number) => {
        frames.push(now);
        if (video.srcObject) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
      const fps = (from: number, to: number) => Math.round(frames.filter((t) => t >= from && t < to).length / ((to - from) / 1000));
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Même choix d'encodeur qu'en session : carte graphique (MP4) si elle sait, sinon processeur (WebM).
      gpuRecorder = await GpuRecorder.prepare(stream, VIDEO_BITRATE_MAP[resolution]);
      await sleep(500);
      const t0 = performance.now();
      await sleep(2000);
      const t1 = performance.now();
      meter?.reset();
      let recorder: MediaRecorder | null = null;
      if (gpuRecorder) {
        gpuRecorder.start();
      } else {
        recorder = new MediaRecorder(stream, {
          mimeType: pickRecorderMimeType(),
          videoBitsPerSecond: VIDEO_BITRATE_MAP[resolution],
          audioBitsPerSecond: 128_000,
        });
        recorder.start(VIDEO_RECORDING_SLICE_MS);
      }
      // La 1re seconde sert à lancer l'encodeur : on mesure les 4 suivantes.
      await sleep(1000);
      const t2 = performance.now();
      await sleep(4000);
      const t3 = performance.now();
      recorder?.stop();
      if (gpuRecorder) await gpuRecorder.stop();
      const s = stream.getVideoTracks()[0].getSettings();
      setResult({
        ok: true,
        size: `${s.width}×${s.height}`,
        before: fps(t0, t1),
        during: fps(t2, t3),
        threads: navigator.hardwareConcurrency,
        gpu: gpuRecorder ? { fps: gpuRecorder.stats?.fps ?? 0 } : null,
        // Encodeur de la carte graphique : sans son reçu, la vidéo n'a pas de piste son.
        sound: meter
          ? { label: mic.label, peak: gpuRecorder && !gpuRecorder.stats?.audio ? 0 : meter.peak() }
          : null,
      });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      meter?.close();
      gpuRecorder?.cancel();
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      if (canonSwitch) await releaseCanonMovie(false);
      setRunning(false);
      onRunningChange?.(false);
    }
  };

  const keepsUp = (fps: number) => result?.ok && result.before > 0 && fps >= Math.min(25, result.before - 3);
  // Avec la carte graphique, la vidéo enregistrée doit aussi être fluide (images sautées si elle ne suit pas).
  const smooth = result?.ok && keepsUp(result.during) && (!result.gpu || keepsUp(result.gpu.fps));
  const soundOk = result?.ok && result.sound && result.sound.peak >= 0.01;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="md" onClick={run} disabled={running}>
          {running ? 'Test en cours (8 s) : parle !' : "Tester l'enregistrement"}
        </Button>
        {!canonSwitch && (
          <video ref={videoRef} muted playsInline className="h-16 rounded" style={{ backgroundColor: '#1A1A1A', display: running ? 'block' : 'none' }} />
        )}
      </div>
      {/* Avec l'appareil Canon : grand aperçu pour vérifier que l'image HDMI est propre (sans les réglages). */}
      {canonSwitch && (
        <video ref={videoRef} muted playsInline className="mt-3 w-full max-h-64 rounded object-contain" style={{ backgroundColor: '#1A1A1A', display: running ? 'block' : 'none' }} />
      )}
      {result &&
        (result.ok ? (
          <p className="text-xs mt-2" style={{ color: smooth ? '#2F6B3A' : '#9B2C2C', fontWeight: 600 }}>
            Caméra {result.size} : {result.before} i/s avant, {result.during} i/s pendant l'enregistrement (PC : {result.threads} threads).{' '}
            {result.gpu
              ? `Encodé par la carte graphique en MP4 : vidéo à ${result.gpu.fps} i/s. `
              : 'Encodé par le processeur en WebM. '}
            {result.before === 0
              ? "Aucune image reçue : vérifie la Cam Link, le câble HDMI et que la caméra sélectionnée dans Caméra est bien la Cam Link."
              : smooth
                ? 'Fluide : ce PC tient cette résolution.'
                : "Trop lourd pour ce PC : l'image saccade pendant les vidéos. Choisis une résolution plus basse (1080p) et refais le test."}
            <span className="block mt-1" style={{ color: soundOk ? '#2F6B3A' : '#9B2C2C' }}>
              {!result.sound
                ? 'Son : aucun micro, les vidéos seront muettes.'
                : soundOk
                  ? `Son : reçu de « ${result.sound.label} » (niveau max ${Math.round(result.sound.peak * 100)} %).`
                  : `Son : rien reçu de « ${result.sound.label} ». Parle pendant le test. Avec la Cam Link, le son vient de l'appareil : vérifie que l'enregistrement du son est activé dans son menu vidéo (pas « Désactivé »).`}
            </span>
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: '#9B2C2C' }}>
            Test impossible : {result.error}
          </p>
        ))}
    </div>
  );
}
