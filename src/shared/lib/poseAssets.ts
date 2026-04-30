/**
 * Convertit un chemin local en URL utilisable par <img> dans le renderer Electron.
 * - data: URL / http(s) → renvoyé tel quel
 * - chemin absolu local → file:// (autorisé car webSecurity:false dans BrowserWindow)
 */
export function localFileUrl(p: string): string {
  if (!p) return '';
  if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  if (p.startsWith('file://')) return p;
  // Normalise les séparateurs Windows en forward slashes
  const normalized = p.replace(/\\/g, '/');
  return `file:///${normalized}`;
}

/** Alias historique pour les poses (data URLs SVG ou chemins). */
export const poseSrc = localFileUrl;

/**
 * Échappe les caractères XML pour insertion sécurisée dans un attribut/texte SVG.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Pictogrammes éditoriaux dessinés à la ligne fine (1.4pt noir #1A1A1A) sur
 * fond ivoire. Centrés autour de (100, 50) dans un viewBox 200×200.
 * Chaque pictogramme évoque la pose sans être figuratif — style
 * "ornement Vogue", géométrique mais signifiant.
 */
const POSE_PICTOGRAMS: Record<string, string> = {
  // Câlin — deux silhouettes qui se touchent (deux ronds qui se chevauchent)
  Câlin:
    '<circle cx="92" cy="48" r="9" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>' +
    '<circle cx="108" cy="48" r="9" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>',
  // Bisou — lèvres stylisées (deux arcs)
  Bisou:
    '<path d="M84 50 Q92 40 100 50 Q108 40 116 50" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M84 50 Q92 60 100 50 Q108 60 116 50" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>',
  // Saut groupé — silhouette de saut (V inversé surmonté d'un point)
  'Saut groupé':
    '<circle cx="100" cy="36" r="3" fill="#1A1A1A"/>' +
    '<path d="M88 60 L100 44 L112 60" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M82 64 L100 60 L118 64" fill="none" stroke="#1A1A1A" stroke-width="1" opacity="0.5"/>',
  // Danse — deux courbes en mouvement (S)
  Danse:
    '<path d="M86 38 Q100 50 86 62" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M114 38 Q100 50 114 62" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>',
  // Cœur mains — un cœur ligne fine
  'Cœur mains':
    '<path d="M100 62 C 80 50 80 36 92 36 C 96 36 100 40 100 44 C 100 40 104 36 108 36 C 120 36 120 50 100 62 Z" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>',
  // Rock & Roll — geste cornes (silhouette de main fine, juste deux doigts levés)
  'Rock & Roll':
    '<rect x="93" y="36" width="3" height="14" fill="#1A1A1A"/>' +
    '<rect x="104" y="36" width="3" height="14" fill="#1A1A1A"/>' +
    '<path d="M88 50 L112 50 L112 62 L88 62 Z" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>',
  // Peace — V (deux lignes fines)
  Peace:
    '<path d="M92 36 L100 56" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M108 36 L100 56" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>',
  // Bras levés — deux lignes en V vers le haut
  'Bras levés':
    '<path d="M88 60 L96 38" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M112 60 L104 38" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<circle cx="100" cy="62" r="3" fill="#1A1A1A"/>',
  // Cool — lunettes fines
  Cool:
    '<circle cx="92" cy="50" r="6" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>' +
    '<circle cx="108" cy="50" r="6" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>' +
    '<path d="M98 50 L102 50" stroke="#1A1A1A" stroke-width="1.4"/>',
  // Toast — deux verres qui s'entrechoquent (deux trapèzes inversés)
  Toast:
    '<path d="M88 38 L92 56 L96 56 L100 38 Z" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M100 38 L104 56 L108 56 L112 38 Z" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>',
  // Surprise — bouche en O et sourcils relevés (cercle + deux lignes)
  Surprise:
    '<circle cx="100" cy="52" r="6" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>' +
    '<line x1="90" y1="40" x2="96" y2="42" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="104" y1="42" x2="110" y2="40" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>',
  // Grimace — bouche en zigzag
  Grimace:
    '<polyline points="86,52 92,46 98,52 104,46 110,52 114,46" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>',
  // Selfie — appareil/téléphone tenu (rectangle + petite lentille)
  Selfie:
    '<rect x="90" y="38" width="20" height="24" rx="2" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>' +
    '<circle cx="100" cy="50" r="3.5" fill="none" stroke="#1A1A1A" stroke-width="1.4"/>',
  // Doigts croisés — deux lignes croisées
  'Doigts croisés':
    '<path d="M92 36 L108 64" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M108 36 L92 64" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>',
  // Pouce en l'air — flèche stylisée vers le haut
  "Pouce en l'air":
    '<path d="M100 36 L100 62" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M93 44 L100 36 L107 44" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>',
  // Mains jointes — un losange fin (deux mains en prière)
  'Mains jointes':
    '<path d="M100 36 L112 50 L100 64 L88 50 Z" fill="none" stroke="#1A1A1A" stroke-width="1.4" stroke-linejoin="round"/>',
};

