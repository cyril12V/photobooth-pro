import { useState } from 'react';
import { Check, Save, Upload, Image } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader } from '../components/AdminUI';
import { Button } from '@shared/components/Button';
import { DECOR_OPTIONS, CornerDecor } from '@client/components/decors';
import type { DecorStyle } from '@shared/types';

const PRESETS = [
  { name: 'Or & Corail', primary: '#0a0e1f', secondary: '#d4a574', accent: '#ff8e72' },
  { name: 'Rose & Champagne', primary: '#1a0e1c', secondary: '#e8c79a', accent: '#f4a8c0' },
  { name: 'Émeraude & Or', primary: '#0c1f1a', secondary: '#d4af37', accent: '#3ec78c' },
  { name: 'Bleu nuit', primary: '#0a0e1f', secondary: '#7ba8d9', accent: '#a8d4ff' },
  { name: 'Bourgogne', primary: '#1c0e0e', secondary: '#c8a268', accent: '#a93838' },
  { name: 'Minimal', primary: '#1a1a1a', secondary: '#fafafa', accent: '#888888' },
];

export function ThemeSettings() {
  const { event, setEvent, settings, setSettings } = useAppStore();
  const [primary, setPrimary] = useState(event?.theme_primary ?? '#0a0e1f');
  const [secondary, setSecondary] = useState(event?.theme_secondary ?? '#d4a574');
  const [accent, setAccent] = useState(event?.theme_accent ?? '#ff8e72');
  const [saved, setSaved] = useState(false);

  const currentDecor: DecorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;

  const selectDecor = async (id: DecorStyle) => {
    await window.api.settings.set('decor_style', id);
    const fresh = await window.api.settings.get();
    setSettings(fresh);
  };

  const pickCustomImage = async () => {
    const path = await window.api.dialog.openImage();
    if (!path) return;
    await window.api.settings.set('decor_custom_path', path);
    const fresh = await window.api.settings.get();
    setSettings(fresh);
  };

  const apply = (p: (typeof PRESETS)[0]) => {
    setPrimary(p.primary);
    setSecondary(p.secondary);
    setAccent(p.accent);
  };

  const save = async () => {
    if (!event) return;
    await window.api.event.save({
      ...event,
      theme_primary: primary,
      theme_secondary: secondary,
      theme_accent: accent,
    });
    const updated = await window.api.event.current();
    if (updated) setEvent(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <AdminPageHeader
        title="Thème"
        description="Personnalisez les couleurs de l'interface invitée"
      />

      <div className="space-y-4">
        <AdminCard title="Décors d'angle">
          <div className="grid grid-cols-3 gap-3">
            {DECOR_OPTIONS.map((opt) => {
              const isSelected = currentDecor === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => selectDecor(opt.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl p-3 border transition-all ${
                    isSelected
                      ? 'border-[#d4a574] bg-[#d4a574]/8 shadow-sm'
                      : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100'
                  }`}
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-white border border-neutral-100">
                    {opt.id === 'none' || opt.id === 'custom' ? (
                      opt.preview
                    ) : (
                      <CornerDecor style={opt.id} position="tl" className="w-full h-full" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-neutral-700">{opt.label}</p>
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-[#d4a574]">
                      <Check size={11} color="white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Upload image custom */}
          {currentDecor === 'custom' && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-neutral-500 italic">
                L'image sera répétée aux 4 angles (avec miroir automatique).
              </p>
              {customImagePath ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 flex-shrink-0">
                    <img
                      src={`file://${customImagePath}`}
                      alt="Décor personnalisé"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500 truncate">{customImagePath.split(/[\\/]/).pop()}</p>
                    <button
                      onClick={pickCustomImage}
                      className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#d4a574] hover:text-[#c8956a] transition-colors"
                    >
                      <Upload size={12} />
                      Changer l'image
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={pickCustomImage}
                  className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 text-sm hover:border-[#d4a574] hover:text-[#d4a574] transition-colors"
                >
                  <Image size={16} />
                  Choisir une image
                </button>
              )}
            </div>
          )}
        </AdminCard>

        <AdminCard title="Palettes prédéfinies">
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => apply(p)}
                className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-left hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
              >
                <div className="flex gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg border border-neutral-200 shadow-sm"
                    style={{ background: p.primary }}
                  />
                  <div
                    className="w-7 h-7 rounded-lg border border-neutral-200 shadow-sm"
                    style={{ background: p.secondary }}
                  />
                  <div
                    className="w-7 h-7 rounded-lg border border-neutral-200 shadow-sm"
                    style={{ background: p.accent }}
                  />
                </div>
                <p className="text-neutral-800 font-medium text-sm">{p.name}</p>
              </button>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Couleurs personnalisées">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Primaire (fond)', val: primary, set: setPrimary },
              { label: 'Secondaire (or)', val: secondary, set: setSecondary },
              { label: 'Accent (corail)', val: accent, set: setAccent },
            ].map((c) => (
              <div key={c.label}>
                <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-2">
                  {c.label}
                </p>
                <input
                  type="color"
                  value={c.val}
                  onChange={(e) => c.set(e.target.value)}
                  className="w-full h-14 rounded-xl bg-neutral-50 border border-neutral-200 cursor-pointer"
                />
                <p className="text-neutral-400 text-xs mt-2 text-center font-mono">
                  {c.val.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Aperçu">
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${primary} 100%)`,
              border: `1px solid ${secondary}33`,
            }}
          >
            <p
              className="text-xs uppercase tracking-[0.4em] mb-4"
              style={{ color: `${secondary}99` }}
            >
              Aperçu
            </p>
            <h3
              className="font-display italic text-4xl mb-3"
              style={{
                background: `linear-gradient(135deg, ${secondary} 0%, ${accent} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Mon Évènement
            </h3>
            <button
              className="px-8 py-3 rounded-full text-sm font-medium"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: 'white',
              }}
            >
              Commencer
            </button>
          </div>
        </AdminCard>

        <Button
          variant="secondary"
          onClick={save}
          icon={saved ? <Check size={20} /> : <Save size={20} />}
          fullWidth
        >
          {saved ? 'Enregistré !' : 'Appliquer le thème'}
        </Button>
      </div>
    </>
  );
}
