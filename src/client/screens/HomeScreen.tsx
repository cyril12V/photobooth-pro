import { motion } from 'framer-motion';
import { Camera, Zap, ImageOff, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { CornerDecor } from '@client/components/decors';
import { localFileUrl } from '@shared/lib/poseAssets';

// ─── Guirlandes lumineuses SVG ────────────────────────────────────────────────

function Garlands() {
  return (
    <svg
      viewBox="0 0 1920 120"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="absolute top-0 left-0 w-full h-28 pointer-events-none"
      aria-hidden="true"
    >
      {/* Fil principale */}
      <path
        d="M0 30 Q120 60 240 28 Q360 -4 480 30 Q600 64 720 28 Q840 -4 960 30 Q1080 64 1200 28 Q1320 -4 1440 30 Q1560 64 1680 28 Q1800 -4 1920 30"
        stroke="#d4a574"
        strokeWidth="1.5"
        fill="none"
        opacity="0.45"
      />
      {/* Ampoules */}
      {[60, 180, 300, 420, 540, 660, 780, 900, 1020, 1140, 1260, 1380, 1500, 1620, 1740, 1860].map((x, i) => {
        const y = 30 + 28 * Math.sin(((x - 0) / 1920) * Math.PI * 8);
        return (
          <g key={x}>
            <line x1={x} y1={y - 12} x2={x} y2={y} stroke="#d4a574" strokeWidth="1" opacity="0.4" />
            <ellipse
              cx={x}
              cy={y + 8}
              rx="6"
              ry="9"
              fill={i % 4 === 0 ? '#f5e6c8' : i % 4 === 1 ? '#ffd6c8' : i % 4 === 2 ? '#f5cdd5' : '#faf0d8'}
              opacity="0.8"
            />
            <ellipse cx={x} cy={y + 8} rx="6" ry="9" fill="white" opacity="0.3" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Placeholder photo couple ─────────────────────────────────────────────────

function CouplePlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 rounded-3xl"
      style={{
        background: 'linear-gradient(145deg, #f5e6d3 0%, #eeddd0 40%, #e8d0c8 70%, #f0dcd5 100%)',
      }}
    >
      <ImageOff size={48} className="text-gold-dark/40" strokeWidth={1.5} />
      <p className="text-gold-dark/50 text-sm uppercase tracking-widest font-sans">Photo couple</p>
    </div>
  );
}

// ─── Formatage date ───────────────────────────────────────────────────────────

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

// ─── Variants Framer Motion ───────────────────────────────────────────────────

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

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { event, setScreen, setMode, poses, settings } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
  const challengeAvailable = poses.length > 0;
  const videoEnabled = settings?.video_enabled ?? true;

  const hasPhoto = Boolean(event?.background_path);
  const photoSrc = hasPhoto ? localFileUrl(event!.background_path!) : null;
  const eventName = event?.name ?? 'Notre Mariage';
  const eventDate = formatDateFr(event?.date);

  const choose = (mode: 'classic' | 'challenge') => {
    if (mode === 'challenge' && !challengeAvailable) return;
    setMode(mode);
    if (mode === 'challenge') {
      setScreen('pose-select');
    } else {
      setScreen('capture');
    }
  };

  return (
    <Screen className="overflow-hidden bg-wedding">
      {/* Fond cream avec texture douce */}
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

      {/* Guirlandes */}
      <motion.div {...fadeIn(0.2)}>
        <Garlands />
      </motion.div>

      {/* Bouton retour vers le splash (si vidéo activée) */}
      {videoEnabled && (
        <motion.button
          {...fadeIn(0.4)}
          onClick={() => setScreen('splash')}
          className="absolute top-6 left-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur transition-colors"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(212,165,116,0.4)',
            color: '#5a3e2b',
          }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm tracking-wide">Retour</span>
        </motion.button>
      )}

      {/* Coins décoratifs */}
      <motion.div {...fadeIn(0.6)} className="absolute top-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.7)} className="absolute top-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="tr" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.8)} className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="bl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.9)} className="absolute bottom-0 right-0 w-80 h-80 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      {/* Layout principal horizontal */}
      <div className="relative z-10 flex h-full items-center px-20 gap-16">

        {/* ── Côté gauche : texte ── */}
        <div className="flex-1 flex flex-col items-start justify-center gap-6">

          {/* Surtitle */}
          <motion.p
            {...fadeUp(0.4)}
            className="font-sans text-sm uppercase tracking-[0.45em] font-medium"
            style={{ color: '#c8956a' }}
          >
            Bienvenue à notre mariage
          </motion.p>

          {/* Filet doré */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.55, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-16 h-px"
            style={{ background: 'linear-gradient(to right, #d4a574, transparent)' }}
          />

          {/* Nom en script Allura */}
          <motion.h1
            {...fadeUp(0.65)}
            className="leading-none text-left"
            style={{
              fontFamily: '"Allura", cursive',
              fontSize: 'clamp(4rem, 8vw, 9rem)',
              color: '#2a1a10',
              textShadow: '0 2px 40px rgba(212,165,116,0.25)',
              lineHeight: 1.1,
            }}
          >
            {eventName}
          </motion.h1>

          {/* Date */}
          {eventDate && (
            <motion.p
              {...fadeUp(0.85)}
              className="font-sans text-base uppercase tracking-[0.35em] font-light"
              style={{ color: '#5a3e2b' }}
            >
              {eventDate}
            </motion.p>
          )}

          {/* Filet décoratif bas */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-32 h-px"
            style={{ background: 'linear-gradient(to right, #d4a574, rgba(212,165,116,0.2))' }}
          />

          {/* Sous-titre invitation */}
          <motion.p
            {...fadeUp(1.05)}
            className="font-sans text-sm tracking-wide font-light mt-2"
            style={{ color: '#5a3e2b', opacity: 0.75 }}
          >
            Choisissez votre style de photo
          </motion.p>

          {/* Boutons mode — grands avec explications */}
          <motion.div
            {...fadeUp(1.15)}
            className="flex flex-col sm:flex-row gap-4 mt-3 w-full max-w-2xl"
          >
            {/* Classique */}
            <motion.button
              onClick={() => choose('classic')}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="btn-touch shine flex-1 flex flex-col items-start gap-2 px-7 py-5 text-white font-sans rounded-3xl text-left"
              style={{
                background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
                boxShadow: '0 10px 30px rgba(228,110,90,0.35)',
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <Camera size={26} strokeWidth={2.2} />
                <span className="font-bold text-xl uppercase tracking-[0.15em]">Classique</span>
              </div>
              <span className="text-sm font-light leading-snug" style={{ opacity: 0.95 }}>
                Une belle photo naturelle et élégante
              </span>
            </motion.button>

            {/* Challenge */}
            <motion.button
              onClick={() => choose('challenge')}
              disabled={!challengeAvailable}
              whileHover={challengeAvailable ? { y: -4, scale: 1.02 } : undefined}
              whileTap={challengeAvailable ? { scale: 0.97 } : undefined}
              className={`btn-touch shine flex-1 flex flex-col items-start gap-2 px-7 py-5 font-sans rounded-3xl text-left transition-opacity ${challengeAvailable ? '' : 'opacity-50 cursor-not-allowed'}`}
              style={{
                background: 'rgba(255,255,255,0.7)',
                color: '#5a3e2b',
                border: '2px solid rgba(212,165,116,0.6)',
                boxShadow: '0 10px 30px rgba(90,60,40,0.1)',
                backdropFilter: 'blur(8px)',
              }}
              title={challengeAvailable ? 'Reproduire une pose fun' : 'Aucune pose configurée'}
            >
              <div className="flex items-center gap-3 w-full">
                <Zap size={26} strokeWidth={2.2} style={{ color: '#e8806a' }} fill="#e8806a" />
                <span className="font-bold text-xl uppercase tracking-[0.15em]">Challenge</span>
              </div>
              <span className="text-sm font-light leading-snug" style={{ opacity: 0.85 }}>
                {challengeAvailable
                  ? 'Reproduisez une pose amusante'
                  : 'Aucune pose disponible'}
              </span>
            </motion.button>
          </motion.div>
        </div>

        {/* ── Côté droit : photo couple ── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-[420px] h-[560px] flex-shrink-0 rounded-3xl overflow-hidden"
          style={{
            boxShadow: '0 32px 80px rgba(90,60,40,0.18), 0 0 0 1px rgba(212,165,116,0.25)',
          }}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="Photo du couple"
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <CouplePlaceholder />
          )}
        </motion.div>
      </div>
    </Screen>
  );
}
