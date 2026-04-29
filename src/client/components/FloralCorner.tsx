interface Props {
  position: 'tl' | 'tr' | 'bl' | 'br';
  className?: string;
}

const transformMap: Record<Props['position'], string | undefined> = {
  tl: undefined,
  tr: 'scaleX(-1)',
  bl: 'scaleY(-1)',
  br: 'scale(-1,-1)',
};

export function FloralCorner({ position, className = '' }: Props) {
  const transform = transformMap[position];
  return (
    <svg
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={transform ? { transform } : undefined}
      aria-hidden="true"
    >
      {/* Feuillage */}
      <path d="M10 150 Q40 100 80 80 Q60 110 40 140 Z" fill="#b5c9a0" opacity="0.55" />
      <path d="M10 150 Q60 120 100 60 Q75 105 30 145 Z" fill="#9cb88a" opacity="0.4" />
      <path d="M10 150 Q30 80 90 40 Q55 90 20 148 Z" fill="#c5d9b0" opacity="0.35" />
      {/* Tige principale */}
      <path d="M10 150 Q55 95 110 30" stroke="#8aaa72" strokeWidth="2" fill="none" opacity="0.5" />
      {/* Rose 1 — grande */}
      <circle cx="110" cy="30" r="16" fill="#f2c4ce" opacity="0.85" />
      <circle cx="110" cy="30" r="11" fill="#e8a0b0" opacity="0.9" />
      <circle cx="110" cy="30" r="6" fill="#d4788a" opacity="0.95" />
      {/* Pétales rose 1 */}
      <ellipse cx="110" cy="14" rx="7" ry="10" fill="#f5cdd5" opacity="0.7" />
      <ellipse cx="124" cy="22" rx="7" ry="10" fill="#f5cdd5" opacity="0.7" transform="rotate(45 124 22)" />
      <ellipse cx="96" cy="22" rx="7" ry="10" fill="#f5cdd5" opacity="0.7" transform="rotate(-45 96 22)" />
      <ellipse cx="124" cy="38" rx="7" ry="10" fill="#f5cdd5" opacity="0.7" transform="rotate(135 124 38)" />
      <ellipse cx="96" cy="38" rx="7" ry="10" fill="#f5cdd5" opacity="0.7" transform="rotate(-135 96 38)" />
      {/* Rose 2 — petite */}
      <circle cx="70" cy="72" r="11" fill="#f8d7df" opacity="0.75" />
      <circle cx="70" cy="72" r="7" fill="#eeafc0" opacity="0.85" />
      <circle cx="70" cy="72" r="4" fill="#d47890" opacity="0.9" />
      <ellipse cx="70" cy="61" rx="5" ry="7" fill="#fbe0e6" opacity="0.65" />
      <ellipse cx="80" cy="68" rx="5" ry="7" fill="#fbe0e6" opacity="0.65" transform="rotate(45 80 68)" />
      <ellipse cx="60" cy="68" rx="5" ry="7" fill="#fbe0e6" opacity="0.65" transform="rotate(-45 60 68)" />
      {/* Bouton floral */}
      <circle cx="42" cy="108" r="6" fill="#f5cdd5" opacity="0.6" />
      <circle cx="42" cy="108" r="3" fill="#e8a0b0" opacity="0.7" />
    </svg>
  );
}
