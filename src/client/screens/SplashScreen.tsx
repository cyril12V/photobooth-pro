import { motion } from 'framer-motion';
import { MdCameraAlt, MdVideocam } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

function formatDateFr(iso?: string): { day: string; month: string; year: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString('fr-FR', { day: '2-digit' }),
      month: d.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase(),
      year: d.toLocaleDateString('fr-FR', { year: 'numeric' }),
    };
  } catch {
    return null;
  }
}

export function SplashScreen() {
  const { event, settings, setScreen, setFlow } = useAppStore();
  const videoEnabled = settings?.video_enabled ?? true;

  const eventName = event?.name ?? 'Notre Évènement';
  const eventDate = formatDateFr(event?.date);

  const choosePhoto = () => {
    setFlow('photo');
    setScreen('home');
  };

  const chooseVideo = () => {
    if (!videoEnabled) return;
    setFlow('video');
    setScreen('video-home');
  };

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-10">
        {/* HEADER éditorial */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Bienvenue
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Photobooth Pro
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Issue {eventDate?.year ?? new Date().getFullYear()}
          </span>
        </motion.div>

        {/* CORPS */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <motion.p
            {...fadeUp(0.25)}
            className="label-editorial mb-5"
            style={{ color: '#6B5D4F' }}
          >
            The Wedding Issue
          </motion.p>

          <motion.h1
            {...fadeUp(0.35)}
            className="font-editorial leading-[0.9] mb-3"
            style={{
              fontSize: 'clamp(4.5rem, 10vw, 10rem)',
              color: '#1A1A1A',
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}
          >
            {eventName.toUpperCase()}
          </motion.h1>

          {eventDate && (
            <motion.div {...fadeUp(0.5)} className="flex items-center gap-5 mt-2 mb-12">
              <div className="editorial-rule-light" style={{ width: '3rem' }} />
              <div className="flex items-baseline gap-3">
                <span
                  className="font-editorial"
                  style={{ fontSize: '1.75rem', color: '#1A1A1A', fontWeight: 700 }}
                >
                  {eventDate.day}
                </span>
                <span className="label-editorial" style={{ color: '#1A1A1A' }}>
                  {eventDate.month}
                </span>
                <span
                  className="font-editorial"
                  style={{ fontSize: '1.75rem', color: '#1A1A1A', fontWeight: 700 }}
                >
                  {eventDate.year}
                </span>
              </div>
              <div className="editorial-rule-light" style={{ width: '3rem' }} />
            </motion.div>
          )}

          <motion.p
            {...fadeUp(0.7)}
            className="label-editorial mb-8"
            style={{ color: '#6B5D4F' }}
          >
            Choisissez votre format
          </motion.p>

          {/* Cards Photo / Vidéo — agrandies, sans sous-textes */}
          <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
            <motion.button
              {...fadeUp(0.85)}
              onClick={choosePhoto}
              className="card-editorial flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02]"
              style={{ minHeight: 460, padding: '4rem 3rem' }}
            >
              <div
                className="flex items-center justify-center mb-10"
                style={{
                  width: 140,
                  height: 140,
                  backgroundColor: '#1A1A1A',
                  borderRadius: '8px',
                }}
              >
                <MdCameraAlt size={72} color="#FAF6EE" />
              </div>
              <h2
                className="font-editorial"
                style={{
                  fontSize: 'clamp(3rem, 5vw, 4.5rem)',
                  color: '#1A1A1A',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                PHOTO
              </h2>
            </motion.button>

            <motion.button
              {...fadeUp(1)}
              onClick={chooseVideo}
              disabled={!videoEnabled}
              className="card-editorial flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02]"
              style={{
                minHeight: 460,
                padding: '4rem 3rem',
                opacity: videoEnabled ? 1 : 0.4,
                cursor: videoEnabled ? 'pointer' : 'not-allowed',
              }}
              title={videoEnabled ? 'Enregistrer une vidéo' : 'Mode vidéo désactivé'}
            >
              <div
                className="flex items-center justify-center mb-10"
                style={{
                  width: 140,
                  height: 140,
                  backgroundColor: '#E8DCC4',
                  borderRadius: '8px',
                }}
              >
                <MdVideocam size={72} color="#1A1A1A" />
              </div>
              <h2
                className="font-editorial"
                style={{
                  fontSize: 'clamp(3rem, 5vw, 4.5rem)',
                  color: '#1A1A1A',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                VIDÉO
              </h2>
            </motion.button>
          </div>
        </div>

        {/* FOOTER */}
        <motion.div
          {...fadeUp(1.1)}
          className="flex items-center justify-between pt-4 mt-6"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Touchez un format pour commencer
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 001
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
