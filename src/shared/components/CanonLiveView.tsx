import { useEffect, useRef } from 'react';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  onFirstFrame?: () => void;
}

/**
 * Aperçu en direct de l'appareil Canon (images JPEG du LiveView EDSDK).
 * Le LiveView doit être démarré par l'appelant (window.api.canon.liveview(true)).
 * Si le décodage prend du retard, seules les images les plus récentes sont affichées.
 */
export function CanonLiveView({ className, style, onFirstFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;

  useEffect(() => {
    let cancelled = false;
    let decoding = false;
    let latest: Uint8Array | null = null;
    let first = true;

    const drawLatest = async () => {
      if (decoding || !latest) return;
      const jpeg = latest;
      latest = null;
      decoding = true;
      try {
        const bitmap = await createImageBitmap(new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
        const canvas = canvasRef.current;
        if (canvas && !cancelled) {
          if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
          }
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
          if (first) {
            first = false;
            onFirstFrameRef.current?.();
          }
        }
        bitmap.close();
      } catch {
        // Image tronquée : on attend la suivante.
      } finally {
        decoding = false;
        if (latest && !cancelled) drawLatest();
      }
    };

    const off = window.api.canon.onFrame((jpeg) => {
      latest = jpeg;
      drawLatest();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} />;
}
