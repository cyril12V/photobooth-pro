import { motion } from 'framer-motion';
import { MdCheck, MdReplay } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { composePhotoWithTemplate } from '@shared/lib/composer';
import type { TemplateConfig } from '@shared/types';
import { useEffect, useState } from 'react';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
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

  const eventNameUp = (event?.name ?? 'Wedding').toUpperCase();
  const dateStr = event?.date
    ? new Date(event.date)
        .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        .toUpperCase()
    : '';

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-12">
        {/* Bandeau top éditorial */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Aperçu
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Validation du souvenir
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            {dateStr}
          </span>
        </motion.div>

        {/* Corps */}
        <div className="flex-1 grid grid-cols-12 gap-12 items-center pt-10">
          {/* COLONNE GAUCHE : titre + meta éditoriale */}
          <div className="col-span-5 flex flex-col justify-center">
            <motion.p
              {...fadeUp(0.25)}
              className="label-editorial mb-6"
              style={{ color: '#6B5D4F' }}
            >
              The Cover Story
            </motion.p>

            <motion.h1
              {...fadeUp(0.35)}
              className="font-editorial leading-[0.9]"
              style={{
                fontSize: 'clamp(4rem, 8vw, 8rem)',
                color: '#1A1A1A',
                fontWeight: 900,
                letterSpacing: '-0.03em',
              }}
            >
              {eventNameUp}
            </motion.h1>

            <motion.p
              {...fadeUp(0.5)}
              className="mt-4"
              style={{
                fontFamily: '"Pinyon Script", cursive',
                fontSize: 'clamp(2rem, 3vw, 3rem)',
                color: '#1A1A1A',
                lineHeight: 1,
              }}
            >
              {event?.name ?? 'Wedding'}
            </motion.p>

            <motion.div {...fadeUp(0.65)} className="mt-10">
              <div className="editorial-rule-light mb-4" style={{ width: '4rem' }} />
              <p
                className="text-base"
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.6,
                  maxWidth: '28rem',
                }}
              >
                {isMulti
                  ? `${photos.length} clichés capturés. Validez pour les composer en une couverture unique, ou recommencez la séance.`
                  : 'Votre cliché est prêt. Validez pour l\'imprimer et le partager, ou recommencez si vous souhaitez une autre prise.'}
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div {...fadeUp(0.85)} className="mt-12 flex flex-wrap gap-3">
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

          {/* COLONNE DROITE : photo(s) en portrait magazine */}
          <div className="col-span-7 flex items-center justify-center">
            {isMulti ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="grid gap-4"
                style={{
                  gridTemplateColumns: photos.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
                  maxHeight: '75vh',
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
                    <div
                      className="absolute top-3 left-3 px-2 py-1"
                      style={{
                        backgroundColor: '#1A1A1A',
                        color: '#FAF6EE',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                      }}
                    >
                      №{String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
                style={{ aspectRatio: '3/4', maxHeight: '75vh' }}
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
                <div
                  className="absolute -bottom-2 -right-2 px-4 py-2"
                  style={{
                    backgroundColor: '#1A1A1A',
                    color: '#FAF6EE',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                  }}
                >
                  The Shot
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-4 mt-8"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Validez ou recommencez
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 001
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
