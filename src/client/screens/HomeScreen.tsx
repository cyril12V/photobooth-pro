import { motion } from 'framer-motion';
import { MdCameraAlt, MdBolt, MdArrowBack } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';

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
  transition: { delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 1.2, ease: [0.16, 1, 0.3, 1] as const },
});

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
      {/* Fond ivoire */}
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      {/* Bouton retour */}
      {videoEnabled && (
        <motion.button
          {...fadeUp(0.2)}
          onClick={() => setScreen('splash')}
          className="absolute top-8 left-8 z-30 flex items-center gap-2 px-3 py-2"
          style={{
            color: '#1A1A1A',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <MdArrowBack size={16} />
          <span>Retour</span>
        </motion.button>
      )}

      {/* Numéro éditorial vertical droit */}
      <motion.div
        {...fadeIn(0.5)}
        className="absolute right-7 top-1/2 z-20 pointer-events-none"
        style={{
          transform: 'rotate(90deg) translateX(50%)',
          transformOrigin: 'right center',
          color: '#1A1A1A',
          opacity: 0.55,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.65rem',
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Issue №01 · {date?.year ?? new Date().getFullYear()}
      </motion.div>

      {/* CONTENU */}
      <div className="relative z-10 h-full flex flex-col" style={{ padding: '2.5rem 5rem' }}>
        {/* HEADER éditorial */}
        <motion.div
          {...fadeUp(0.15)}
          className="flex items-center justify-between pt-2 pb-3"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            The Wedding Issue
          </span>
          <span
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontWeight: 700,
              color: '#1A1A1A',
              fontSize: '1.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            Vœux
          </span>
          <span
            style={{
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            Photo Booth
          </span>
        </motion.div>

        {/* SCÈNE CENTRALE — titre en italic LARGE + photo qui se superpose */}
        <div className="relative flex-1 flex flex-col items-center justify-center">
          {/* Titre Playfair italic immense, derrière la photo */}
          <motion.h1
            {...fadeUp(0.4)}
            className="absolute top-[18%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none whitespace-nowrap"
            style={{
              fontFamily: '"Playfair Display", "Bodoni Moda", Didot, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(4.5rem, 11vw, 10rem)',
              color: '#1A1A1A',
              letterSpacing: '-0.025em',
              lineHeight: 0.95,
              maxWidth: '95vw',
            }}
          >
            {coupleName}
          </motion.h1>

          {/* Photo couple — décalée pour passer DEVANT le titre */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20"
            style={{
              width: 'clamp(16rem, 26vw, 22rem)',
              aspectRatio: '3/4',
              marginTop: '6vh',
            }}
          >
            <div
              className="w-full h-full overflow-hidden"
              style={{
                borderRadius: '4px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                background: '#E8DCC4',
              }}
            >
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Couple"
                  className="w-full h-full object-cover photo-warm"
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, #E8DCC4 0%, #D4B896 100%)',
                  }}
                >
                  <span
                    style={{
                      color: '#6B5D4F',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.65rem',
                      letterSpacing: '0.35em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    Photo couple
                  </span>
                </div>
              )}
            </div>

            {/* Petite étiquette discrète en bas-droite */}
            <div
              className="absolute -bottom-3 -right-3 px-3 py-1.5"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '0.6rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
              }}
            >
              The Cover
            </div>
          </motion.div>
        </div>

        {/* BAS — date + CTAs */}
        <div className="flex flex-col items-center" style={{ paddingBottom: '0.5rem' }}>
          {date && (
            <motion.div
              {...fadeUp(0.85)}
              className="flex items-center justify-center mb-7"
              style={{ gap: '1.5rem' }}
            >
              <div style={{ width: '3rem', height: '1px', backgroundColor: '#1A1A1A', opacity: 0.5 }} />
              <span
                style={{
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  letterSpacing: '0.4em',
                  textTransform: 'uppercase',
                }}
              >
                {date.day} {date.month} {date.year}
              </span>
              <div style={{ width: '3rem', height: '1px', backgroundColor: '#1A1A1A', opacity: 0.5 }} />
            </motion.div>
          )}

          <motion.div
            {...fadeUp(1)}
            className="flex flex-wrap items-center justify-center"
            style={{ gap: '0.875rem' }}
          >
            <button
              onClick={() => choose('classic')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                background: '#1A1A1A',
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                padding: '0.875rem 2rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2B2B2B'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A1A1A'; }}
            >
              <MdCameraAlt size={16} />
              Classique
            </button>

            <button
              onClick={() => choose('challenge')}
              disabled={!challengeAvailable}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                background: 'transparent',
                color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                padding: '0.875rem 2rem',
                borderRadius: '999px',
                border: '1px solid #1A1A1A',
                cursor: challengeAvailable ? 'pointer' : 'not-allowed',
                opacity: challengeAvailable ? 1 : 0.4,
                transition: 'background 0.2s ease',
              }}
              title={challengeAvailable ? '' : 'Aucune pose configurée'}
              onMouseEnter={(e) => {
                if (challengeAvailable) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,26,26,0.06)';
              }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <MdBolt size={16} />
              Challenge
            </button>
          </motion.div>
        </div>
      </div>
    </Screen>
  );
}
