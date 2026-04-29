import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  X,
  Type,
  Image,
  Square,
  Circle,
  Minus,
  Frame,
  Camera,
  Star,
  ChevronDown,
  ChevronUp,
  RectangleVertical,
  RectangleHorizontal,
} from 'lucide-react';
import type { TemplateConfig, TemplateElement } from '@shared/types';
import { useAppStore } from '@shared/store';
import { Button } from '@shared/components/Button';
import { AdminInput } from '../../components/AdminUI';
import { EditorCanvas } from './EditorCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import {
  genId,
  makeNewElement,
  makePresetWedding,
  makePresetPolaroid,
  makePresetGeometric,
  CANVAS_W,
  CANVAS_H,
} from './defaults';
import type { FrameElement } from '@shared/types';

interface Props {
  templateId: number;
  templateName: string;
  initialConfig: TemplateConfig;
  onSaved: () => void;
  onCancel: () => void;
}

const SIDEBAR_TOOLS: {
  label: string;
  type: 'text' | 'image' | 'logo' | 'shape' | 'frame' | 'photo-slot';
  icon: React.ReactNode;
  subType?: string;
}[] = [
  { label: 'Texte', type: 'text', icon: <Type size={18} /> },
  { label: 'Image', type: 'image', icon: <Image size={18} /> },
  { label: 'Logo', type: 'logo', icon: <Star size={18} /> },
  { label: 'Rectangle', type: 'shape', icon: <Square size={18} /> },
  { label: 'Cercle', type: 'shape', icon: <Circle size={18} /> },
  { label: 'Ligne', type: 'shape', icon: <Minus size={18} /> },
  { label: 'Cadre', type: 'frame', icon: <Frame size={18} /> },
  { label: 'Photo', type: 'photo-slot', icon: <Camera size={18} /> },
];

const PRESETS = [
  { label: 'Mariage', fn: makePresetWedding },
  { label: 'Polaroid', fn: makePresetPolaroid },
  { label: 'Géométrique', fn: makePresetGeometric },
] as const;

// Calcule la scale pour afficher le canvas dans l'espace disponible
function useCanvasScale(canvasW: number, canvasH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const availW = rect.width - 32;
      const availH = rect.height - 32;
      const s = Math.min(availW / canvasW, availH / canvasH, 1);
      setScale(Math.max(s, 0.1));
    };
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [canvasW, canvasH]);

  return { ref, scale };
}

