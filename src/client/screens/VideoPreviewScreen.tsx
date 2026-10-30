import { motion } from 'framer-motion';
import { MdRefresh } from 'react-icons/md';
import { useEffect, useState } from 'react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { edgePrint } from '../components/ContactHeader';
import '../../styles/contact-videoshare.css';

export function VideoPreviewScreen() {
  const {
    currentVideoBlob,
    currentVideoBlobUrl,
    currentVideoDurationMs,
    videoMode,
    event,
    setScreen,
    clearVideo,
    setVideoSaved,
  } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Une vidéo de l'appareil Canon n'a pas de blob : elle est lue depuis son fichier.
  useEffect(() => {
    if (!currentVideoBlobUrl) {
      setScreen('video-home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentVideoBlobUrl) return null;

  const validate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const promise = useAppStore.getState().currentVideoSavePromise;
      if (!promise) {
        throw new Error('Upload non démarré');
      }
      const res = await promise;
      setVideoSaved({ filepath: res.filepath, shareUrl: res.share_url });
      setScreen('video-share');
    } catch (e) {
      console.error(e);
      setError("La vidéo n'a pas pu être enregistrée. Touchez « Garder ce message » pour réessayer.");
      setSaving(false);
    }
  };

  const retake = () => {
    clearVideo();
    setScreen(videoMode === 'interview' ? 'video-interview' : 'video-free');
  };

  const seconds = Math.round(currentVideoDurationMs / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  // Compteur imprimé sur le bord de la pellicule : « 1:05 ».
  const timecode = `${mins}:${String(secs).padStart(2, '0')}`;
  const name = event?.name?.trim();
  const edge = edgePrint(event, 'Message vidéo');

  return (
    <Screen className="overflow-hidden contact-paper">
      <div className="reel-page reel-page--preview">
        <div className="reel-text">
          {name && <p className="reel-dateline">Pour {name}</p>}
          <h1 className="contact-title">Voici votre message.</h1>
          <p className="contact-lede">
            Regardez-le avant de le laisser aux mariés. Vous pouvez le refaire autant de fois que vous voulez.
          </p>

          <div className="reel-actions">
            <button onClick={validate} disabled={saving} className="btn-editorial-primary">
              {saving && <MdRefresh size={22} className="animate-spin" />}
              {saving ? 'Enregistrement…' : 'Garder ce message'}
            </button>
            <button onClick={retake} disabled={saving} className="btn-editorial-secondary">
              Recommencer
            </button>
          </div>

          {error && (
            <p className="reel-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* La prise projetée dans un bout de pellicule : seule entrée animée de l'écran. */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="reel"
        >
          <div className="contact-rebate contact-rebate--top" aria-hidden>
            {[0, 1].map((i) => (
              <span key={i} className="contact-edge" style={{ left: `calc(var(--mm) * ${8 + i * 92})` }}>
                {edge}
              </span>
            ))}
          </div>
          <video src={currentVideoBlobUrl} controls playsInline autoPlay />
          <div className="contact-rebate contact-rebate--bottom" aria-hidden>
            <span className="contact-edge" style={{ left: 'calc(var(--mm) * 4)' }}>
              {`▸ DURÉE ${timecode}`}
            </span>
          </div>
        </motion.div>
      </div>
    </Screen>
  );
}
