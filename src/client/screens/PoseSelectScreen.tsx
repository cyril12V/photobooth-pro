import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MdArrowBack, MdShuffle, MdCheck } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { poseSrc } from '@shared/lib/poseAssets';
import { loadPrimaryTemplateSnapshot } from '@shared/lib/photoTemplate';
import type { ChallengePose } from '@shared/types';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
});

export function PoseSelectScreen() {
  const { poses, setSelectedPose, setSelectedPoses, setScreen } = useAppStore();

  const [totalSlots, setTotalSlots] = useState(1);
  const [selected, setSelected] = useState<ChallengePose[]>([]);

  useEffect(() => {
    (async () => {
      const { slotCount } = await loadPrimaryTemplateSnapshot();
      setTotalSlots(slotCount);
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
    ? `${selected.length} sur ${totalSlots} sélectionnée${selected.length > 1 ? 's' : ''}`
    : "Reproduisez la pose, on s'occupe du reste";

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: '2.5rem 5rem' }}>
        {/* Header */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <button
            onClick={() => setScreen('home')}
            className="btn-editorial-ghost"
          >
            <MdArrowBack size={18} />
            <span>Retour</span>
          </button>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Mode challenge
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 002
          </span>
        </motion.div>

        {/* Titre */}
        <div className="text-center" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
          <motion.p
            {...fadeUp(0.2)}
            className="label-editorial"
            style={{ color: '#6B5D4F', marginBottom: '1rem' }}
          >
            {headingSub}
          </motion.p>
          <motion.h1
            {...fadeUp(0.3)}
            className="font-editorial"
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
              color: '#1A1A1A',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {headingTitle}
          </motion.h1>
        </div>

        {/* Grille */}
        {poses.length === 0 ? (
          <motion.div
            {...fadeUp(0.5)}
            className="flex-1 flex items-center justify-center"
          >
            <div className="card-editorial p-12 max-w-xl text-center">
              <p
                className="font-editorial mb-3"
                style={{ fontSize: '2rem', color: '#1A1A1A', fontWeight: 800, letterSpacing: '-0.02em' }}
              >
                Aucune pose configurée
              </p>
              <p
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                }}
              >
                Demandez à l'organisateur d'ajouter des poses dans le mode admin.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center min-h-0">
            <div
              className="grid grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-6xl overflow-y-auto px-1"
              style={{ maxHeight: '52vh' }}
            >
              {poses.map((pose, i) => {
                const selectedIndex = isMulti ? selected.findIndex((p) => p.id === pose.id) : -1;
                const isSelected = selectedIndex >= 0;
                return (
                  <motion.button
                    key={pose.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => (isMulti ? toggleMulti(pose) : chooseSingle(pose))}
                    className="relative p-4 aspect-square flex flex-col items-center justify-center"
                    style={{
                      backgroundColor: '#FAF6EE',
                      borderRadius: '4px',
                      border: isSelected ? '2px solid #1A1A1A' : '1px solid rgba(212, 184, 150, 0.25)',
                      boxShadow: isSelected
                        ? '0 8px 32px rgba(0,0,0,0.08)'
                        : '0 4px 20px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    {isSelected && (
                      <div
                        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center"
                        style={{
                          backgroundColor: '#1A1A1A',
                          color: '#FAF6EE',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                        }}
                      >
                        {selectedIndex + 1}
                      </div>
                    )}
                    <img
                      src={poseSrc(pose.image_path)}
                      alt={pose.label}
                      className="w-full h-3/4 object-contain mb-2"
                    />
                    <p
                      className="text-center"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '0.8125rem',
                        color: '#1A1A1A',
                      }}
                    >
                      {pose.label}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button onClick={random} className="btn-editorial-secondary">
                <MdShuffle size={18} />
                Surprenez-moi
              </button>

              {isMulti && selected.length === totalSlots && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => finalize(selected)}
                  className="btn-editorial-primary"
                >
                  <MdCheck size={18} />
                  Continuer
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-3 pb-3 mt-4"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 002
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