export function Editor({ templateId, templateName, initialConfig, onSaved, onCancel }: Props) {
  const event = useAppStore((s) => s.event);

  const [name, setName] = useState(templateName);
  const [config, setConfig] = useState<TemplateConfig>(() => ({
    canvas_width: CANVAS_W,
    canvas_height: CANVAS_H,
    background_color: '#faf6ef',
    elements: [],
    ...initialConfig,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const { ref: canvasAreaRef, scale } = useCanvasScale(
    config.canvas_width,
    config.canvas_height,
  );

  // Keyboard: Suppr pour supprimer l'élément sélectionné
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Ne pas supprimer si on est dans un input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedElement = config.elements.find((e) => e.id === selectedId) ?? null;

  const addElement = useCallback(
    (toolIndex: number) => {
      const tool = SIDEBAR_TOOLS[toolIndex];
      let el = makeNewElement(tool.type, config.canvas_width, config.canvas_height);

      // Sous-types pour shapes
      if (tool.type === 'shape') {
        const shapeMap: Record<string, 'rect' | 'circle' | 'line'> = {
          Rectangle: 'rect',
          Cercle: 'circle',
          Ligne: 'line',
        };
        const shape = shapeMap[tool.label];
        if (shape && el.type === 'shape') {
          el = { ...el, shape };
          if (shape === 'circle') el = { ...el, border_radius: 600 };
          if (shape === 'line') el = { ...el, height: 4 };
        }
      }

      // Assigner z max
      const maxZ = config.elements.reduce((m, e) => Math.max(m, e.z), 0);
      el = { ...el, z: maxZ + 1, id: genId() };

      setConfig((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedId(el.id);
    },
    [config],
  );

  const updateElement = useCallback((updated: TemplateElement) => {
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === updated.id ? updated : e)),
    }));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== selectedId),
    }));
    setSelectedId(null);
  }, [selectedId]);

  const bringForward = useCallback(() => {
    if (!selectedElement) return;
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((e) =>
        e.id === selectedElement.id ? { ...e, z: e.z + 1 } : e,
      ),
    }));
  }, [selectedElement]);

  const sendBackward = useCallback(() => {
    if (!selectedElement) return;
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.map((e) =>
        e.id === selectedElement.id ? { ...e, z: Math.max(0, e.z - 1) } : e,
      ),
    }));
  }, [selectedElement]);

  const pickBackground = async () => {
    const path = await window.api.dialog.openImage();
    if (path) setConfig((prev) => ({ ...prev, background_image: path }));
  };

  const applyPreset = (fn: () => TemplateConfig) => {
    setConfig(fn());
    setSelectedId(null);
    setShowPresets(false);
  };

  // ─── Bordures rapides : ajoute / remplace un cadre couvrant tout le canvas ──
  const applyBorder = (style: 'none' | 'thin' | 'double' | 'thick') => {
    setConfig((prev) => {
      // Retire les bordures existantes (id préfixé "border-quick-")
      const filtered = prev.elements.filter((e) => !e.id.startsWith('border-quick-'));
      if (style === 'none') return { ...prev, elements: filtered };

      const w = prev.canvas_width;
      const h = prev.canvas_height;
      const maxZ = filtered.reduce((m, e) => Math.max(m, e.z), 0);

      const baseFrame = {
        id: '',
        type: 'frame' as const,
        x: 0,
        y: 0,
        width: w,
        height: h,
        rotation: 0,
        z: maxZ + 1,
        stroke: '#d4a574',
        stroke_width: 4,
        border_radius: 0,
        fill: 'transparent',
      };

      const frames: FrameElement[] = [];
      if (style === 'thin') {
        frames.push({ ...baseFrame, id: 'border-quick-1', x: 30, y: 30, width: w - 60, height: h - 60, stroke_width: 3 });
      } else if (style === 'double') {
        frames.push({ ...baseFrame, id: 'border-quick-1', x: 30, y: 30, width: w - 60, height: h - 60, stroke_width: 4 });
        frames.push({ ...baseFrame, id: 'border-quick-2', x: 50, y: 50, width: w - 100, height: h - 100, stroke_width: 1, z: maxZ + 2 });
      } else if (style === 'thick') {
        frames.push({ ...baseFrame, id: 'border-quick-1', x: 0, y: 0, width: w, height: h, stroke_width: 40, stroke: '#d4a574' });
      }

      return { ...prev, elements: [...filtered, ...frames] };
    });
  };

  // ─── Toggle orientation portrait / paysage ────────────────────────────────
  const toggleOrientation = useCallback(() => {
    setConfig((prev) => {
      const oldW = prev.canvas_width;
      const oldH = prev.canvas_height;
      const newW = oldH;
      const newH = oldW;
      const scaleX = newW / oldW;
      const scaleY = newH / oldH;
      const resizedElements = prev.elements.map((el) => ({
        ...el,
        x: Math.round(el.x * scaleX),
        y: Math.round(el.y * scaleY),
        width: Math.round(el.width * scaleX),
        height: Math.round(el.height * scaleY),
      }));
      return { ...prev, canvas_width: newW, canvas_height: newH, elements: resizedElements };
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await window.api.template.save({
        id: templateId || undefined,
        name,
        config,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-midnight-950">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div className="w-48 flex-shrink-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-cream text-sm focus:outline-none focus:border-gold"
            placeholder="Nom du template"
          />
        </div>

        {/* Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-cream/70 text-sm hover:bg-white/10 transition-colors"
          >
            Modeles
            {showPresets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showPresets && (
            <div className="absolute top-full left-0 mt-1 w-44 glass-strong rounded-xl border border-white/10 overflow-hidden z-50">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.fn)}
                  className="w-full px-4 py-3 text-left text-cream/80 text-sm hover:bg-white/10 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-cream/70 text-sm hover:bg-white/10 transition-colors"
        >
          <X size={16} />
          Annuler
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-br from-gold-light to-gold text-midnight-950 font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — tools */}
        <div className="w-20 flex-shrink-0 border-r border-white/10 py-4 flex flex-col gap-1 items-center overflow-y-auto">
          {SIDEBAR_TOOLS.map((tool, i) => (
            <button
              key={`${tool.type}-${tool.label}`}
              onClick={() => addElement(i)}
              title={tool.label}
              className="w-14 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-cream/60 hover:bg-white/10 hover:text-cream transition-colors"
            >
              {tool.icon}
              <span className="text-[9px] uppercase tracking-wider leading-tight text-center">{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div
          ref={canvasAreaRef}
          className="flex-1 flex items-center justify-center overflow-auto p-4 bg-midnight-900/50"
          style={{ minWidth: 0 }}
        >
          <EditorCanvas
            config={config}
            selectedId={selectedId}
            scale={scale}
            event={event}
            onSelectElement={setSelectedId}
            onUpdateElement={updateElement}
          />
        </div>

        {/* Right sidebar — properties */}
        <div className="w-72 flex-shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-midnight-950/80">
          {selectedElement ? (
            <PropertiesPanel
              element={selectedElement}
              onChange={updateElement}
              onDelete={deleteSelected}
              onBringForward={bringForward}
              onSendBackward={sendBackward}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-cream/40 p-6 text-center gap-2">
              <Square size={32} className="opacity-30" />
              <p className="text-sm">Sélectionnez un élément pour modifier ses propriétés</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar — canvas settings ─────────────────────────────── */}
      <div className="flex items-center gap-6 px-5 py-3 border-t border-white/10 flex-shrink-0 bg-midnight-900/60">
        <div className="flex items-center gap-3">
          <span className="text-cream/50 text-xs uppercase tracking-widest">Fond</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={config.background_color}
              onChange={(e) => setConfig((prev) => ({ ...prev, background_color: e.target.value }))}
              className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
            />
            <span className="text-cream/60 text-xs font-mono">{config.background_color}</span>
          </div>
        </div>

        <button
          onClick={pickBackground}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cream/70 text-xs hover:bg-white/10 transition-colors"
        >
          <Image size={12} />
          Image de fond
          {config.background_image && (
            <span className="text-gold text-[10px]">✓</span>
          )}
        </button>

        {config.background_image && (
          <button
            onClick={() => setConfig((prev) => ({ ...prev, background_image: null }))}
            className="text-red-400/70 text-xs hover:text-red-400 transition-colors"
          >
            Retirer image
          </button>
        )}

        {/* Bordures rapides */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="text-cream/50 text-xs uppercase tracking-widest">Bords</span>
          <button
            onClick={() => applyBorder('none')}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cream/70 text-xs hover:bg-white/10 transition-colors"
            title="Aucune bordure"
          >
            ✕
          </button>
          <button
            onClick={() => applyBorder('thin')}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cream/70 text-xs hover:bg-white/10 transition-colors"
            title="Filet doré fin"
          >
            ─
          </button>
          <button
            onClick={() => applyBorder('double')}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cream/70 text-xs hover:bg-white/10 transition-colors"
            title="Double filet"
          >
            ═
          </button>
          <button
            onClick={() => applyBorder('thick')}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-cream/70 text-xs hover:bg-white/10 transition-colors"
            title="Cadre épais"
          >
            █
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Toggle portrait / paysage */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => config.canvas_width < config.canvas_height ? undefined : toggleOrientation()}
              title="Portrait"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                config.canvas_width < config.canvas_height
                  ? 'bg-gold/20 text-gold'
                  : 'bg-white/5 text-cream/50 hover:bg-white/10 hover:text-cream/80'
              }`}
            >
              <RectangleVertical size={13} />
              Portrait
            </button>
            <button
              onClick={() => config.canvas_width > config.canvas_height ? undefined : toggleOrientation()}
              title="Paysage"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                config.canvas_width > config.canvas_height
                  ? 'bg-gold/20 text-gold'
                  : 'bg-white/5 text-cream/50 hover:bg-white/10 hover:text-cream/80'
              }`}
            >
              <RectangleHorizontal size={13} />
              Paysage
            </button>
          </div>
          <span className="text-cream/40 text-xs">
            {config.canvas_width} × {config.canvas_height}px
          </span>
        </div>
      </div>
    </div>
  );
}
