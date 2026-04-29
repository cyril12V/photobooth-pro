import { useEffect, useState } from 'react';
import { Printer, Check } from 'lucide-react';
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
            <p className="text-neutral-500 text-sm">Aucune imprimante détectée par le système.</p>
          ) : (
            <div className="space-y-2">
              {printers.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelected(p.name)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-colors
                    ${selected === p.name
                      ? 'bg-neutral-900 text-white border border-neutral-900'
                      : 'bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                    }`}
                >
                  <Printer size={18} className={selected === p.name ? 'text-[#d4a574]' : 'text-neutral-400'} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selected === p.name ? 'text-white' : 'text-neutral-800'}`}>
                      {p.displayName || p.name}
                    </p>
                    {p.isDefault && (
                      <span className="text-xs text-[#d4a574] font-medium uppercase tracking-wider">
                        Par défaut système
                      </span>
                    )}
                  </div>
                  {selected === p.name && <Check size={16} className="text-[#d4a574]" />}
                </button>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard title="Nombre maximum de copies">
          <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
            Limite : {maxCopies} {maxCopies > 1 ? 'copies' : 'copie'}
          </p>
          <input
            type="range"
            min={1}
            max={8}
            value={maxCopies}
            onChange={(e) => setMaxCopies(Number(e.target.value))}
            className="w-full accent-neutral-900"
          />
        </AdminCard>

        <AdminCard
          title="Note pour les imprimantes pro"
          description="DNP, Mitsubishi, Canon Selphy"
        >
          <p className="text-neutral-500 text-sm leading-relaxed">
            En V1, l'impression utilise le pilote système. Pour un contrôle précis (format
            10×15 sans dialogue, gestion bandeau, fin de papier), prévoyez d'intégrer le SDK
            officiel de votre imprimante en V2 (DNP fournit un SDK Windows).
          </p>
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
