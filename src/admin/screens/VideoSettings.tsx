import { useEffect, useRef, useState } from 'react';
import { MdMic, MdCheck, MdMovie, MdFolder } from 'react-icons/md';
import {
  CAPTURE_RESOLUTION_MAP,
  CAPTURE_RESOLUTIONS,
  VIDEO_BITRATE_MAP,
  VIDEO_RECORDING_SLICE_MS,
  buildVideoTrackConstraints,
  pickRecorderMimeType,
  type CaptureResolution,
} from '@shared/lib/mediaCapture';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

type CaptureMode = 'photo' | 'video' | 'both';
const CAPTURE_MODE_OPTIONS: Array<{ value: CaptureMode; label: string }> = [
  { value: 'photo', label: 'Photo seule' },
  { value: 'video', label: 'Vidéo seule' },
  { value: 'both', label: 'Les deux' },
];

/**
 * Niveau sonore en direct du micro choisi : si la barre ne bouge pas quand on
 * parle, ce micro n'enregistre rien (ex. l'entrée audio HDMI de la Cam Link).
 */
function MicLevel({ deviceId }: { deviceId: string }) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    setError(null);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
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
  }, [deviceId]);

  return (
    <div className="mt-4">
      <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-2">Niveau du micro</p>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E8DFD0' }}>
        <div
          className="h-full"
          style={{ width: `${Math.min(100, level * 140)}%`, backgroundColor: level > 0.02 ? '#2F6B3A' : '#B8A88F' }}
        />
      </div>
      <p className="text-neutral-400 text-xs mt-2">
        {error ??
          "Parle près du micro : la barre doit bouger. Si elle reste vide, les vidéos seront sans son : choisis un autre micro (l'entrée audio de la Cam Link ne capte que le son HDMI de l'appareil)."}
      </p>
    </div>
  );
}

type RecordingTestResult =
  | { ok: true; size: string; before: number; during: number; threads: number }
  | { ok: false; error: string };

/**
 * Filme 5 s comme pendant une vraie session (même caméra, même résolution, même
 * encodage) et mesure la fluidité de l'aperçu : si l'encodage est trop lourd
 * pour ce PC, l'image ralentit pendant l'enregistrement.
 */
function RecordingTest({ resolution, cameraId, micId }: { resolution: CaptureResolution; cameraId: string; micId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RecordingTestResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: buildVideoTrackConstraints(resolution, cameraId),
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
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

      await sleep(500);
      const t0 = performance.now();
      await sleep(2000);
      const t1 = performance.now();
      const recorder = new MediaRecorder(stream, {
        mimeType: pickRecorderMimeType(),
        videoBitsPerSecond: VIDEO_BITRATE_MAP[resolution],
        audioBitsPerSecond: 128_000,
      });
      recorder.start(VIDEO_RECORDING_SLICE_MS);
      // La 1re seconde sert à lancer l'encodeur : on mesure les 4 suivantes.
      await sleep(1000);
      const t2 = performance.now();
      await sleep(4000);
      const t3 = performance.now();
      recorder.stop();
      const s = stream.getVideoTracks()[0].getSettings();
      setResult({
        ok: true,
        size: `${s.width}×${s.height}`,
        before: fps(t0, t1),
        during: fps(t2, t3),
        threads: navigator.hardwareConcurrency,
      });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setRunning(false);
    }
  };

  const smooth = result?.ok && result.during >= Math.min(25, result.before - 3);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="md" onClick={run} disabled={running}>
          {running ? 'Test en cours (8 s)…' : "Tester l'enregistrement"}
        </Button>
        <video ref={videoRef} muted playsInline className="h-16 rounded" style={{ backgroundColor: '#1A1A1A', display: running ? 'block' : 'none' }} />
      </div>
      {result &&
        (result.ok ? (
          <p className="text-xs mt-2" style={{ color: smooth ? '#2F6B3A' : '#9B2C2C', fontWeight: 600 }}>
            Caméra {result.size} : {result.before} i/s avant, {result.during} i/s pendant l'enregistrement (PC : {result.threads} threads).{' '}
            {smooth
              ? 'Fluide : ce PC tient cette résolution.'
              : "Trop lourd pour ce PC : l'image saccade pendant les vidéos. Choisis une résolution plus basse (1080p) et refais le test."}
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: '#9B2C2C' }}>
            Test impossible : {result.error}
          </p>
        ))}
    </div>
  );
}

