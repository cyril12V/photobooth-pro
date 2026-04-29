import { useEffect, useState } from 'react';
import { MdMic, MdCheck, MdMovie, MdFolder } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

const RESOLUTIONS = ['1080p', '720p', '480p'] as const;
type Resolution = (typeof RESOLUTIONS)[number];

type CompileStatus =
  | { kind: 'idle' }
  | { kind: 'running'; percent: number; stage: string }
  | { kind: 'done'; filepath: string }
  | { kind: 'error'; message: string };

export function VideoSettings() {
  const { settings, setSettings } = useAppStore();
  const [enabled, setEnabled] = useState(settings?.video_enabled ?? true);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState(settings?.microphone_device_id ?? '');
  const [resolution, setResolution] = useState<Resolution>(
    settings?.video_resolution ?? '1080p',
  );
  const [maxDuration, setMaxDuration] = useState(settings?.video_max_duration_seconds ?? 30);
  const [defaultQuestionSec, setDefaultQuestionSec] = useState(
    settings?.video_default_question_seconds ?? 15,
  );
  const [beep, setBeep] = useState(settings?.video_interview_beep ?? true);
  const [flash, setFlash] = useState(settings?.video_interview_flash ?? true);
  const [saved, setSaved] = useState(false);

  // Compilation
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
        // Petite demande pour autoriser l'accès et obtenir les labels
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {}
      const all = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(all.filter((d) => d.kind === 'audioinput'));
    })();
  }, []);

  // Listener progress compilation — un seul listener, vivant tant que la page existe
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
    await window.api.settings.set('video_enabled', enabled);
    await window.api.settings.set('microphone_device_id', micId);
    await window.api.settings.set('video_resolution', resolution);
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
    // Sauvegarde des settings avant compilation pour qu'ils soient pris en compte
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
        title="Vidéo"
        description="Configurez le mode vidéo (interview guidée + message libre)"
      />

      <div className="space-y-4">
        <AdminCard title="Activation">
          <AdminToggle
            label="Activer le mode Vidéobooth"
            description="Affiche la sélection Photo/Vidéo au lancement de la borne"
            value={enabled}
            onChange={setEnabled}
          />
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
        </AdminCard>

        <AdminCard title="Qualité">
          <div className="space-y-4">
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Résolution
              </p>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                      resolution === r
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-neutral-400 text-xs mt-2">
                1080p ≈ 35 MB/min · 720p ≈ 18 MB/min · 480p ≈ 8 MB/min (codec VP9)
              </p>
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
                  ? `Compilation en cours… ${compStatus.percent}%`
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
