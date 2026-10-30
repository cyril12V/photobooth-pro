// Images par défaut des bandes de pellicule, embarquées dans l'app (la salle n'a pas forcément internet).
// Photos Pexels (licence Pexels : usage commercial libre, sans mention obligatoire).
// La photo du couple (Évènement › Image de fond) passe devant quand elle est renseignée.
import confettis from '../assets/film/confettis.jpg';
import discoursJardin from '../assets/film/discours-jardin.jpg';
import discoursMicro from '../assets/film/discours-micro.jpg';
import discoursTemoin from '../assets/film/discours-temoin.jpg';
import sortieEglise from '../assets/film/sortie-eglise.jpg';
import toast from '../assets/film/toast.jpg';

export const FILM_IMAGES = {
  /** Accueil : prendre une photo / laisser un message vidéo. */
  photo: confettis,
  video: discoursJardin,
  /** Photo : classique / challenge (quand aucune pose n'a d'image). */
  classic: sortieEglise,
  challenge: toast,
  /** Vidéo : interview / message libre. */
  interview: discoursTemoin,
  freeMessage: discoursMicro,
};
