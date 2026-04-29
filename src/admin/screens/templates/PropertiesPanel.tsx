import type {
  TemplateElement,
  TextElement,
  ImageElement,
  ShapeElement,
  FrameElement,
  PhotoSlotElement,
} from '@shared/types';
import { localFileUrl } from '@shared/lib/poseAssets';
import { FONT_FAMILIES } from './defaults';

interface Props {
  element: TemplateElement;
  onChange: (updated: TemplateElement) => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-cream/60 text-xs uppercase tracking-widest mb-1">
      {children}
    </span>
  );
}

function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith('#') ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold"
        />
      </div>
    </Row>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row>
      <div className="flex justify-between items-center mb-1">
        <Label>{label}</Label>
        <span className="text-cream/60 text-xs">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
    </Row>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold"
      />
    </Row>
  );
}

function CheckboxInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 mb-3 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-gold"
      />
      <span className="text-cream/80 text-sm">{label}</span>
    </label>
  );
}

// ─── Panels par type ─────────────────────────────────────────────────────────

function TextPanel({ el, onChange }: { el: TextElement; onChange: (u: TemplateElement) => void }) {
  const upd = (patch: Partial<TextElement>) => onChange({ ...el, ...patch });
  const isDynamic = Boolean(el.use_event_name || el.use_event_date);

  return (
    <>
      <Row>
        <div className="flex items-center justify-between mb-1">
          <Label>Texte</Label>
          {isDynamic && (
            <span className="text-[10px] text-gold uppercase tracking-wider">
              {el.use_event_name ? 'Nom auto' : 'Date auto'}
            </span>
          )}
        </div>
        <textarea
          value={el.text}
          onChange={(e) => upd({ text: e.target.value, use_event_name: false, use_event_date: false })}
          rows={3}
          placeholder={isDynamic ? 'Écrire un texte fixe (désactive le mode auto)' : 'Votre texte'}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold resize-none"
        />
        {isDynamic && (
          <p className="text-cream/40 text-[11px] mt-1.5 italic">
            Ce texte sera remplacé par {el.use_event_name ? 'le nom' : 'la date'} de l'évènement à l'impression.
          </p>
        )}
      </Row>

      <CheckboxInput
        label="Utiliser le nom de l'évènement"
        value={el.use_event_name ?? false}
        onChange={(v) => upd({ use_event_name: v, use_event_date: v ? false : el.use_event_date })}
      />
      <CheckboxInput
        label="Utiliser la date de l'évènement"
        value={el.use_event_date ?? false}
        onChange={(v) => upd({ use_event_date: v, use_event_name: v ? false : el.use_event_name })}
      />

      <Row>
        <Label>Police</Label>
        <select
          value={el.font_family}
          onChange={(e) => upd({ font_family: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </Row>

      <NumberInput label="Taille (px)" value={el.font_size} min={8} max={300} onChange={(v) => upd({ font_size: v })} />

      <Row>
        <Label>Graisse</Label>
        <div className="flex gap-2">
          {([400, 600, 700] as const).map((w) => (
            <button
              key={w}
              onClick={() => upd({ font_weight: w })}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                el.font_weight === w ? 'bg-gold text-midnight-950' : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              {w === 400 ? 'Normal' : w === 600 ? 'Semi' : 'Gras'}
            </button>
          ))}
        </div>
      </Row>

      <CheckboxInput label="Italique" value={el.italic} onChange={(v) => upd({ italic: v })} />

      <ColorInput label="Couleur" value={el.color} onChange={(v) => upd({ color: v })} />

      <Row>
        <Label>Alignement</Label>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              onClick={() => upd({ align: a })}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                el.align === a ? 'bg-gold text-midnight-950' : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              {a === 'left' ? 'G' : a === 'center' ? 'C' : 'D'}
            </button>
          ))}
        </div>
      </Row>

      <NumberInput label="Espacement lettres" value={el.letter_spacing} min={-10} max={50} onChange={(v) => upd({ letter_spacing: v })} />
    </>
  );
}

function ImagePanel({ el, onChange }: { el: ImageElement; onChange: (u: TemplateElement) => void }) {
  const upd = (patch: Partial<ImageElement>) => onChange({ ...el, ...patch });

  const pickImage = async () => {
    const path = await window.api.dialog.openImage();
    if (path) upd({ src: path });
  };

  return (
    <>
      <Row>
        <Label>Source image</Label>
        <button
          onClick={pickImage}
          className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-cream/80 text-sm hover:bg-white/10 transition-colors"
        >
          {el.src ? 'Changer l\'image' : 'Choisir une image'}
        </button>
        {el.src && (
          <div className="mt-2 rounded-lg overflow-hidden h-20">
            <img src={localFileUrl(el.src)} alt="" className="w-full h-full object-contain" />
          </div>
        )}
      </Row>

      <SliderInput label="Opacité" value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => upd({ opacity: v / 100 })} />
      <NumberInput label="Border radius" value={el.border_radius} min={0} max={600} onChange={(v) => upd({ border_radius: v })} />

      <Row>
        <Label>Ajustement</Label>
        <div className="flex gap-2">
          {(['contain', 'cover'] as const).map((f) => (
            <button
              key={f}
              onClick={() => upd({ fit: f })}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                el.fit === f ? 'bg-gold text-midnight-950' : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              {f === 'contain' ? 'Contenir' : 'Couvrir'}
            </button>
          ))}
        </div>
      </Row>
    </>
  );
}

