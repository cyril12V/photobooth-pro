import { motion } from 'framer-motion';
import { ArrowLeft, Shuffle } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CornerDecor } from '@client/components/decors';
import { poseSrc } from '@shared/lib/poseAssets';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.8 },
});

export function PoseSelectScreen() {
  const { poses, setSelectedPose, setScreen, settings } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;

  const choose = (pose: typeof poses[0]) => {
    setSelectedPose(pose);
    setScreen('capture');
  };

  const random = () => {
    if (poses.length === 0) return;
    const p = poses[Math.floor(Math.random() * poses.length)];
    choose(p);
  };

  return (
    <Screen className="overflow-hidden bg-wedding flex flex-col items-center justify-center px-12 py-12">
      {/* Fond cream avec gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      {/* Coins décoratifs */}
      <motion.div {...fadeIn(0.5)} className="absolute top-0 left-0 w-56 h-56 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 right-0 w-56 h-56 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      {/* Bouton retour */}
      <button
        onClick={() => setScreen('home')}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 px-5 py-3 rounded-full bg-white/60 border border-[#d4a574]/30 text-[#5a3e2b] hover:bg-white/80 backdrop-blur transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Retour</span>
      </button>

      {/* Titre */}
      <div className="relative z-10 flex flex-col items-center w-full">
        <motion.p
          {...fadeUp(0.2)}
          className="font-sans text-sm uppercase tracking-[0.45em] font-medium mb-3"
          style={{ color: '#c8956a' }}
        >
          Mode challenge
        </motion.p>

        <motion.div
          initial={{ scaleX: 0, originX: 0.5 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-12 h-px mb-4"
          style={{ background: 'linear-gradient(to right, transparent, #d4a574, transparent)' }}
        />

        <motion.h2
          {...fadeUp(0.3)}
          className="text-center mb-2"
          style={{
            fontFamily: '"Allura", cursive',
            fontSize: 'clamp(2.5rem, 5vw, 5rem)',
            color: '#2a1a10',
          }}
        >
          Choisissez votre défi
        </motion.h2>
        <motion.p
          {...fadeUp(0.45)}
          className="font-sans text-base font-light mb-10"
          style={{ color: '#5a3e2b' }}
        >
          Reproduisez la pose, on s'occupe du reste
        </motion.p>

        {poses.length === 0 ? (
          <motion.div
            {...fadeUp(0.5)}
            className="glass-wedding rounded-3xl p-12 max-w-xl text-center"
          >
            <p className="text-xl mb-4 font-medium" style={{ color: '#2a1a10' }}>
              Aucune pose configurée pour le moment
            </p>
            <p className="text-sm font-light" style={{ color: '#5a3e2b' }}>
              Demandez à l'organisateur d'ajouter des poses dans le mode admin
            </p>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-5 max-w-6xl w-full max-h-[55vh] overflow-y-auto p-2">
              {poses.map((pose, i) => (
                <motion.button
                  key={pose.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ scale: 1.05, y: -6 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => choose(pose)}
                  className="glass-wedding shine rounded-3xl p-4 aspect-square flex flex-col items-center justify-center group relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"
                    style={{ background: 'linear-gradient(135deg, rgba(242,196,206,0.15) 0%, rgba(212,165,116,0.1) 100%)' }}
                  />
                  <img
                    src={poseSrc(pose.image_path)}
                    alt={pose.label}
                    className="relative w-full h-3/4 object-contain mb-3 rounded-xl"
                  />
                  <p className="relative font-medium text-sm text-center px-2" style={{ color: '#2a1a10' }}>
                    {pose.label}
                  </p>
                </motion.button>
              ))}
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={random}
              className="mt-10 flex items-center gap-3 px-8 py-4 rounded-full bg-white/60 border border-[#d4a574]/30 backdrop-blur hover:bg-white/80 transition-colors"
              style={{ color: '#5a3e2b' }}
            >
              <Shuffle size={20} />
              <span className="font-medium tracking-wide">Surprenez-moi</span>
            </motion.button>
          </>
        )}
      </div>
    </Screen>
  );
}
