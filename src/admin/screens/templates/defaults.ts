import type {
  TemplateConfig,
  TemplateElement,
  TextElement,
  PhotoSlotElement,
  ShapeElement,
  FrameElement,
} from '@shared/types';

let _idCounter = 0;
export function genId(): string {
  return `el_${Date.now()}_${_idCounter++}`;
}

export const CANVAS_W = 1200;
export const CANVAS_H = 1800;

export const FONT_FAMILIES = [
  'Fraunces',
  'Manrope',
  'Allura',
  'Dancing Script',
] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];

// ─── Presets de format (portrait par défaut, ratio respecté) ───────────────
// Les dimensions sont stockées en portrait : si l'utilisateur choisit un
// preset alors que le canvas est en paysage, le toggle d'orientation reste
// disponible.
export interface FormatPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: '10x15', label: '10 × 15 cm', width: 1200, height: 1800 },
  { id: '13x18', label: '13 × 18 cm', width: 1560, height: 2160 },
  { id: 'a6', label: 'A6', width: 1240, height: 1748 },
  { id: 'a5', label: 'A5', width: 1748, height: 2480 },
  { id: 'a4', label: 'A4', width: 2480, height: 3508 },
  { id: 'square', label: 'Carré', width: 1500, height: 1500 },
  { id: 'polaroid', label: 'Polaroid', width: 1200, height: 1500 },
];

export const CANVAS_MIN = 400;
export const CANVAS_MAX = 6000;

// ─── Redimensionne un canvas en re-positionnant proportionnellement les
// éléments existants. Utilisé par l'éditeur pour : toggle orientation,
// changement de preset, saisie de dimensions custom.
export function resizeCanvas(
  prev: TemplateConfig,
  newW: number,
  newH: number,
): TemplateConfig {
  const oldW = prev.canvas_width || CANVAS_W;
  const oldH = prev.canvas_height || CANVAS_H;
  if (oldW === newW && oldH === newH) return prev;
  const scaleX = newW / oldW;
  const scaleY = newH / oldH;
  const elements = prev.elements.map((el) => ({
    ...el,
    x: Math.round(el.x * scaleX),
    y: Math.round(el.y * scaleY),
    width: Math.round(el.width * scaleX),
    height: Math.round(el.height * scaleY),
  }));
  return { ...prev, canvas_width: newW, canvas_height: newH, elements };
}

// ─── Template par défaut (nouveau template vierge) ──────────────────────────
export function makeDefaultTemplate(): TemplateConfig {
  const titleEl: TextElement = {
    id: genId(),
    type: 'text',
    x: 100,
    y: 80,
    width: 1000,
    height: 120,
    rotation: 0,
    z: 2,
    text: 'Votre évènement',
    font_family: 'Fraunces',
    font_size: 72,
    font_weight: 400,
    italic: true,
    color: '#0a0e1f',
    align: 'center',
    letter_spacing: 2,
    use_event_name: true,
  };

  const photoSlot: PhotoSlotElement = {
    id: genId(),
    type: 'photo-slot',
    x: 100,
    y: 240,
    width: 1000,
    height: 1300,
    rotation: 0,
    z: 1,
    border_radius: 16,
  };

  const dateEl: TextElement = {
    id: genId(),
    type: 'text',
    x: 100,
    y: 1590,
    width: 1000,
    height: 80,
    rotation: 0,
    z: 2,
    text: '25 août 2025',
    font_family: 'Manrope',
    font_size: 40,
    font_weight: 400,
    italic: false,
    color: '#0a0e1f',
    align: 'center',
    letter_spacing: 4,
    use_event_date: true,
  };

  return {
    canvas_width: CANVAS_W,
    canvas_height: CANVAS_H,
    background_color: '#faf6ef',
    elements: [photoSlot, titleEl, dateEl],
  };
}

