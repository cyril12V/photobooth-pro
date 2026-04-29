import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MdMail,
  MdQrCode2,
  MdHome,
  MdCheck,
  MdRefresh,
  MdContentCopy,
  MdErrorOutline,
} from 'react-icons/md';
import QRCode from 'qrcode';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
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
          color: { dark: '#1A1A1A', light: '#FAF6EE' },
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
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-10">
        {/* Header */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Partage vidéo
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Récupérez votre vidéo
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 006
          </span>
        </motion.div>

        <div className="flex-1 grid grid-cols-12 gap-12 items-center pt-8">
          {/* Vidéo à gauche */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-5 relative flex items-center justify-center"
          >
            {currentVideoBlobUrl && (
              <div
                className="overflow-hidden relative"
                style={{
                  borderRadius: '4px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  maxHeight: '70vh',
                }}
              >
                <video
                  src={currentVideoBlobUrl}
                  controls
                  playsInline
                  className="w-full max-h-[70vh] bg-black"
                />
                <div
                  className="absolute -bottom-2 left-2 px-4 py-2 label-editorial"
                  style={{ backgroundColor: '#1A1A1A', color: '#FAF6EE', fontSize: '0.6875rem' }}
                >
                  The Take
                </div>
              </div>
            )}
          </motion.div>

          {/* Actions à droite */}
          <div className="col-span-7 flex flex-col gap-5">
            <div>
              <motion.p
                {...fadeUp(0.25)}
                className="label-editorial mb-3"
                style={{ color: '#6B5D4F' }}
              >
                Votre vidéo est prête
              </motion.p>
              <motion.h2
                {...fadeUp(0.35)}
                className="font-editorial mb-2"
                style={{
                  fontSize: 'clamp(3rem, 5vw, 5rem)',
                  color: '#1A1A1A',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.95,
                }}
              >
                ET MAINTENANT
              </motion.h2>
              <motion.div {...fadeUp(0.45)} className="mt-3 mb-4">
                <div className="editorial-rule-light" style={{ width: '4rem' }} />
              </motion.div>
              <motion.p
                {...fadeUp(0.55)}
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  maxWidth: '32rem',
                }}
              >
                Scannez le QR code pour récupérer votre vidéo, ou recevez le lien par email.
              </motion.p>
            </div>

            <motion.div {...fadeUp(0.65)} className="grid grid-cols-2 gap-3">
              {enableQr && (
                <button
                  onClick={() => {
                    setShowQr(true);
                    setShowEmail(false);
                  }}
                  className={showQr ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
                >
                  <MdQrCode2 size={18} />
                  QR Code
                </button>
              )}
              {enableEmail && (
                <button
                  onClick={() => {
                    setShowEmail(true);
                    setShowQr(false);
                    setEmailError(null);
                  }}
                  className={showEmail ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
                >
                  <MdMail size={18} />
                  Email
                </button>
              )}
            </motion.div>

            {showQr && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="card-editorial p-6"
              >
                {currentVideoShareUrl ? (
                  <>
                    <div className="flex items-center gap-5 mb-4">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          className="w-32 h-32 shrink-0"
                          style={{
                            backgroundColor: '#FAF6EE',
                            padding: '0.5rem',
                            borderRadius: '4px',
                          }}
                        />
                      ) : (
                        <div
                          className="w-32 h-32 flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }}
                        >
                          <MdRefresh size={28} className="animate-spin" style={{ color: '#1A1A1A' }} />
                        </div>
                      )}
                      <div>
                        <p className="label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                          Scannez pour récupérer
                        </p>
                        <p
                          className="font-editorial"
                          style={{ fontSize: '1.25rem', color: '#1A1A1A', fontWeight: 700 }}
                        >
                          Sur votre téléphone
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 px-3 py-2"
                      style={{
                        backgroundColor: '#F4ECDD',
                        border: '1px solid rgba(212, 184, 150, 0.4)',
                        borderRadius: '4px',
                      }}
                    >
                      <p
                        className="flex-1 truncate"
                        style={{
                          fontFamily: 'Inter, monospace',
                          fontSize: '0.75rem',
                          color: '#6B5D4F',
                        }}
                      >
                        {currentVideoShareUrl}
                      </p>
                      <button
                        onClick={copyUrl}
                        className="shrink-0 flex items-center gap-1.5"
                        style={{ color: '#1A1A1A', cursor: 'pointer' }}
                        aria-label="Copier l'URL"
                      >
                        {copied ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
                        <span className="label-editorial" style={{ fontSize: '0.6875rem' }}>
                          {copied ? 'Copié' : 'Copier'}
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  <p
                    className="text-center py-2"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.875rem',
                      color: '#6B5D4F',
                    }}
                  >
                    Lien indisponible
                  </p>
                )}
              </motion.div>
            )}

            {showEmail && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="card-editorial p-6"
              >
                {emailSent ? (
                  <div className="flex items-center gap-3" style={{ color: '#1A1A1A' }}>
                    <MdCheck size={20} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem' }}>
                      Lien envoyé à {email}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="label-editorial mb-3" style={{ color: '#6B5D4F' }}>
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
                      className="w-full px-4 py-3 mb-3 focus:outline-none"
                      style={{
                        backgroundColor: '#F4ECDD',
                        border: '1px solid rgba(212, 184, 150, 0.4)',
                        color: '#1A1A1A',
                        borderRadius: '4px',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '1rem',
                      }}
                    />
                    {emailError && (
                      <div
                        className="flex items-start gap-2 px-3 py-2 mb-3"
                        style={{
                          backgroundColor: '#F4ECDD',
                          border: '1px solid #1A1A1A',
                          borderRadius: '4px',
                        }}
                      >
                        <MdErrorOutline size={16} style={{ color: '#1A1A1A', marginTop: 2 }} />
                        <p
                          className="text-sm"
                          style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}
                        >
                          {emailError}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={sendEmail}
                      disabled={!email.trim() || emailSending}
                      className="btn-editorial-primary w-full"
                    >
                      {emailSending && <MdRefresh size={18} className="animate-spin" />}
                      {emailSending ? 'Envoi...' : 'Envoyer'}
                    </button>
                  </>
                )}
              </motion.div>
            )}

            <motion.div {...fadeUp(0.85)} className="mt-2">
              <button onClick={resetCapture} className="btn-editorial-primary w-full">
                <MdHome size={20} />
                Nouvelle vidéo
              </button>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-4 mt-6"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Partagez votre souvenir
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 006
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
