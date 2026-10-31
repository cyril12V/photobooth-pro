import type { ImageElement, PhotoSlotElement, TemplateConfig, TextElement } from '../types';

/**
 * Cadre « Planche-contact » pour les tirages 10 × 15 en paysage : la photo est une image
 * de pellicule 35 mm (perforations, nom des mariés imprimé sur le bord, images voisines
 * de part et d'autre), les prénoms en italique et la date dessous, comme une légende
 * de reportage. Partagé entre l'admin (modèle proposé) et la base (ajouté une fois).
 */
export const CONTACT_SHEET_TEMPLATE_NAME = 'Planche-contact';

const W = 1800;
const H = 1200;
/** Papier du tirage : les perforations le laissent voir. */
const PAPER = '#f4f2ed';
const STRIP_Y = 56;
const STRIP_H = 932;
const REBATE = 96;
const GAP = 56;
const PHOTO = { x: 345, y: STRIP_Y + REBATE, w: 1110, h: 740 };
const EDGE_COLOR = '#cfccc5';

function filmStripSvg(): string {
  const holes = Array.from({ length: 16 }, (_, i) => 26 + i * 112)
    .map((x) => `<rect x="${x}" y="14" width="62" height="42" rx="9"/><rect x="${x}" y="${STRIP_H - 56}" width="62" height="42" rx="9"/>`)
    .join('');
  const left = PHOTO.x - GAP - PHOTO.w;
  const right = PHOTO.x + PHOTO.w + GAP;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${STRIP_H}" viewBox="0 0 ${W} ${STRIP_H}">` +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2d2b"/><stop offset="1" stop-color="#161615"/></linearGradient></defs>' +
    `<rect width="${W}" height="${STRIP_H}" fill="#000"/>` +
    `<rect x="${left}" y="${REBATE}" width="${PHOTO.w}" height="${PHOTO.h}" fill="url(#g)"/>` +
    `<rect x="${right}" y="${REBATE}" width="${PHOTO.w}" height="${PHOTO.h}" fill="url(#g)"/>` +
    `<g fill="${PAPER}">${holes}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function edgeText(id: string, text: string, x: number, y: number, extra: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: 'text',
    x,
    y,
    width: 900,
    height: 28,
    rotation: 0,
    z: 3,
    text,
    font_family: 'Archivo Variable',
    font_size: 22,
    font_weight: 600,
    italic: false,
    color: EDGE_COLOR,
    align: 'left',
    letter_spacing: 5,
    ...extra,
  };
}

export function makeContactSheetTemplate(): TemplateConfig {
  const strip: ImageElement = {
    id: 'pc_strip',
    type: 'image',
    x: 0,
    y: STRIP_Y,
    width: W,
    height: STRIP_H,
    rotation: 0,
    z: 1,
    src: filmStripSvg(),
    opacity: 1,
    border_radius: 0,
    fit: 'cover',
  };

  const photo: PhotoSlotElement = {
    id: 'pc_photo',
    type: 'photo-slot',
    x: PHOTO.x,
    y: PHOTO.y,
    width: PHOTO.w,
    height: PHOTO.h,
    rotation: 0,
    z: 2,
    border_radius: 0,
  };

  const names: TextElement = {
    id: 'pc_names',
    type: 'text',
    x: PHOTO.x,
    y: 1016,
    width: 780,
    height: 110,
    rotation: 0,
    z: 3,
    text: 'Les mariés',
    font_family: 'Newsreader Variable',
    font_size: 84,
    font_weight: 330,
    italic: true,
    color: '#000000',
    align: 'left',
    letter_spacing: 0,
    use_event_name: true,
  };

  const date: TextElement = {
    id: 'pc_date',
    type: 'text',
    x: PHOTO.x + PHOTO.w - 300,
    y: 1052,
    width: 300,
    height: 50,
    rotation: 0,
    z: 3,
    text: '31 octobre 2026',
    font_family: 'Newsreader Variable',
    font_size: 40,
    font_weight: 400,
    italic: false,
    color: '#5c5a55',
    align: 'right',
    letter_spacing: 0,
    use_event_date: true,
  };

  const bottomEdge = STRIP_Y + STRIP_H - REBATE + 8;
  return {
    canvas_width: W,
    canvas_height: H,
    background_color: PAPER,
    elements: [
      strip,
      photo,
      edgeText('pc_edge_names', 'Les mariés', PHOTO.x + 40, STRIP_Y + 66, { use_event_name: true, uppercase: true }),
      edgeText('pc_edge_frame', '▸24', PHOTO.x + 40, bottomEdge, { width: 200 }),
      edgeText('pc_edge_frame_a', '24A', PHOTO.x + 595, bottomEdge, { width: 200 }),
      names,
      date,
    ],
  };
}
