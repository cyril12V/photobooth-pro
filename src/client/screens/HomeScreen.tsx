import { motion } from 'framer-motion';
import { MdCameraAlt, MdArrowBack, MdImageNotSupported } from 'react-icons/md';
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
      <MdImageNotSupported size={48} style={{ color: '#6B5D4F', opacity: 0.5 }} />
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
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { event, setScreen, setMode, poses, settings } = useAppStore();
  const challengeAvailable = poses.length > 0;
  const videoEnabled = settings?.video_enabled ?? true;

  const hasPhoto = Boolean(event?.background_path);
  const photoSrc = hasPhoto ? localFileUrl(event!.background_path!) : null;
  const coupleName = event?.name ?? 'Camille & Julien';
  const date = formatDate(event?.date);

  const start = () => {
    if (challengeAvailable) {
      setMode('challenge');
      setScreen('pose-select');
    } else {
      setMode('classic');
      setScreen('capture');
    }
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
          {videoEnabled ? (
            <button
              onClick={() => setScreen('splash')}
              className="btn-editorial-ghost"
            >
              <MdArrowBack size={18} />
              <span>Retour</span>
            </button>
          ) : (
            <span className="label-editorial" style={{ color: '#1A1A1A' }}>
              Photo
            </span>
          )}
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Issue {date?.year ?? new Date().getFullYear()}
          </span>
        </motion.div>

        {/* CORPS */}
        {hasPhoto ? (
          <div
            className="flex-1 grid items-center"
            style={{ gridTemplateColumns: '1fr auto', gap: '4rem', paddingTop: '3rem', paddingBottom: '3rem' }}
          >
            {/* GAUCHE : titre éditorial calme */}
            <div className="flex flex-col justify-center min-w-0" style={{ maxWidth: '32rem' }}>
              <motion.p
                {...fadeUp(0.25)}
                className="label-editorial"
                style={{ color: '#6B5D4F', marginBottom: '1.25rem' }}
              >
                Photo
              </motion.p>

              <motion.h1
                {...fadeUp(0.35)}
                className="font-editorial"
                style={{
                  fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                  color: '#1A1A1A',
                  letterSpacing: '-0.02em',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  wordBreak: 'break-word',
                }}
              >
                {coupleName}
              </motion.h1>

              {date && (
                <motion.p
                  {...fadeUp(0.5)}
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '1.25rem',
                    color: '#6B5D4F',
                    marginTop: '1.25rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {date.day} {date.month.toLowerCase()} {date.year}
                </motion.p>
              )}

              <motion.div {...fadeUp(0.75)} className="flex flex-wrap gap-3" style={{ marginTop: '3rem' }}>
                <button onClick={start} className="btn-editorial-primary">
                  <MdCameraAlt size={18} />
                  Démarrer
                </button>
              </motion.div>
            </div>

            {/* DROITE : photo couple, taille modérée */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative shrink-0"
              style={{ width: '24rem', aspectRatio: '3/4', maxHeight: '60vh' }}
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
            </motion.div>
          </div>
        ) : (
          // ─── Pas de photo : layout 1 colonne centré ────────────────────────
          <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <motion.p
              {...fadeUp(0.25)}
              className="label-editorial"
              style={{ color: '#6B5D4F', marginBottom: '1.25rem' }}
            >
              Photo
            </motion.p>

            <motion.h1
              {...fadeUp(0.35)}
              className="font-editorial"
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                color: '#1A1A1A',
                letterSpacing: '-0.02em',
                fontWeight: 700,
                lineHeight: 1.05,
                maxWidth: '40rem',
              }}
            >
              {coupleName}
            </motion.h1>

            {date && (
              <motion.p
                {...fadeUp(0.5)}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1.25rem',
                  color: '#6B5D4F',
                  marginTop: '1.25rem',
                  letterSpacing: '0.02em',
                }}
              >
                {date.day} {date.month.toLowerCase()} {date.year}
              </motion.p>
            )}

            <motion.div {...fadeUp(0.75)} className="flex flex-wrap justify-center gap-3" style={{ marginTop: '3rem' }}>
              <button onClick={start} className="btn-editorial-primary">
                <MdCameraAlt size={18} />
                Démarrer
              </button>
            </motion.div>
          </div>
        )}

        {/* FOOTER */}
        <motion.div
          {...fadeUp(0.95)}
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
