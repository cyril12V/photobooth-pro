import { useEffect, useState } from 'react';
import { MdAdd, MdDelete, MdEdit, MdCheck, MdLayers } from 'react-icons/md';
import type { TemplateConfig } from '@shared/types';
import { useAppStore } from '@shared/store';
import { AdminPageHeader } from '../components/AdminUI';
import { Button } from '@shared/components/Button';
import { Editor } from './templates/Editor';
import { CanvasPreview } from './templates/CanvasPreview';
import { makeDefaultTemplate } from './templates/defaults';

interface TemplateRow {
  id: number;
  name: string;
  config: TemplateConfig;
}

export function Templates() {
  const event = useAppStore((s) => s.event);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.api.template.list();
      setTemplates(
        list.map((t) => {
          let config: TemplateConfig;
          try {
            const parsed = JSON.parse(t.config_json);
            config = {
              canvas_width: parsed.canvas_width || 1200,
              canvas_height: parsed.canvas_height || 1800,
              background_color: parsed.background_color || '#ffffff',
              background_image: parsed.background_image ?? null,
              elements: Array.isArray(parsed.elements) ? parsed.elements : [],
              ...parsed,
              ...(Array.isArray(parsed.elements) ? {} : { elements: [] }),
            };
          } catch {
            config = {
              canvas_width: 1200,
              canvas_height: 1800,
              background_color: '#ffffff',
              elements: [],
            };
          }
          return { id: t.id, name: t.name, config };
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const newTemplate = () => {
    setEditing({
      id: 0,
      name: 'Nouveau template',
      config: makeDefaultTemplate(),
    });
  };

  const handleSaved = async () => {
    await load();
    const savedTemplate = templates[templates.length - 1];
    setSavedId(savedTemplate?.id ?? null);
    setTimeout(() => setSavedId(null), 3000);
    setEditing(null);
  };

  const remove = async (id: number) => {
    if (!confirm('Supprimer ce template ?')) return;
    await window.api.template.delete(id);
    await load();
  };

  // ── Editeur plein écran (garde son style sombre) ─────────────────────────
  if (editing) {
    return (
      <Editor
        templateId={editing.id}
        templateName={editing.name}
        initialConfig={editing.config}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  // ── Liste des templates ──────────────────────────────────────────────────
  return (
    <>
      <AdminPageHeader
        title="Templates"
        description="Concevez les habillages visuels appliqués aux photos"
      />

      {savedId !== null && (
        <div
          className="mb-4 p-4 flex items-center gap-3"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid #1A1A1A',
            borderRadius: '4px',
            color: '#1A1A1A',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
          }}
        >
          <MdCheck size={18} />
          <span>Template enregistré avec succès</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3 mb-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-5 animate-pulse"
              style={{
                backgroundColor: '#FAF6EE',
                border: '1px solid rgba(212, 184, 150, 0.2)',
                borderRadius: '24px',
              }}
            >
              <div className="flex items-center gap-5">
                <div
                  className="flex-shrink-0"
                  style={{ width: 60, height: 96, backgroundColor: '#F4ECDD', borderRadius: '4px' }}
                />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48" style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }} />
                  <div className="h-3 w-32" style={{ backgroundColor: '#F4ECDD', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div
          className="p-12 text-center mb-4"
          style={{
            backgroundColor: '#FAF6EE',
            border: '1px solid rgba(212, 184, 150, 0.2)',
            borderRadius: '24px',
          }}
        >
          <MdLayers size={36} className="mx-auto mb-4" style={{ color: '#6B5D4F' }} />
          <p
            className="font-editorial mb-2"
            style={{ fontSize: '1.5rem', color: '#1A1A1A', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Aucun template
          </p>
          <p style={{ color: '#6B5D4F', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
            Créez votre premier template pour habiller vos photos.
          </p>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="space-y-3 mb-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="p-5 flex items-center gap-5 group transition-colors"
              style={{
                backgroundColor: '#FAF6EE',
                border: '1px solid rgba(212, 184, 150, 0.2)',
                borderRadius: '24px',
              }}
            >
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{
                  width: 60,
                  height: 90,
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 184, 150, 0.3)',
                }}
              >
                <CanvasPreview
                  config={t.config}
                  event={event}
                  scale={60 / (t.config.canvas_width ?? 1200)}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontWeight: 700,
                    color: '#1A1A1A',
                    fontSize: '1.0625rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t.name}
                </p>
                <p
                  className="mt-1"
                  style={{
                    color: '#6B5D4F',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.8125rem',
                  }}
                >
                  {t.config.canvas_width ?? 1200} x {t.config.canvas_height ?? 1800}px
                  {' '}
                  {t.config.elements?.length ?? 0} élément
                  {(t.config.elements?.length ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-2 px-3.5 py-2"
                  style={{
                    backgroundColor: '#F4ECDD',
                    color: '#1A1A1A',
                    border: '1px solid rgba(212, 184, 150, 0.3)',
                    borderRadius: '4px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                  }}
                >
                  <MdEdit size={14} />
                  Modifier
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="p-2"
                  style={{
                    backgroundColor: '#1A1A1A',
                    color: '#FAF6EE',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title="Supprimer"
                >
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" onClick={newTemplate} icon={<MdAdd size={20} />} fullWidth>
        Nouveau template
      </Button>
    </>
  );
}