// ─── Preset mariage classique ────────────────────────────────────────────────
export function makePresetWedding(): TemplateConfig {
  const frame: FrameElement = {
    id: genId(),
    type: 'frame',
    x: 40,
    y: 40,
    width: 1120,
    height: 1720,
    rotation: 0,
    z: 4,
    stroke: '#d4a574',
    stroke_width: 4,
    border_radius: 0,
    fill: 'transparent',
  };

  const innerFrame: FrameElement = {
    id: genId(),
    type: 'frame',
    x: 60,
    y: 60,
    width: 1080,
    height: 1680,
    rotation: 0,
    z: 3,
    stroke: '#d4a574',
    stroke_width: 1,
    border_radius: 0,
    fill: 'transparent',
  };

  const topDecor: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 550,
    y: 100,
    width: 100,
    height: 4,
    rotation: 0,
    z: 5,
    shape: 'line',
    fill: '#d4a574',
    stroke: '#d4a574',
    stroke_width: 2,
    border_radius: 0,
    opacity: 0.8,
  };

  const title: TextElement = {
    id: genId(),
    type: 'text',
    x: 100,
    y: 120,
    width: 1000,
    height: 140,
    rotation: 0,
    z: 6,
    text: 'Mariage',
    font_family: 'Fraunces',
    font_size: 96,
    font_weight: 400,
    italic: true,
    color: '#0a0e1f',
    align: 'center',
    letter_spacing: 4,
    use_event_name: true,
  };

  const photo: PhotoSlotElement = {
    id: genId(),
    type: 'photo-slot',
    x: 100,
    y: 290,
    width: 1000,
    height: 1250,
    rotation: 0,
    z: 1,
    border_radius: 0,
  };

  const divider: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 400,
    y: 1575,
    width: 400,
    height: 2,
    rotation: 0,
    z: 5,
    shape: 'line',
    fill: '#d4a574',
    stroke: '#d4a574',
    stroke_width: 1,
    border_radius: 0,
    opacity: 0.6,
  };

  const date: TextElement = {
    id: genId(),
    type: 'text',
    x: 100,
    y: 1600,
    width: 1000,
    height: 80,
    rotation: 0,
    z: 6,
    text: '25 août 2025',
    font_family: 'Manrope',
    font_size: 36,
    font_weight: 400,
    italic: false,
    color: '#d4a574',
    align: 'center',
    letter_spacing: 8,
    use_event_date: true,
  };

  return {
    canvas_width: CANVAS_W,
    canvas_height: CANVAS_H,
    background_color: '#fdfbf7',
    elements: [photo, topDecor, frame, innerFrame, title, divider, date],
  };
}

// ─── Preset polaroid ─────────────────────────────────────────────────────────
export function makePresetPolaroid(): TemplateConfig {
  const bg: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 80,
    y: 80,
    width: 1040,
    height: 1440,
    rotation: 0,
    z: 1,
    shape: 'rect',
    fill: '#ffffff',
    stroke: '#e0d8cc',
    stroke_width: 2,
    border_radius: 8,
    opacity: 1,
  };

  const photo: PhotoSlotElement = {
    id: genId(),
    type: 'photo-slot',
    x: 130,
    y: 130,
    width: 940,
    height: 1150,
    rotation: 0,
    z: 2,
    border_radius: 4,
  };

  const caption: TextElement = {
    id: genId(),
    type: 'text',
    x: 130,
    y: 1310,
    width: 940,
    height: 120,
    rotation: 0,
    z: 3,
    text: 'Notre soirée',
    font_family: 'Dancing Script',
    font_size: 72,
    font_weight: 400,
    italic: false,
    color: '#333333',
    align: 'center',
    letter_spacing: 1,
    use_event_name: true,
  };

  const dateCaption: TextElement = {
    id: genId(),
    type: 'text',
    x: 130,
    y: 1440,
    width: 940,
    height: 60,
    rotation: 0,
    z: 3,
    text: '2025',
    font_family: 'Manrope',
    font_size: 32,
    font_weight: 400,
    italic: false,
    color: '#888888',
    align: 'center',
    letter_spacing: 6,
    use_event_date: true,
  };

  return {
    canvas_width: CANVAS_W,
    canvas_height: CANVAS_H,
    background_color: '#f5f0e8',
    elements: [bg, photo, caption, dateCaption],
  };
}

