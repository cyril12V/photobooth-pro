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
 * Choisit un pictogramme géométrique éditorial (purement décoratif) en fonction
 * de l'index — un point, un filet, un rond, une croix fine. Le rendu est
 * indépendant du sens de la pose : c'est un ornement, pas une icône.
 */
function ornamentSvg(index: number): string {
  const variant = index % 4;
  const stroke = '#1A1A1A';
  switch (variant) {
    case 0:
      // Filet horizontal centré
      return `<line x1="86" y1="48" x2="114" y2="48" stroke="${stroke}" stroke-width="1"/>`;
    case 1:
      // Petit point
      return `<circle cx="100" cy="48" r="2" fill="${stroke}"/>`;
    case 2:
      // Rond fin
      return `<circle cx="100" cy="48" r="5" fill="none" stroke="${stroke}" stroke-width="1"/>`;
    default:
      // Croix fine
      return `<line x1="94" y1="48" x2="106" y2="48" stroke="${stroke}" stroke-width="1"/><line x1="100" y1="42" x2="100" y2="54" stroke="${stroke}" stroke-width="1"/>`;
  }
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
 * Playfair Display capitales, numérotation magazine "№ XX" et un petit
 * pictogramme géométrique discret en ornement.
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
  ${ornamentSvg(index)}
  <text x="100" y="78" text-anchor="middle" fill="#6B5D4F" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="600" letter-spacing="2.7">N&#176; ${number}</text>
  <text x="100" y="118" text-anchor="middle" dominant-baseline="middle" fill="#1A1A1A" font-family="Playfair Display, Bodoni Moda, Didot, serif" font-weight="900" font-size="${fontSize}" letter-spacing="1">${safeLabel}</text>
  <line x1="86" y1="148" x2="114" y2="148" stroke="#1A1A1A" stroke-width="0.75"/>
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
