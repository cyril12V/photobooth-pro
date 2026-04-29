import { motion } from 'framer-motion';
import { MdCameraAlt, MdBolt, MdArrowBack, MdImageNotSupported } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';

// ─── Placeholder photo couple ─────────────────────────────────────────────────

function CouplePlaceholder() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{ backgroundColor: '#E8DCC4' }}
    >
      <MdImageNotSupported size={56} style={{ color: '#6B5D4F', opacity: 0.5 }} />
      <p className="label-editorial" style={{ color: '#6B5D4F', opacity: 0.7 }}>
        Photo couple
      </p>
    </div>
  );
}

// ─── Formatage date ───────────────────────────────────────────────────────────

function formatDate(iso?: string): { day: string; month: string; year: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString('fr-FR', { day: '2-digit' }),
      month: d.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase(),
      year: d.toLocaleDateString('fr-FR', { year: 'numeric' }),
    };
  } catch {
    return null;
  }
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

// ─── HomeScreen — Couverture éditoriale ──────────────────────────────────────

export function HomeScreen() {
  const { event, setScreen, setMode, poses, settings } = useAppStore();
  const challengeAvailable = poses.length > 0;
  const videoEnabled = settings?.video_enabled ?? true;

  const hasPhoto = Boolean(event?.background_path);
  const photoSrc = hasPhoto ? localFileUrl(event!.background_path!) : null;
  const coupleName = event?.name ?? 'Camille & Julien';
  const date = formatDate(event?.date);

  const choose = (mode: 'classic' | 'challenge') => {
    if (mode === 'challenge' && !challengeAvailable) return;
    setMode(mode);
    if (mode === 'challenge') setScreen('pose-select');
    else setScreen('capture');
  };

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      {videoEnabled && (
        <motion.button
          {...fadeUp(0.05)}
          onClick={() => setScreen('splash')}
          className="absolute top-8 left-8 z-30 btn-editorial-ghost"
        >
          <MdArrowBack size={18} />
          <span>Retour</span>
        </motion.button>
      )}

      <div className="relative z-10 h-full flex flex-col px-16 py-10">
        {/* HEADER éditorial — pas de tirets */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Bienvenue
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Photobooth Pro
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Issue {date?.year ?? new Date().getFullYear()}
          </span>
        </motion.div>

        {/* CORPS */}
        <div className="flex-1 grid grid-cols-12 gap-12 items-center pt-8">
          {/* GAUCHE : titre éditorial */}
          <div className="col-span-7 flex flex-col justify-center min-w-0">
            <motion.p
              {...fadeUp(0.25)}
              className="label-editorial mb-5"
              style={{ color: '#6B5D4F' }}
            >
              The Wedding Issue
            </motion.p>

            {/* Titre fixe court qui ne déborde jamais */}
            <motion.h1
              {...fadeUp(0.35)}
              className="font-editorial leading-[0.85]"
              style={{
                fontSize: 'clamp(7rem, 13vw, 14rem)',
                color: '#1A1A1A',
                letterSpacing: '-0.045em',
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              MARIAGE
            </motion.h1>

            {/* Nom du couple en script Pinyon — wrap si long */}
            <motion.p
              {...fadeUp(0.5)}
              className="mt-3"
              style={{
                fontFamily: '"Pinyon Script", cursive',
                fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                color: '#1A1A1A',
                lineHeight: 1.1,
                wordBreak: 'break-word',
              }}
            >
              {coupleName}
            </motion.p>

            {/* Date format magazine — sans points médians */}
            {date && (
              <motion.div {...fadeUp(0.65)} className="mt-8 flex items-center gap-5">
                <div className="editorial-rule-light" style={{ width: '3.5rem' }} />
                <div className="flex items-baseline gap-3">
                  <span className="font-editorial" style={{ fontSize: '2.25rem', color: '#1A1A1A', fontWeight: 700 }}>
                    {date.day}
                  </span>
                  <span className="label-editorial" style={{ color: '#1A1A1A', fontSize: '0.875rem' }}>
                    {date.month}
                  </span>
                  <span className="font-editorial" style={{ fontSize: '2.25rem', color: '#1A1A1A', fontWeight: 700 }}>
                    {date.year}
                  </span>
                </div>
              </motion.div>
            )}

            {/* CTAs */}
            <motion.div {...fadeUp(0.8)} className="mt-10 flex flex-wrap gap-3">
              <button onClick={() => choose('classic')} className="btn-editorial-primary">
                <MdCameraAlt size={18} />
                Photo classique
              </button>

              <button
                onClick={() => choose('challenge')}
                disabled={!challengeAvailable}
                className="btn-editorial-secondary"
                title={challengeAvailable ? '' : 'Aucune pose configurée'}
              >
                <MdBolt size={18} />
                Challenge
              </button>
            </motion.div>

            <motion.p
              {...fadeUp(0.95)}
              className="mt-5 text-sm"
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.5,
                maxWidth: '32rem',
              }}
            >
              Capturez l'instant. Une photo classique pour l'élégance, un défi pour l'amusement.
              Chaque souvenir devient une couverture éditoriale.
            </motion.p>
          </div>

          {/* DROITE : photo couple */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-5 relative"
            style={{ aspectRatio: '3/4' }}
          >
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Couple"
                  className="w-full h-full object-cover photo-warm"
                  draggable={false}
                />
              ) : (
                <CouplePlaceholder />
              )}
            </div>

            <div
              className="absolute -bottom-2 -right-2 px-4 py-2 label-editorial"
              style={{ backgroundColor: '#1A1A1A', color: '#FAF6EE', fontSize: '0.6875rem' }}
            >
              Cover Photo
            </div>
          </motion.div>
        </div>

        {/* FOOTER */}
        <motion.div
          {...fadeUp(1.05)}
          className="flex items-center justify-between pt-4 mt-6"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Touchez un mode pour commencer
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 001
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
