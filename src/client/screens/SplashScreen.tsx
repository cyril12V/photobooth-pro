import { motion } from 'framer-motion';
import { MdCameraAlt, MdVideocam } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 1.2, ease: [0.16, 1, 0.3, 1] as const },
});

function formatYear(iso?: string): string {
  if (!iso) return String(new Date().getFullYear());
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric' });
  } catch {
    return String(new Date().getFullYear());
  }
}

export function SplashScreen() {
  const { event, settings, setScreen, setFlow } = useAppStore();
  const videoEnabled = settings?.video_enabled ?? true;

  const eventName = event?.name ?? 'Notre Évènement';
  const year = formatYear(event?.date);
  const hasPhoto = Boolean(event?.background_path);
  const photoSrc = hasPhoto ? localFileUrl(event!.background_path!) : null;

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
      {/* Fond ivoire */}
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      {/* Numéro éditorial vertical droit */}
      <motion.div
        {...fadeIn(0.5)}
        className="absolute right-7 top-1/2 z-20 pointer-events-none"
        style={{
          transform: 'rotate(90deg) translateX(50%)',
          transformOrigin: 'right center',
          color: '#1A1A1A',
          opacity: 0.55,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.65rem',
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Issue №01 · {year}
      </motion.div>

      {/* CONTENU */}
      <div className="relative z-10 h-full flex flex-col" style={{ padding: '2.5rem 5rem' }}>
        {/* HEADER */}
        <motion.div
          {...fadeUp(0.15)}
          className="flex items-center justify-between pt-2 pb-3"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            Bienvenue
          </span>
          <span
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontWeight: 700,
              color: '#1A1A1A',
              fontSize: '1.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            Vœux
          </span>
          <span
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            Photo Booth
          </span>
        </motion.div>

        {/* SCÈNE — titre italic large derrière, petite photo au centre */}
        <div className="relative flex-1 flex flex-col items-center justify-center">
          {/* Titre Playfair italic en arrière-plan */}
          <motion.h1
            {...fadeUp(0.4)}
            className="absolute top-[20%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none whitespace-nowrap"
            style={{
              fontFamily: '"Playfair Display", "Bodoni Moda", Didot, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(4rem, 10vw, 9rem)',
              color: '#1A1A1A',
              letterSpacing: '-0.025em',
              lineHeight: 0.95,
              maxWidth: '95vw',
            }}
          >
            {eventName}
          </motion.h1>

          {/* Petite photo couple au centre — passe DEVANT le titre */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20"
            style={{
              width: 'clamp(13rem, 18vw, 17rem)',
              aspectRatio: '3/4',
              marginTop: '8vh',
            }}
          >
            <div
              className="w-full h-full overflow-hidden"
              style={{
                borderRadius: '4px',
                boxShadow: '0 18px 50px rgba(0,0,0,0.18)',
                background: '#E8DCC4',
              }}
            >
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Couple"
                  className="w-full h-full object-cover photo-warm"
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, #E8DCC4 0%, #D4B896 100%)',
                  }}
                >
                  <span
                    style={{
                      color: '#6B5D4F',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.6rem',
                      letterSpacing: '0.35em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    Couple
                  </span>
                </div>
              )}
            </div>

            <div
              className="absolute -bottom-3 -right-3 px-3 py-1.5"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '0.6rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
              }}
            >
              Cover
            </div>
          </motion.div>
        </div>

        {/* BAS — 2 cards Photo / Vidéo */}
        <div className="flex flex-col items-center" style={{ paddingBottom: '0.5rem' }}>
          <motion.p
            {...fadeUp(0.85)}
            className="mb-5"
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.7rem',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            Choisissez votre format
          </motion.p>

          <div className="flex items-center justify-center" style={{ gap: '1rem' }}>
            <motion.button
              {...fadeUp(1)}
              onClick={choosePhoto}
              className="flex items-center justify-center transition-all"
              style={{
                width: 200,
                height: 64,
                background: '#1A1A1A',
                color: '#FAF6EE',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                gap: '0.75rem',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <MdCameraAlt size={20} />
              <span
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  letterSpacing: '-0.01em',
                }}
              >
                Photo
              </span>
            </motion.button>

            <motion.button
              {...fadeUp(1.1)}
              onClick={chooseVideo}
              disabled={!videoEnabled}
              className="flex items-center justify-center transition-all"
              style={{
                width: 200,
                height: 64,
                background: 'transparent',
                color: '#1A1A1A',
                borderRadius: '999px',
                border: '1px solid #1A1A1A',
                cursor: videoEnabled ? 'pointer' : 'not-allowed',
                opacity: videoEnabled ? 1 : 0.4,
                gap: '0.75rem',
              }}
              whileHover={videoEnabled ? { scale: 1.02 } : undefined}
              whileTap={videoEnabled ? { scale: 0.97 } : undefined}
              title={videoEnabled ? '' : 'Mode vidéo désactivé'}
            >
              <MdVideocam size={20} />
              <span
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  letterSpacing: '-0.01em',
                }}
              >
                Vidéo
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
