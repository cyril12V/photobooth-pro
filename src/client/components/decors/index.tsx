import type { ReactNode } from 'react';
import type { DecorStyle } from '@shared/types';
import { localFileUrl } from '@shared/lib/poseAssets';

export type { DecorStyle };

// ─── Shared transform by position ────────────────────────────────────────────

const transformMap: Record<'tl' | 'tr' | 'bl' | 'br', string | undefined> = {
  tl: undefined,
  tr: 'scaleX(-1)',
  bl: 'scaleY(-1)',
  br: 'scale(-1,-1)',
};

interface CornerProps {
  position: 'tl' | 'tr' | 'bl' | 'br';
  className?: string;
}

// ─── Floral ───────────────────────────────────────────────────────────────────

function FloralDecor({ position, className = '' }: CornerProps) {
  const transform = transformMap[position];
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      {/* Grandes tiges */}
      <path d="M10 310 Q80 200 160 160 Q120 220 80 280 Z" fill="#b5c9a0" opacity="0.55" />
      <path d="M10 310 Q120 240 200 120 Q150 210 60 290 Z" fill="#9cb88a" opacity="0.4" />
      <path d="M10 310 Q60 160 180 80 Q110 180 40 296 Z" fill="#c5d9b0" opacity="0.35" />
      <path d="M10 310 Q110 190 220 60" stroke="#8aaa72" strokeWidth="2" fill="none" opacity="0.5" />
      {/* Tige secondaire vers le bas */}
      <path d="M10 310 Q60 240 120 200 Q80 250 30 305" stroke="#9cb88a" strokeWidth="1.5" fill="none" opacity="0.4" />
      {/* Tige secondaire diagonale */}
      <path d="M10 310 Q100 270 160 230" stroke="#b5c9a0" strokeWidth="1" fill="none" opacity="0.35" />

      {/* Grande fleur principale */}
      <circle cx="220" cy="60" r="22" fill="#f2c4ce" opacity="0.85" />
      <circle cx="220" cy="60" r="15" fill="#e8a0b0" opacity="0.9" />
      <circle cx="220" cy="60" r="8" fill="#d4788a" opacity="0.95" />
      <ellipse cx="220" cy="38" rx="9" ry="13" fill="#f5cdd5" opacity="0.7" />
      <ellipse cx="238" cy="48" rx="9" ry="13" fill="#f5cdd5" opacity="0.7" transform="rotate(45 238 48)" />
      <ellipse cx="202" cy="48" rx="9" ry="13" fill="#f5cdd5" opacity="0.7" transform="rotate(-45 202 48)" />
      <ellipse cx="238" cy="72" rx="9" ry="13" fill="#f5cdd5" opacity="0.7" transform="rotate(135 238 72)" />
      <ellipse cx="202" cy="72" rx="9" ry="13" fill="#f5cdd5" opacity="0.7" transform="rotate(-135 202 72)" />

      {/* Fleur secondaire milieu */}
      <circle cx="140" cy="144" r="15" fill="#f8d7df" opacity="0.75" />
      <circle cx="140" cy="144" r="10" fill="#eeafc0" opacity="0.85" />
      <circle cx="140" cy="144" r="5.5" fill="#d47890" opacity="0.9" />
      <ellipse cx="140" cy="129" rx="6" ry="9" fill="#fbe0e6" opacity="0.65" />
      <ellipse cx="153" cy="137" rx="6" ry="9" fill="#fbe0e6" opacity="0.65" transform="rotate(45 153 137)" />
      <ellipse cx="127" cy="137" rx="6" ry="9" fill="#fbe0e6" opacity="0.65" transform="rotate(-45 127 137)" />
      <ellipse cx="153" cy="151" rx="6" ry="9" fill="#fbe0e6" opacity="0.65" transform="rotate(135 153 151)" />
      <ellipse cx="127" cy="151" rx="6" ry="9" fill="#fbe0e6" opacity="0.65" transform="rotate(-135 127 151)" />

      {/* Petite fleur haute droite */}
      <circle cx="270" cy="115" r="10" fill="#f2c4ce" opacity="0.7" />
      <circle cx="270" cy="115" r="6" fill="#e8a0b0" opacity="0.8" />
      <circle cx="270" cy="115" r="3" fill="#d4788a" opacity="0.85" />
      <ellipse cx="270" cy="105" rx="5" ry="7" fill="#f5cdd5" opacity="0.6" />
      <ellipse cx="278" cy="111" rx="5" ry="7" fill="#f5cdd5" opacity="0.6" transform="rotate(45 278 111)" />
      <ellipse cx="262" cy="111" rx="5" ry="7" fill="#f5cdd5" opacity="0.6" transform="rotate(-45 262 111)" />

      {/* Petite fleur basse */}
      <circle cx="84" cy="216" r="8" fill="#f5cdd5" opacity="0.6" />
      <circle cx="84" cy="216" r="4" fill="#e8a0b0" opacity="0.7" />
      <circle cx="44" cy="264" r="6" fill="#f5cdd5" opacity="0.55" />
      <circle cx="44" cy="264" r="3" fill="#e8a0b0" opacity="0.65" />

      {/* Boutons floraux en bas */}
      <circle cx="170" cy="200" r="5" fill="#f2c4ce" opacity="0.5" />
      <circle cx="200" cy="175" r="4" fill="#e8a0b0" opacity="0.45" />
      <circle cx="240" cy="155" r="4" fill="#f5cdd5" opacity="0.45" />

      {/* Feuilles éparpillées sur la tige */}
      <ellipse cx="100" cy="245" rx="10" ry="4.5" fill="#b5c9a0" opacity="0.5" transform="rotate(-50 100 245)" />
      <ellipse cx="60" cy="278" rx="8" ry="3.5" fill="#c5d9b0" opacity="0.45" transform="rotate(-60 60 278)" />
    </svg>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function StarsDecor({ position, className = '' }: CornerProps) {
  const transform = transformMap[position];
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="starGold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5e6a3" />
          <stop offset="100%" stopColor="#d4a574" />
        </radialGradient>
      </defs>
      {/* Grande étoile principale */}
      <polygon
        points="60,20 68,44 94,44 74,60 82,84 60,68 38,84 46,60 26,44 52,44"
        fill="url(#starGold)"
        opacity="0.9"
      />
      {/* Étoile moyenne haute droite */}
      <polygon
        points="160,70 166,88 186,88 170,100 176,118 160,106 144,118 150,100 134,88 154,88"
        fill="#d4a574"
        opacity="0.75"
      />
      {/* Étoile moyenne basse gauche */}
      <polygon
        points="70,160 76,178 96,178 80,190 86,208 70,196 54,208 60,190 44,178 64,178"
        fill="#e8c97a"
        opacity="0.65"
      />
      {/* Petite étoile 1 */}
      <polygon
        points="110,136 114,148 126,148 116,156 120,168 110,160 100,168 104,156 94,148 106,148"
        fill="#e8c97a"
        opacity="0.6"
      />
      {/* Petite étoile 2 */}
      <polygon
        points="30,110 32,118 42,118 34,124 36,132 30,126 24,132 26,124 18,118 28,118"
        fill="#d4a574"
        opacity="0.55"
      />
      {/* Petite étoile 3 */}
      <polygon
        points="200,130 202,138 210,138 204,143 206,151 200,146 194,151 196,143 190,138 198,138"
        fill="#d4a574"
        opacity="0.5"
      />
      {/* Petite étoile 4 — bas */}
      <polygon
        points="140,220 142,228 150,228 144,233 146,241 140,236 134,241 136,233 130,228 138,228"
        fill="#e8c97a"
        opacity="0.45"
      />
      {/* Micro-étoile 1 */}
      <polygon
        points="90,60 92,66 98,66 93,70 95,76 90,72 85,76 87,70 82,66 88,66"
        fill="#f0d080"
        opacity="0.7"
      />
      {/* Micro-étoile 2 */}
      <polygon
        points="230,60 231,64 236,64 232,67 234,71 230,68 226,71 228,67 224,64 229,64"
        fill="#d4a574"
        opacity="0.55"
      />
      {/* Micro-étoile 3 */}
      <polygon
        points="50,200 51,204 56,204 52,207 53,211 50,208 47,211 48,207 44,204 49,204"
        fill="#e8c97a"
        opacity="0.5"
      />
      {/* Points lumineux */}
      <circle cx="24" cy="200" r="2.5" fill="#d4a574" opacity="0.4" />
      <circle cx="130" cy="230" r="2" fill="#e8c97a" opacity="0.5" />
      <circle cx="190" cy="60" r="2" fill="#d4a574" opacity="0.45" />
      <circle cx="50" cy="260" r="1.5" fill="#d4a574" opacity="0.35" />
      <circle cx="250" cy="100" r="1.5" fill="#e8c97a" opacity="0.4" />
      <circle cx="170" cy="175" r="2" fill="#d4a574" opacity="0.4" />
      {/* Filets lumineux */}
      <line x1="20" y1="20" x2="20" y2="36" stroke="#e8c97a" strokeWidth="1" opacity="0.35" />
      <line x1="12" y1="28" x2="28" y2="28" stroke="#e8c97a" strokeWidth="1" opacity="0.35" />
      <line x1="150" y1="20" x2="150" y2="32" stroke="#d4a574" strokeWidth="0.8" opacity="0.3" />
      <line x1="144" y1="26" x2="156" y2="26" stroke="#d4a574" strokeWidth="0.8" opacity="0.3" />
      <line x1="250" y1="170" x2="250" y2="178" stroke="#e8c97a" strokeWidth="0.8" opacity="0.25" />
      <line x1="246" y1="174" x2="254" y2="174" stroke="#e8c97a" strokeWidth="0.8" opacity="0.25" />
    </svg>
  );
}

