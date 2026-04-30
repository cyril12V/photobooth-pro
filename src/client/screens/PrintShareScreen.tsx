import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MdPrint,
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
import { sounds } from '@shared/lib/sounds';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
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
          color: { dark: '#1A1A1A', light: '#FAF6EE' },
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
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: '2.5rem 5rem' }}>
        {/* Header */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Souvenir
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 003
          </span>
        </motion.div>

        {/* Corps */}
        <div
          className="flex-1 grid items-center"
          style={{ gridTemplateColumns: '1fr 1fr', gap: '5rem', paddingTop: '2.5rem', paddingBottom: '2rem' }}
        >
          {/* Photo à gauche */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center min-w-0"
          >
            {currentPhotoDataUrl && (
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: '4px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  maxHeight: '60vh',
                }}
              >
                <img
                  src={currentPhotoDataUrl}
                  alt="Photo"
                  className="w-auto object-contain photo-warm"
                  style={{ maxHeight: '60vh' }}
                />
              </div>
            )}
          </motion.div>

          {/* Actions à droite */}
          <div className="flex flex-col" style={{ maxWidth: '28rem', gap: '1.25rem' }}>
            <div>
              <motion.p
                {...fadeUp(0.25)}
                className="label-editorial"
                style={{ color: '#6B5D4F', marginBottom: '0.875rem' }}
              >
                Souvenir prêt
              </motion.p>
              <motion.h2
                {...fadeUp(0.35)}
                className="font-editorial"
                style={{
                  fontSize: 'clamp(1.75rem, 3vw, 2rem)',
                  color: '#1A1A1A',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                Et maintenant&nbsp;?
              </motion.h2>
              <motion.p
                {...fadeUp(0.45)}
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  marginTop: '1rem',
                }}
              >
                Imprimez, recevez par email ou scannez le QR code.
              </motion.p>
            </div>

            {/* Sélecteur copies — aligné, sobre */}
            <motion.div {...fadeUp(0.55)}>
              <p className="label-editorial" style={{ color: '#6B5D4F', marginBottom: '0.625rem' }}>
                Nombre d'impressions
              </p>
              <div className="flex gap-2">
                {Array.from({ length: maxCopies }, (_, i) => i + 1).map((n) => {
                  const active = copies === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setCopies(n)}
                      className="flex-1 flex items-center justify-center transition-colors"
                      style={{
                        height: '3rem',
                        backgroundColor: active ? '#1A1A1A' : '#FAF6EE',
                        color: active ? '#FAF6EE' : '#1A1A1A',
                        borderRadius: '4px',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '1rem',
                        border: active ? 'none' : '1px solid rgba(212, 184, 150, 0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Imprimer */}
            <motion.div {...fadeUp(0.65)}>
              <button
                onClick={print}
                disabled={printing || printed}
                className="btn-editorial-primary w-full"
              >
                {printing ? (
                  <MdRefresh size={20} className="animate-spin" />
                ) : printed ? (
                  <MdCheck size={20} />
                ) : (
                  <MdPrint size={20} />
                )}
                {printing
                  ? 'Impression...'
                  : printed
                    ? 'Imprimé'
                    : `Imprimer ${copies} ${copies > 1 ? 'copies' : 'copie'}`}
              </button>
            </motion.div>

            {/* Partage numérique */}
            <motion.div {...fadeUp(0.75)} className="grid grid-cols-2 gap-3">
              {enableEmail && (
                <button
                  onClick={() => {
                    setShowEmail(true);
                    setShowQr(false);
                    setEmailError(null);
                  }}
                  className="btn-editorial-secondary"
                >
                  <MdMail size={18} />
                  Email
                </button>
              )}
              {enableQr && (
                <button
                  onClick={() => {
                    setShowQr(true);
                    setShowEmail(false);
                  }}
                  className="btn-editorial-secondary"
                >
                  <MdQrCode2 size={18} />
                  QR Code
                </button>
              )}
            </motion.div>

            {/* Email panel */}
            {showEmail && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  backgroundColor: '#FAF6EE',
                  border: '1px solid rgba(212, 184, 150, 0.4)',
                  borderRadius: '4px',
                  padding: '1.25rem',
                }}
              >
                {emailSent ? (
                  <div
                    className="flex items-center gap-3"
                    style={{ color: '#1A1A1A' }}
                  >
                    <MdCheck size={20} />
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '0.9375rem',
                      }}
                    >
                      Photo envoyée à {email}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="label-editorial" style={{ color: '#6B5D4F', marginBottom: '0.625rem' }}>
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
                        fontSize: '0.9375rem',
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

            {/* QR panel */}
            {showQr && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  backgroundColor: '#FAF6EE',
                  border: '1px solid rgba(212, 184, 150, 0.4)',
                  borderRadius: '4px',
                  padding: '1.25rem',
                }}
              >
                {currentPhotoShareUrl ? (
                  <>
                    <div className="flex items-center gap-4 mb-3">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          className="w-28 h-28 shrink-0"
                          style={{ backgroundColor: '#FAF6EE', padding: '0.375rem', borderRadius: '4px' }}
                        />
                      ) : (
                        <div
                          className="w-28 h-28 flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }}
                        >
                          <MdRefresh size={24} className="animate-spin" style={{ color: '#1A1A1A' }} />
                        </div>
                      )}
                      <div>
                        <p className="label-editorial" style={{ color: '#6B5D4F', marginBottom: '0.375rem' }}>
                          Scannez pour télécharger
                        </p>
                        <p
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '0.9375rem',
                            color: '#1A1A1A',
                            fontWeight: 500,
                          }}
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
                        {currentPhotoShareUrl}
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
                    QR indisponible
                  </p>
                )}
              </motion.div>
            )}

            {/* Nouvelle photo — taille normale */}
            <motion.div {...fadeUp(0.9)}>
              <button
                onClick={resetCapture}
                className="btn-editorial-secondary w-full"
              >
                <MdHome size={18} />
                Nouvelle photo
              </button>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 003
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
