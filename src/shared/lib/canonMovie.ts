/**
 * Vidéo enregistrée par l'appareil Canon en USB, à la manière de LumaBooth :
 * l'app bascule l'appareil en mode vidéo, affiche son LiveView USB (propre,
 * contrairement à sa sortie HDMI en mode photo), lui fait enregistrer la vidéo
 * sur sa carte (jusqu'en 4K, sans charger le PC) puis la rapatrie.
 * En sortant de l'écran vidéo, on remet toujours l'appareil en mode photo.
 */
import type { CanonMovie } from '@shared/types';

/** Connexion, passage en mode vidéo et aperçu. Renvoie un message d'erreur ou null. */
export async function prepareCanonMovie(): Promise<string | null> {
  const steps = [
    () => window.api.canon.connect(),
    () => window.api.canon.movieMode(true),
    () => window.api.canon.liveview(true),
  ];
  for (const step of steps) {
    const r = await step();
    if (!r.ok) return r.error;
  }
  return null;
}

export async function startCanonMovie(): Promise<string | null> {
  const r = await window.api.canon.movieStart();
  return r.ok ? null : r.error;
}

/** Arrête l'enregistrement et rapatrie la vidéo. Renvoie la vidéo ou un message d'erreur. */
export async function finishCanonMovie(onProgress: (percent: number) => void): Promise<CanonMovie | string> {
  const off = window.api.canon.onProgress(onProgress);
  try {
    const r = await window.api.canon.movieStop(true);
    if (!r.ok) return r.error;
    return r.result ?? "La vidéo n'a pas pu être récupérée depuis l'appareil.";
  } finally {
    off();
  }
}

/**
 * Source « Appareil Canon + Cam Link » : on passe l'appareil en mode vidéo par USB
 * pour que sa sortie HDMI devienne propre (en mode photo elle montre les réglages),
 * puis l'app enregistre la Cam Link comme d'habitude : fluide et sans attente.
 * L'appareil n'enregistre pas lui-même (le R50 ne garde pas un HDMI propre pendant
 * un enregistrement sur carte). À la sortie : releaseCanonMovie(false).
 */
export async function switchCanonToMovieForHdmi(): Promise<string | null> {
  const conn = await window.api.canon.connect();
  if (!conn.ok) return conn.error;
  const movie = await window.api.canon.movieMode(true);
  if (!movie.ok) return movie.error;
  // La sortie HDMI se resynchronise au changement de mode : on laisse la Cam Link la retrouver.
  await new Promise((r) => setTimeout(r, 1500));
  return null;
}

/** Sortie de l'écran vidéo : annule un enregistrement en cours et remet l'appareil en mode photo. */
export async function releaseCanonMovie(recording: boolean) {
  if (recording) await window.api.canon.movieStop(false);
  await window.api.canon.liveview(false);
  await window.api.canon.movieMode(false);
}
