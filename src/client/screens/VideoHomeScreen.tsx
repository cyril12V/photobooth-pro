import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, MicVocal } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CornerDecor } from '@client/components/decors';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 1 },
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
  const { event, settings, setScreen, setVideoMode } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;

  const eventName = event?.name ?? 'Notre Évènement';
  const eventDate = formatDateFr(event?.date);

  const choose = (mode: 'interview' | 'free_message') => {
    setVideoMode(mode);
    if (mode === 'interview') setScreen('video-interview');
    else setScreen('video-free');
  };

  return (
    <Screen className="overflow-hidden bg-wedding">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      <motion.div {...fadeIn(0.3)} className="absolute top-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.4)} className="absolute top-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tr" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.5)} className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="bl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      <button
        onClick={() => setScreen('splash')}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur transition-colors"
        style={{
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(212,165,116,0.4)',
          color: '#5a3e2b',
        }}
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Retour</span>
      </button>

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-12">
        <motion.p
          {...fadeUp(0.3)}
          className="font-sans text-sm uppercase tracking-[0.45em] font-medium mb-3"
          style={{ color: '#c8956a' }}
        >
          Vidéobooth
        </motion.p>

        <motion.h1
          {...fadeUp(0.45)}
          className="leading-none mb-3 text-center"
          style={{
            fontFamily: '"Allura", cursive',
            fontSize: 'clamp(3.5rem, 6vw, 7rem)',
            color: '#2a1a10',
            lineHeight: 1.1,
          }}
        >
          {eventName}
        </motion.h1>

        {eventDate && (
          <motion.p
            {...fadeUp(0.6)}
            className="font-sans text-sm uppercase tracking-[0.3em] font-light mb-10"
            style={{ color: '#5a3e2b' }}
          >
            {eventDate}
          </motion.p>
        )}

        <motion.p
          {...fadeUp(0.75)}
          className="font-sans text-sm tracking-wide font-light mb-8"
          style={{ color: '#5a3e2b', opacity: 0.7 }}
        >
          Choisissez votre style de message
        </motion.p>

        <div className="flex gap-8">
          {/* Interview guidée */}
          <motion.button
            {...fadeUp(0.9)}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => choose('interview')}
            className="btn-touch flex flex-col items-center justify-center gap-5 p-10 rounded-3xl text-center"
            style={{
              width: 340,
              minHeight: 340,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,250,240,0.7) 100%)',
              border: '1.5px solid rgba(212,165,116,0.45)',
              boxShadow: '0 18px 48px rgba(90,60,40,0.14)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #d4a574 0%, #b88a55 50%, #9c6f3e 100%)',
                boxShadow: '0 12px 32px rgba(184,138,85,0.32)',
              }}
            >
              <MicVocal size={36} color="#fff" strokeWidth={2.2} />
            </div>
            <h2
              className="leading-none"
              style={{
                fontFamily: '"Allura", cursive',
                fontSize: '3rem',
                color: '#2a1a10',
              }}
            >
              Interview
            </h2>
            <p
              className="font-sans text-sm font-light"
              style={{ color: '#5a3e2b', maxWidth: 240 }}
            >
              Répondez à une série de questions préparées par les organisateurs
            </p>
          </motion.button>

          {/* Message libre */}
          <motion.button
            {...fadeUp(1.05)}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => choose('free_message')}
            className="btn-touch flex flex-col items-center justify-center gap-5 p-10 rounded-3xl text-center"
            style={{
              width: 340,
              minHeight: 340,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,250,240,0.7) 100%)',
              border: '1.5px solid rgba(212,165,116,0.45)',
              boxShadow: '0 18px 48px rgba(90,60,40,0.14)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
                boxShadow: '0 12px 32px rgba(228,110,90,0.32)',
              }}
            >
              <MessageCircle size={36} color="#fff" strokeWidth={2.2} />
            </div>
            <h2
              className="leading-none"
              style={{
                fontFamily: '"Allura", cursive',
                fontSize: '3rem',
                color: '#2a1a10',
              }}
            >
              Message libre
            </h2>
            <p
              className="font-sans text-sm font-light"
              style={{ color: '#5a3e2b', maxWidth: 240 }}
            >
              Laissez un mot spontané, comme vous le sentez
            </p>
          </motion.button>
        </div>
      </div>
    </Screen>
  );
}
