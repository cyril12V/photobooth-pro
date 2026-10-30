import { useEffect } from 'react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';
import { FilmStrip, type FilmFrame } from '../components/FilmStrip';
import { formatDateline } from '../components/ContactHeader';
import { FILM_IMAGES } from '../components/filmImages';

type Choice = 'photo' | 'video';

/** « Minas & Christine » → deux lignes, la seconde commençant par l'esperluette. */
function splitNames(name: string): [string, string | null] {
  const m = name.match(/^(.+?)\s+(&|et)\s+(.+)$/i);
  return m ? [m[1], `${m[2]} ${m[3]}`] : [name, null];
}

export function SplashScreen() {
  const { event, settings, setScreen, setFlow } = useAppStore();
  const captureMode = settings?.capture_mode ?? 'both';

  const name = event?.name?.trim() || 'Bienvenue';
  const [firstLine, secondLine] = splitNames(name);
  const dateline = formatDateline(event?.date);
  const couplePhoto = event?.background_path ? localFileUrl(event.background_path) : null;
  // Les prénoms longs passent sur moins de place.
  const namesScale = Math.max(firstLine.length, secondLine?.length ?? 0) > 16 ? 0.72 : 1;

  useEffect(() => {
    if (captureMode === 'photo') {
      setFlow('photo');
      setScreen('home');
    } else if (captureMode === 'video') {
      setFlow('video');
      setScreen('video-home');
    }
  }, [captureMode, setFlow, setScreen]);

  if (captureMode !== 'both') {
    return null;
  }

  const choose = (choice: Choice) => {
    setFlow(choice);
    setScreen(choice === 'photo' ? 'home' : 'video-home');
  };

  const frames: Array<FilmFrame<Choice>> = [
    { id: 'photo', label: 'Prendre une photo', image: couplePhoto, crop: '30% 45%', fallback: FILM_IMAGES.photo },
    { id: 'video', label: 'Laisser un message vidéo', fallback: FILM_IMAGES.video },
  ];

  return (
    <Screen className="overflow-hidden">
      <div className="contact absolute inset-0">
        <div className="contact-grain" style={{ opacity: 0.07 }} aria-hidden />

        <div className="contact-page">
          {dateline && <p className="contact-dateline">{dateline}</p>}

          <h1 className="contact-names" style={{ '--names-scale': namesScale } as React.CSSProperties}>
            <span>{firstLine}</span>
            {secondLine && <span>{secondLine}</span>}
          </h1>

          <p className="contact-standfirst">Ce soir, le reportage, c'est vous.</p>

          <FilmStrip frames={frames} event={event} onChoose={choose} />

          <p className="contact-hint">Touchez une image pour commencer.</p>
        </div>
      </div>
    </Screen>
  );
}
