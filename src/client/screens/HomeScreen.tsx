import { motion } from 'framer-motion';
import { Camera, Zap, ArrowLeft, ImageOff } from 'lucide-react';
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
      <ImageOff size={56} strokeWidth={1.5} style={{ color: '#6B5D4F', opacity: 0.5 }} />
      <p
        className="text-[11px] font-medium"
        style={{
          color: '#6B5D4F',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        Photo couple
      </p>
    </div>
  );
}

// ─── Formatage date ───────────────────────────────────────────────────────────

function formatDateFr(iso?: string): { day: string; month: string; year: string } | null {
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

// ─── Variants Framer Motion ───────────────────────────────────────────────────

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
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
  const eventName = (event?.name ?? 'Wedding').toUpperCase();
  const date = formatDateFr(event?.date);

  // Pour la signature en script (affiche le 1er prénom ou le nom complet stylisé)
  const signatureText = event?.name ?? 'Wedding';

  const choose = (mode: 'classic' | 'challenge') => {
    if (mode === 'challenge' && !challengeAvailable) return;
    setMode(mode);
    if (mode === 'challenge') setScreen('pose-select');
    else setScreen('capture');
  };

  return (
    <Screen className="overflow-hidden" >
      {/* Fond ivoire pure */}
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      {/* Bouton retour discret (si vidéo activée) */}
      {videoEnabled && (
        <motion.button
          {...fadeUp(0.1)}
          onClick={() => setScreen('splash')}
          className="absolute top-8 left-8 z-30 btn-editorial-ghost"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          <span>Retour</span>
        </motion.button>
      )}

      {/* ───────── Layout magazine : grille pleine page ─────────────────── */}
      <div className="relative z-10 h-full flex flex-col px-16 py-12">
        {/* HEADER — Bandeau éditorial top */}
        <motion.div
          {...fadeUp(0.15)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Bienvenue
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Issue · {date?.year ?? new Date().getFullYear()}
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Photobooth Pro
          </span>
        </motion.div>

        {/* CORPS — Grille 2 colonnes : titre/CTA gauche, photo droite */}
        <div className="flex-1 grid grid-cols-12 gap-12 items-center pt-12">
          {/* COLONNE GAUCHE : titre éditorial */}
          <div className="col-span-7 flex flex-col justify-center">
            {/* Petit label au-dessus */}
            <motion.p
              {...fadeUp(0.3)}
              className="label-editorial mb-6"
              style={{ color: '#6B5D4F' }}
            >
              The Wedding Issue
            </motion.p>

            {/* TITRE GIGANTESQUE — type Vogue */}
            <motion.h1
              {...fadeUp(0.4)}
              className="font-editorial leading-[0.85]"
              style={{
                fontSize: 'clamp(6rem, 14vw, 16rem)',
                color: '#1A1A1A',
                letterSpacing: '-0.04em',
                fontWeight: 900,
              }}
            >
              {eventName}
            </motion.h1>

            {/* Signature script en accent — petit, sous le titre */}
            <motion.p
              {...fadeUp(0.55)}
              className="mt-4"
              style={{
                fontFamily: '"Pinyon Script", cursive',
                fontSize: 'clamp(2.5rem, 4vw, 4rem)',
                color: '#1A1A1A',
                lineHeight: 1,
              }}
            >
              {signatureText}
            </motion.p>

            {/* Date format magazine */}
            {date && (
              <motion.div
                {...fadeUp(0.7)}
                className="mt-10 flex items-center gap-6"
              >
                <div className="editorial-rule-light" style={{ width: '4rem' }} />
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-editorial"
                    style={{ fontSize: '2.5rem', color: '#1A1A1A', fontWeight: 700 }}
                  >
                    {date.day}
                  </span>
                  <span className="label-editorial" style={{ color: '#1A1A1A' }}>
                    {date.month}
                  </span>
                  <span
                    className="font-editorial"
                    style={{ fontSize: '2.5rem', color: '#1A1A1A', fontWeight: 700 }}
                  >
                    {date.year}
                  </span>
                </div>
              </motion.div>
            )}

            {/* CTAs — minimaux, espacés */}
            <motion.div
              {...fadeUp(0.85)}
              className="mt-12 flex flex-wrap gap-3"
            >
              <button
                onClick={() => choose('classic')}
                className="btn-editorial-primary"
              >
                <Camera size={18} strokeWidth={2.2} />
                Photo classique
              </button>

              <button
                onClick={() => choose('challenge')}
                disabled={!challengeAvailable}
                className="btn-editorial-secondary"
                title={challengeAvailable ? '' : 'Aucune pose configurée'}
              >
                <Zap size={18} strokeWidth={2.2} />
                Challenge
              </button>
            </motion.div>

            {/* Petit caption sous les CTA */}
            <motion.p
              {...fadeUp(1)}
              className="mt-5 text-sm"
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                lineHeight: 1.5,
                maxWidth: '32rem',
              }}
            >
              Capturez l'instant. Une photo classique pour l'élégance, un défi pour l'amusement —
              chaque souvenir devient une vraie couverture éditoriale.
            </motion.p>
          </div>

          {/* COLONNE DROITE : photo couple en portrait magazine */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-5 relative"
            style={{ aspectRatio: '3/4' }}
          >
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                borderRadius: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
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
                <CouplePlaceholder />
              )}
            </div>

            {/* Étiquette "PHOTO" en bas comme un crédit magazine */}
            <div
              className="absolute -bottom-2 -right-2 px-4 py-2"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#FAF6EE',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '11px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
              }}
            >
              Cover Photo
            </div>
          </motion.div>
        </div>

        {/* FOOTER — Filet bas */}
        <motion.div
          {...fadeUp(1.1)}
          className="flex items-center justify-between pt-4 mt-8"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 001
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Touchez un mode pour commencer
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
