import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdPrint, MdClose, MdCheck, MdRotate90DegreesCcw, MdRotate90DegreesCw } from 'react-icons/md';

interface PrintDialogProps {
  open: boolean;
  photoDataUrl: string;
  filepath: string;
  printerName?: string;
  maxCopies: number;
  onClose: () => void;
  onPrinted: () => void;
}

const FORMATS = [
  { id: '4x6' as const, label: '4 × 6', cm: '10,16 × 15,24 cm' },
  { id: '5x7' as const, label: '5 × 7', cm: '12,7 × 17,78 cm' },
  { id: '6x8' as const, label: '6 × 8', cm: '15,24 × 20,32 cm' },
];

/**
 * Dialog d'impression in-app avec aperçu.
 * - L'utilisateur voit exactement comment la photo va sortir.
 * - Toggle Portrait / Paysage qui adapte l'aperçu en temps réel.
 * - Sélecteurs format papier et copies.
 * - Bouton Imprimer envoie le job au pilote DS620 avec les bonnes options.
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
  const [format, setFormat] = useState<'4x6' | '5x7' | '6x8'>('4x6');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Détecte l'orientation native de la photo au montage
  useEffect(() => {
    if (!open || !photoDataUrl) return;
    const img = new Image();
    img.onload = () => {
      setOrientation(img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait');
    };
    img.src = photoDataUrl;
  }, [open, photoDataUrl]);

  // Reset à la fermeture
  useEffect(() => {
    if (!open) {
      setPrinting(false);
      setPrinted(false);
      setError(null);
      setCopies(1);
    }
  }, [open]);

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

  // Aperçu : ratio du cadre selon orientation choisie
  const aspectRatio = orientation === 'portrait' ? '2 / 3' : '3 / 2';

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
          className="relative w-full max-w-5xl mx-8"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '24px',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
            maxHeight: '90vh',
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
            {/* COLONNE GAUCHE — Aperçu */}
            <div
              className="flex items-center justify-center p-12"
              style={{
                backgroundColor: '#F4ECDD',
                minHeight: 480,
              }}
            >
              <div
                className="relative shadow-lg"
                style={{
                  aspectRatio,
                  height: orientation === 'portrait' ? '60vh' : 'auto',
                  width: orientation === 'landscape' ? '90%' : 'auto',
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 184, 150, 0.5)',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                }}
              >
                <img
                  src={photoDataUrl}
                  alt="Aperçu"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            </div>

            {/* COLONNE DROITE — Options */}
            <div className="flex flex-col p-10" style={{ maxHeight: '90vh', overflow: 'auto' }}>
              <p
                className="label-editorial mb-2"
                style={{ color: '#6B5D4F' }}
              >
                Aperçu d'impression
              </p>
              <h2
                className="font-editorial mb-1"
                style={{
                  fontSize: '1.75rem',
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
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  marginBottom: '2rem',
                }}
              >
                Vérifiez l'orientation et le format avant d'imprimer.
              </p>

              {/* Orientation */}
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Orientation
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6">
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
              <div className="grid grid-cols-3 gap-2 mb-6">
                {FORMATS.map((f) => {
                  const active = format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
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
                          fontSize: '1.25rem',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {f.label}
                      </span>
                      <span
                        className="label-editorial"
                        style={{
                          color: active ? '#D4B896' : '#6B5D4F',
                          fontSize: '0.6rem',
                          marginTop: '0.125rem',
                        }}
                      >
                        {f.cm}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Copies */}
              <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Nombre d'impressions
              </p>
              <div className="flex gap-2 mb-6">
                {Array.from({ length: maxCopies }, (_, i) => i + 1).map((n) => {
                  const active = copies === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCopies(n)}
                      className="flex-1 flex items-center justify-center transition-colors"
                      style={{
                        height: 44,
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

              <div className="flex-1" />

              {/* Boutons d'action */}
              <div className="flex gap-3 mt-6">
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
                    fontSize: '0.875rem',
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
                    fontSize: '0.875rem',
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
