import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MdCheck, MdRefresh, MdContentCopy } from 'react-icons/md';
import QRCode from 'qrcode';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import '../../styles/contact-videoshare.css';

export function VideoShareScreen() {
  const {
    currentVideoBlobUrl,
    currentVideoShareUrl,
    settings,
    event,
    resetCapture,
  } = useAppStore();

  const [showQr, setShowQr] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const enableQr = settings?.enable_qr ?? true;
  const name = event?.name?.trim();

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
          color: { dark: '#000000', light: '#f7f6f2' },
        });
        setQrDataUrl(dataUrl);
      } catch (e) {
        console.error('Erreur QR', e);
        setQrDataUrl(null);
      }
    })();
  }, [showQr, currentVideoShareUrl]);

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
    <Screen className="overflow-hidden contact-paper">
      <div className="reel-page reel-page--share">
        <div className="reel-text">
          <h1 className="contact-title">Merci, c'est dans la boîte.</h1>
          <p className="contact-lede">
            {name ? `Votre message est enregistré pour ${name}.` : 'Votre message est enregistré.'}
          </p>

          {showQr && (
            // Le bon à tirer apparaît (ou réapparaît) quand on le demande.
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {currentVideoShareUrl ? (
                <>
                  <div className="reel-proof">
                    <div className="reel-proof-qr">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR code de la vidéo" />
                      ) : (
                        <MdRefresh size={32} className="animate-spin" />
                      )}
                    </div>
                    <p className="reel-proof-text">Scannez-le pour retrouver la vidéo sur votre téléphone.</p>
                  </div>
                  <div className="reel-link">
                    <span>{currentVideoShareUrl}</span>
                    <button onClick={copyUrl} className="btn-editorial-ghost" aria-label="Copier le lien">
                      {copied ? <MdCheck size={18} /> : <MdContentCopy size={18} />}
                      {copied ? 'Lien copié' : 'Copier le lien'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="reel-error">
                  Pas de lien de partage pour cette vidéo. Elle est bien enregistrée sur la borne.
                </p>
              )}
            </motion.div>
          )}

          <div className="reel-actions">
            <button onClick={resetCapture} className="btn-editorial-primary">
              Retour à l'accueil
            </button>
            {enableQr && (
              <button onClick={() => setShowQr((v) => !v)} className="btn-editorial-secondary">
                {showQr ? 'Masquer le QR code' : 'Afficher le QR code'}
              </button>
            )}
          </div>
        </div>

        {currentVideoBlobUrl && (
          <div className="reel">
            <div className="contact-rebate contact-rebate--top" aria-hidden />
            <video src={currentVideoBlobUrl} controls playsInline />
            <div className="contact-rebate contact-rebate--bottom" aria-hidden />
          </div>
        )}
      </div>
    </Screen>
  );
}