// ─── Hearts ───────────────────────────────────────────────────────────────────

function HeartsDecor({ position, className = '' }: CornerProps) {
  const transform = transformMap[position];
  const heart = (cx: number, cy: number, s: number) => {
    const x = cx - s;
    const y = cy - s * 0.75;
    return `M ${cx} ${cy + s * 0.9}
      C ${cx - s * 1.5} ${cy + s * 0.2} ${x - s * 0.6} ${y - s * 0.5} ${cx} ${y + s * 0.1}
      C ${cx + s * 0.6 + s * 0.6} ${y - s * 0.5} ${cx + s * 1.5} ${cy + s * 0.2} ${cx} ${cy + s * 0.9} Z`;
  };
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      {/* Grand cœur principal */}
      <path d={heart(56, 56, 36)} fill="#f2c4ce" opacity="0.8" />
      {/* Cœur moyen haut droite */}
      <path d={heart(144, 110, 26)} fill="#e8a0b0" opacity="0.65" />
      {/* Cœur moyen bas gauche */}
      <path d={heart(100, 200, 22)} fill="#f5cdd5" opacity="0.6" />
      {/* Petits cœurs */}
      <path d={heart(36, 136, 14)} fill="#f2c4ce" opacity="0.5" />
      <path d={heart(180, 56, 18)} fill="#e8a0b0" opacity="0.5" />
      <path d={heart(200, 160, 12)} fill="#f5cdd5" opacity="0.45" />
      <path d={heart(240, 90, 14)} fill="#f2c4ce" opacity="0.4" />
      <path d={heart(60, 256, 10)} fill="#e8a0b0" opacity="0.4" />
      <path d={heart(160, 240, 11)} fill="#f5cdd5" opacity="0.38" />
      {/* Micro-cœurs */}
      <path d={heart(110, 290, 8)} fill="#f2c4ce" opacity="0.35" />
      <path d={heart(200, 220, 7)} fill="#e8a0b0" opacity="0.32" />
      <path d={heart(270, 130, 8)} fill="#f5cdd5" opacity="0.3" />
      <path d={heart(245, 200, 6)} fill="#f2c4ce" opacity="0.28" />
    </svg>
  );
}

