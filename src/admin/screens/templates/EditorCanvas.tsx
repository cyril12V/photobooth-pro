import { useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import type { TemplateConfig, TemplateElement, PhotoboothEvent } from '@shared/types';
import { localFileUrl } from '@shared/lib/poseAssets';

interface Props {
  config: TemplateConfig;
  selectedId: string | null;
  scale: number;
  event: PhotoboothEvent | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (el: TemplateElement) => void;
}

export function EditorCanvas({
  config,
  selectedId,
  scale,
  event,
  onSelectElement,
  onUpdateElement,
}: Props) {
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const sorted = [...elements].sort((a, b) => a.z - b.z);

  return (
    <div
      style={{
        width: config.canvas_width * scale,
        height: config.canvas_height * scale,
        backgroundColor: config.background_color,
        backgroundImage: config.background_image ? `url("${localFileUrl(config.background_image)}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 20px 80px -10px rgba(0,0,0,0.6)',
      }}
      onClick={() => onSelectElement(null)}
    >
      {sorted.map((el) => (
        <CanvasElement
          key={el.id}
          el={el}
          scale={scale}
          selected={el.id === selectedId}
          event={event}
          onSelect={() => onSelectElement(el.id)}
          onUpdate={onUpdateElement}
        />
      ))}
    </div>
  );
}

interface ElementProps {
  el: TemplateElement;
  scale: number;
  selected: boolean;
  event: PhotoboothEvent | null;
  onSelect: () => void;
  onUpdate: (el: TemplateElement) => void;
}

function CanvasElement({ el, scale, selected, event, onSelect, onUpdate }: ElementProps) {
  const isDragging = useRef(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isDragging.current) onSelect();
    },
    [onSelect],
  );

  const content = renderContent(el, scale, event);

  // Poignées visibles aux 8 points quand l'élément est sélectionné — carrés dorés.
  const handleSize = 14;
  const cornerStyle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    background: '#d4a574',
    border: '2px solid white',
    borderRadius: 4,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  };
  const edgeStyle: React.CSSProperties = {
    background: '#d4a574',
    border: '1.5px solid white',
    borderRadius: 3,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  };
  const resizeHandleStyles = selected
    ? {
        topLeft: { ...cornerStyle, marginLeft: -handleSize / 2, marginTop: -handleSize / 2 },
        topRight: { ...cornerStyle, marginRight: -handleSize / 2, marginTop: -handleSize / 2 },
        bottomLeft: { ...cornerStyle, marginLeft: -handleSize / 2, marginBottom: -handleSize / 2 },
        bottomRight: { ...cornerStyle, marginRight: -handleSize / 2, marginBottom: -handleSize / 2 },
        top: { ...edgeStyle, height: 8, width: 32, left: '50%', marginLeft: -16, marginTop: -4 },
        bottom: { ...edgeStyle, height: 8, width: 32, left: '50%', marginLeft: -16, marginBottom: -4 },
        left: { ...edgeStyle, width: 8, height: 32, top: '50%', marginTop: -16, marginLeft: -4 },
        right: { ...edgeStyle, width: 8, height: 32, top: '50%', marginTop: -16, marginRight: -4 },
      }
    : undefined;

  return (
    <Rnd
      position={{ x: el.x * scale, y: el.y * scale }}
      size={{ width: el.width * scale, height: el.height * scale }}
      style={{
        transform: `rotate(${el.rotation}deg)`,
        zIndex: el.z,
        outline: selected ? '2px solid #d4a574' : 'none',
        outlineOffset: '2px',
        cursor: 'move',
      }}
      enableResizing={!el.locked}
      resizeHandleStyles={resizeHandleStyles}
      disableDragging={el.locked}
      bounds="parent"
      onDragStart={() => { isDragging.current = true; }}
      onDragStop={(_e, d) => {
        setTimeout(() => { isDragging.current = false; }, 50);
        onUpdate({ ...el, x: Math.round(d.x / scale), y: Math.round(d.y / scale) });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onUpdate({
          ...el,
          x: Math.round(position.x / scale),
          y: Math.round(position.y / scale),
          width: Math.round(parseInt(ref.style.width) / scale),
          height: Math.round(parseInt(ref.style.height) / scale),
        });
      }}
      onClick={handleClick}
    >
      {content}
    </Rnd>
  );
}

function renderContent(el: TemplateElement, scale: number, event: PhotoboothEvent | null): React.ReactNode {
  if (el.type === 'photo-slot') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: el.border_radius * scale,
          background: 'repeating-conic-gradient(rgba(150,150,150,0.3) 0% 25%, rgba(200,200,200,0.3) 0% 50%) 0 0 / 20px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed rgba(212,165,116,0.5)',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ color: 'rgba(212,165,116,0.7)', fontSize: 14 * scale, fontFamily: 'Manrope', userSelect: 'none' }}>
          Photo
        </span>
      </div>
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
          width: '100%',
          height: '100%',
          fontFamily: el.font_family,
          fontSize: el.font_size * scale,
          fontWeight: el.font_weight,
          fontStyle: el.italic ? 'italic' : 'normal',
          color: el.color,
          textAlign: el.align,
          letterSpacing: el.letter_spacing * scale,
          display: 'flex',
          alignItems: 'center',
          justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center',
          overflow: 'hidden',
          userSelect: 'none',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '0 4px',
          boxSizing: 'border-box',
        }}
      >
        {txt}
      </div>
    );
  }

  if (el.type === 'image' || el.type === 'logo') {
    return (
      <div style={{ width: '100%', height: '100%', opacity: el.opacity, borderRadius: el.border_radius * scale, overflow: 'hidden', pointerEvents: 'none' }}>
        {el.src ? (
          <img src={localFileUrl(el.src)} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit, display: 'block' }} />
        ) : (
          <div
            style={{
              width: '100%', height: '100%',
              background: 'rgba(255,255,255,0.1)',
              border: '2px dashed rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)', fontSize: 12 * scale,
              fontFamily: 'Manrope', userSelect: 'none',
            }}
          >
            {el.type === 'logo' ? 'Logo' : 'Image'}
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
            width: '100%', height: '100%',
            borderRadius: '50%',
            background: el.fill,
            border: el.stroke_width > 0 ? `${el.stroke_width * scale}px solid ${el.stroke}` : undefined,
            opacity: el.opacity,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      );
    }
    if (el.shape === 'line') {
      return (
        <div
          style={{
            width: '100%',
            height: Math.max(el.stroke_width * scale, 1),
            background: el.stroke,
            opacity: el.opacity,
            pointerEvents: 'none',
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: '100%', height: '100%',
          background: el.fill,
          border: el.stroke_width > 0 ? `${el.stroke_width * scale}px solid ${el.stroke}` : undefined,
          borderRadius: el.border_radius * scale,
          opacity: el.opacity,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
    );
  }

  if (el.type === 'frame') {
    return (
      <div
        style={{
          width: '100%', height: '100%',
          border: `${el.stroke_width * scale}px solid ${el.stroke}`,
          borderRadius: el.border_radius * scale,
          background: el.fill === 'transparent' ? 'transparent' : el.fill,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
    );
  }

  return null;
}
