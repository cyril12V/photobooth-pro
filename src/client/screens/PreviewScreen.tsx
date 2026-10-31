import { motion } from 'framer-motion';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { composePhotoWithTemplate } from '@shared/lib/composer';
import { loadActiveTemplate } from '@shared/lib/activeTemplate';
import { useEffect, useState } from 'react';
import '../../styles/contact-print.css';

/** « 3 / 2 » → 1,5 ; format par défaut 3:4 tant que la photo n'est pas chargée. */
function ratioValue(ratio: string): number {
  const [w, h] = ratio.split('/').map((n) => Number(n.trim()));
  return w > 0 && h > 0 ? w / h : 3 / 4;
}

export function PreviewScreen() {
  const {
    currentPhotoDataUrl,
    currentPhotoDataUrls,
    event,
    mode,
    settings,
    setScreen,
    setCurrentPhoto,
  } = useAppStore();
  const [saving, setSaving] = useState(false);

  const photos = currentPhotoDataUrls.length > 0
    ? currentPhotoDataUrls
    : currentPhotoDataUrl ? [currentPhotoDataUrl] : [];
  const isMulti = photos.length > 1;
  // Format réel des clichés (horizontal ou vertical) pour les vignettes multi-photos.
  const [ratio, setRatio] = useState('3 / 4');

  useEffect(() => {
    if (photos.length === 0) setScreen('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!photos[0]) return;
    const img = new Image();
    img.onload = () => setRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    img.src = photos[0];
  }, [photos[0]]);

  if (photos.length === 0) return null;

  const validate = async () => {
    if (!event || saving) return;
    setSaving(true);
    try {
      let finalDataUrl = photos[0];
      try {
        const config = await loadActiveTemplate();
        if (config) {
          const paperFormat = (settings?.paper_format as '4x6' | '5x7' | '6x8' | undefined) ?? '4x6';
          finalDataUrl = await composePhotoWithTemplate(photos, config, event, paperFormat);
        }
      } catch (e) {
        console.error('[PreviewScreen] Composition template échouée, photo brute conservée :', e);
      }

      const r = await window.api.photo.save({
        dataUrl: finalDataUrl,
        eventId: event.id,
        mode,
      });
      setCurrentPhoto(finalDataUrl, r.filepath, r.share_url);
      setScreen('print-share');
    } catch (e) {
      console.error('Erreur sauvegarde', e);
      alert('Erreur lors de la sauvegarde de la photo. Réessayez.');
      setSaving(false);
    }
  };

  const retake = () => setScreen('capture');

  // Planche multi-clichés : 2 ou 4 sur deux colonnes, sinon trois. La largeur de la planche
  // est bornée par la hauteur disponible (k = largeur / hauteur de la grille).
  const columns = photos.length === 2 || photos.length === 4 ? 2 : 3;
  const rows = Math.ceil(photos.length / columns);
  const sheetShape = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    '--cp-k': (ratioValue(ratio) * columns) / rows,
    '--cp-rows': rows,
  } as React.CSSProperties;

  return (
    <Screen className="overflow-hidden">
      <div className="contact-paper absolute inset-0">
        <div className="cp-page">
          {/* Le tirage se pose sur la table. */}
          <div className="cp-stage">
            <motion.div
              initial={{ opacity: 0, y: 28, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: -0.6 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="contact-print"
              style={{ maxWidth: '100%' }}
            >
              {isMulti ? (
                <div className="cp-sheet" style={sheetShape}>
                  {photos.map((url, i) => (
                    <div key={i} className="min-w-0">
                      <div style={{ aspectRatio: ratio }}>
                        <img src={url} alt={`Cliché ${i + 1}`} />
                      </div>
                      <span className="cp-sheet-number contact-edgeprint">{`▸${i + 1}`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                // Photo entière, dans son vrai format (horizontal ou vertical).
                <img src={photos[0]} alt="Aperçu" className="cp-photo" />
              )}
            </motion.div>
          </div>

          <div className="cp-side">
            <h1 className="contact-title">{isMulti ? 'Elles vous plaisent ?' : 'Elle vous plaît ?'}</h1>
            <p className="contact-lede">
              {isMulti
                ? `Vos ${photos.length} photos sont prêtes. Gardez-les pour les imprimer et les récupérer sur votre téléphone, ou recommencez la séance.`
                : 'Gardez-la pour l’imprimer et la récupérer sur votre téléphone, ou reprenez-la.'}
            </p>

            <div className="cp-actions">
              <button onClick={validate} disabled={saving} className="btn-editorial-primary">
                {saving ? 'Enregistrement…' : isMulti ? 'Je les garde' : 'Je la garde'}
              </button>
              <button onClick={retake} disabled={saving} className="btn-editorial-secondary">
                {isMulti ? 'Recommencer la séance' : 'Reprendre la photo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
