import { MdArrowBack } from 'react-icons/md';
import type { PhotoboothEvent } from '@shared/types';

/** Lien de retour en haut à gauche : aligné sur la marge sur le papier, en petit sur l'image en chambre noire. */
export function ContactBack({ onBack, label = 'Retour' }: { onBack: () => void; label?: string }) {
  return (
    <button
      onClick={onBack}
      className="contact-back btn-editorial-ghost"
    >
      <MdArrowBack size={20} />
      <span>{label}</span>
    </button>
  );
}

/** « Samedi 31 octobre 2026 » ; null sans date valide. */
export function formatDateline(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Inscription du bord de pellicule : « MINAS & CHRISTINE  31 10 2026 ». */
export function edgePrint(event: PhotoboothEvent | null, fallbackName = 'Bienvenue'): string {
  const d = event?.date ? new Date(event.date) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const date = Number.isNaN(d.getTime()) ? '' : `${p(d.getDate())} ${p(d.getMonth() + 1)} ${d.getFullYear()}`;
  return `${(event?.name?.trim() || fallbackName).toUpperCase()}  ${date}`;
}
