import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shuffle, Check } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CornerDecor } from '@client/components/decors';
import { poseSrc } from '@shared/lib/poseAssets';
import type { ChallengePose, TemplateConfig } from '@shared/types';

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
  const { poses, setSelectedPose, setSelectedPoses, setScreen, settings } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;

  const [totalSlots, setTotalSlots] = useState(1);
  const [selected, setSelected] = useState<ChallengePose[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const templates = await window.api.template.list();
        if (templates.length > 0) {
          const config = JSON.parse(templates[0].config_json) as TemplateConfig;
          const slots = config.elements.filter((el) => el.type === 'photo-slot').length;
          setTotalSlots(slots > 0 ? slots : 1);
        }
      } catch {
        setTotalSlots(1);
      }
    })();
  }, []);

  const isMulti = totalSlots > 1;

  const finalize = (chosen: ChallengePose[]) => {
    if (chosen.length === 0) return;
    setSelectedPoses(chosen);
    setSelectedPose(chosen[0]);
    setScreen('capture');
  };

  const chooseSingle = (pose: ChallengePose) => {
    finalize([pose]);
  };

  const toggleMulti = (pose: ChallengePose) => {
    setSelected((prev) => {
      const idx = prev.findIndex((p) => p.id === pose.id);
      if (idx >= 0) {
        return prev.filter((p) => p.id !== pose.id);
      }
      if (prev.length >= totalSlots) return prev;
      return [...prev, pose];
    });
  };

  // Auto-navigate when complete in multi-mode
  useEffect(() => {
    if (!isMulti) return;
    if (selected.length === totalSlots) {
      const t = setTimeout(() => finalize(selected), 600);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, totalSlots, isMulti]);

  const random = () => {
    if (poses.length === 0) return;
    if (isMulti) {
      const pool = [...poses];
      const picked: ChallengePose[] = [];
      const take = Math.min(totalSlots, pool.length);
      for (let i = 0; i < take; i += 1) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool[idx]);
        pool.splice(idx, 1);
      }
      // Pad with repeats if pool was smaller than totalSlots
      while (picked.length < totalSlots && poses.length > 0) {
        picked.push(poses[Math.floor(Math.random() * poses.length)]);
      }
      finalize(picked);
    } else {
      const p = poses[Math.floor(Math.random() * poses.length)];
      chooseSingle(p);
    }
  };

  const headingTitle = isMulti ? `Choisissez vos ${totalSlots} poses` : 'Choisissez votre défi';
  const headingSub = isMulti
    ? `${selected.length} / ${totalSlots} sélectionnée(s)`
    : "Reproduisez la pose, on s'occupe du reste";

  return (
    <Screen className="overflow-hidden bg-wedding flex flex-col items-center justify-center px-12 py-12">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      <motion.div {...fadeIn(0.5)} className="absolute top-0 left-0 w-56 h-56 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 right-0 w-56 h-56 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      <button
        onClick={() => setScreen('home')}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 px-5 py-3 rounded-full bg-white/60 border border-[#d4a574]/30 text-[#5a3e2b] hover:bg-white/80 backdrop-blur transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm tracking-wide">Retour</span>
      </button>

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
          {headingTitle}
        </motion.h2>
        <motion.p
          {...fadeUp(0.45)}
          className="font-sans text-base font-light mb-10"
          style={{ color: '#5a3e2b' }}
        >
          {headingSub}
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
              {poses.map((pose, i) => {
                const selectedIndex = isMulti ? selected.findIndex((p) => p.id === pose.id) : -1;
                const isSelected = selectedIndex >= 0;
                return (
                  <motion.button
                    key={pose.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.05, y: -6 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => (isMulti ? toggleMulti(pose) : chooseSingle(pose))}
                    className="glass-wedding shine rounded-3xl p-4 aspect-square flex flex-col items-center justify-center group relative overflow-hidden"
                    style={
                      isSelected
                        ? {
                            outline: '2px solid #d4a574',
                            outlineOffset: 2,
                            boxShadow: '0 12px 40px rgba(212,165,116,0.35)',
                          }
                        : undefined
                    }
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"
                      style={{ background: 'linear-gradient(135deg, rgba(242,196,206,0.15) 0%, rgba(212,165,116,0.1) 100%)' }}
                    />
                    {isSelected && (
                      <div
                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                        style={{
                          background: 'linear-gradient(135deg, #d4a574 0%, #c8956a 100%)',
                          boxShadow: '0 4px 14px rgba(212,165,116,0.5)',
                        }}
                      >
                        {selectedIndex + 1}
                      </div>
                    )}
                    <img
                      src={poseSrc(pose.image_path)}
                      alt={pose.label}
                      className="relative w-full h-3/4 object-contain mb-3 rounded-xl"
                    />
                    <p className="relative font-medium text-sm text-center px-2" style={{ color: '#2a1a10' }}>
                      {pose.label}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-10 flex items-center gap-4">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={random}
                className="flex items-center gap-3 px-8 py-4 rounded-full bg-white/60 border border-[#d4a574]/30 backdrop-blur hover:bg-white/80 transition-colors"
                style={{ color: '#5a3e2b' }}
              >
                <Shuffle size={20} />
                <span className="font-medium tracking-wide">Surprenez-moi</span>
              </motion.button>

              {isMulti && selected.length === totalSlots && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => finalize(selected)}
                  className="flex items-center gap-3 px-8 py-4 rounded-full text-white"
                  style={{
                    background: 'linear-gradient(135deg, #d4a574 0%, #c8956a 100%)',
                    boxShadow: '0 10px 32px rgba(212,165,116,0.4)',
                  }}
                >
                  <Check size={20} />
                  <span className="font-medium tracking-wide">Continuer</span>
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
