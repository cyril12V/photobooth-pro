import { motion } from 'framer-motion';
import { MdCheck, MdReplay, MdRefresh } from 'react-icons/md';
import { useEffect, useState } from 'react';
import { useAppStore } from '@shared/store';
import { Screen } from '@shared/components/Screen';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
});

export function VideoPreviewScreen() {
  const {
    currentVideoBlob,
    currentVideoBlobUrl,
    currentVideoDurationMs,
    currentInterviewLog,
    videoMode,
    event,
    setScreen,
    clearVideo,
    setVideoSaved,
  } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const eventNameUp = (event?.name ?? 'Wedding').toUpperCase();

  return (
    <Screen className="overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: '#F4ECDD' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-10">
        {/* Header */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Aperçu vidéo
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Durée {durationLabel}
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 005
          </span>
        </motion.div>

        {/* Corps */}
        <div className="flex-1 grid grid-cols-12 gap-12 items-center pt-8">
          <div className="col-span-5 flex flex-col justify-center">
            <motion.p
              {...fadeUp(0.25)}
              className="label-editorial mb-5"
              style={{ color: '#6B5D4F' }}
            >
              The Video Cover
            </motion.p>

            <motion.h1
              {...fadeUp(0.35)}
              className="font-editorial leading-[0.9]"
              style={{
                fontSize: 'clamp(3.5rem, 7vw, 7rem)',
                color: '#1A1A1A',
                fontWeight: 900,
                letterSpacing: '-0.03em',
              }}
            >
              {eventNameUp}
            </motion.h1>

            <motion.div {...fadeUp(0.5)} className="mt-8">
              <div className="editorial-rule-light mb-4" style={{ width: '4rem' }} />
              <p
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  maxWidth: '28rem',
                }}
              >
                Votre vidéo est prête. Validez pour la sauvegarder et la partager, ou refaites une
                prise si nécessaire.
              </p>
            </motion.div>

            {error && (
              <motion.p
                {...fadeUp(0.6)}
                className="mt-4"
                style={{ color: '#1A1A1A', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}
              >
                {error}
              </motion.p>
            )}

            <motion.div {...fadeUp(0.7)} className="mt-10 flex flex-wrap gap-3">
              <button
                onClick={validate}
                disabled={saving}
                className="btn-editorial-primary"
              >
                {saving ? (
                  <MdRefresh size={20} className="animate-spin" />
                ) : (
                  <MdCheck size={20} />
                )}
                {saving ? 'Sauvegarde...' : 'Je la garde'}
              </button>
              <button
                onClick={retake}
                disabled={saving}
                className="btn-editorial-secondary"
              >
                <MdReplay size={20} />
                Refaire
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-7 flex items-center justify-center"
          >
            <div
              className="overflow-hidden relative"
              style={{
                borderRadius: '4px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                maxHeight: '70vh',
              }}
            >
              <video
                src={currentVideoBlobUrl}
                controls
                playsInline
                autoPlay
                className="max-h-[70vh] w-auto bg-black"
              />
              <div
                className="absolute -bottom-2 -right-2 px-4 py-2 label-editorial"
                style={{ backgroundColor: '#1A1A1A', color: '#FAF6EE', fontSize: '0.6875rem' }}
              >
                The Take
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          {...fadeUp(1)}
          className="flex items-center justify-between pt-4 mt-6"
          style={{ borderTop: '1px solid #1A1A1A' }}
        >
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            Édition limitée
          </span>
          <span className="label-editorial" style={{ color: '#6B5D4F' }}>
            Validez ou refaites
          </span>
          <span className="label-editorial" style={{ color: '#1A1A1A' }}>
            № 005
          </span>
        </motion.div>
      </div>
    </Screen>
  );
}
