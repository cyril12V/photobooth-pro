import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, Mail, QrCode, Home, Check, Loader2, Copy, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { CornerDecor } from '@client/components/decors';
import { sounds } from '@shared/lib/sounds';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.8 },
});

export function PrintShareScreen() {
  const {
    currentPhotoDataUrl,
    currentPhotoFilepath,
    currentPhotoShareUrl,
    settings,
    event,
    resetCapture,
  } = useAppStore();

  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [email, setEmail] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
  const maxCopies = settings?.max_copies ?? 4;
  const enableEmail = settings?.enable_email ?? true;
  const enableQr = settings?.enable_qr ?? true;

  useEffect(() => {
    if (!showQr) return;
    if (!currentPhotoShareUrl) {
      setQrDataUrl(null);
      return;
    }
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(currentPhotoShareUrl, {
          width: 400,
          margin: 2,
          color: { dark: '#2a1a10', light: '#faf6ef' },
        });
        setQrDataUrl(dataUrl);
      } catch (e) {
        console.error('Erreur QR', e);
        setQrDataUrl(null);
      }
    })();
  }, [showQr, currentPhotoShareUrl]);

  const print = async () => {
    if (!currentPhotoFilepath || printing) return;
    setPrinting(true);
    try {
      await window.api.printer.print({
        filepath: currentPhotoFilepath,
        copies,
        printerName: settings?.printer_name || undefined,
      });
      sounds.success();
      setPrinted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'inconnue';
      console.error('Erreur impression', e);
      alert(`Erreur d'impression : ${msg}`);
    } finally {
      setPrinting(false);
    }
  };

  const sendEmail = async () => {
    if (!email.trim() || !currentPhotoFilepath || emailSending) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const result = await window.api.email.send({
        to: email.trim(),
        filepath: currentPhotoFilepath,
        eventName: event?.name,
      });
      if (result.ok) {
        setEmailSent(true);
        setTimeout(() => {
          setShowEmail(false);
          setEmail('');
          setEmailSent(false);
        }, 2000);
      } else {
        setEmailError(result.error ?? "Erreur inconnue lors de l'envoi.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue.';
      setEmailError(msg);
    } finally {
      setEmailSending(false);
    }
  };

  const copyUrl = async () => {
    if (!currentPhotoShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentPhotoShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copie impossible', e);
    }
  };

  return (
    <Screen className="overflow-hidden bg-wedding flex items-center justify-center px-12 py-12">
      {/* Fond cream avec gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      {/* Coins décoratifs */}
      <motion.div {...fadeIn(0.5)} className="absolute top-0 left-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      <div className="relative z-10 grid grid-cols-2 gap-12 max-w-7xl w-full items-center">
        {/* Photo à gauche */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div
            className="absolute -inset-3 rounded-3xl blur-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.3) 0%, rgba(242,196,206,0.2) 100%)' }}
          />
          {currentPhotoDataUrl && (
            <img
              src={currentPhotoDataUrl}
              alt="Photo"
              className="relative w-full max-h-[70vh] object-contain rounded-3xl"
              style={{
                boxShadow: '0 32px 80px rgba(90,60,40,0.18), 0 0 0 1px rgba(212,165,116,0.25)',
              }}
            />
          )}
        </motion.div>

        {/* Actions à droite */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-5"
        >
          {/* Titre */}
          <div>
            <motion.p
              {...fadeUp(0.3)}
              className="font-sans text-sm uppercase tracking-[0.45em] font-medium mb-2"
              style={{ color: '#c8956a' }}
            >
              Votre souvenir est prêt
            </motion.p>
            <motion.h2
              {...fadeUp(0.4)}
              style={{
                fontFamily: '"Allura", cursive',
                fontSize: 'clamp(2.5rem, 4vw, 4rem)',
                color: '#2a1a10',
              }}
            >
              Et maintenant ?
            </motion.h2>
            <motion.p
              {...fadeUp(0.5)}
              className="font-sans text-base font-light mt-1"
              style={{ color: '#5a3e2b' }}
            >
              Imprimez, envoyez par email ou scannez le QR code
            </motion.p>
          </div>

          {/* Sélecteur copies */}
          <div className="glass-wedding rounded-3xl p-6">
            <p className="font-sans text-xs uppercase tracking-widest mb-4 font-medium" style={{ color: '#c8956a' }}>
              Nombre d'impressions
            </p>
            <div className="flex gap-3">
              {Array.from({ length: maxCopies }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCopies(n)}
                  className={`flex-1 aspect-square rounded-2xl text-2xl font-medium transition-all ${
                    copies === n
                      ? 'text-white shadow-[0_4px_16px_rgba(228,110,90,0.35)]'
                      : 'bg-white/60 border border-[#d4a574]/30 hover:bg-white/80'
                  }`}
                  style={
                    copies === n
                      ? {
                          background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
                          fontFamily: '"Allura", cursive',
                        }
                      : { color: '#2a1a10', fontFamily: '"Allura", cursive' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            icon={
              printing ? (
                <Loader2 className="animate-spin" size={24} />
              ) : printed ? (
                <Check size={24} />
              ) : (
                <Printer size={24} />
              )
            }
            onClick={print}
            disabled={printing || printed}
            fullWidth
          >
            {printing
              ? 'Impression...'
              : printed
              ? 'Imprimé !'
              : `Imprimer ${copies} ${copies > 1 ? 'copies' : 'copie'}`}
          </Button>

          {/* Partage numérique */}
          <div className="grid grid-cols-2 gap-4">
            {enableEmail && (
              <Button
                variant="ghost"
                size="md"
                icon={<Mail size={20} />}
                onClick={() => {
                  setShowEmail(true);
                  setShowQr(false);
                  setEmailError(null);
                }}
                fullWidth
              >
                Email
              </Button>
            )}
            {enableQr && (
              <Button
                variant="ghost"
                size="md"
                icon={<QrCode size={20} />}
                onClick={() => {
                  setShowQr(true);
                  setShowEmail(false);
                }}
                fullWidth
              >
                QR Code
              </Button>
            )}
          </div>

          {/* Email panel */}
          {showEmail && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="glass-wedding rounded-3xl p-6"
            >
              {emailSent ? (
                <div className="flex items-center gap-3" style={{ color: '#2a1a10' }}>
                  <Check style={{ color: '#c8956a' }} />
                  <span
                    style={{
                      fontFamily: '"Allura", cursive',
                      fontSize: '1.4rem',
                      color: '#2a1a10',
                    }}
                  >
                    Photo envoyée à {email}
                  </span>
                </div>
              ) : (
                <>
                  <p className="font-sans text-xs uppercase tracking-widest mb-3 font-medium" style={{ color: '#c8956a' }}>
                    Votre email
                  </p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    placeholder="vous@exemple.fr"
                    className="w-full rounded-2xl px-5 py-4 text-lg placeholder:text-[#5a3e2b]/40 focus:outline-none mb-3"
                    style={{
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(212,165,116,0.3)',
                      color: '#2a1a10',
                    }}
                  />
                  {emailError && (
                    <div className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-3" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                      <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: '#dc2626' }} />
                      <p className="text-sm" style={{ color: '#b91c1c' }}>{emailError}</p>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="md"
                    icon={emailSending ? <Loader2 className="animate-spin" size={18} /> : undefined}
                    onClick={sendEmail}
                    disabled={!email.trim() || emailSending}
                    fullWidth
                  >
                    {emailSending ? 'Envoi...' : 'Envoyer'}
                  </Button>
                </>
              )}
            </motion.div>
          )}

          {/* QR panel */}
          {showQr && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="glass-wedding rounded-3xl p-6"
            >
              {currentPhotoShareUrl ? (
                <>
                  <div className="flex items-center gap-5 mb-4">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-32 h-32 rounded-2xl p-2 shrink-0"
                        style={{ background: '#faf6ef' }}
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,165,116,0.1)' }}>
                        <Loader2 className="animate-spin" size={28} style={{ color: '#c8956a' }} />
                      </div>
                    )}
                    <div>
                      <p
                        className="mb-1"
                        style={{
                          fontFamily: '"Allura", cursive',
                          fontSize: '1.4rem',
                          color: '#2a1a10',
                        }}
                      >
                        Scannez pour télécharger
                      </p>
                      <p className="text-sm font-light" style={{ color: '#5a3e2b' }}>
                        La photo arrivera directement sur votre téléphone
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(212,165,116,0.2)' }}
                  >
                    <p className="text-xs font-mono flex-1 truncate" style={{ color: '#5a3e2b' }}>
                      {currentPhotoShareUrl}
                    </p>
                    <button
                      onClick={copyUrl}
                      className="shrink-0 flex items-center gap-1.5 transition-colors"
                      style={{ color: copied ? '#c8956a' : '#5a3e2b' }}
                      aria-label="Copier l'URL"
                    >
                      {copied ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                      <span className="text-xs">{copied ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm italic text-center py-2 font-light" style={{ color: '#5a3e2b' }}>
                  QR indisponible
                </p>
              )}
            </motion.div>
          )}

          {/* Nouvelle photo — bouton CTA principal, bien visible */}
          <motion.button
            onClick={resetCapture}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="btn-touch shine mt-4 flex items-center justify-center gap-3 px-10 py-5 text-white font-sans font-semibold text-base uppercase tracking-[0.2em] rounded-full"
            style={{
              background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
              boxShadow: '0 10px 32px rgba(228,110,90,0.4)',
            }}
          >
            <Home size={22} strokeWidth={2.2} />
            Nouvelle photo
          </motion.button>
        </motion.div>
      </div>
    </Screen>
  );
}
