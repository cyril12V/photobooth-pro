import { motion } from 'framer-motion';
import { MdCheck, MdReplay } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { composePhotoWithTemplate } from '@shared/lib/composer';
import type { TemplateConfig } from '@shared/types';
import { useEffect, useState } from 'react';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

export function PreviewScreen() {
  const {
    currentPhotoDataUrl,
    currentPhotoDataUrls,
    event,
    mode,
    setScreen,
    setCurrentPhoto,
  } = useAppStore();
  const [saving, setSaving] = useState(false);

  const photos = currentPhotoDataUrls.length > 0
    ? currentPhotoDataUrls
    : currentPhotoDataUrl ? [currentPhotoDataUrl] : [];
  const isMulti = photos.length > 1;

  useEffect(() => {
    if (photos.length === 0) setScreen('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (photos.length === 0) return null;

  const validate = async () => {
    if (!event || saving) return;
    setSaving(true);
    try {
      let finalDataUrl = photos[0];
      try {
        const templates = await window.api.template.list();
        if (templates.length > 0) {
          const config = JSON.parse(templates[0].config_json) as TemplateConfig;
          finalDataUrl = await composePhotoWithTemplate(photos, config, event);
        }
      } catch (e) {
        console.warn('Composition template échouée, photo brute conservée', e);
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
            Aperçu
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 002
          </span>
        </motion.div>

        {/* Corps */}
        <div
          className="flex-1 grid items-center"
          style={{ gridTemplateColumns: '1fr 1fr', gap: '5rem', paddingTop: '3rem', paddingBottom: '3rem' }}
        >
          {/* COLONNE GAUCHE : photo(s) */}
          <div className="flex items-center justify-center min-w-0">
            {isMulti ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: photos.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
                  maxHeight: '60vh',
                  width: '100%',
                  maxWidth: '32rem',
                }}
              >
                {photos.map((url, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden"
                    style={{
                      borderRadius: '4px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                      aspectRatio: '3/4',
                    }}
                  >
                    <img
                      src={url}
                      alt={`Cliché ${i + 1}`}
                      className="w-full h-full object-cover photo-warm"
                    />
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
                style={{ aspectRatio: '3/4', maxHeight: '60vh' }}
              >
                <div
                  className="overflow-hidden h-full"
                  style={{
                    borderRadius: '4px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  }}
                >
                  <img
                    src={photos[0]}
                    alt="Aperçu"
                    className="w-full h-full object-cover photo-warm"
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* COLONNE DROITE : actions sobres */}
          <div className="flex flex-col justify-center" style={{ maxWidth: '28rem' }}>
            <motion.p
              {...fadeUp(0.25)}
              className="label-editorial"
              style={{ color: '#6B5D4F', marginBottom: '1.25rem' }}
            >
              Aperçu
            </motion.p>

            <motion.h1
              {...fadeUp(0.35)}
              className="font-editorial"
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
                color: '#1A1A1A',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Et maintenant&nbsp;?
            </motion.h1>

            <motion.p
              {...fadeUp(0.5)}
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                marginTop: '1.5rem',
                maxWidth: '24rem',
              }}
            >
              {isMulti
                ? `${photos.length} clichés capturés. Validez pour les composer, ou recommencez la séance.`
                : 'Votre cliché est prêt. Validez pour passer au partage, ou recommencez.'}
            </motion.p>

            {/* Actions */}
            <motion.div {...fadeUp(0.7)} className="flex flex-wrap gap-3" style={{ marginTop: '2.5rem' }}>
              <button
                onClick={validate}
                disabled={saving}
                className="btn-editorial-primary"
              >
                <MdCheck size={20} />
                {saving ? 'Sauvegarde...' : 'Je la garde'}
              </button>

              <button
                onClick={retake}
                disabled={saving}
                className="btn-editorial-secondary"
              >
                <MdReplay size={20} />
                Reprendre
              </button>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(0.95)}
          className="flex items-center justify-between pt-3 pb-3"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 002
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
