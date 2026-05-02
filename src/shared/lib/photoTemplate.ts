import type { PhotoLayout, TemplateConfig } from '@shared/types';

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1800;

interface TemplateRow {
  id: number;
  name: string;
  config_json: string;
}

export const DEFAULT_PHOTO_LAYOUT: PhotoLayout = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
};

export function normalizeTemplateConfig(raw: unknown): TemplateConfig {
  const parsed =
    raw && typeof raw === 'object' ? (raw as Partial<TemplateConfig>) : {};

  return {
    canvas_width: parsed.canvas_width || DEFAULT_WIDTH,
    canvas_height: parsed.canvas_height || DEFAULT_HEIGHT,
    background_color: parsed.background_color || '#ffffff',
    background_image: parsed.background_image ?? null,
    elements: Array.isArray(parsed.elements) ? parsed.elements : [],
    ...parsed,
    ...(Array.isArray(parsed.elements) ? {} : { elements: [] }),
  };
}

export function getPhotoLayout(
  config: Pick<TemplateConfig, 'canvas_width' | 'canvas_height'> | null | undefined,
): PhotoLayout {
  return {
    width: config?.canvas_width || DEFAULT_WIDTH,
    height: config?.canvas_height || DEFAULT_HEIGHT,
  };
}

export function getAspectRatioString(layout: PhotoLayout): string {
  return `${layout.width} / ${layout.height}`;
}

export function isLandscapeLayout(layout: PhotoLayout): boolean {
  return layout.width > layout.height;
}

export function getPhotoSlotCount(config: TemplateConfig | null | undefined): number {
  if (!config) return 1;
  const slots = config.elements.filter((el) => el.type === 'photo-slot').length;
  return slots > 0 ? slots : 1;
}

export async function loadPrimaryTemplateSnapshot(): Promise<{
  template: TemplateRow | null;
  config: TemplateConfig | null;
  layout: PhotoLayout;
  slotCount: number;
}> {
  try {
    const templates = await window.api.template.list();
    const template = templates[0] ?? null;
    if (!template) {
      return {
        template: null,
        config: null,
        layout: DEFAULT_PHOTO_LAYOUT,
        slotCount: 1,
      };
    }

    const config = normalizeTemplateConfig(JSON.parse(template.config_json));
    return {
      template,
      config,
      layout: getPhotoLayout(config),
      slotCount: getPhotoSlotCount(config),
    };
  } catch {
    return {
      template: null,
      config: null,
      layout: DEFAULT_PHOTO_LAYOUT,
      slotCount: 1,
    };
  }
}