function ShapePanel({ el, onChange }: { el: ShapeElement; onChange: (u: TemplateElement) => void }) {
  const upd = (patch: Partial<ShapeElement>) => onChange({ ...el, ...patch });

  return (
    <>
      <Row>
        <Label>Forme</Label>
        <div className="flex gap-2">
          {(['rect', 'circle', 'line'] as const).map((s) => (
            <button
              key={s}
              onClick={() => upd({ shape: s })}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                el.shape === s ? 'bg-gold text-midnight-950' : 'bg-white/5 text-cream/70 hover:bg-white/10'
              }`}
            >
              {s === 'rect' ? 'Rect' : s === 'circle' ? 'Cercle' : 'Ligne'}
            </button>
          ))}
        </div>
      </Row>

      <ColorInput label="Remplissage" value={el.fill} onChange={(v) => upd({ fill: v })} />
      <ColorInput label="Contour" value={el.stroke} onChange={(v) => upd({ stroke: v })} />
      <NumberInput label="Épaisseur contour" value={el.stroke_width} min={0} max={50} onChange={(v) => upd({ stroke_width: v })} />
      {el.shape === 'rect' && (
        <NumberInput label="Border radius" value={el.border_radius} min={0} max={600} onChange={(v) => upd({ border_radius: v })} />
      )}
      <SliderInput label="Opacité" value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => upd({ opacity: v / 100 })} />
    </>
  );
}

function FramePanel({ el, onChange }: { el: FrameElement; onChange: (u: TemplateElement) => void }) {
  const upd = (patch: Partial<FrameElement>) => onChange({ ...el, ...patch });

  return (
    <>
      <ColorInput label="Couleur contour" value={el.stroke} onChange={(v) => upd({ stroke: v })} />
      <NumberInput label="Épaisseur contour" value={el.stroke_width} min={0} max={100} onChange={(v) => upd({ stroke_width: v })} />
      <NumberInput label="Border radius" value={el.border_radius} min={0} max={600} onChange={(v) => upd({ border_radius: v })} />
      <ColorInput label="Fond (transparent = aucun)" value={el.fill} onChange={(v) => upd({ fill: v })} />
    </>
  );
}

function PhotoSlotPanel({ el, onChange }: { el: PhotoSlotElement; onChange: (u: TemplateElement) => void }) {
  const upd = (patch: Partial<PhotoSlotElement>) => onChange({ ...el, ...patch });
  return (
    <NumberInput label="Border radius" value={el.border_radius} min={0} max={600} onChange={(v) => upd({ border_radius: v })} />
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────
export function PropertiesPanel({ element, onChange, onDelete, onBringForward, onSendBackward }: Props) {
  const typeLabel: Record<string, string> = {
    text: 'Texte',
    image: 'Image',
    logo: 'Logo',
    shape: 'Forme',
    frame: 'Cadre',
    'photo-slot': 'Photo',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <span className="text-cream font-medium">{typeLabel[element.type] ?? element.type}</span>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
        >
          Supprimer
        </button>
      </div>

      {/* Z-order */}
      <div className="px-5 py-3 flex gap-2 border-b border-white/10 flex-shrink-0">
        <button
          onClick={onBringForward}
          className="flex-1 py-1.5 rounded-lg bg-white/5 text-cream/70 text-xs hover:bg-white/10 transition-colors"
        >
          Vers l'avant
        </button>
        <button
          onClick={onSendBackward}
          className="flex-1 py-1.5 rounded-lg bg-white/5 text-cream/70 text-xs hover:bg-white/10 transition-colors"
        >
          Vers l'arrière
        </button>
      </div>

      {/* Geometry */}
      <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <Label>X</Label>
            <input
              type="number"
              value={Math.round(element.x)}
              onChange={(e) => onChange({ ...element, x: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <Label>Y</Label>
            <input
              type="number"
              value={Math.round(element.y)}
              onChange={(e) => onChange({ ...element, y: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <Label>Largeur</Label>
            <input
              type="number"
              value={Math.round(element.width)}
              onChange={(e) => onChange({ ...element, width: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <Label>Hauteur</Label>
            <input
              type="number"
              value={Math.round(element.height)}
              onChange={(e) => onChange({ ...element, height: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <Label>Rotation</Label>
            <span className="text-cream/60 text-xs">{element.rotation}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={element.rotation}
            onChange={(e) => onChange({ ...element, rotation: Number(e.target.value) })}
            className="w-full accent-gold"
          />
        </div>
      </div>

      {/* Type-specific props */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {element.type === 'text' && (
          <TextPanel el={element as TextElement} onChange={onChange} />
        )}
        {(element.type === 'image' || element.type === 'logo') && (
          <ImagePanel el={element as ImageElement} onChange={onChange} />
        )}
        {element.type === 'shape' && (
          <ShapePanel el={element as ShapeElement} onChange={onChange} />
        )}
        {element.type === 'frame' && (
          <FramePanel el={element as FrameElement} onChange={onChange} />
        )}
        {element.type === 'photo-slot' && (
          <PhotoSlotPanel el={element as PhotoSlotElement} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