type CompileStatus =
  | { kind: 'idle' }
  | { kind: 'running'; percent: number; stage: string }
  | { kind: 'done'; filepath: string }
  | { kind: 'error'; message: string };

export function VideoSettings() {
  const { settings, setSettings } = useAppStore();
  const [captureMode, setCaptureMode] = useState<CaptureMode>(
    (settings?.capture_mode ?? 'both') as CaptureMode,
  );
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState(settings?.microphone_device_id ?? '');
  const [captureResolution, setCaptureResolution] = useState<CaptureResolution>(
    settings?.video_capture_resolution ?? '1080p',
  );
  const [maxDuration, setMaxDuration] = useState(settings?.video_max_duration_seconds ?? 30);
  const [defaultQuestionSec, setDefaultQuestionSec] = useState(
    settings?.video_default_question_seconds ?? 15,
  );
  const [beep, setBeep] = useState(settings?.video_interview_beep ?? true);
  const [flash, setFlash] = useState(settings?.video_interview_flash ?? true);
  const [saved, setSaved] = useState(false);

  const [compEnabled, setCompEnabled] = useState(settings?.video_compilation_enabled ?? true);
  const [compShowQuestions, setCompShowQuestions] = useState(
    settings?.video_compilation_show_questions ?? true,
  );
  const [compShowLogo, setCompShowLogo] = useState(
    settings?.video_compilation_show_logo ?? true,
  );
  const [compShowEventName, setCompShowEventName] = useState(
    settings?.video_compilation_show_event_name ?? true,
  );
  const [compIntroDuration, setCompIntroDuration] = useState(
    settings?.video_compilation_intro_duration ?? 3,
  );
  const [compStatus, setCompStatus] = useState<CompileStatus>({ kind: 'idle' });

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {}
      const all = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(all.filter((d) => d.kind === 'audioinput'));
    })();
  }, []);

  useEffect(() => {
    const off = window.api.video.onCompileProgress(({ percent, stage }) => {
      setCompStatus((prev) =>
        prev.kind === 'running' ? { kind: 'running', percent, stage } : prev,
      );
    });
    return () => {
      off();
    };
  }, []);

  const save = async () => {
    await window.api.settings.set('capture_mode', captureMode);
    await window.api.settings.set('video_enabled', captureMode !== 'photo');
    await window.api.settings.set('microphone_device_id', micId);
    await window.api.settings.set('video_capture_resolution', captureResolution);
    await window.api.settings.set('video_max_duration_seconds', maxDuration);
    await window.api.settings.set('video_default_question_seconds', defaultQuestionSec);
    await window.api.settings.set('video_interview_beep', beep);
    await window.api.settings.set('video_interview_flash', flash);
    await window.api.settings.set('video_compilation_enabled', compEnabled);
    await window.api.settings.set('video_compilation_show_questions', compShowQuestions);
    await window.api.settings.set('video_compilation_show_logo', compShowLogo);
    await window.api.settings.set('video_compilation_show_event_name', compShowEventName);
    await window.api.settings.set('video_compilation_intro_duration', compIntroDuration);
    const newSettings = await window.api.settings.get();
    setSettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const startCompile = async () => {
    if (compStatus.kind === 'running') return;

    await window.api.settings.set('video_compilation_show_questions', compShowQuestions);
    await window.api.settings.set('video_compilation_show_logo', compShowLogo);
    await window.api.settings.set('video_compilation_show_event_name', compShowEventName);
    await window.api.settings.set('video_compilation_intro_duration', compIntroDuration);

    setCompStatus({ kind: 'running', percent: 0, stage: 'Démarrage' });
    try {
      const result = await window.api.video.compile();
      if (result.ok && result.filepath) {
        setCompStatus({ kind: 'done', filepath: result.filepath });
      } else {
        setCompStatus({ kind: 'error', message: result.error ?? 'Erreur inconnue' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCompStatus({ kind: 'error', message: msg });
    }
  };

  const openCompilationFolder = () => {
    void window.api.video.openFolder();
  };

  return (
    <>
      <AdminPageHeader
        title="Mode & Vidéo"
        description="Choisis ce que la borne propose au démarrage et configure la vidéo"
      />

      <div className="space-y-4">
        <AdminCard title="Mode de la borne">
          <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
            Que peut faire l'invité au démarrage ?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {CAPTURE_MODE_OPTIONS.map(({ value, label }) => {
              const active = captureMode === value;
              return (
                <button
                  key={value}
                  onClick={() => setCaptureMode(value)}
                  className="p-3 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
                    color: active ? '#FAF6EE' : '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p
            className="mt-2"
            style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}
          >
            {captureMode === 'photo' && 'La borne démarre directement sur le mode photo, l\'écran de choix Photo/Vidéo est masqué.'}
            {captureMode === 'video' && 'La borne démarre directement sur le mode vidéo, l\'écran de choix Photo/Vidéo est masqué.'}
            {captureMode === 'both' && 'L\'invité voit un écran de choix Photo / Vidéo au démarrage.'}
          </p>
        </AdminCard>

        <AdminCard title="Microphone">
          {micDevices.length === 0 ? (
            <p className="text-neutral-500 text-sm">
              Aucun micro détecté. Branchez votre micro externe ou autorisez l'accès.
            </p>
          ) : (
            <div className="space-y-2">
              {micDevices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => setMicId(d.deviceId)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-colors
                    ${
                      micId === d.deviceId
                        ? 'bg-neutral-900 text-white border border-neutral-900'
                        : 'bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                    }`}
                >
                  <MdMic
                    size={18}
                    style={{ color: micId === d.deviceId ? '#D4B896' : '#6B5D4F' }}
                  />
                  <span className="flex-1 text-sm truncate font-medium">
                    {d.label || `Micro ${d.deviceId.slice(0, 8)}`}
                  </span>
                  {micId === d.deviceId && <MdCheck size={16} style={{ color: '#D4B896' }} />}
                </button>
              ))}
              <button
                onClick={() => setMicId('')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-colors
                  ${
                    !micId
                      ? 'bg-neutral-900 text-white border border-neutral-900'
                      : 'bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                  }`}
              >
                <MdMic
                  size={18}
                  style={{ color: !micId ? '#D4B896' : '#6B5D4F' }}
                />
                <span className="flex-1 text-sm font-medium">Micro par défaut du système</span>
                {!micId && <MdCheck size={16} style={{ color: '#D4B896' }} />}
              </button>
            </div>
          )}
          <MicLevel deviceId={micId} />
        </AdminCard>

        <AdminCard title="Qualité">
          <div className="space-y-4">
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Qualité d'enregistrement
              </p>
              <div className="grid grid-cols-4 gap-3">
                {CAPTURE_RESOLUTIONS.map((resolution) => (
                  <button
                    key={resolution}
                    onClick={() => setCaptureResolution(resolution)}
                    className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                      captureResolution === resolution
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {resolution === '4k' ? '4K' : resolution}
                  </button>
                ))}
              </div>
              <p className="text-neutral-400 text-xs mt-2">
                Source actuelle : {CAPTURE_RESOLUTION_MAP[captureResolution].width}×{CAPTURE_RESOLUTION_MAP[captureResolution].height}.
              </p>
              <p className="text-neutral-400 text-xs mt-1">
                Poids approximatif : 4K ≈ 75 MB/min, 1080p ≈ 40 MB/min, 720p ≈ 20 MB/min, 480p ≈ 10 MB/min.
              </p>
              <p className="text-neutral-400 text-xs mt-1">
                La 4K est exigeante : ta caméra doit fournir un vrai flux 4K (Canon R6 Mark II en mode Webcam Utility, Sony Imaging Edge, GoPro, etc.) et la machine doit pouvoir l'encoder en temps réel (processeur 4 cœurs / 8 threads minimum). En cas de lag ou de fichier cassé, retombe en 1080p.
              </p>
              <RecordingTest resolution={captureResolution} cameraId={settings?.camera_device_id ?? ''} micId={micId} />
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Durée max message libre : {maxDuration} secondes
              </p>
              <input
                type="range"
                min={10}
                max={180}
                step={5}
                value={maxDuration}
                onChange={(e) => setMaxDuration(Number(e.target.value))}
                className="w-full accent-neutral-900"
              />
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Durée par défaut d'une question : {defaultQuestionSec} secondes
              </p>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={defaultQuestionSec}
                onChange={(e) => setDefaultQuestionSec(Number(e.target.value))}
                className="w-full accent-neutral-900"
              />
              <p className="text-neutral-400 text-xs mt-2">
                Cette valeur est utilisée comme valeur initiale pour les nouvelles questions.
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Transitions entre questions (interview)">
          <div className="divide-y divide-neutral-100">
            <AdminToggle
              label="Bip audio entre questions"
              description="Discret, aide au repérage des coupes au montage"
              value={beep}
              onChange={setBeep}
            />
            <AdminToggle
              label="Flash visuel entre questions"
              description="Court éclair blanc, repérable visuellement au montage"
              value={flash}
              onChange={setFlash}
            />
          </div>
        </AdminCard>

        <AdminCard title="Compilation" accentBar>
          <div className="space-y-4">
            <div className="divide-y divide-neutral-100">
              <AdminToggle
                label="Activer la compilation"
                description="Permet de générer une vidéo unique regroupant toutes les interviews"
                value={compEnabled}
                onChange={setCompEnabled}
              />
              <AdminToggle
                label="Afficher les questions"
                description="Incruste la question en haut de chaque clip selon les timecodes"
                value={compShowQuestions}
                onChange={setCompShowQuestions}
              />
              <AdminToggle
                label="Afficher le logo"
                description="Logo de l'évènement en haut à droite"
                value={compShowLogo}
                onChange={setCompShowLogo}
              />
              <AdminToggle
                label="Afficher le nom des mariés"
                description="Nom de l'évènement en bas à gauche"
                value={compShowEventName}
                onChange={setCompShowEventName}
              />
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Durée de l'intro : {compIntroDuration} seconde{compIntroDuration > 1 ? 's' : ''}
              </p>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={compIntroDuration}
                onChange={(e) => setCompIntroDuration(Number(e.target.value))}
                className="w-full accent-neutral-900"
              />
              <p className="text-neutral-400 text-xs mt-2">
                Carton d'intro avec le nom des mariés et la date.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={startCompile}
                icon={<MdMovie size={20} />}
                fullWidth
                disabled={compStatus.kind === 'running' || !compEnabled}
              >
                {compStatus.kind === 'running'
                  ? `Compilation en coursâ€¦ ${compStatus.percent}%`
                  : 'Générer la compilation maintenant'}
              </Button>

              {compStatus.kind === 'running' && (
                <div className="mt-3">
                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${compStatus.percent}%`,
                        background: 'linear-gradient(135deg, #e8c79a 0%, #d4a574 100%)',
                      }}
                    />
                  </div>
                  <p className="text-neutral-500 text-xs mt-2">{compStatus.stage}</p>
                </div>
              )}

              {compStatus.kind === 'done' && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-emerald-800 text-sm font-medium">
                    Compilation générée avec succès
                  </p>
                  <p className="text-emerald-700 text-xs mt-1 break-all">
                    {compStatus.filepath}
                  </p>
                  <button
                    onClick={openCompilationFolder}
                    className="mt-2 inline-flex items-center gap-2 text-emerald-800 text-xs font-medium hover:underline"
                  >
                    <MdFolder size={14} />
                    Ouvrir le dossier
                  </button>
                </div>
              )}

              {compStatus.kind === 'error' && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-800 text-sm font-medium">
                    Échec de la compilation
                  </p>
                  <p className="text-red-700 text-xs mt-1">{compStatus.message}</p>
                </div>
              )}
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