/**
 * Sélectionne le pictogramme correspondant au label, ou un ornement neutre
 * si aucun pictogramme n'est défini.
 */
function pictogramSvg(label: string): string {
  return (
    POSE_PICTOGRAMS[label] ??
    `<circle cx="100" cy="50" r="5" fill="none" stroke="#1A1A1A" stroke-width="1"/>`
  );
}

/**
 * Adapte la taille de la typographie en fonction de la longueur du label
 * pour rester lisible et bien centré dans le carré 200×200.
 */
function fontSizeForLabel(label: string): number {
  const len = label.length;
  if (len <= 5) return 28;
  if (len <= 8) return 24;
  if (len <= 12) return 20;
  if (len <= 16) return 16;
  return 14;
}

/**
 * Génère une SVG data URL pour une pose prédéfinie — DA éditoriale Vogue.
 * Format carré 200×200, fond ivoire, rectangle interne plus clair, label en
 * Playfair Display capitales, numérotation magazine "№ XX" et un pictogramme
 * spécifique à la pose au centre.
 *
 * @param _emoji — ignoré (conservé pour rétro-compatibilité de signature)
 * @param label — texte affiché en gros (mis en majuscules)
 * @param index — numéro éditorial 1-based pour la mention "№ XX"
 */
function makePoseSvg(_emoji: string, label: string, index: number): string {
  const safeLabel = escapeXml(label.toUpperCase());
  const number = String(index).padStart(2, '0');
  const fontSize = fontSizeForLabel(label);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="#F4ECDD"/>
  <rect x="12" y="12" width="176" height="176" fill="#FAF6EE" stroke="#1A1A1A" stroke-width="1"/>
  <text x="100" y="32" text-anchor="middle" fill="#6B5D4F" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="600" letter-spacing="2.7">N&#176; ${number}</text>
  <g transform="translate(0, 50)">${pictogramSvg(label)}</g>
  <line x1="86" y1="124" x2="114" y2="124" stroke="#1A1A1A" stroke-width="0.75"/>
  <text x="100" y="150" text-anchor="middle" dominant-baseline="middle" fill="#1A1A1A" font-family="Playfair Display, Bodoni Moda, Didot, serif" font-weight="900" font-size="${fontSize}" letter-spacing="1">${safeLabel}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface PresetPose {
  label: string;
  emoji: string;
  image_path: string;
}

function pose(label: string, emoji: string, index: number): PresetPose {
  return { label, emoji, image_path: makePoseSvg(emoji, label, index) };
}

const POSE_LABELS: Array<{ label: string; emoji: string }> = [
  { label: 'Câlin', emoji: '🤗' },
  { label: 'Bisou', emoji: '💋' },
  { label: 'Saut groupé', emoji: '🦘' },
  { label: 'Danse', emoji: '💃' },
  { label: 'Cœur mains', emoji: '🫶' },
  { label: 'Rock & Roll', emoji: '🤘' },
  { label: 'Peace', emoji: '✌️' },
  { label: 'Bras levés', emoji: '🙌' },
  { label: 'Cool', emoji: '😎' },
  { label: 'Toast', emoji: '🥂' },
  { label: 'Surprise', emoji: '😲' },
  { label: 'Grimace', emoji: '😜' },
  { label: 'Selfie', emoji: '🤳' },
  { label: 'Doigts croisés', emoji: '🤞' },
  { label: "Pouce en l'air", emoji: '👍' },
  { label: 'Mains jointes', emoji: '🙏' },
];

export const PRESET_POSES: PresetPose[] = POSE_LABELS.map((p, i) =>
  pose(p.label, p.emoji, i + 1),
);
