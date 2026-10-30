import { useState } from 'react';
import type { PhotoboothEvent } from '@shared/types';
import { edgePrint } from './ContactHeader';

export interface FilmFrame<Id extends string> {
  id: Id;
  label: string;
  caption?: string;
  image?: string | null;
  /** Cadrage de l'image dans la vue (object-position). */
  crop?: string;
  /** Image embarquée affichée si `image` est absente ou introuvable (fichier déplacé). */
  fallback?: string;
  disabled?: boolean;
}

interface Props<Id extends string> {
  frames: Array<FilmFrame<Id>>;
  event: PhotoboothEvent | null;
  onChoose: (id: Id) => void;
}

function FrameImage({ frame, index }: { frame: FilmFrame<string>; index: number }) {
  const [missing, setMissing] = useState(false);
  const useFallback = !frame.image || missing;
  const src = useFallback ? frame.fallback : frame.image;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setMissing(true)}
      style={{
        objectPosition: useFallback ? undefined : frame.crop,
        filter: `grayscale(1) contrast(1.12) brightness(${index === 0 ? 0.92 : 1.02})`,
      }}
    />
  );
}

/**
 * Bande de pellicule 35 mm dont chaque image est un choix : perforations, nom des mariés
 * et date imprimés sur le bord, numéros d'image en bas. À placer dans un `.contact-page`.
 */
export function FilmStrip<Id extends string>({ frames, event, onChoose }: Props<Id>) {
  const edge = edgePrint(event);
  // Numéros d'image imprimés sur le bord, comme sur une vraie pellicule (1, 1A, 2…).
  const frameNumbers = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="contact-strip">
      <div className="contact-rebate contact-rebate--top" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="contact-edge" style={{ left: `calc(var(--mm) * ${8 + i * 92})` }}>
            {edge}
          </span>
        ))}
      </div>
      <div className="contact-rebate contact-rebate--bottom" aria-hidden>
        {frameNumbers.flatMap((n) => [
          <span key={n} className="contact-edge" style={{ left: `calc(var(--mm) * ${4 + (n - 1) * 38})` }}>
            {`▸${n}`}
          </span>,
          <span key={`${n}A`} className="contact-edge" style={{ left: `calc(var(--mm) * ${23 + (n - 1) * 38})` }}>
            {`${n}A`}
          </span>,
        ])}
      </div>

      {frames.map((f, i) => (
        <button
          key={f.id}
          className="contact-frame"
          onClick={() => onChoose(f.id)}
          disabled={f.disabled}
          aria-label={f.label}
        >
          <FrameImage key={f.image ?? f.fallback} frame={f} index={i} />
          <span className="contact-grain" aria-hidden />
          <span className="contact-frame-label">
            {f.label}
            {f.caption && <span className="contact-frame-caption">{f.caption}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
