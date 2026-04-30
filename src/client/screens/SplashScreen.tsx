import { motion } from 'framer-motion';
import { MdCameraAlt, MdVideocam } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 1.4, ease: [0.16, 1, 0.3, 1] as const },
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
      {/* PHOTO HERO en background */}
      <div className="absolute inset-0" style={{ backgroundColor: '#1A1A1A' }}>
        {photoSrc ? (
          <motion.img
            {...fadeIn(0)}
            src={photoSrc}
            alt="Couple"
            className="w-full h-full object-cover photo-warm"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% 30%, #E8DCC4 0%, #D4B896 60%, #6B5D4F 100%)',
            }}
          />
        )}
      </div>

      {/* Overlay gradient pour lisibilité */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Numéro éditorial latéral droit */}
      <motion.div
        {...fadeIn(0.6)}
        className="absolute right-8 top-1/2 z-20 pointer-events-none"
        style={{
          transform: 'rotate(90deg) translateX(50%)',
          transformOrigin: 'right center',
          color: '#FAF6EE',
          opacity: 0.85,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.7rem',
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Issue №01 · {year}
      </motion.div>

      {/* CONTENU */}
      <div className="relative z-10 h-full flex flex-col" style={{ padding: '3rem 5rem' }}>
        {/* HEADER */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid rgba(250, 246, 239, 0.5)' }}
        >
          <span
            style={{
              color: '#FAF6EE',
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
              color: '#FAF6EE',
              fontSize: '1.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            Vœux
          </span>
          <span
            style={{
              color: '#FAF6EE',
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

        {/* CŒUR : nom event en italic, et 2 cards superposées */}
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <motion.p
            {...fadeUp(0.6)}
            style={{
              color: '#FAF6EE',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.7rem',
              letterSpacing: '0.45em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: '1.5rem',
            }}
          >
            Le mariage de
          </motion.p>

          <motion.h1
            {...fadeUp(0.75)}
            style={{
              fontFamily: '"Playfair Display", "Bodoni Moda", Didot, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(3rem, 7vw, 6rem)',
              color: '#FAF6EE',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textShadow: '0 4px 30px rgba(0,0,0,0.3)',
              maxWidth: '56rem',
              marginBottom: '4rem',
            }}
          >
            {eventName}
          </motion.h1>

          {/* 2 cards Photo / Vidéo en glassmorphism subtil */}
          <div className="flex items-center justify-center" style={{ gap: '1.5rem' }}>
            <motion.button
              {...fadeUp(0.95)}
              onClick={choosePhoto}
              className="flex flex-col items-center justify-center transition-all"
              style={{
                width: 220,
                height: 260,
                background: 'rgba(250, 246, 239, 0.94)',
                borderRadius: '8px',
                border: '1px solid rgba(250, 246, 239, 0.4)',
                cursor: 'pointer',
                gap: '1.5rem',
                backdropFilter: 'blur(10px)',
              }}
              whileHover={{ y: -6, background: '#FAF6EE' }}
              whileTap={{ scale: 0.98 }}
            >
              <MdCameraAlt size={48} color="#1A1A1A" />
              <div className="text-center">
                <p
                  style={{
                    color: '#6B5D4F',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}
                >
                  Mode
                </p>
                <h2
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontStyle: 'italic',
                    fontWeight: 600,
                    fontSize: '1.875rem',
                    color: '#1A1A1A',
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  Photo
                </h2>
              </div>
            </motion.button>

            <motion.button
              {...fadeUp(1.1)}
              onClick={chooseVideo}
              disabled={!videoEnabled}
              className="flex flex-col items-center justify-center transition-all"
              style={{
                width: 220,
                height: 260,
                background: 'rgba(250, 246, 239, 0.94)',
                borderRadius: '8px',
                border: '1px solid rgba(250, 246, 239, 0.4)',
                cursor: videoEnabled ? 'pointer' : 'not-allowed',
                opacity: videoEnabled ? 1 : 0.4,
                gap: '1.5rem',
                backdropFilter: 'blur(10px)',
              }}
              whileHover={videoEnabled ? { y: -6, background: '#FAF6EE' } : undefined}
              whileTap={videoEnabled ? { scale: 0.98 } : undefined}
              title={videoEnabled ? '' : 'Mode vidéo désactivé'}
            >
              <MdVideocam size={48} color="#1A1A1A" />
              <div className="text-center">
                <p
                  style={{
                    color: '#6B5D4F',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}
                >
                  Mode
                </p>
                <h2
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontStyle: 'italic',
                    fontWeight: 600,
                    fontSize: '1.875rem',
                    color: '#1A1A1A',
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  Vidéo
                </h2>
              </div>
            </motion.button>
          </div>
        </div>

        {/* FOOTER discret */}
        <motion.div
          {...fadeUp(1.3)}
          className="flex items-center justify-center pt-3"
        >
          <span
            style={{
              color: '#FAF6EE',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.7rem',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            Touchez un mode pour commencer
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
