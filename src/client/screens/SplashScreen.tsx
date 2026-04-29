import { motion } from 'framer-motion';
import { Camera, Video } from 'lucide-react';
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

export function SplashScreen() {
  const { event, settings, setScreen, setFlow } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
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
    <Screen className="overflow-hidden bg-wedding">
      {/* Fond cream avec gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(250,240,220,0.5) 0%, transparent 70%),' +
            '#faf6ef',
        }}
      />

      {/* Coins décoratifs */}
      <motion.div {...fadeIn(0.4)} className="absolute top-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.5)} className="absolute top-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tr" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="bl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.7)} className="absolute bottom-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      {/* Contenu */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-12">
        {/* En-tête : nom et date de l'évènement */}
        <motion.p
          {...fadeUp(0.3)}
          className="font-sans text-sm uppercase tracking-[0.45em] font-medium mb-3"
          style={{ color: '#c8956a' }}
        >
          Bienvenue
        </motion.p>

        <motion.h1
          {...fadeUp(0.5)}
          className="leading-none mb-4 text-center"
          style={{
            fontFamily: '"Allura", cursive',
            fontSize: 'clamp(4rem, 7vw, 8rem)',
            color: '#2a1a10',
            textShadow: '0 2px 40px rgba(212,165,116,0.25)',
            lineHeight: 1.1,
          }}
        >
          {eventName}
        </motion.h1>

        {eventDate && (
          <motion.p
            {...fadeUp(0.7)}
            className="font-sans text-base uppercase tracking-[0.35em] font-light mb-12"
            style={{ color: '#5a3e2b' }}
          >
            {eventDate}
          </motion.p>
        )}

        <motion.p
          {...fadeUp(0.85)}
          className="font-sans text-sm tracking-wide font-light mb-10"
          style={{ color: '#5a3e2b', opacity: 0.7 }}
        >
          Que souhaitez-vous faire ?
        </motion.p>

        {/* Cards Photo / Vidéo */}
        <div className="flex gap-8 items-stretch">
          {/* Photo */}
          <motion.button
            {...fadeUp(1)}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={choosePhoto}
            className="btn-touch flex flex-col items-center justify-center gap-5 p-10 rounded-3xl text-center"
            style={{
              width: 360,
              minHeight: 360,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,250,240,0.7) 100%)',
              border: '1.5px solid rgba(212,165,116,0.45)',
              boxShadow: '0 18px 48px rgba(90,60,40,0.14)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
                boxShadow: '0 12px 32px rgba(228,110,90,0.32)',
              }}
            >
              <Camera size={42} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <h2
                className="leading-none mb-1"
                style={{
                  fontFamily: '"Allura", cursive',
                  fontSize: '3.6rem',
                  color: '#2a1a10',
                }}
              >
                Photo
              </h2>
              <p
                className="font-sans text-xs uppercase tracking-[0.3em] mt-2"
                style={{ color: '#c8956a' }}
              >
                Imprimable & partageable
              </p>
            </div>
            <p
              className="font-sans text-sm font-light"
              style={{ color: '#5a3e2b', maxWidth: 260 }}
            >
              Capturez un instant à imprimer ou recevoir par email
            </p>
          </motion.button>

          {/* Vidéo */}
          <motion.button
            {...fadeUp(1.15)}
            whileHover={videoEnabled ? { y: -6, scale: 1.02 } : undefined}
            whileTap={videoEnabled ? { scale: 0.97 } : undefined}
            onClick={chooseVideo}
            disabled={!videoEnabled}
            className={`btn-touch flex flex-col items-center justify-center gap-5 p-10 rounded-3xl text-center transition-opacity ${
              videoEnabled ? '' : 'opacity-40 cursor-not-allowed'
            }`}
            style={{
              width: 360,
              minHeight: 360,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,250,240,0.7) 100%)',
              border: '1.5px solid rgba(212,165,116,0.45)',
              boxShadow: '0 18px 48px rgba(90,60,40,0.14)',
              backdropFilter: 'blur(8px)',
            }}
            title={videoEnabled ? 'Enregistrer un message vidéo' : 'Mode vidéo désactivé'}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #d4a574 0%, #b88a55 50%, #9c6f3e 100%)',
                boxShadow: '0 12px 32px rgba(184,138,85,0.32)',
              }}
            >
              <Video size={42} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <h2
                className="leading-none mb-1"
                style={{
                  fontFamily: '"Allura", cursive',
                  fontSize: '3.6rem',
                  color: '#2a1a10',
                }}
              >
                Vidéo
              </h2>
              <p
                className="font-sans text-xs uppercase tracking-[0.3em] mt-2"
                style={{ color: '#c8956a' }}
              >
                Message ou interview
              </p>
            </div>
            <p
              className="font-sans text-sm font-light"
              style={{ color: '#5a3e2b', maxWidth: 260 }}
            >
              Laissez un message vidéo ou répondez à des questions
            </p>
          </motion.button>
        </div>
      </div>
    </Screen>
  );
}
