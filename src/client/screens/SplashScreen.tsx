import { motion } from 'framer-motion';
import { MdCameraAlt, MdVideocam } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
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

      <div className="relative z-10 h-full flex flex-col" style={{ padding: '2.5rem 5rem' }}>
        {/* HEADER éditorial sobre */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Bienvenue
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Issue {year}
          </span>
        </motion.div>

        {/* CORPS centré */}
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
          <motion.p
            {...fadeUp(0.25)}
            className="label-editorial"
            style={{ color: '#6B5D4F', marginBottom: '1.5rem' }}
          >
            Bienvenue
          </motion.p>

          <motion.h1
            {...fadeUp(0.35)}
            className="font-editorial"
            style={{
              fontSize: 'clamp(2.25rem, 4vw, 3rem)',
              color: '#1A1A1A',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              maxWidth: '36rem',
            }}
          >
            {eventName}
          </motion.h1>

          <motion.p
            {...fadeUp(0.55)}
            className="label-editorial"
            style={{ color: '#6B5D4F', marginTop: '4rem', marginBottom: '2.5rem' }}
          >
            Choisissez votre format
          </motion.p>

          {/* Cards Photo / Vidéo — petites, centrées, espacées */}
          <div className="flex items-center justify-center" style={{ gap: '3rem' }}>
            <motion.button
              {...fadeUp(0.7)}
              onClick={choosePhoto}
              className="flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02]"
              style={{
                width: 280,
                height: 280,
                backgroundColor: '#FAF6EE',
                borderRadius: '24px',
                border: '1px solid rgba(212, 184, 150, 0.4)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                gap: '1.75rem',
              }}
            >
              <MdCameraAlt size={56} color="#1A1A1A" />
              <h2
                className="font-editorial"
                style={{
                  fontSize: '2rem',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                Photo
              </h2>
            </motion.button>

            <motion.button
              {...fadeUp(0.85)}
              onClick={chooseVideo}
              disabled={!videoEnabled}
              className="flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02]"
              style={{
                width: 280,
                height: 280,
                backgroundColor: '#FAF6EE',
                borderRadius: '24px',
                border: '1px solid rgba(212, 184, 150, 0.4)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                opacity: videoEnabled ? 1 : 0.4,
                cursor: videoEnabled ? 'pointer' : 'not-allowed',
                gap: '1.75rem',
              }}
              title={videoEnabled ? 'Enregistrer une vidéo' : 'Mode vidéo désactivé'}
            >
              <MdVideocam size={56} color="#1A1A1A" />
              <h2
                className="font-editorial"
                style={{
                  fontSize: '2rem',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                Vidéo
              </h2>
            </motion.button>
          </div>
        </div>

        {/* FOOTER */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 001
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
