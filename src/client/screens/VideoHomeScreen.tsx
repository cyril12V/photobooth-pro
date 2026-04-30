import { motion } from 'framer-motion';
import { MdArrowBack, MdMic } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
});

function formatDateFr(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      .toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

export function VideoHomeScreen() {
  const { event, setScreen, setVideoMode } = useAppStore();

  const eventName = event?.name ?? 'Notre Évènement';
  const eventDate = formatDateFr(event?.date);

  const start = () => {
    setVideoMode('interview');
    setScreen('video-interview');
  };

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-10">
        {/* Header */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <button
            onClick={() => setScreen('splash')}
            className="btn-editorial-ghost"
          >
            <MdArrowBack size={18} />
            <span>Retour</span>
          </button>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            {eventName}
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            {eventDate || 'En direct'}
          </span>
        </motion.div>

        {/* Corps */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <motion.p
            {...fadeUp(0.25)}
            className="label-editorial mb-5"
            style={{ color: '#6B5D4F' }}
          >
            The Video Issue
          </motion.p>

          <motion.h1
            {...fadeUp(0.35)}
            className="font-editorial leading-[0.9] mb-10"
            style={{
              fontSize: 'clamp(4rem, 9vw, 9rem)',
              color: '#1A1A1A',
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}
          >
            VIDÉO
          </motion.h1>

          <motion.button
            {...fadeUp(0.6)}
            onClick={start}
            className="card-editorial p-10 flex flex-col items-center text-center"
            style={{ minWidth: 320, minHeight: 320 }}
          >
            <div
              className="w-20 h-20 flex items-center justify-center mb-6"
              style={{
                backgroundColor: '#1A1A1A',
                borderRadius: '4px',
              }}
            >
              <MdMic size={40} color="#FAF6EE" />
            </div>
            <h2
              className="font-editorial"
              style={{
                fontSize: '2.25rem',
                color: '#1A1A1A',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Démarrer
            </h2>
          </motion.button>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-4 mt-6"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 004
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
