import { useEffect, useState } from 'react';
import { MdMic, MdCheck, MdMovie, MdFolder } from 'react-icons/md';
import {
  CAPTURE_RESOLUTION_MAP,
  CAPTURE_RESOLUTIONS,
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

    setCompStatus({ kind: 'running', percent: 0, stage: 'DÃ©marrage' });
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
              Aucun micro dÃ©tectÃ©. Branchez votre micro externe ou autorisez l'accÃ¨s.
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
                <span className="flex-1 text-sm font-medium">Micro par dÃ©faut du systÃ¨me</span>
                {!micId && <MdCheck size={16} style={{ color: '#D4B896' }} />}
              </button>
            </div>
          )}
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
                Poids approximatif : 4K ≈ 50 MB/min, 1080p ≈ 30 MB/min, 720p ≈ 15 MB/min, 480p ≈ 8 MB/min.
              </p>
              <p className="text-neutral-400 text-xs mt-1">
                La 4K est exigeante : ta caméra doit fournir un vrai flux 4K (Canon R6 Mark II en mode Webcam Utility, Sony Imaging Edge, GoPro, etc.) et la machine doit pouvoir l'encoder en temps réel. En cas de lag ou de fichier cassé, retombe en 1080p.
              </p>
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                DurÃ©e max message libre : {maxDuration} secondes
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
                DurÃ©e par dÃ©faut d'une question : {defaultQuestionSec} secondes
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
                Cette valeur est utilisÃ©e comme valeur initiale pour les nouvelles questions.
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Transitions entre questions (interview)">
          <div className="divide-y divide-neutral-100">
            <AdminToggle
              label="Bip audio entre questions"
              description="Discret, aide au repÃ©rage des coupes au montage"
              value={beep}
              onChange={setBeep}
            />
            <AdminToggle
              label="Flash visuel entre questions"
              description="Court Ã©clair blanc, repÃ©rable visuellement au montage"
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
                description="Permet de gÃ©nÃ©rer une vidÃ©o unique regroupant toutes les interviews"
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
                description="Logo de l'Ã©vÃ¨nement en haut Ã  droite"
                value={compShowLogo}
                onChange={setCompShowLogo}
              />
              <AdminToggle
                label="Afficher le nom des mariÃ©s"
                description="Nom de l'Ã©vÃ¨nement en bas Ã  gauche"
                value={compShowEventName}
                onChange={setCompShowEventName}
              />
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                DurÃ©e de l'intro : {compIntroDuration} seconde{compIntroDuration > 1 ? 's' : ''}
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
                Carton d'intro avec le nom des mariÃ©s et la date.
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
                  : 'GÃ©nÃ©rer la compilation maintenant'}
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
                    Compilation gÃ©nÃ©rÃ©e avec succÃ¨s
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
                    Ã‰chec de la compilation
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
          {saved ? 'EnregistrÃ©' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
