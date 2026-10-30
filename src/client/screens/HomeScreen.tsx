import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';
import { FilmStrip, type FilmFrame } from '../components/FilmStrip';
import { ContactBack } from '../components/ContactHeader';
import { FILM_IMAGES } from '../components/filmImages';

type Mode = 'classic' | 'challenge';

export function HomeScreen() {
  const { event, setScreen, setMode, poses, settings } = useAppStore();
  const challengeAvailable = poses.length > 0;
  const videoEnabled = settings?.video_enabled ?? true;
  const couplePhoto = event?.background_path ? localFileUrl(event.background_path) : null;

  const choose = (mode: Mode) => {
    if (mode === 'challenge' && !challengeAvailable) return;
    setMode(mode);
    if (mode === 'challenge') setScreen('pose-select');
    else setScreen('capture');
  };

  const frames: Array<FilmFrame<Mode>> = [
    {
      id: 'classic',
      label: 'Classique',
      caption: 'Vous posez comme vous voulez.',
      image: couplePhoto,
      crop: '30% 45%',
      fallback: FILM_IMAGES.classic,
    },
    {
      id: 'challenge',
      label: 'Challenge',
      caption: challengeAvailable ? 'Vous choisissez une pose à imiter.' : "Aucune pose n'est prête.",
      fallback: FILM_IMAGES.challenge,
      disabled: !challengeAvailable,
    },
  ];

  return (
    <Screen className="overflow-hidden">
      <div className="contact contact-paper absolute inset-0">
        {videoEnabled && <ContactBack onBack={() => setScreen('splash')} />}

        <div className="contact-page">
          {event?.name && <p className="contact-dateline">{event.name.trim()}</p>}
          <h1 className="contact-title" style={{ marginTop: 'calc(var(--mm) * 1.6)' }}>
            Comment voulez-vous poser&nbsp;?
          </h1>

          <FilmStrip frames={frames} event={event} onChoose={choose} />

          <p className="contact-hint">Touchez une image pour choisir.</p>
        </div>
      </div>
    </Screen>
  );
}
