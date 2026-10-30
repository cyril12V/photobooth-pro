import type { ReactNode } from 'react';
import type { PhotoboothEvent } from '@shared/types';
import { edgePrint } from './ContactHeader';

/** 7,4 s → « 00:07 ». */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
}

interface Props {
  event: PhotoboothEvent | null;
  /** Numéro d'image imprimé en bas (la question en cours pour l'interview). */
  frame: number;
  timecode: string;
  children: ReactNode;
}

/**
 * Le direct de la caméra en plein écran ; le nom des mariés, la date, le numéro
 * d'image et le timecode sont imprimés en haut, comme sur le bord du film.
 */
export function VideoNegative({ event, frame, timecode, children }: Props) {
  return (
    <div className="darkroom-negative">
      <div className="darkroom-window">{children}</div>
      <p className="darkroom-edge contact-edgeprint" aria-hidden>
        <span>{edgePrint(event)}</span>
        <span>{`▸${frame}`}</span>
        <span>{timecode}</span>
      </p>
    </div>
  );
}
