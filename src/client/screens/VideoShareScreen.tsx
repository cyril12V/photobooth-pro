import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, QrCode, Home, Check, Loader2, Copy, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { CornerDecor } from '@client/components/decors';

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

export function VideoShareScreen() {
  const {
    currentVideoBlobUrl,
    currentVideoShareUrl,
    settings,
    event,
    resetCapture,
  } = useAppStore();

  const [showEmail, setShowEmail] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const [email, setEmail] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
  const enableEmail = settings?.enable_email ?? true;
  const enableQr = settings?.enable_qr ?? true;

  useEffect(() => {
    if (!showQr || !currentVideoShareUrl) {
      setQrDataUrl(null);
      return;
    }
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(currentVideoShareUrl, {
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
  }, [showQr, currentVideoShareUrl]);

  const sendEmail = async () => {
    if (!email.trim() || !currentVideoShareUrl || emailSending) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const result = await window.api.email.sendVideo({
        to: email.trim(),
        shareUrl: currentVideoShareUrl,
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
    if (!currentVideoShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentVideoShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copie impossible', e);
    }
  };

  return (
    <Screen className="overflow-hidden bg-wedding flex items-center justify-center px-12 py-12">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      <motion.div {...fadeIn(0.5)} className="absolute top-0 left-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.6)} className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      <div className="relative z-10 grid grid-cols-2 gap-12 max-w-7xl w-full items-center">
        {/* Vidéo à gauche */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div
            className="absolute -inset-3 rounded-3xl blur-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(212,165,116,0.3) 0%, rgba(242,196,206,0.2) 100%)',
            }}
          />
          {currentVideoBlobUrl && (
            <video
              src={currentVideoBlobUrl}
              controls
              playsInline
              className="relative w-full max-h-[70vh] rounded-3xl bg-black"
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
              Scannez le QR code pour récupérer votre vidéo, ou recevez le lien par email.
            </motion.p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {showQr && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="glass-wedding rounded-3xl p-6"
            >
              {currentVideoShareUrl ? (
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
                      <div
                        className="w-32 h-32 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(212,165,116,0.1)' }}
                      >
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
                        Scannez pour récupérer
                      </p>
                      <p className="text-sm font-light" style={{ color: '#5a3e2b' }}>
                        Vous pourrez visionner et télécharger la vidéo
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(212,165,116,0.2)',
                    }}
                  >
                    <p className="text-xs font-mono flex-1 truncate" style={{ color: '#5a3e2b' }}>
                      {currentVideoShareUrl}
                    </p>
                    <button
                      onClick={copyUrl}
                      className="shrink-0 flex items-center gap-1.5 transition-colors"
                      style={{ color: copied ? '#c8956a' : '#5a3e2b' }}
                      aria-label="Copier l'URL"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span className="text-xs">{copied ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <p
                  className="text-sm italic text-center py-2 font-light"
                  style={{ color: '#5a3e2b' }}
                >
                  Lien indisponible
                </p>
              )}
            </motion.div>
          )}

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
                    Lien envoyé à {email}
                  </span>
                </div>
              ) : (
                <>
                  <p
                    className="font-sans text-xs uppercase tracking-widest mb-3 font-medium"
                    style={{ color: '#c8956a' }}
                  >
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
                    <div
                      className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-3"
                      style={{
                        background: 'rgba(220,38,38,0.08)',
                        border: '1px solid rgba(220,38,38,0.2)',
                      }}
                    >
                      <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: '#dc2626' }} />
                      <p className="text-sm" style={{ color: '#b91c1c' }}>
                        {emailError}
                      </p>
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

          <motion.button
            onClick={resetCapture}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 self-center flex items-center justify-center gap-3 px-10 py-5 text-base font-semibold uppercase tracking-[0.2em] rounded-full text-white"
            style={{
              background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
              boxShadow: '0 10px 32px rgba(228,110,90,0.4)',
            }}
          >
            <Home size={22} strokeWidth={2.2} />
            <span>Nouvelle vidéo</span>
          </motion.button>
        </motion.div>
      </div>
    </Screen>
  );
}
