import type {
  TemplateConfig,
  PhotoboothEvent,
  TemplateElement,
  TextElement,
  ImageElement,
  ShapeElement,
  FrameElement,
  PhotoSlotElement,
} from '@shared/types';

/**
 * Compose la photo finale avec le template (cadre, texte, logo, photo-slot, etc.)
 * Retourne un dataURL JPEG.
 *
 * @param photoDataUrls - Un seul dataURL (rétrocompat) ou un tableau pour le multi-photo.
 *   Les photo-slots sont remplis dans l'ordre par position (Y croissant, puis X).
 *   Si moins de photos que de slots, le cycle reprend depuis le début.
 */
export async function composePhotoWithTemplate(
  photoDataUrls: string | string[],
  template: TemplateConfig | null,
  event: PhotoboothEvent | null,
): Promise<string> {
  const urlsArray = Array.isArray(photoDataUrls) ? photoDataUrls : [photoDataUrls];
  const firstUrl = urlsArray[0] ?? '';

  // Pas de template : retourne la première photo telle quelle
  if (!template) return firstUrl;

  // Format legacy (sans elements) : utilise l'ancien rendu
  if (!Array.isArray(template.elements) || template.elements.length === 0) {
    return composeLegacy(firstUrl, template, event);
  }

  const W = template.canvas_width || 1200;
  const H = template.canvas_height || 1800;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  // ─── Fond ────────────────────────────────────────────────────────────────
  ctx.fillStyle = template.background_color || '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (template.background_image) {
    try {
      const bg = await loadImage(toSrc(template.background_image));
      ctx.drawImage(bg, 0, 0, W, H);
    } catch {
      // ignore
    }
  }

  // Charge les photos capturées — une par photo-slot, avec cycle si insuffisant
  const loadedPhotos = await Promise.all(urlsArray.map((u) => loadImage(u)));

  // Trie les photo-slots par position (Y croissant, puis X) pour un ordre naturel
  const photoSlots = [...template.elements]
    .filter((el): el is PhotoSlotElement => el.type === 'photo-slot')
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // Map slot.id → image chargée
  const photoBySlotId = new Map<string, HTMLImageElement>();
  photoSlots.forEach((slot, i) => {
    photoBySlotId.set(slot.id, loadedPhotos[i % loadedPhotos.length]);
  });

  // Tri par z (croissant — z bas dessous, z haut dessus)
  const sorted = [...template.elements].sort((a, b) => a.z - b.z);

  for (const el of sorted) {
    ctx.save();
    // Rotation autour du centre
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    try {
      switch (el.type) {
        case 'photo-slot': {
          const photo = photoBySlotId.get(el.id) ?? loadedPhotos[0];
          drawPhotoSlot(ctx, el as PhotoSlotElement, photo);
          break;
        }
        case 'text':
          drawText(ctx, el as TextElement, event);
          break;
        case 'image':
        case 'logo':
          await drawImageElement(ctx, el as ImageElement);
          break;
        case 'shape':
          drawShape(ctx, el as ShapeElement);
          break;
        case 'frame':
          drawFrame(ctx, el as FrameElement);
          break;
      }
    } catch (e) {
      console.warn('[composer] erreur élément', el, e);
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin uniquement pour http(s) — sinon ça casse app-file:// et data:
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image non chargée : ${src}`));
    img.src = src;
  });
}

/** Convertit un chemin (file path absolu, data: URL, http) en src compatible Image. */
function toSrc(p: string): string {
  if (!p) return '';
  if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://') || p.startsWith('file://')) {
    return p;
  }
  return `file:///${p.replace(/\\/g, '/')}`;
}

function clipRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPhotoSlot(
  ctx: CanvasRenderingContext2D,
  el: PhotoSlotElement,
  photo: HTMLImageElement,
) {
  ctx.save();
  clipRoundedRect(ctx, el.x, el.y, el.width, el.height, el.border_radius || 0);
  ctx.clip();

  // Cover (recadrage centré)
  const ratio = photo.width / photo.height;
  const target = el.width / el.height;
  let srcX = 0,
    srcY = 0,
    srcW = photo.width,
    srcH = photo.height;
  if (ratio > target) {
    srcW = photo.height * target;
    srcX = (photo.width - srcW) / 2;
  } else {
    srcH = photo.width / target;
    srcY = (photo.height - srcH) / 2;
  }
  ctx.drawImage(photo, srcX, srcY, srcW, srcH, el.x, el.y, el.width, el.height);
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  el: TextElement,
  event: PhotoboothEvent | null,
) {
  let text = el.text || '';
  if (el.use_event_name && event?.name) text = event.name;
  if (el.use_event_date && event?.date) {
    try {
      text = new Date(event.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      text = event.date;
    }
  }

  const weight = el.font_weight || 400;
  const italic = el.italic ? 'italic ' : '';
  const family = el.font_family || 'Manrope, sans-serif';
  ctx.font = `${italic}${weight} ${el.font_size}px "${family}"`;
  ctx.fillStyle = el.color || '#000000';
  ctx.textAlign = el.align || 'left';
  ctx.textBaseline = 'top';

  // letter-spacing : Canvas API expérimentale
  if ('letterSpacing' in ctx && typeof el.letter_spacing === 'number') {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${el.letter_spacing}px`;
  }

  // Word wrap simple
  const lines = wrapText(ctx, text, el.width);
  const lineHeight = el.font_size * 1.2;
  let yOffset = 0;
  let xPos = el.x;
  if (el.align === 'center') xPos = el.x + el.width / 2;
  if (el.align === 'right') xPos = el.x + el.width;

  for (const line of lines) {
    ctx.fillText(line, xPos, el.y + yOffset);
    yOffset += lineHeight;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

async function drawImageElement(ctx: CanvasRenderingContext2D, el: ImageElement) {
  if (!el.src) return;
  const img = await loadImage(toSrc(el.src));
  ctx.save();
  ctx.globalAlpha = typeof el.opacity === 'number' ? el.opacity : 1;
  clipRoundedRect(ctx, el.x, el.y, el.width, el.height, el.border_radius || 0);
  ctx.clip();

  if (el.fit === 'contain') {
    const ratio = img.width / img.height;
    const target = el.width / el.height;
    let dw = el.width;
    let dh = el.height;
    if (ratio > target) dh = el.width / ratio;
    else dw = el.height * ratio;
    const dx = el.x + (el.width - dw) / 2;
    const dy = el.y + (el.height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // cover (default)
    const ratio = img.width / img.height;
    const target = el.width / el.height;
    let srcX = 0,
      srcY = 0,
      srcW = img.width,
      srcH = img.height;
    if (ratio > target) {
      srcW = img.height * target;
      srcX = (img.width - srcW) / 2;
    } else {
      srcH = img.width / target;
      srcY = (img.height - srcH) / 2;
    }
    ctx.drawImage(img, srcX, srcY, srcW, srcH, el.x, el.y, el.width, el.height);
  }
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  ctx.globalAlpha = typeof el.opacity === 'number' ? el.opacity : 1;
  ctx.fillStyle = el.fill || 'transparent';
  ctx.strokeStyle = el.stroke || 'transparent';
  ctx.lineWidth = el.stroke_width || 0;

  if (el.shape === 'rect') {
    clipRoundedRect(ctx, el.x, el.y, el.width, el.height, el.border_radius || 0);
    if (el.fill && el.fill !== 'transparent') ctx.fill();
    if (el.stroke_width > 0) ctx.stroke();
  } else if (el.shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    if (el.fill && el.fill !== 'transparent') ctx.fill();
    if (el.stroke_width > 0) ctx.stroke();
  } else if (el.shape === 'line') {
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + el.height / 2);
    ctx.lineTo(el.x + el.width, el.y + el.height / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFrame(ctx: CanvasRenderingContext2D, el: FrameElement) {
  if (el.fill && el.fill !== 'transparent') {
    ctx.fillStyle = el.fill;
    clipRoundedRect(ctx, el.x, el.y, el.width, el.height, el.border_radius || 0);
    ctx.fill();
  }
  if ((el.stroke_width || 0) > 0) {
    ctx.strokeStyle = el.stroke || '#000';
    ctx.lineWidth = el.stroke_width;
    clipRoundedRect(ctx, el.x, el.y, el.width, el.height, el.border_radius || 0);
    ctx.stroke();
  }
}

// ─── Legacy (compat ancienne config) ───────────────────────────────────────
async function composeLegacy(
  photoDataUrl: string,
  template: TemplateConfig,
  event: PhotoboothEvent | null,
): Promise<string> {
  const W = template.canvas_width || 1200;
  const H = template.canvas_height || 1800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  ctx.fillStyle = template.background_color || '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const frameWidth = template.frame_width || 60;
  ctx.fillStyle = template.frame_color || '#0a0e1f';
  ctx.fillRect(0, 0, W, H);

  const img = await loadImage(photoDataUrl);
  const photoX = frameWidth;
  const photoY = frameWidth;
  const photoW = W - frameWidth * 2;
  const photoH = H * 0.75 - frameWidth;

  const ratio = img.width / img.height;
  const target = photoW / photoH;
  let srcX = 0,
    srcY = 0,
    srcW = img.width,
    srcH = img.height;
  if (ratio > target) {
    srcW = img.height * target;
    srcX = (img.width - srcW) / 2;
  } else {
    srcH = img.width / target;
    srcY = (img.height - srcH) / 2;
  }
  ctx.drawImage(img, srcX, srcY, srcW, srcH, photoX, photoY, photoW, photoH);

  if (template.event_name_position && template.event_name_position !== 'none' && event) {
    const text = template.event_name_text || event.name;
    ctx.fillStyle = '#faf6ef';
    ctx.font = 'italic 64px Fraunces, serif';
    ctx.textAlign = 'center';
    const ty =
      template.event_name_position === 'top' ? frameWidth + 80 : H - frameWidth - 40;
    ctx.fillText(text, W / 2, ty);
  }

  if (template.custom_text) {
    ctx.fillStyle = '#d4a574';
    ctx.font = '500 32px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(template.custom_text, W / 2, H - frameWidth - 100);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

export type { TemplateElement };
