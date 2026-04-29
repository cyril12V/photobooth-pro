import { useState } from 'react';
import { Save, Upload, Check } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { localFileUrl } from '@shared/lib/poseAssets';
import { AdminCard, AdminPageHeader, AdminInput } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

export function EventSettings() {
  const { event, setEvent } = useAppStore();
  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [logoPath, setLogoPath] = useState(event?.logo_path ?? '');
  const [bgPath, setBgPath] = useState(event?.background_path ?? '');
  const [saved, setSaved] = useState(false);

  const pickLogo = async () => {
    const p = await window.api.dialog.openImage();
    if (p) setLogoPath(p);
  };

  const pickBg = async () => {
    const p = await window.api.dialog.openImage();
    if (p) setBgPath(p);
  };

  const save = async () => {
    const payload = {
      name,
      date,
      logo_path: logoPath || null,
      background_path: bgPath || null,
      theme_primary: event?.theme_primary ?? '#0a0e1f',
      theme_secondary: event?.theme_secondary ?? '#d4a574',
      theme_accent: event?.theme_accent ?? '#ff8e72',
    };
    await window.api.event.save(payload);
    const updated = await window.api.event.current();
    if (updated) setEvent(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader
        title="Évènement"
        description="Personnalisez l'écran d'accueil de vos invités"
      />

      <div className="space-y-4">
        <AdminCard title="Informations" description="Nom et date affichés sur l'écran d'accueil">
          <div className="space-y-4">
            <AdminInput
              label="Nom de l'évènement"
              value={name}
              onChange={setName}
              placeholder="Mariage Marie & Thomas"
            />
            <AdminInput label="Date" type="date" value={date} onChange={setDate} />
          </div>
        </AdminCard>

        <AdminCard title="Visuels" description="Logo et image de fond personnalisés">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Logo / photo
              </p>
              {logoPath ? (
                <div className="relative">
                  <img
                    src={localFileUrl(logoPath)}
                    alt="Logo"
                    className="w-full h-40 object-contain bg-neutral-50 rounded-xl border border-neutral-200 p-3"
                  />
                  <button
                    onClick={pickLogo}
                    className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 hover:bg-neutral-900/60 rounded-xl transition-colors text-white opacity-0 hover:opacity-100 text-sm font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickLogo}
                  className="w-full h-40 border-2 border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors"
                >
                  <Upload size={22} />
                  <span className="text-sm">Choisir une image</span>
                </button>
              )}
            </div>

            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Image de fond
              </p>
              {bgPath ? (
                <div className="relative">
                  <img
                    src={localFileUrl(bgPath)}
                    alt="Fond"
                    className="w-full h-40 object-cover rounded-xl border border-neutral-200"
                  />
                  <button
                    onClick={pickBg}
                    className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 hover:bg-neutral-900/60 rounded-xl transition-colors text-white opacity-0 hover:opacity-100 text-sm font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickBg}
                  className="w-full h-40 border-2 border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors"
                >
                  <Upload size={22} />
                  <span className="text-sm">Choisir une image</span>
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <Button
          variant="secondary"
          icon={saved ? <Check size={20} /> : <Save size={20} />}
          onClick={save}
          fullWidth
        >
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