// ─── Geometric ────────────────────────────────────────────────────────────────

function GeometricDecor({ position, className = '' }: CornerProps) {
  const transform = transformMap[position];
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      {/* Arcs de coin */}
      <path d="M 0 160 Q 0 0 160 0" stroke="#d4a574" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 0 120 Q 0 0 120 0" stroke="#d4a574" strokeWidth="0.7" fill="none" opacity="0.3" />
      <path d="M 0 200 Q 0 0 200 0" stroke="#d4a574" strokeWidth="0.5" fill="none" opacity="0.2" />
      <path d="M 0 250 Q 0 0 250 0" stroke="#e8c97a" strokeWidth="0.4" fill="none" opacity="0.15" />
      {/* Triangle principal */}
      <polygon points="0,0 100,0 0,100" fill="#d4a574" opacity="0.18" />
      {/* Petit triangle accent */}
      <polygon points="20,0 60,0 0,40" fill="#e8c97a" opacity="0.25" />
      {/* Cercles de coin */}
      <circle cx="0" cy="0" r="80" stroke="#d4a574" strokeWidth="0.8" fill="none" opacity="0.2" />
      <circle cx="0" cy="0" r="56" stroke="#d4a574" strokeWidth="0.5" fill="none" opacity="0.15" />
      <circle cx="0" cy="0" r="130" stroke="#d4a574" strokeWidth="0.4" fill="none" opacity="0.1" />
      {/* Points décoratifs */}
      <circle cx="110" cy="20" r="3" fill="#d4a574" opacity="0.55" />
      <circle cx="20" cy="110" r="3" fill="#d4a574" opacity="0.55" />
      <circle cx="76" cy="76" r="2.5" fill="#e8c97a" opacity="0.45" />
      <circle cx="160" cy="30" r="2" fill="#d4a574" opacity="0.4" />
      <circle cx="30" cy="160" r="2" fill="#d4a574" opacity="0.4" />
      <circle cx="200" cy="50" r="2" fill="#e8c97a" opacity="0.35" />
      <circle cx="50" cy="200" r="2" fill="#e8c97a" opacity="0.35" />
      {/* Lignes minimalistes */}
      <line x1="0" y1="190" x2="20" y2="190" stroke="#d4a574" strokeWidth="1" opacity="0.35" />
      <line x1="190" y1="0" x2="190" y2="20" stroke="#d4a574" strokeWidth="1" opacity="0.35" />
      <line x1="0" y1="240" x2="14" y2="240" stroke="#d4a574" strokeWidth="0.8" opacity="0.25" />
      <line x1="240" y1="0" x2="240" y2="14" stroke="#d4a574" strokeWidth="0.8" opacity="0.25" />
      {/* Losanges */}
      <polygon points="140,0 160,20 140,40 120,20" fill="none" stroke="#d4a574" strokeWidth="0.8" opacity="0.4" />
      <polygon points="200,0 216,16 200,32 184,16" fill="none" stroke="#e8c97a" strokeWidth="0.6" opacity="0.3" />
      <polygon points="0,140 20,160 0,180 -20,160" fill="none" stroke="#d4a574" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

// ─── Botanical ────────────────────────────────────────────────────────────────

function BotanicalDecor({ position, className = '' }: CornerProps) {
  const transform = transformMap[position];
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      {/* Tige principale longue */}
      <path d="M16 304 Q90 220 190 110 Q230 60 260 20" stroke="#7a9a6a" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Branches secondaires */}
      <path d="M16 304 Q60 240 120 200" stroke="#7a9a6a" strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M16 304 Q40 280 80 260 Q100 248 130 230" stroke="#8aaa72" strokeWidth="0.8" fill="none" opacity="0.35" />
      <path d="M100 195 Q130 165 160 140" stroke="#7a9a6a" strokeWidth="0.8" fill="none" opacity="0.3" />

      {/* Feuilles sur tige principale — de bas en haut */}
      <ellipse cx="100" cy="210" rx="18" ry="7" fill="#9cb88a" opacity="0.65" transform="rotate(-40 100 210)" />
      <ellipse cx="70" cy="236" rx="14" ry="6" fill="#b5c9a0" opacity="0.55" transform="rotate(-50 70 236)" />
      <ellipse cx="144" cy="164" rx="17" ry="7" fill="#9cb88a" opacity="0.6" transform="rotate(-35 144 164)" />
      <ellipse cx="120" cy="184" rx="12" ry="5" fill="#c5d9b0" opacity="0.45" transform="rotate(-55 120 184)" />
      <ellipse cx="190" cy="110" rx="16" ry="6.5" fill="#9cb88a" opacity="0.6" transform="rotate(-25 190 110)" />
      <ellipse cx="220" cy="76" rx="14" ry="5.5" fill="#b5c9a0" opacity="0.55" transform="rotate(-20 220 76)" />
      <ellipse cx="248" cy="44" rx="12" ry="5" fill="#9cb88a" opacity="0.5" transform="rotate(-15 248 44)" />

      {/* Feuilles sur tige secondaire */}
      <ellipse cx="44" cy="284" rx="10" ry="4.5" fill="#b5c9a0" opacity="0.5" transform="rotate(-60 44 284)" />
      <ellipse cx="90" cy="252" rx="9" ry="4" fill="#c5d9b0" opacity="0.4" transform="rotate(35 90 252)" />
      <ellipse cx="150" cy="218" rx="11" ry="4.5" fill="#9cb88a" opacity="0.45" transform="rotate(-45 150 218)" />
      <ellipse cx="170" cy="155" rx="9" ry="3.5" fill="#b5c9a0" opacity="0.4" transform="rotate(-30 170 155)" />

      {/* Petites baies */}
      <circle cx="180" cy="100" r="4" fill="#8aaa72" opacity="0.55" />
      <circle cx="210" cy="64" r="3.5" fill="#7a9a62" opacity="0.5" />
      <circle cx="236" cy="36" r="3" fill="#8aaa72" opacity="0.45" />
      <circle cx="115" cy="175" r="3" fill="#8aaa72" opacity="0.45" />
      <circle cx="88" cy="204" r="2.5" fill="#7a9a62" opacity="0.4" />
    </svg>
  );
}

