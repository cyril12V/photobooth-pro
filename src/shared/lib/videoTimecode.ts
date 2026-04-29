import type { InterviewLogEntry } from '@shared/types';

/**
 * Construit un nouveau builder de timecodes pour un enregistrement interview.
 * Le `t0` est l'instant `performance.now()` du début effectif de l'enregistrement,
 * stocké côté appelant. Chaque entrée mesure son startMs/endMs en différentiel.
 */
export class InterviewTimecodeBuilder {
  private entries: InterviewLogEntry[] = [];
  private t0: number;

  constructor(t0: number) {
    this.t0 = t0;
  }

  /** ms écoulés depuis t0, arrondi à l'entier */
  elapsed(now = performance.now()): number {
    return Math.max(0, Math.round(now - this.t0));
  }

  push(entry: { index: number; text: string; startMs: number; endMs: number }) {
    this.entries.push({
      index: entry.index,
      text: entry.text,
      startMs: Math.round(entry.startMs),
      endMs: Math.round(entry.endMs),
    });
  }

  list(): InterviewLogEntry[] {
    return [...this.entries];
  }
}

export function formatHms(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const msPart = String(ms % 1000).padStart(3, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${msPart}`;
}
