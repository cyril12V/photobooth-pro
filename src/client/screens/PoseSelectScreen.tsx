import { useEffect, useState } from 'react';
import { MdShuffle } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { poseSrc } from '@shared/lib/poseAssets';
import { loadActiveTemplate } from '@shared/lib/activeTemplate';
import type { ChallengePose } from '@shared/types';
import { ContactBack } from '../components/ContactHeader';
import '../../styles/contact-photo.css';

export function PoseSelectScreen() {
  const { poses, setSelectedPose, setSelectedPoses, setScreen } = useAppStore();

  const [totalSlots, setTotalSlots] = useState(1);
  const [selected, setSelected] = useState<ChallengePose[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const config = await loadActiveTemplate();
        if (config) {
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

  const headingTitle = isMulti ? `Choisissez vos ${totalSlots} poses.` : 'Choisissez une pose.';
  const headingSub = isMulti
    ? `${selected.length} sur ${totalSlots} choisie${selected.length > 1 ? 's' : ''}. Touchez une pose une seconde fois pour l'enlever.`
    : 'Vous la reproduisez devant l’appareil, on s’occupe du reste.';

  return (
    <Screen className="contact-paper overflow-hidden">
      <ContactBack onBack={() => setScreen('home')} />

      <div
        className="relative h-full flex flex-col"
        style={{
          padding: 'calc(var(--mm) * 10) var(--margin) calc(var(--mm) * 3.5)',
        }}
      >
        <h1 className="contact-title">{headingTitle}</h1>
        <p className="contact-lede" style={{ marginTop: '1rem' }}>
          {headingSub}
        </p>

        {poses.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <p className="contact-title" style={{ fontSize: 'clamp(2rem, 3.4vw, 3.25rem)' }}>
              Aucune pose n’est prête.
            </p>
            <p className="contact-lede" style={{ marginTop: '1rem', maxWidth: '40ch' }}>
              Demandez à l’organisateur d’ajouter des poses dans l’admin.
            </p>
          </div>
        ) : (
          <>
            {/* La planche-contact : une bande verticale par colonne, une pose par image. */}
            <div className="posesheet flex-1 min-h-0" style={{ marginTop: 'calc(var(--mm) * 3)' }}>
              {poses.map((pose, i) => {
                const selectedIndex = isMulti ? selected.findIndex((p) => p.id === pose.id) : -1;
                const isSelected = selectedIndex >= 0;
                return (
                  <button
                    key={pose.id}
                    onClick={() => (isMulti ? toggleMulti(pose) : chooseSingle(pose))}
                    className="posesheet-frame"
                    aria-pressed={isMulti ? isSelected : undefined}
                    aria-label={pose.label}
                  >
                    <span className="posesheet-image">
                      <img src={poseSrc(pose.image_path)} alt="" draggable={false} />
                      <span className="posesheet-label">{pose.label}</span>
                      {isSelected && <span className="posesheet-order">{selectedIndex + 1}</span>}
                    </span>
                    <span className="contact-edgeprint posesheet-number" aria-hidden>
                      ▸{i + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4" style={{ marginTop: 'calc(var(--mm) * 3)' }}>
              <button onClick={random} className="btn-editorial-secondary" style={{ minHeight: 64 }}>
                <MdShuffle size={22} />
                Tirer au sort
              </button>

              {isMulti && selected.length === totalSlots && (
                <button onClick={() => finalize(selected)} className="btn-editorial-primary" style={{ minHeight: 64 }}>
                  Prendre les photos
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
