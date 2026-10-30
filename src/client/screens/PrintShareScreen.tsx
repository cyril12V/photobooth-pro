import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MdRefresh, MdCheck, MdContentCopy } from 'react-icons/md';
import QRCode from 'qrcode';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { sounds } from '@shared/lib/sounds';
import '../../styles/contact-print.css';

export function PrintShareScreen() {
  const {
    currentPhotoDataUrl,
    currentPhotoFilepath,
    currentPhotoShareUrl,
    settings,
    resetCapture,
  } = useAppStore();

  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const maxCopies = settings?.max_copies ?? 4;
  const enableQr = settings?.enable_qr ?? true;

  useEffect(() => {
    if (!showQr) return;
    if (!currentPhotoShareUrl) {
      setQrDataUrl(null);
      return;
    }
    (async () => {
      try {
        // Noir sur le blanc du tirage : le tampon se fond dans le papier et reste bien lisible.
        const dataUrl = await QRCode.toDataURL(currentPhotoShareUrl, {
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

  const copiesWord = (n: number) => (n > 1 ? 'copies' : 'copie');

  return (
    <Screen className="overflow-hidden">
      <div className="contact-paper absolute inset-0">
        <div className="cp-page">
          <div className="cp-stage">
            {currentPhotoDataUrl && (
              <div className="cp-print">
                <div className="contact-print">
                  <img src={currentPhotoDataUrl} alt="Photo" className="cp-photo" />
                </div>

                {/* Le QR code se pose sur le coin du tirage, comme un tampon d'épreuve. */}
                {showQr && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
                    animate={{ opacity: 1, scale: 1, rotate: 2.2 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="cp-stamp"
                  >
                    {currentPhotoShareUrl ? (
                      <>
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="QR code de la photo" className="cp-stamp-code" />
                        ) : (
                          <div className="cp-stamp-code flex items-center justify-center">
                            <MdRefresh size={28} className="animate-spin" />
                          </div>
                        )}
                        <p className="cp-stamp-caption">Scannez avec l’appareil photo de votre téléphone.</p>
                        <button onClick={copyUrl} className="cp-stamp-copy" aria-label="Copier le lien">
                          {copied ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
                          <span>{copied ? 'Lien copié' : 'Copier le lien'}</span>
                        </button>
                      </>
                    ) : (
                      <p className="cp-stamp-caption">Pas de lien de partage pour cette photo.</p>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="cp-side">
            <h1 className="contact-title">Elle est à vous.</h1>
            <p className="contact-lede">
              {enableQr
                ? 'Imprimez-la ici, ou récupérez-la sur votre téléphone.'
                : 'Imprimez-la ici, elle sort tout de suite.'}
            </p>

            <div className="cp-actions">
              {maxCopies > 1 && (
                <div>
                  <p className="cp-note">Nombre de copies</p>
                  <div className="cp-copies">
                    {Array.from({ length: maxCopies }, (_, i) => i + 1).map((n) => (
                      <button key={n} onClick={() => setCopies(n)} aria-pressed={copies === n}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={print} disabled={printing || printed} className="btn-editorial-primary">
                {printing && <MdRefresh size={22} className="animate-spin" />}
                {printing
                  ? 'Impression en cours…'
                  : printed
                    ? `${copies} ${copiesWord(copies)} ${copies > 1 ? 'imprimées' : 'imprimée'}`
                    : `Imprimer ${copies} ${copiesWord(copies)}`}
              </button>
              {printed && <p className="cp-note">Récupérez votre tirage à la sortie de l’imprimante.</p>}

              {enableQr && (
                <button onClick={() => setShowQr((v) => !v)} className="btn-editorial-secondary">
                  {showQr ? 'Masquer le QR code' : 'Récupérer sur mon téléphone'}
                </button>
              )}

              <button onClick={resetCapture} className="btn-editorial-ghost" style={{ minHeight: '4rem' }}>
                Terminer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
