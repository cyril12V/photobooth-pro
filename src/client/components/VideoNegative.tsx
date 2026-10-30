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
 * Le direct de la caméra cadré comme un négatif dans le passe-vue : perforations,
 * nom des mariés et date sur le bord du haut, numéro d'image et timecode en bas.
 */
export function VideoNegative({ event, frame, timecode, children }: Props) {
  return (
    <div className="darkroom-negative">
      <div className="contact-rebate contact-rebate--top" aria-hidden>
        <span className="contact-edge" style={{ left: 'calc(var(--mm) * 8)' }}>
          {edgePrint(event)}
        </span>
      </div>
      <div className="darkroom-window">{children}</div>
      <div className="contact-rebate contact-rebate--bottom" aria-hidden>
        <span className="contact-edge" style={{ left: 'calc(var(--mm) * 4)' }}>{`▸${frame}`}</span>
        <span className="contact-edge" style={{ left: 'calc(var(--mm) * 23)' }}>{`${frame}A`}</span>
        <span className="contact-edge" style={{ right: 'calc(var(--mm) * 4)' }}>{timecode}</span>
      </div>
    </div>
  );
}
