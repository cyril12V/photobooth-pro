import { useEffect, useState } from 'react';
import { MdPrint, MdCheck } from 'react-icons/md';
import type { PrinterInfo } from '@shared/types';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

export function PrinterSettings() {
  const { settings, setSettings } = useAppStore();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selected, setSelected] = useState(settings?.printer_name ?? '');
  const [maxCopies, setMaxCopies] = useState(settings?.max_copies ?? 4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.printer.list().then(setPrinters);
  }, []);

  const save = async () => {
    await window.api.settings.set('printer_name', selected);
    await window.api.settings.set('max_copies', maxCopies);
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
          title="Note pour les imprimantes pro"
          description="DNP, Mitsubishi, Canon Selphy"
        >
          <p
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
          >
            En V1, l'impression utilise le pilote système. Pour un contrôle précis (format
            10x15 sans dialogue, gestion bandeau, fin de papier), prévoyez d'intégrer le SDK
            officiel de votre imprimante en V2 (DNP fournit un SDK Windows).
          </p>
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
