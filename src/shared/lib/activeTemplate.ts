import type { TemplateConfig } from '../types';

/**
 * Le modèle appliqué aux photos : celui choisi dans Admin › Templates, aucun si
 * « sans cadre » (-1), sinon le premier par ordre alphabétique (ancien comportement).
 */
export function pickActiveTemplate<T extends { id: number }>(templates: T[], activeId?: number): T | undefined {
  if (activeId === -1) return undefined;
  return templates.find((t) => t.id === activeId) ?? templates[0];
}

/** Lit le modèle actif à jour (l'admin a pu le changer depuis le chargement de l'app). */
export async function loadActiveTemplate(): Promise<TemplateConfig | null> {
  const [templates, settings] = await Promise.all([window.api.template.list(), window.api.settings.get()]);
  const row = pickActiveTemplate(templates, settings.active_template_id);
  return row ? (JSON.parse(row.config_json) as TemplateConfig) : null;
}
