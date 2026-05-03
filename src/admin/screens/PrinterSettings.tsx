import { useEffect, useState } from 'react';
import { MdPrint, MdCheck } from 'react-icons/md';
import type { PrinterInfo } from '@shared/types';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

type PaperFormat = '4x6' | '5x7' | '6x8';
const PAPER_FORMATS: { id: PaperFormat; label: string; cm: string }[] = [
  { id: '4x6', label: '4×6', cm: '10×15 cm' },
  { id: '5x7', label: '5×7', cm: '13×18 cm' },
  { id: '6x8', label: '6×8', cm: '15×20 cm' },
];

export function PrinterSettings() {
  const { settings, setSettings } = useAppStore();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selected, setSelected] = useState(settings?.printer_name ?? '');
  const [maxCopies, setMaxCopies] = useState(settings?.max_copies ?? 4);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>(
    settings?.paper_format ?? '4x6',
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.printer.list().then(setPrinters);
  }, []);

  const save = async () => {
    await window.api.settings.set('printer_name', selected);
    await window.api.settings.set('max_copies', maxCopies);
    await window.api.settings.set('paper_format', paperFormat);
    const newSettings = await window.api.settings.get();
    setSettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader
        title="Imprimante"
        description="Sélectionnez l'imprimante photo et la limite de copies"
      />

      <div className="space-y-4">
        <AdminCard title="Imprimante par défaut">
          {printers.length === 0 ? (
            <p style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
              Aucune imprimante détectée par le système.
            </p>
          ) : (
            <div className="space-y-2">
              {printers.map((p) => {
                const active = selected === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setSelected(p.name)}
                    className="w-full flex items-center gap-3 p-3.5 text-left transition-colors"
                    style={{
                      backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
                      color: active ? '#FAF6EE' : '#1A1A1A',
                      border: '1px solid rgba(212, 184, 150, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <MdPrint size={18} style={{ color: active ? '#D4B896' : '#6B5D4F' }} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                        }}
                      >
                        {p.displayName || p.name}
                      </p>
                      {p.isDefault && (
                        <span
                          className="label-editorial"
                          style={{ color: active ? '#D4B896' : '#6B5D4F', fontSize: '0.6875rem' }}
                        >
                          Par défaut système
                        </span>
                      )}
                    </div>
                    {active && <MdCheck size={16} style={{ color: '#D4B896' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard
          title="Format papier"
          description="Adapté à votre imprimante (DNP DS620 supporte 4×6, 5×7, 6×8)"
        >
          <div className="grid grid-cols-3 gap-3">
            {PAPER_FORMATS.map((p) => {
              const active = paperFormat === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPaperFormat(p.id)}
                  className="p-4 text-center transition-colors"
                  style={{
                    backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
                    color: active ? '#FAF6EE' : '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <p
                    style={{
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                      fontSize: '1.5rem',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {p.label}
                  </p>
                  <p
                    className="label-editorial"
                    style={{
                      color: active ? '#D4B896' : '#6B5D4F',
                      fontSize: '0.6875rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    {p.cm}
                  </p>
                </button>
              );
            })}
          </div>
        </AdminCard>

        <AdminCard title="Nombre maximum de copies">
          <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
            Limite : {maxCopies} {maxCopies > 1 ? 'copies' : 'copie'}
          </p>
          <input
            type="range"
            min={1}
            max={8}
            value={maxCopies}
            onChange={(e) => setMaxCopies(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#1A1A1A' }}
          />
        </AdminCard>

        <AdminCard
          title="Aperçu d'impression"
          description="L'aperçu Windows s'ouvre avant chaque impression"
        >
          <p
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              marginBottom: '0.75rem',
            }}
          >
            Quand un invité clique sur <strong>Imprimer</strong>, le dialog Windows
            s'ouvre avec l'aperçu de la photo. Ajustez l'orientation et le format,
            puis validez. C'est exactement la même UI que celle de l'Explorateur
            Windows quand vous imprimez manuellement.
          </p>
          <div
            style={{
              backgroundColor: '#F4ECDD',
              border: '1px solid rgba(212, 184, 150, 0.5)',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '0.5rem',
            }}
          >
            <p
              className="label-editorial"
              style={{ color: '#1A1A1A', marginBottom: '0.5rem' }}
            >
              Réglages recommandés DNP DS620
            </p>
            <ul
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem',
                lineHeight: 1.7,
                margin: 0,
                paddingLeft: '1.25rem',
              }}
            >
              <li><strong>Orientation</strong> : Portrait</li>
              <li><strong>Format papier</strong> : 6×4 (= 15,24 × 10,16 cm). Certains pilotes affichent <em>15,61 × 10,5 cm</em> selon la zone d'impression utile.</li>
              <li><strong>Marges</strong> : Sans marges / Pleine page</li>
              <li><strong>Qualité</strong> : 300 DPI (par défaut)</li>
            </ul>
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
