import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { BookOpen, Loader2, ImageOff } from 'lucide-react';
import type { Photo } from '@shared/types';
import { useAppStore } from '@shared/store';
import { localFileUrl } from '@shared/lib/poseAssets';
import { AdminPageHeader, AdminCard } from '../components/AdminUI';

type PhotosPerPage = 4 | 6;

interface GridSpec {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 15;
const GAP = 10;

const GRIDS: Record<PhotosPerPage, GridSpec> = {
  4: { cols: 2, rows: 2, cellW: 90, cellH: 120 },
  6: { cols: 2, rows: 3, cellW: 90, cellH: 80 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = src;
  });
}

function imageToJpegDataUrl(img: HTMLImageElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer un contexte canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Crop centré ratio cible (cover) -> canvas redimensionné -> dataURL JPEG
 */
function imageCoverToJpegDataUrl(
  img: HTMLImageElement,
  targetRatio: number,
  quality = 0.85,
): string {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcRatio = srcW / srcH;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;
  if (srcRatio > targetRatio) {
    // src trop large : crop horizontal
    sw = srcH * targetRatio;
    sx = (srcW - sw) / 2;
  } else {
    // src trop haute : crop vertical
    sh = srcW / targetRatio;
    sy = (srcH - sh) / 2;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer un contexte canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function formatDateUppercase(iso?: string): string {
  if (!iso) return '';
  try {
    const date = new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return date.toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

function sanitizeFileName(name: string): string {
  return (name || 'evenement')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .trim() || 'evenement';
}

export function Album() {
  const event = useAppStore((s) => s.event);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [perPage, setPerPage] = useState<PhotosPerPage>(4);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      setLoadingPhotos(false);
      return;
    }
    let cancelled = false;
    setLoadingPhotos(true);
    window.api.photo
      .list(event.id)
      .then((list) => {
        if (!cancelled) setPhotos(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingPhotos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  const generate = async () => {
    if (!event || photos.length === 0) return;
    setGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      // ─── Page 1 — Couverture ────────────────────────────────────────────
      doc.setFont('times', 'italic');
      doc.setFontSize(36);
      doc.setTextColor(20, 20, 20);
      doc.text(event.name || 'Album', A4_WIDTH / 2, 50, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      const dateLabel = formatDateUppercase(event.date);
      if (dateLabel) {
        doc.text(dateLabel, A4_WIDTH / 2, 70, { align: 'center', charSpace: 1.2 });
      }

      if (event.background_path) {
        try {
          const coverImg = await loadImage(localFileUrl(event.background_path));
          const coverW = 140;
          const coverH = 170;
          const coverRatio = coverW / coverH; // 4:5 environ
          const coverData = imageCoverToJpegDataUrl(coverImg, coverRatio, 0.85);
          const coverX = (A4_WIDTH - coverW) / 2;
          const coverY = 90;
          doc.addImage(coverData, 'JPEG', coverX, coverY, coverW, coverH);
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.3);
          doc.rect(coverX, coverY, coverW, coverH);
        } catch (err) {
          // pas de photo des mariés -> on continue sans
          console.warn('Cover image failed', err);
        }
      }

      doc.setFont('times', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(120, 120, 120);
      doc.text('Album souvenir', A4_WIDTH / 2, A4_HEIGHT - 18, { align: 'center' });

      // ─── Pages 2+ — Grille photos ───────────────────────────────────────
      const grid = GRIDS[perPage];
      const totalGridW = grid.cols * grid.cellW + (grid.cols - 1) * GAP;
      const totalGridH = grid.rows * grid.cellH + (grid.rows - 1) * GAP;
      const startX = (A4_WIDTH - totalGridW) / 2;
      const startY = (A4_HEIGHT - totalGridH) / 2;

      for (let i = 0; i < photos.length; i++) {
        const indexOnPage = i % perPage;
        if (indexOnPage === 0) {
          doc.addPage();
        }
        const col = indexOnPage % grid.cols;
        const row = Math.floor(indexOnPage / grid.cols);
        const x = startX + col * (grid.cellW + GAP);
        const y = startY + row * (grid.cellH + GAP);

        try {
          const photo = photos[i];
          const img = await loadImage(localFileUrl(photo.filepath));
          const cellRatio = grid.cellW / grid.cellH;
          const dataUrl = imageCoverToJpegDataUrl(img, cellRatio, 0.85);
          doc.addImage(dataUrl, 'JPEG', x, y, grid.cellW, grid.cellH);
        } catch (err) {
          console.warn('Skipping unreadable photo', err);
          // placeholder gris si l'image refuse de charger
          doc.setFillColor(240, 240, 240);
          doc.rect(x, y, grid.cellW, grid.cellH, 'F');
        }

        // bordure 1pt grise (~0.353 mm)
        doc.setDrawColor(170, 170, 170);
        doc.setLineWidth(0.353);
        doc.rect(x, y, grid.cellW, grid.cellH);

        setProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      const fileName = `Album-${sanitizeFileName(event.name)}.pdf`;
      doc.save(fileName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  if (!event) {
    return (
      <>
        <AdminPageHeader
          title="Album photo"
          subtitle="Évènement"
          description="Générez un livre imprimable"
        />
        <AdminCard>
          <p className="text-sm text-neutral-500">Aucun évènement actif.</p>
        </AdminCard>
      </>
    );
  }

  const empty = !loadingPhotos && photos.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Album photo"
        subtitle="Évènement"
        description="Générez un livre imprimable"
      />

      <AdminCard
        title="Mise en page"
        description="Choisissez la densité des photos par page"
        accentBar
      >
        <div className="space-y-6">
          {/* Sélecteur photos par page */}
          <div>
            <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wider mb-2.5">
              Photos par page
            </p>
            <div className="flex gap-3">
              {([4, 6] as const).map((value) => {
                const active = perPage === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPerPage(value)}
                    disabled={generating}
                    className="flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: active ? '#d4a574' : '#e5e7eb',
                      background: active
                        ? 'linear-gradient(135deg, rgba(232,199,154,0.25) 0%, rgba(212,165,116,0.15) 100%)'
                        : '#ffffff',
                      color: active ? '#5a3e2b' : '#525252',
                      boxShadow: active ? '0 0 0 3px rgba(212,165,116,0.15)' : 'none',
                    }}
                  >
                    {value} photos
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compteur */}
          <div className="flex items-center justify-between py-3 border-t border-neutral-100">
            <div>
              <p className="text-sm font-medium text-neutral-900">Photos disponibles</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {loadingPhotos
                  ? 'Chargement…'
                  : `${photos.length} photo${photos.length > 1 ? 's' : ''} pour ${event.name}`}
              </p>
            </div>
            <span
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{
                background: 'rgba(212,165,116,0.12)',
                color: '#5a3e2b',
              }}
            >
              {loadingPhotos ? '…' : photos.length}
            </span>
          </div>

          {/* Empty state */}
          {empty && (
            <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50">
              <ImageOff size={32} className="text-neutral-300 mb-3" strokeWidth={1.6} />
              <p className="text-sm font-medium text-neutral-700">
                Aucune photo capturée pour cet évènement
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Lancez le mode photobooth pour commencer à remplir l'album.
              </p>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* CTA */}
          <motion.button
            type="button"
            onClick={generate}
            disabled={generating || empty || loadingPhotos}
            whileHover={!generating && !empty ? { scale: 1.01 } : undefined}
            whileTap={!generating && !empty ? { scale: 0.99 } : undefined}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
              boxShadow: '0 4px 14px rgba(255,126,95,0.35)',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={17} className="animate-spin" strokeWidth={2.4} />
                Génération… {progress}%
              </>
            ) : (
              <>
                <BookOpen size={17} strokeWidth={2.4} />
                Générer l'album
              </>
            )}
          </motion.button>
        </div>
      </AdminCard>
    </>
  );
}
