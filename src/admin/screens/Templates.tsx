import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Check, Layers } from 'lucide-react';
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
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700">
          <Check size={18} />
          <span className="text-sm font-medium">Template enregistré avec succès</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 animate-pulse shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-16 rounded-lg bg-neutral-100 flex-shrink-0" style={{ height: 96 }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded w-48" />
                  <div className="h-3 bg-neutral-50 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center mb-4 shadow-sm">
          <Layers size={36} className="text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-500 mb-2">Aucun template pour le moment</p>
          <p className="text-neutral-400 text-sm">
            Créez votre premier template pour habiller vos photos
          </p>
        </div>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3 mb-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center gap-5 group shadow-sm hover:border-neutral-300 transition-colors"
            >
              {/* Miniature canvas */}
              <div className="flex-shrink-0 rounded-xl overflow-hidden border border-neutral-200" style={{ width: 60, height: 90 }}>
                <CanvasPreview
                  config={t.config}
                  event={event}
                  scale={60 / (t.config.canvas_width ?? 1200)}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-neutral-900 font-semibold text-base truncate">{t.name}</p>
                <p className="text-neutral-500 text-sm mt-0.5">
                  {t.config.canvas_width ?? 1200} x {t.config.canvas_height ?? 1800}px
                  {' · '}
                  {t.config.elements?.length ?? 0} élément{(t.config.elements?.length ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium transition-colors"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" onClick={newTemplate} icon={<Plus size={20} />} fullWidth>
        Nouveau template
      </Button>
    </>
  );
}
