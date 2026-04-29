import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Upload, Sparkles, Check } from 'lucide-react';
import type { ChallengePose } from '@shared/types';
import { useAppStore } from '@shared/store';
import { poseSrc, PRESET_POSES, type PresetPose } from '@shared/lib/poseAssets';
import { AdminCard, AdminPageHeader, AdminInput } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

export function ChallengePoses() {
  const { setPoses } = useAppStore();
  const [list, setList] = useState<ChallengePose[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const load = async () => {
    const r = await window.api.pose.list();
    setList(r);
    setPoses(r);
  };

  useEffect(() => {
    load();
  }, []);

  const existingLabels = useMemo(
    () => new Set(list.map((p) => p.label.toLowerCase().trim())),
    [list],
  );

  const pickImage = async () => {
    const p = await window.api.dialog.openImage();
    if (p) setImagePath(p);
  };

  const addPose = async () => {
    if (!label.trim() || !imagePath) return;
    await window.api.pose.add({ label, image_path: imagePath });
    setLabel('');
    setImagePath('');
    setAdding(false);
    await load();
  };

  const addPreset = async (preset: PresetPose) => {
    if (existingLabels.has(preset.label.toLowerCase().trim())) return;
    await window.api.pose.add({ label: preset.label, image_path: preset.image_path });
    setJustAdded(preset.label);
    setTimeout(() => setJustAdded(null), 1500);
    await load();
  };

  const addAllPresets = async () => {
    for (const p of PRESET_POSES) {
      if (!existingLabels.has(p.label.toLowerCase().trim())) {
        await window.api.pose.add({ label: p.label, image_path: p.image_path });
      }
    }
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Supprimer cette pose ?')) return;
    await window.api.pose.delete(id);
    await load();
  };

  return (
    <>
      <AdminPageHeader
        title="Poses challenge"
        description="Bibliothèque de poses à imiter pour le mode challenge"
      />

      {/* ─── Banque de poses prédéfinies ──────────────────────────────────── */}
      <AdminCard
        title="Poses prêtes à l'emploi"
        description="Cliquez pour ajouter une pose à votre bibliothèque"
        className="mb-4"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 text-sm transition-colors"
          >
            <Sparkles size={15} />
            {showPresets ? 'Masquer les poses' : `Afficher ${PRESET_POSES.length} poses prédéfinies`}
          </button>
          {showPresets && (
            <button
              onClick={addAllPresets}
              className="text-[#d4a574] hover:text-amber-600 text-sm font-medium transition-colors"
            >
              Tout ajouter
            </button>
          )}
        </div>

        {showPresets && (
          <div className="grid grid-cols-4 gap-3">
            {PRESET_POSES.map((p) => {
              const already = existingLabels.has(p.label.toLowerCase().trim());
              const isJust = justAdded === p.label;
              return (
                <button
                  key={p.label}
                  onClick={() => addPreset(p)}
                  disabled={already}
                  className={`group relative rounded-xl p-2 border transition-all ${
                    already
                      ? 'bg-neutral-50 border-neutral-200 opacity-40 cursor-not-allowed'
                      : 'bg-neutral-50 border-neutral-200 hover:border-[#d4a574]/60 hover:bg-amber-50'
                  }`}
                  title={already ? 'Déjà ajoutée' : `Ajouter "${p.label}"`}
                >
                  <img
                    src={p.image_path}
                    alt={p.label}
                    className="w-full aspect-square object-contain"
                  />
                  <p className="text-neutral-600 text-xs text-center mt-1 truncate">
                    {p.label}
                  </p>
                  {already && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check size={12} className="text-emerald-600" />
                    </div>
                  )}
                  {isJust && (
                    <div className="absolute inset-0 rounded-xl bg-[#d4a574]/20 flex items-center justify-center pointer-events-none">
                      <Check size={26} className="text-[#d4a574]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </AdminCard>

      {adding && (
        <AdminCard title="Ajouter une pose" className="mb-4">
          <div className="space-y-4">
            <AdminInput
              label="Libellé"
              value={label}
              onChange={setLabel}
              placeholder="Ex : Saut groupé"
            />
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Image / icône
              </p>
              {imagePath ? (
                <div className="relative w-32">
                  <img
                    src={poseSrc(imagePath)}
                    alt="Pose"
                    className="w-32 h-32 object-contain bg-neutral-50 rounded-xl border border-neutral-200 p-2"
                  />
                  <button
                    onClick={pickImage}
                    className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 hover:bg-neutral-900/60 rounded-xl transition-colors text-white opacity-0 hover:opacity-100 text-xs font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickImage}
                  className="w-32 h-32 border-2 border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-xs">Choisir</span>
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={() => setAdding(false)}>
                Annuler
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={addPose}
                disabled={!label || !imagePath}
                className="flex-1"
              >
                Ajouter la pose
              </Button>
            </div>
          </div>
        </AdminCard>
      )}

      {list.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center mb-4 shadow-sm">
          <p className="text-neutral-500 mb-2">Aucune pose pour le moment</p>
          <p className="text-neutral-400 text-sm">
            Ajoutez des poses fun pour activer le mode challenge
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-4">
          {list.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-neutral-200 rounded-2xl p-4 group relative shadow-sm"
            >
              <img
                src={poseSrc(p.image_path)}
                alt={p.label}
                className="w-full aspect-square object-contain bg-neutral-50 rounded-xl mb-3 p-2"
              />
              <p className="text-neutral-800 font-medium text-sm text-center truncate">
                {p.label}
              </p>
              <button
                onClick={() => remove(p.id)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border border-red-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding && (
        <Button
          variant="primary"
          onClick={() => setAdding(true)}
          icon={<Plus size={20} />}
          fullWidth
        >
          Ajouter une pose
        </Button>
      )}
    </>
  );
}
