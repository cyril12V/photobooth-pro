import { useEffect, useMemo, useState } from 'react';
import { MdAdd, MdDelete, MdFileUpload, MdAutoAwesome, MdCheck } from 'react-icons/md';
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
            className="flex items-center gap-2 transition-colors"
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <MdAutoAwesome size={15} />
            {showPresets ? 'Masquer les poses' : `Afficher ${PRESET_POSES.length} poses prédéfinies`}
          </button>
          {showPresets && (
            <button
              onClick={addAllPresets}
              className="label-editorial transition-colors"
              style={{ color: '#1A1A1A', background: 'transparent', border: 'none', cursor: 'pointer' }}
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
                  className="group relative p-2 transition-all"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px solid rgba(212, 184, 150, 0.3)',
                    borderRadius: '4px',
                    opacity: already ? 0.4 : 1,
                    cursor: already ? 'not-allowed' : 'pointer',
                  }}
                  title={already ? 'Déjà ajoutée' : `Ajouter "${p.label}"`}
                >
                  <img
                    src={p.image_path}
                    alt={p.label}
                    className="w-full aspect-square object-contain"
                  />
                  <p
                    className="text-center mt-1 truncate"
                    style={{
                      color: '#6B5D4F',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.75rem',
                    }}
                  >
                    {p.label}
                  </p>
                  {already && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }}
                    >
                      <MdCheck size={12} style={{ color: '#FAF6EE' }} />
                    </div>
                  )}
                  {isJust && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ backgroundColor: 'rgba(26,26,26,0.15)', borderRadius: '4px' }}
                    >
                      <MdCheck size={26} style={{ color: '#1A1A1A' }} />
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
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Image / icône
              </p>
              {imagePath ? (
                <div className="relative w-32">
                  <img
                    src={poseSrc(imagePath)}
                    alt="Pose"
                    className="w-32 h-32 object-contain p-2"
                    style={{
                      backgroundColor: '#F4ECDD',
                      border: '1px solid rgba(212, 184, 150, 0.4)',
                      borderRadius: '4px',
                    }}
                  />
                  <button
                    onClick={pickImage}
                    className="absolute inset-0 flex items-center justify-center transition-colors opacity-0 hover:opacity-100"
                    style={{
                      backgroundColor: 'rgba(26,26,26,0.6)',
                      color: '#FAF6EE',
                      borderRadius: '4px',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      cursor: 'pointer',
                    }}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickImage}
                  className="w-32 h-32 flex flex-col items-center justify-center gap-2 transition-colors"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px dashed rgba(212, 184, 150, 0.6)',
                    color: '#6B5D4F',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <MdFileUpload size={20} />
                  <span className="label-editorial">Choisir</span>
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
        <div
          className="p-12 text-center mb-4"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid rgba(212, 184, 150, 0.2)',
            borderRadius: '24px',
          }}
        >
          <p
            className="font-editorial mb-2"
            style={{ fontSize: '1.5rem', color: '#1A1A1A', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Aucune pose
          </p>
          <p style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
            Ajoutez des poses fun pour activer le mode challenge.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-4">
          {list.map((p) => (
            <div
              key={p.id}
              className="p-4 group relative"
              style={{
                backgroundColor: '#FAF6EE',
                border: '1px solid rgba(212, 184, 150, 0.2)',
                borderRadius: '24px',
              }}
            >
              <img
                src={poseSrc(p.image_path)}
                alt={p.label}
                className="w-full aspect-square object-contain mb-3 p-2"
                style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }}
              />
              <p
                className="text-center truncate"
                style={{
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {p.label}
              </p>
              <button
                onClick={() => remove(p.id)}
                className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  backgroundColor: '#1A1A1A',
                  color: '#FAF6EE',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <MdDelete size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding && (
        <Button
          variant="primary"
          onClick={() => setAdding(true)}
          icon={<MdAdd size={20} />}
          fullWidth
        >
          Ajouter une pose
        </Button>
      )}
    </>
  );
}
