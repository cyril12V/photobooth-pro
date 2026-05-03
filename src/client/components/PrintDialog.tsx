import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdPrint,
  MdClose,
  MdCheck,
  MdRotate90DegreesCcw,
  MdRotate90DegreesCw,
  MdOpenWith,
  MdRestartAlt,
} from 'react-icons/md';

interface PrintDialogProps {
  open: boolean;
  photoDataUrl: string;
  filepath: string;
  printerName?: string;
  maxCopies: number;
  onClose: () => void;
  onPrinted: () => void;
}

const FORMATS = {
  '4x6': { label: '4 × 6', cm: '10,16 × 15,24 cm', w: 4, h: 6 },
  '5x7': { label: '5 × 7', cm: '12,7 × 17,78 cm', w: 5, h: 7 },
  '6x8': { label: '6 × 8', cm: '15,24 × 20,32 cm', w: 6, h: 8 },
} as const;

type FormatId = keyof typeof FORMATS;

/**
 * Dialog d'impression in-app avec :
 * - Aperçu adapté au format papier (le cadre change selon 4×6/5×7/6×8 + orientation)
 * - Drag de l'image pour ajuster le cadrage (object-position)
 * - Récap des réglages en bas pour pouvoir les noter et les hardcoder ensuite
 */
export function PrintDialog({
  open,
  photoDataUrl,
  filepath,
  printerName,
  maxCopies,
  onClose,
  onPrinted,
}: PrintDialogProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [format, setFormat] = useState<FormatId>('4x6');
  const [copies, setCopies] = useState(1);
  const [pos, setPos] = useState({ x: 50, y: 50 }); // object-position en %
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // Détecte l'orientation native de la photo au montage
  useEffect(() => {
    if (!open || !photoDataUrl) return;
    const img = new Image();
    img.onload = () => {
      setOrientation(img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait');
    };
    img.src = photoDataUrl;
  }, [open, photoDataUrl]);

  // Reset à chaque ouverture
  useEffect(() => {
    if (!open) {
      setPrinting(false);
      setPrinted(false);
      setError(null);
      setCopies(1);
      setPos({ x: 50, y: 50 });
    }
  }, [open]);

  // ─── Drag handlers pour repositionner l'image ────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!frameRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    // Le drag inverse object-position (drag à droite = montre la partie gauche)
    const sensitivity = 1.4;
    const newX = dragState.current.startPosX - (dx / rect.width) * 100 * sensitivity;
    const newY = dragState.current.startPosY - (dy / rect.height) * 100 * sensitivity;
    setPos({
      x: Math.max(0, Math.min(100, newX)),
      y: Math.max(0, Math.min(100, newY)),
    });
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const resetPosition = () => setPos({ x: 50, y: 50 });

  // ─── Calculs ─────────────────────────────────────────────────────────────
  const f = FORMATS[format];
  // Ratio du cadre selon orientation × format
  const aspectRatio =
    orientation === 'portrait' ? `${f.w} / ${f.h}` : `${f.h} / ${f.w}`;

  const handlePrint = async () => {
    if (printing || !filepath) return;
    setPrinting(true);
    setError(null);
    try {
      await window.api.printer.print({
        filepath,
        copies,
        printerName,
        isLandscape: orientation === 'landscape',
        objectPosition: `${pos.x.toFixed(0)}% ${pos.y.toFixed(0)}%`,
      });
      setPrinted(true);
      setTimeout(() => {
        onPrinted();
        onClose();
      }, 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
    } finally {
      setPrinting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{
          backgroundColor: 'rgba(26, 26, 26, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !printing) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-6xl mx-8"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '24px',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
            maxHeight: '92vh',
            overflow: 'hidden',
          }}
        >
          {/* Bouton fermer */}
          <button
            onClick={onClose}
            disabled={printing}
            className="absolute top-5 right-5 z-10 w-10 h-10 flex items-center justify-center transition-colors"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#1A1A1A',
              cursor: printing ? 'not-allowed' : 'pointer',
              opacity: printing ? 0.4 : 1,
            }}
          >
            <MdClose size={24} />
          </button>

          <div className="grid grid-cols-2 gap-0">
            {/* COLONNE GAUCHE — Aperçu avec drag */}
            <div
              className="flex flex-col items-center justify-center p-10"
              style={{
                backgroundColor: '#F4ECDD',
                minHeight: 540,
              }}
            >
              <div
                ref={frameRef}
                className="relative"
                style={{
                  aspectRatio,
                  height: orientation === 'portrait' ? '60vh' : 'auto',
                  width: orientation === 'landscape' ? '95%' : 'auto',
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 184, 150, 0.5)',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                  cursor: dragState.current ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  src={photoDataUrl}
                  alt="Aperçu"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${pos.x}% ${pos.y}%`,
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
                {/* Indication de drag */}
                <div
                  className="absolute bottom-3 right-3 px-2 py-1 flex items-center gap-1 pointer-events-none"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.7)',
                    color: '#FAF6EE',
                    borderRadius: '3px',
                    fontSize: '0.625rem',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  <MdOpenWith size={12} />
                  Glissez pour ajuster
                </div>
              </div>

              <button
                onClick={resetPosition}
                className="mt-3 flex items-center gap-1.5"
                style={{
                  color: '#6B5D4F',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                <MdRestartAlt size={14} />
                Recentrer
              </button>
            </div>

            {/* COLONNE DROITE — Options + récap */}
            <div className="flex flex-col p-10" style={{ maxHeight: '92vh', overflow: 'auto' }}>
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Aperçu d'impression
              </p>
              <h2
                className="font-editorial mb-1"
                style={{
                  fontSize: '1.625rem',
                  color: '#1A1A1A',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                Imprimer la photo
              </h2>
              <p
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  marginBottom: '1.5rem',
                }}
              >
                Ajustez l'orientation, le format et le cadrage avant d'imprimer.
              </p>

              {/* Orientation */}
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Orientation
              </p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  onClick={() => setOrientation('portrait')}
                  className="flex items-center justify-center gap-2 py-3 transition-colors"
                  style={{
                    backgroundColor: orientation === 'portrait' ? '#1A1A1A' : '#F4ECDD',
                    color: orientation === 'portrait' ? '#FAF6EE' : '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.4)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  <MdRotate90DegreesCw size={18} />
                  Portrait
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className="flex items-center justify-center gap-2 py-3 transition-colors"
                  style={{
                    backgroundColor: orientation === 'landscape' ? '#1A1A1A' : '#F4ECDD',
                    color: orientation === 'landscape' ? '#FAF6EE' : '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.4)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  <MdRotate90DegreesCcw size={18} />
                  Paysage
                </button>
              </div>

              {/* Format papier */}
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Format papier
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {(Object.keys(FORMATS) as FormatId[]).map((id) => {
                  const item = FORMATS[id];
                  const active = format === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setFormat(id)}
                      className="flex flex-col items-center justify-center py-3 transition-colors"
                      style={{
                        backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
                        color: active ? '#FAF6EE' : '#1A1A1A',
                        border: '1px solid rgba(212, 184, 150, 0.4)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: '"Playfair Display", serif',
                          fontWeight: 700,
                          fontSize: '1.125rem',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="label-editorial"
                        style={{
                          color: active ? '#D4B896' : '#6B5D4F',
                          fontSize: '0.55rem',
                          marginTop: '0.125rem',
                        }}
                      >
                        {item.cm}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Copies */}
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Nombre d'impressions
              </p>
              <div className="flex gap-2 mb-5">
                {Array.from({ length: maxCopies }, (_, i) => i + 1).map((n) => {
                  const active = copies === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCopies(n)}
                      className="flex-1 flex items-center justify-center transition-colors"
                      style={{
                        height: 42,
                        backgroundColor: active ? '#1A1A1A' : '#F4ECDD',
                        color: active ? '#FAF6EE' : '#1A1A1A',
                        border: '1px solid rgba(212, 184, 150, 0.4)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              {/* RÉCAP — pour pouvoir noter les réglages qui marchent */}
              <div
                style={{
                  backgroundColor: '#1A1A1A',
                  color: '#FAF6EE',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  lineHeight: 1.7,
                }}
              >
                <p
                  className="label-editorial"
                  style={{
                    color: '#D4B896',
                    fontSize: '0.625rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Réglages actuels (à noter)
                </p>
                <div>orientation : <strong>{orientation}</strong></div>
                <div>format : <strong>{format}</strong> ({FORMATS[format].cm})</div>
                <div>aspect ratio : <strong>{aspectRatio.replace(/\s/g, '')}</strong></div>
                <div>copies : <strong>{copies}</strong></div>
                <div>
                  cadrage : <strong>x={pos.x.toFixed(0)}% y={pos.y.toFixed(0)}%</strong>
                </div>
                <div style={{ opacity: 0.7, marginTop: '0.5rem', fontSize: '0.6875rem' }}>
                  imprimante : {printerName || 'défaut système'}
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <div
                  className="mb-4 p-3"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '4px',
                    color: '#7f1d1d',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.8125rem',
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={printing}
                  className="flex-1 py-3 transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#1A1A1A',
                    border: '1px solid #1A1A1A',
                    borderRadius: '4px',
                    cursor: printing ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    opacity: printing ? 0.4 : 1,
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing || printed}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 transition-colors"
                  style={{
                    backgroundColor: '#1A1A1A',
                    color: '#FAF6EE',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: printing || printed ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    opacity: printing && !printed ? 0.7 : 1,
                  }}
                >
                  {printed ? (
                    <>
                      <MdCheck size={18} />
                      Imprimé
                    </>
                  ) : printing ? (
                    'Impression…'
                  ) : (
                    <>
                      <MdPrint size={18} />
                      Imprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