// ─── Preset géométrique ──────────────────────────────────────────────────────
export function makePresetGeometric(): TemplateConfig {
  const topBar: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 0,
    y: 0,
    width: CANVAS_W,
    height: 220,
    rotation: 0,
    z: 1,
    shape: 'rect',
    fill: '#0a0e1f',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 0,
    opacity: 1,
  };

  const bottomBar: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 0,
    y: 1550,
    width: CANVAS_W,
    height: 250,
    rotation: 0,
    z: 1,
    shape: 'rect',
    fill: '#0a0e1f',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 0,
    opacity: 1,
  };

  const accent: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 0,
    y: 215,
    width: CANVAS_W,
    height: 10,
    rotation: 0,
    z: 2,
    shape: 'rect',
    fill: '#d4a574',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 0,
    opacity: 1,
  };

  const accentBottom: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 0,
    y: 1545,
    width: CANVAS_W,
    height: 10,
    rotation: 0,
    z: 2,
    shape: 'rect',
    fill: '#d4a574',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 0,
    opacity: 1,
  };

  const title: TextElement = {
    id: genId(),
    type: 'text',
    x: 60,
    y: 50,
    width: 1080,
    height: 120,
    rotation: 0,
    z: 3,
    text: 'MON EVENEMENT',
    font_family: 'Manrope',
    font_size: 56,
    font_weight: 700,
    italic: false,
    color: '#d4a574',
    align: 'center',
    letter_spacing: 10,
    use_event_name: true,
  };

  const photo: PhotoSlotElement = {
    id: genId(),
    type: 'photo-slot',
    x: 0,
    y: 225,
    width: CANVAS_W,
    height: 1320,
    rotation: 0,
    z: 1,
    border_radius: 0,
  };

  const dateText: TextElement = {
    id: genId(),
    type: 'text',
    x: 60,
    y: 1590,
    width: 1080,
    height: 80,
    rotation: 0,
    z: 3,
    text: '25 AOÛT 2025',
    font_family: 'Manrope',
    font_size: 40,
    font_weight: 700,
    italic: false,
    color: '#ffffff',
    align: 'center',
    letter_spacing: 8,
    use_event_date: true,
  };

  const dotL: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 60,
    y: 1660,
    width: 12,
    height: 12,
    rotation: 0,
    z: 3,
    shape: 'circle',
    fill: '#d4a574',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 50,
    opacity: 1,
  };

  const dotR: ShapeElement = {
    id: genId(),
    type: 'shape',
    x: 1128,
    y: 1660,
    width: 12,
    height: 12,
    rotation: 0,
    z: 3,
    shape: 'circle',
    fill: '#d4a574',
    stroke: 'transparent',
    stroke_width: 0,
    border_radius: 50,
    opacity: 1,
  };

  return {
    canvas_width: CANVAS_W,
    canvas_height: CANVAS_H,
    background_color: '#ffffff',
    elements: [topBar, bottomBar, accent, accentBottom, photo, title, dateText, dotL, dotR],
  };
}

// ─── Fabrique d'éléments nouveaux ────────────────────────────────────────────
export function makeNewElement(
  type: 'text' | 'image' | 'logo' | 'shape' | 'frame' | 'photo-slot',
  canvasW: number,
  canvasH: number,
): TemplateElement {
  const cx = Math.round(canvasW / 2 - 200);
  const cy = Math.round(canvasH / 2 - 100);

  const base = { id: genId(), x: cx, y: cy, rotation: 0, z: 10 };

  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        width: 400,
        height: 80,
        text: 'Texte',
        font_family: 'Fraunces',
        font_size: 48,
        font_weight: 400,
        italic: false,
        color: '#0a0e1f',
        align: 'center',
        letter_spacing: 0,
      } satisfies TextElement;

    case 'image':
    case 'logo':
      return {
        ...base,
        type,
        width: 300,
        height: 300,
        src: '',
        opacity: 1,
        border_radius: 0,
        fit: 'contain',
      };

    case 'shape':
      return {
        ...base,
        type: 'shape',
        width: 300,
        height: 300,
        shape: 'rect',
        fill: '#d4a574',
        stroke: 'transparent',
        stroke_width: 0,
        border_radius: 0,
        opacity: 1,
      } satisfies ShapeElement;

    case 'frame':
      return {
        ...base,
        type: 'frame',
        width: 400,
        height: 400,
        stroke: '#d4a574',
        stroke_width: 4,
        border_radius: 0,
        fill: 'transparent',
      } satisfies FrameElement;

    case 'photo-slot':
      return {
        ...base,
        type: 'photo-slot',
        width: 600,
        height: 800,
        border_radius: 0,
      } satisfies PhotoSlotElement;
  }
}
