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
 * Génère une SVG data URL pour une pose prédéfinie.
 * Format : carré 200×200, fond cream, emoji centré + label.
 */
function makePoseSvg(emoji: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#faf6ef"/>
        <stop offset="100%" stop-color="#f5e6d3"/>
      </linearGradient>
      <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e8c79a"/>
        <stop offset="100%" stop-color="#d4a574"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="24" fill="url(#bg)"/>
    <rect x="6" y="6" width="188" height="188" rx="20" fill="none" stroke="url(#ring)" stroke-width="1.5" opacity="0.6"/>
    <text x="100" y="118" font-size="84" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>
    <text x="100" y="172" font-size="13" letter-spacing="2" text-anchor="middle" fill="#5a3e2b" font-family="Manrope, sans-serif" font-weight="600">${label.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface PresetPose {
  label: string;
  emoji: string;
  image_path: string;
}

function pose(label: string, emoji: string): PresetPose {
  return { label, emoji, image_path: makePoseSvg(emoji, label) };
}

export const PRESET_POSES: PresetPose[] = [
  pose('Câlin', '🤗'),
  pose('Bisou', '💋'),
  pose('Saut groupé', '🦘'),
  pose('Danse', '💃'),
  pose('Cœur mains', '🫶'),
  pose('Rock & Roll', '🤘'),
  pose('Peace', '✌️'),
  pose('Bras levés', '🙌'),
  pose('Cool', '😎'),
  pose('Toast', '🥂'),
  pose('Surprise', '😲'),
  pose('Grimace', '😜'),
  pose('Selfie', '🤳'),
  pose('Doigts croisés', '🤞'),
  pose('Pouce en l\'air', '👍'),
  pose('Mains jointes', '🙏'),
];
