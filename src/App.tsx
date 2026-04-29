import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@shared/store';
import { ClientApp } from '@client/ClientApp';
import { AdminApp } from '@admin/AdminApp';

export function App() {
  const { adminMode, setAdminMode, setEvent, setSettings, setPoses, setScreen, event } = useAppStore();
  const [loading, setLoading] = useState(true);

  // Chargement initial des données
  useEffect(() => {
    (async () => {
      try {
        const [ev, settings, poses] = await Promise.all([
          window.api.event.current(),
          window.api.settings.get(),
          window.api.pose.list(),
        ]);
        if (ev) setEvent(ev);
        if (settings) setSettings(settings);
        if (poses) setPoses(poses);
        // Si la vidéo est désactivée, on saute le splash et on va direct à l'accueil photo
        if (settings && !settings.video_enabled) {
          setScreen('home');
        }
      } catch (e) {
        console.error('Erreur chargement initial', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [setEvent, setSettings, setPoses, setScreen]);

  // Application des couleurs du thème de l'évènement aux variables CSS
  useEffect(() => {
    if (event) {
      document.documentElement.style.setProperty('--color-primary', event.theme_primary);
      document.documentElement.style.setProperty('--color-secondary', event.theme_secondary);
      document.documentElement.style.setProperty('--color-accent', event.theme_accent);
    }
  }, [event]);

  // Détection coin caché : 5 tapotements rapides en haut à droite → admin
  useEffect(() => {
    let taps: number[] = [];
    const onTap = (e: PointerEvent) => {
      const isCorner = e.clientX > window.innerWidth - 80 && e.clientY < 80;
      if (!isCorner) return;
      const now = Date.now();
      taps = [...taps.filter((t) => now - t < 2000), now];
      if (taps.length >= 5) {
        setAdminMode(true);
        taps = [];
      }
    };
    window.addEventListener('pointerdown', onTap);
    return () => window.removeEventListener('pointerdown', onTap);
  }, [setAdminMode]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#faf6ef' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-display italic text-3xl"
          style={{ color: '#5a3e2b', opacity: 0.7 }}
        >
          Chargement...
        </motion.div>
      </div>
    );
  }

  // Fond cream côté client, sombre côté admin — pour qu'aucun flash de fond contraire ne se voie
  const rootBg = adminMode ? '#0a0a0a' : '#faf6ef';

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: rootBg }}>
      <AnimatePresence mode="wait">
        {adminMode ? (
          <motion.div
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <AdminApp />
          </motion.div>
        ) : (
          <motion.div
            key="client"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <ClientApp />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone invisible coin haut-droit pour activer l'admin */}
      {!adminMode && (
        <div
          className="absolute top-0 right-0 w-20 h-20 z-50"
          aria-hidden="true"
        />
      )}

      {/* Le bouton de sortie admin est désormais dans la sidebar AdminApp / AdminLogin */}
    </div>
  );
}