// ─── Custom ───────────────────────────────────────────────────────────────────

interface CustomDecorProps extends CornerProps {
  imagePath: string | null;
}

function CustomDecor({ position, className = '', imagePath }: CustomDecorProps) {
  const transform = transformMap[position];
  const style: React.CSSProperties = transform ? { transform } : {};

  if (!imagePath) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg text-neutral-400 text-xs text-center p-2 ${className}`}
        style={style}
      >
        Aucune image choisie
      </div>
    );
  }

  return (
    <img
      src={localFileUrl(imagePath)}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ ...style, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

// ─── None ─────────────────────────────────────────────────────────────────────

function NoneDecor() {
  return null;
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────

interface CornerDecorProps {
  style: DecorStyle;
  position: 'tl' | 'tr' | 'bl' | 'br';
  className?: string;
  customImagePath?: string | null;
}

export function CornerDecor({ style, position, className, customImagePath }: CornerDecorProps) {
  switch (style) {
    case 'floral':
      return <FloralDecor position={position} className={className} />;
    case 'stars':
      return <StarsDecor position={position} className={className} />;
    case 'hearts':
      return <HeartsDecor position={position} className={className} />;
    case 'geometric':
      return <GeometricDecor position={position} className={className} />;
    case 'botanical':
      return <BotanicalDecor position={position} className={className} />;
    case 'custom':
      return <CustomDecor position={position} className={className} imagePath={customImagePath ?? null} />;
    case 'none':
      return <NoneDecor />;
  }
}

// ─── Options pour la sélection UI dans Theme settings ────────────────────────

export const DECOR_OPTIONS: Array<{ id: DecorStyle; label: string; preview: ReactNode }> = [
  {
    id: 'floral',
    label: 'Floral',
    preview: <FloralDecor position="tl" className="w-full h-full" />,
  },
  {
    id: 'stars',
    label: 'Étoiles',
    preview: <StarsDecor position="tl" className="w-full h-full" />,
  },
  {
    id: 'hearts',
    label: 'Cœurs',
    preview: <HeartsDecor position="tl" className="w-full h-full" />,
  },
  {
    id: 'geometric',
    label: 'Géométrique',
    preview: <GeometricDecor position="tl" className="w-full h-full" />,
  },
  {
    id: 'botanical',
    label: 'Botanique',
    preview: <BotanicalDecor position="tl" className="w-full h-full" />,
  },
  {
    id: 'custom',
    label: 'Personnalisé',
    preview: (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-neutral-400 text-xs text-center leading-tight px-1">Image<br />custom</span>
      </div>
    ),
  },
  {
    id: 'none',
    label: 'Aucun',
    preview: (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-neutral-300 text-xl leading-none">—</span>
      </div>
    ),
  },
];
