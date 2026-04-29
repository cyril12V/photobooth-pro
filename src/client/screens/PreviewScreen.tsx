import { motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { CornerDecor } from '@client/components/decors';
import { composePhotoWithTemplate } from '@shared/lib/composer';
import type { TemplateConfig } from '@shared/types';
import { useEffect, useState } from 'react';

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.8 },
});

export function PreviewScreen() {
  const { currentPhotoDataUrl, currentPhotoDataUrls, event, mode, setScreen, setCurrentPhoto, clearPhotos, settings } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
  const [saving, setSaving] = useState(false);

  // Utilise le tableau si disponible, sinon fallback sur le single
  const photos = currentPhotoDataUrls.length > 0 ? currentPhotoDataUrls : (currentPhotoDataUrl ? [currentPhotoDataUrl] : []);
  const isMulti = photos.length > 1;

  // Garde anti-arrivée directe (sans photo).
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

  const retake = () => {
    // setScreen avant clearPhotos pour éviter qu'un re-render intermédiaire
    // de PreviewScreen avec photos vides ne déclenche d'effet bizarre.
    // CaptureScreen fait déjà clearPhotos() à son montage avant la séquence.
    setScreen('capture');
  };

  return (
    <Screen className="overflow-hidden bg-wedding flex flex-col items-center justify-center px-12">
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
      <motion.div {...fadeIn(0.4)} className="absolute top-0 right-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="tr" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.5)} className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="bl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      {/* Contenu */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Titre */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-sm uppercase tracking-[0.45em] font-medium mb-2"
          style={{ color: '#c8956a' }}
        >
          Aperçu
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-2"
          style={{
            fontFamily: '"Allura", cursive',
            fontSize: 'clamp(3rem, 6vw, 5.5rem)',
            color: '#2a1a10',
          }}
        >
          Magnifique !
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-sans text-base font-light mb-8"
          style={{ color: '#5a3e2b' }}
        >
          Vous gardez celle-ci ?
        </motion.p>

        {/* Photo principale ou strip multi-photos */}
        {isMulti ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3 mb-10"
          >
            {photos.map((url, i) => (
              <div key={i} className="relative">
                <div
                  className="absolute -inset-2 rounded-2xl blur-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.25) 0%, rgba(242,196,206,0.15) 100%)' }}
                />
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="relative max-h-[48vh] rounded-2xl"
                  style={{
                    boxShadow: '0 16px 48px rgba(90,60,40,0.15), 0 0 0 1px rgba(212,165,116,0.2)',
                  }}
                />
                <div
                  className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(212,165,116,0.9)', color: '#2a1a10' }}
                >
                  {i + 1}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-10"
          >
            <div
              className="absolute -inset-3 rounded-3xl blur-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.3) 0%, rgba(242,196,206,0.2) 100%)' }}
            />
            <img
              src={photos[0]}
              alt="Aperçu"
              className="relative max-h-[58vh] max-w-[80vw] rounded-3xl"
              style={{
                boxShadow: '0 24px 64px rgba(90,60,40,0.18), 0 0 0 1px rgba(212,165,116,0.25)',
              }}
            />
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-6"
        >
          <Button
            variant="ghost"
            size="lg"
            icon={<RotateCcw size={22} />}
            onClick={retake}
            disabled={saving}
          >
            Reprendre
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<Check size={26} strokeWidth={2.5} />}
            onClick={validate}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Je la garde'}
          </Button>
        </motion.div>
      </div>
    </Screen>
  );
}
