import { useState } from 'react';
import { MdSave, MdFileUpload, MdCheck } from 'react-icons/md';
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
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Logo / photo
              </p>
              {logoPath ? (
                <div className="relative">
                  <img
                    src={localFileUrl(logoPath)}
                    alt="Logo"
                    className="w-full h-40 object-contain p-3"
                    style={{
                      backgroundColor: '#F4ECDD',
                      borderRadius: '4px',
                      border: '1px solid rgba(212, 184, 150, 0.4)',
                    }}
                  />
                  <button
                    onClick={pickLogo}
                    className="absolute inset-0 flex items-center justify-center transition-colors text-sm font-medium opacity-0 hover:opacity-100"
                    style={{
                      backgroundColor: 'rgba(26,26,26,0.6)',
                      color: '#FAF6EE',
                      borderRadius: '4px',
                      fontFamily: 'Inter, sans-serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickLogo}
                  className="w-full h-40 flex flex-col items-center justify-center gap-2 transition-colors"
                  style={{
                    border: '1px dashed rgba(212, 184, 150, 0.6)',
                    backgroundColor: '#F4ECDD',
                    color: '#6B5D4F',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <MdFileUpload size={22} />
                  <span className="label-editorial">Choisir une image</span>
                </button>
              )}
            </div>

            <div>
              <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
                Image de fond
              </p>
              {bgPath ? (
                <div className="relative">
                  <img
                    src={localFileUrl(bgPath)}
                    alt="Fond"
                    className="w-full h-40 object-cover"
                    style={{
                      borderRadius: '4px',
                      border: '1px solid rgba(212, 184, 150, 0.4)',
                    }}
                  />
                  <button
                    onClick={pickBg}
                    className="absolute inset-0 flex items-center justify-center transition-colors opacity-0 hover:opacity-100"
                    style={{
                      backgroundColor: 'rgba(26,26,26,0.6)',
                      color: '#FAF6EE',
                      borderRadius: '4px',
                      fontFamily: 'Inter, sans-serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={pickBg}
                  className="w-full h-40 flex flex-col items-center justify-center gap-2 transition-colors"
                  style={{
                    border: '1px dashed rgba(212, 184, 150, 0.6)',
                    backgroundColor: '#F4ECDD',
                    color: '#6B5D4F',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <MdFileUpload size={22} />
                  <span className="label-editorial">Choisir une image</span>
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <Button
          variant="primary"
          icon={saved ? <MdCheck size={20} /> : <MdSave size={20} />}
          onClick={save}
          fullWidth
        >
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </div>
    </>
  );
}
