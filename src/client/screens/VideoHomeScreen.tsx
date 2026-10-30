import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { FilmStrip, type FilmFrame } from '../components/FilmStrip';
import { ContactBack } from '../components/ContactHeader';
import { FILM_IMAGES } from '../components/filmImages';

type Format = 'interview' | 'free';

export function VideoHomeScreen() {
  const { event, setScreen, setVideoMode } = useAppStore();

  const choose = (format: Format) => {
    if (format === 'interview') {
      setVideoMode('interview');
      setScreen('video-interview');
    } else {
      setVideoMode('free_message');
      setScreen('video-free');
    }
  };

  const frames: Array<FilmFrame<Format>> = [
    {
      id: 'interview',
      label: 'Interview',
      caption: 'On vous pose quelques questions.',
      fallback: FILM_IMAGES.interview,
    },
    {
      id: 'free',
      label: 'Message libre',
      caption: 'Vous dites ce que vous voulez aux mariés.',
      fallback: FILM_IMAGES.freeMessage,
    },
  ];

  return (
    <Screen className="overflow-hidden">
      <div className="contact contact-paper absolute inset-0">
        <ContactBack onBack={() => setScreen('splash')} />

        <div className="contact-page">
          {event?.name && <p className="contact-dateline">{event.name.trim()}</p>}
          <h1 className="contact-title" style={{ marginTop: 'calc(var(--mm) * 1.6)' }}>
            Quel message voulez-vous laisser&nbsp;?
          </h1>

          <FilmStrip frames={frames} event={event} onChoose={choose} />

          <p className="contact-hint">Touchez une image pour choisir.</p>
        </div>
      </div>
    </Screen>
  );
}
