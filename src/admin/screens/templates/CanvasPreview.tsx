import type { TemplateConfig, TemplateElement, PhotoboothEvent } from '@shared/types';
import { localFileUrl } from '@shared/lib/poseAssets';

interface Props {
  config: TemplateConfig;
  event: PhotoboothEvent | null;
  scale: number;
}

// Rendu statique miniature (lecture seule) utilisé dans la liste des templates
export function CanvasPreview({ config, event, scale }: Props) {
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  const w = config?.canvas_width || 1200;
  const h = config?.canvas_height || 1800;

  return (
    <div
      style={{
        width: w * scale,
        height: h * scale,
        backgroundColor: config?.background_color || '#ffffff',
        backgroundImage: config?.background_image
          ? `url("${localFileUrl(config.background_image)}")`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {sorted.map((el) => (
        <ElementPreview key={el.id} el={el} scale={scale} event={event} />
      ))}
    </div>
  );
}

function ElementPreview({
  el,
  scale,
  event,
}: {
  el: TemplateElement;
  scale: number;
  event: PhotoboothEvent | null;
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    height: el.height * scale,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  };

  if (el.type === 'photo-slot') {
    return (
      <div
        style={{
          ...style,
          borderRadius: el.border_radius * scale,
          background:
            'repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 0 0 / 16px 16px',
          opacity: 0.5,
        }}
      />
    );
  }

  if (el.type === 'text') {
    const txt = el.use_event_name
      ? (event?.name ?? el.text)
      : el.use_event_date
        ? (event?.date ?? el.text)
        : el.text;
    return (
      <div
        style={{
          ...style,
          fontFamily: el.font_family,
          fontSize: el.font_size * scale,
          fontWeight: el.font_weight,
          fontStyle: el.italic ? 'italic' : 'normal',
          color: el.color,
          textAlign: el.align,
          letterSpacing: el.letter_spacing * scale,
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            el.align === 'left'
              ? 'flex-start'
              : el.align === 'right'
                ? 'flex-end'
                : 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {txt}
      </div>
    );
  }

  if (el.type === 'image' || el.type === 'logo') {
    return (
      <div style={{ ...style, opacity: el.opacity, borderRadius: el.border_radius * scale, overflow: 'hidden' }}>
        {el.src ? (
          <img
            src={localFileUrl(el.src)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: el.fit }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10 * scale, color: '#888' }}>Image</span>
          </div>
        )}
      </div>
    );
  }

  if (el.type === 'shape') {
    if (el.shape === 'circle') {
      return (
        <div
          style={{
            ...style,
            borderRadius: '50%',
            background: el.fill,
            border: el.stroke_width > 0 ? `${el.stroke_width * scale}px solid ${el.stroke}` : undefined,
            opacity: el.opacity,
          }}
        />
      );
    }
    if (el.shape === 'line') {
      return (
        <div
          style={{
            ...style,
            height: Math.max(el.stroke_width * scale, 1),
            background: el.stroke,
            opacity: el.opacity,
          }}
        />
      );
    }
    return (
      <div
        style={{
          ...style,
          background: el.fill,
          border: el.stroke_width > 0 ? `${el.stroke_width * scale}px solid ${el.stroke}` : undefined,
          borderRadius: el.border_radius * scale,
          opacity: el.opacity,
        }}
      />
    );
  }

  if (el.type === 'frame') {
    return (
      <div
        style={{
          ...style,
          border: `${el.stroke_width * scale}px solid ${el.stroke}`,
          borderRadius: el.border_radius * scale,
          background: el.fill === 'transparent' ? 'transparent' : el.fill,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return null;
}
