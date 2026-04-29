import { motion } from 'framer-motion';
import { Check, RotateCcw, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';
import { Button } from '@shared/components/Button';
import { CornerDecor } from '@client/components/decors';

const fadeIn = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { delay, duration: 0.8 },
});

export function VideoPreviewScreen() {
  const {
    currentVideoBlob,
    currentVideoBlobUrl,
    currentVideoDurationMs,
    currentInterviewLog,
    videoMode,
    settings,
    event,
    setScreen,
    clearVideo,
    setVideoSaved,
  } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Garde anti-arrivée directe
  useEffect(() => {
    if (!currentVideoBlob || !currentVideoBlobUrl) {
      setScreen('video-home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentVideoBlobUrl || !currentVideoBlob) return null;

  const validate = async () => {
    if (!event || saving) return;
    setSaving(true);
    setError(null);
    try {
      const buf = await currentVideoBlob.arrayBuffer();
      const mode = videoMode ?? 'free_message';
      const res = await window.api.video.save({
        buffer: new Uint8Array(buf),
        eventId: event.id,
        mode,
        durationMs: currentVideoDurationMs,
        interviewLog:
          mode === 'interview' ? { questions: currentInterviewLog } : undefined,
      });
      setVideoSaved({ filepath: res.filepath, shareUrl: res.share_url });
      setScreen('video-share');
    } catch (e) {
      console.error(e);
      setError('Impossible de sauvegarder la vidéo. Réessayez.');
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
  const durationLabel = mins > 0 ? `${mins} min ${String(secs).padStart(2, '0')}s` : `${secs}s`;

  return (
    <Screen className="overflow-hidden bg-wedding flex flex-col items-center justify-center px-12">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
            'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
            '#faf6ef',
        }}
      />

      <motion.div {...fadeIn(0.4)} className="absolute top-0 right-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="tr" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div {...fadeIn(0.5)} className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none">
        <CornerDecor style={decorStyle} position="bl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
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
          Votre vidéo
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-sans text-base font-light mb-6"
          style={{ color: '#5a3e2b' }}
        >
          Durée : {durationLabel} — vous la gardez ?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-10"
        >
          <div
            className="absolute -inset-3 rounded-3xl blur-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(212,165,116,0.3) 0%, rgba(242,196,206,0.2) 100%)',
            }}
          />
          <video
            src={currentVideoBlobUrl}
            controls
            playsInline
            autoPlay
            className="relative max-h-[60vh] max-w-[85vw] rounded-3xl bg-black"
            style={{
              boxShadow: '0 24px 64px rgba(90,60,40,0.18), 0 0 0 1px rgba(212,165,116,0.25)',
            }}
          />
        </motion.div>

        {error && (
          <p className="mb-4 text-sm font-light" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        )}

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
            Refaire
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={
              saving ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Check size={26} strokeWidth={2.5} />
              )
            }
            onClick={validate}
            disabled={saving}
          >
            {saving ? 'Sauvegarde…' : 'Je la garde'}
          </Button>
        </motion.div>
      </div>
    </Screen>
  );
}
