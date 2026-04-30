import { motion } from 'framer-motion';
import { MdCameraAlt, MdBolt, MdArrowBack } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { localFileUrl } from '@shared/lib/poseAssets';

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
  transition: { delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 1.4, ease: [0.16, 1, 0.3, 1] as const },
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
      {/* PHOTO HERO — plein écran, c'est ELLE qui crée la vibe */}
      <div className="absolute inset-0" style={{ backgroundColor: '#1A1A1A' }}>
        {photoSrc ? (
          <motion.img
            {...fadeIn(0)}
            src={photoSrc}
            alt="Couple"
            className="w-full h-full object-cover photo-warm"
            draggable={false}
          />
        ) : (
          // Fallback texturé crème quand pas de photo
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% 30%, #E8DCC4 0%, #D4B896 60%, #6B5D4F 100%)',
            }}
          />
        )}
      </div>

      {/* OVERLAY dégradé pour lisibilité du texte (vignette légère) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 22%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Bouton retour ghost (vidéo activée) */}
      {videoEnabled && (
        <motion.button
          {...fadeUp(0.4)}
          onClick={() => setScreen('splash')}
          className="absolute top-8 left-8 z-30 flex items-center gap-2 px-3 py-2"
          style={{
            color: '#FAF6EE',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <MdArrowBack size={16} />
          <span>Retour</span>
        </motion.button>
      )}

      {/* Numéro éditorial latéral droit (signature magazine) */}
      <motion.div
        {...fadeIn(0.6)}
        className="absolute right-8 top-1/2 z-20 pointer-events-none"
        style={{
          transform: 'rotate(90deg) translateX(50%)',
          transformOrigin: 'right center',
          color: '#FAF6EE',
          opacity: 0.85,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '0.7rem',
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Issue №01 · {date?.year ?? new Date().getFullYear()}
      </motion.div>

      {/* CONTENU ÉDITORIAL — superposé à la photo */}
      <div className="relative z-10 h-full flex flex-col" style={{ padding: '3rem 5rem' }}>
        {/* HEADER bandeau haut sur la photo (filet ivoire fin) */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid rgba(250, 246, 239, 0.5)' }}
        >
          <span
            style={{
              color: '#FAF6EE',
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
              color: '#FAF6EE',
              fontSize: '1.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            Vœux
          </span>
          <span
            style={{
              color: '#FAF6EE',
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

        {/* CŒUR — typo Playfair italic centrée bas, le wow est ici */}
        <div className="flex-1 flex flex-col justify-end items-center text-center">
          <motion.p
            {...fadeUp(0.7)}
            style={{
              color: '#FAF6EE',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '0.7rem',
              letterSpacing: '0.45em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: '1.25rem',
            }}
          >
            Le mariage de
          </motion.p>

          {/* Nom couple en Playfair italic — la signature magazine */}
          <motion.h1
            {...fadeUp(0.85)}
            style={{
              fontFamily: '"Playfair Display", "Bodoni Moda", Didot, serif',
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(3.5rem, 8vw, 7rem)',
              color: '#FAF6EE',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textShadow: '0 4px 30px rgba(0,0,0,0.3)',
              maxWidth: '56rem',
              wordBreak: 'break-word',
            }}
          >
            {coupleName}
          </motion.h1>

          {/* Filet décoratif + date */}
          {date && (
            <motion.div
              {...fadeUp(1)}
              className="flex items-center justify-center mt-8"
              style={{ gap: '1.5rem' }}
            >
              <div style={{ width: '3rem', height: '1px', backgroundColor: '#FAF6EE', opacity: 0.7 }} />
              <span
                style={{
                  color: '#FAF6EE',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  letterSpacing: '0.4em',
                  textTransform: 'uppercase',
                  opacity: 0.85,
                }}
              >
                {date.day} {date.month} {date.year}
              </span>
              <div style={{ width: '3rem', height: '1px', backgroundColor: '#FAF6EE', opacity: 0.7 }} />
            </motion.div>
          )}

          {/* CTAs — minimaux, posés sous la signature */}
          <motion.div
            {...fadeUp(1.2)}
            className="flex flex-wrap items-center justify-center gap-3"
            style={{ marginTop: '3rem', marginBottom: '0.5rem' }}
          >
            <button
              onClick={() => choose('classic')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                background: '#FAF6EE',
                color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                padding: '0.875rem 2rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, background 0.2s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FAF6EE'; }}
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
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                padding: '0.875rem 2rem',
                borderRadius: '999px',
                border: '1px solid rgba(250, 246, 239, 0.7)',
                cursor: challengeAvailable ? 'pointer' : 'not-allowed',
                opacity: challengeAvailable ? 1 : 0.5,
                transition: 'background 0.2s ease',
              }}
              title={challengeAvailable ? '' : 'Aucune pose configurée'}
              onMouseEnter={(e) => {
                if (challengeAvailable) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(250, 246, 239, 0.12)';
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
