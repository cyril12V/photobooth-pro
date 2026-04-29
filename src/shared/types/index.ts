export interface PhotoboothEvent {
  id: number;
  name: string;
  date: string;
  logo_path: string | null;
  background_path: string | null;
  theme_primary: string;
  theme_secondary: string;
  theme_accent: string;
  active: number;
}

export interface Photo {
  id: number;
  event_id: number;
  filepath: string;
  mode: 'classic' | 'challenge';
  qr_code: string | null;
  cloud_url: string | null;
  printed_count: number;
  created_at: string;
}

export interface ChallengePose {
  id: number;
  label: string;
  image_path: string;
}

export type VideoMode = 'interview' | 'free_message';

export interface Video {
  id: number;
  event_id: number;
  filepath: string;
  mode: VideoMode;
  duration_ms: number;
  interview_log_path: string | null;
  qr_code: string | null;
  created_at: string;
}

export interface InterviewQuestion {
  id: number;
  label: string;
  duration_seconds: number;
  order_index: number;
  active: number;
}

export interface InterviewLogEntry {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
}

export interface PhotoTemplate {
  id: number;
  name: string;
  config: TemplateConfig;
}

// ─── Template libre — éléments composables ─────────────────────────────────
export type TemplateElementType =
  | 'text'
  | 'image'
  | 'shape'
  | 'frame'
  | 'logo'
  | 'photo-slot';

export interface BaseElement {
  id: string;
  type: TemplateElementType;
  x: number;          // px relatifs au canvas (0..canvas_width)
  y: number;
  width: number;
  height: number;
  rotation: number;   // degrés
  z: number;          // ordre d'empilement
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  font_family: string;       // 'Fraunces' | 'Manrope' | 'Dancing Script' | ...
  font_size: number;
  font_weight: number;       // 400, 600, 700
  italic: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  letter_spacing: number;
  use_event_name?: boolean;  // remplace text par event.name dynamiquement
  use_event_date?: boolean;  // idem pour date
}

export interface ImageElement extends BaseElement {
  type: 'image' | 'logo';
  src: string;               // chemin local absolu ou data: URL
  opacity: number;
  border_radius: number;
  fit: 'contain' | 'cover';
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'circle' | 'line';
  fill: string;
  stroke: string;
  stroke_width: number;
  border_radius: number;
  opacity: number;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  stroke: string;
  stroke_width: number;
  border_radius: number;
  fill: string;              // fond derrière
}

export interface PhotoSlotElement extends BaseElement {
  type: 'photo-slot';
  // emplacement où la photo capturée sera insérée
  border_radius: number;
}

export type TemplateElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | FrameElement
  | PhotoSlotElement;

export interface TemplateConfig {
  // Format canvas (par défaut portrait 1200x1800 — print 10x15)
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  background_image?: string | null;
  elements: TemplateElement[];

  // Compatibilité ancienne API (legacy)
  frame_color?: string;
  frame_width?: number;
  event_name_position?: 'top' | 'bottom' | 'none';
  event_name_text?: string;
  custom_text?: string;
  custom_text_position?: 'top' | 'bottom' | 'left' | 'right';
  side_image_path?: string;
  side_image_position?: 'left' | 'right' | 'none';
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: number;
}

export type DecorStyle = 'floral' | 'stars' | 'hearts' | 'geometric' | 'botanical' | 'custom' | 'none';

export interface AppSettings {
  admin_password_hash: string;
  max_copies: number;
  countdown_seconds: number;
  enable_email: boolean;
  enable_qr: boolean;
  enable_cloud: boolean;
  printer_name: string;
  camera_device_id: string;
  flash_enabled: boolean;
  sound_enabled: boolean;
  // SMTP
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
  smtp_from_name: string;
  // QR / partage local
  share_server_port: number;
  // Décor d'angle
  decor_style: DecorStyle;
  decor_custom_path: string | null;
  // VideoBooth
  video_enabled: boolean;
  microphone_device_id: string;
  video_resolution: '1080p' | '720p' | '480p';
  video_max_duration_seconds: number;
  video_default_question_seconds: number;
  video_interview_beep: boolean;
  video_interview_flash: boolean;
  // Compilation vidéo
  video_compilation_enabled: boolean;
  video_compilation_show_questions: boolean;
  video_compilation_show_logo: boolean;
  video_compilation_show_event_name: boolean;
  video_compilation_intro_duration: number;
}

// Bridge IPC exposé au renderer
declare global {
  interface Window {
    api: {
      event: {
        current: () => Promise<PhotoboothEvent | undefined>;
        save: (data: Partial<PhotoboothEvent>) => Promise<{ id: number }>;
      };
      photo: {
        save: (payload: {
          dataUrl: string;
          eventId: number;
          mode: string;
        }) => Promise<{ id: number; filepath: string; share_url: string }>;
        list: (eventId: number) => Promise<Photo[]>;
        openFolder: (eventId?: number) => Promise<{ ok: boolean; path?: string; error?: string }>;
        folder: (eventId?: number) => Promise<string | null>;
      };
      template: {
        list: () => Promise<Array<{ id: number; name: string; config_json: string }>>;
        save: (data: {
          id?: number;
          name: string;
          config: TemplateConfig;
        }) => Promise<{ id: number }>;
        delete: (id: number) => Promise<{ ok: boolean }>;
      };
      pose: {
        list: () => Promise<ChallengePose[]>;
        add: (data: { label: string; image_path: string }) => Promise<{ id: number }>;
        delete: (id: number) => Promise<{ ok: boolean }>;
      };
      video: {
        save: (payload: {
          buffer: ArrayBuffer | Uint8Array;
          eventId: number;
          mode: VideoMode;
          durationMs: number;
          interviewLog?: { questions: InterviewLogEntry[] };
        }) => Promise<{
          id: number;
          filepath: string;
          share_url: string;
          interview_log_path: string | null;
        }>;
        list: (eventId: number) => Promise<Video[]>;
        delete: (id: number) => Promise<{ ok: boolean }>;
        openFolder: (eventId?: number) => Promise<{ ok: boolean; path?: string; error?: string }>;
        compile: (
          eventId?: number,
        ) => Promise<{ ok: boolean; filepath?: string; error?: string }>;
        onCompileProgress: (
          callback: (data: { percent: number; stage: string }) => void,
        ) => () => void;
      };
      question: {
        list: () => Promise<InterviewQuestion[]>;
        add: (data: { label: string; duration_seconds: number }) => Promise<{ id: number }>;
        update: (data: {
          id: number;
          label?: string;
          duration_seconds?: number;
        }) => Promise<{ ok: boolean }>;
        delete: (id: number) => Promise<{ ok: boolean }>;
        reorder: (ids: number[]) => Promise<{ ok: boolean }>;
      };
      settings: {
        get: () => Promise<AppSettings>;
        set: (key: string, value: any) => Promise<{ ok: boolean }>;
      };
      printer: {
        list: () => Promise<PrinterInfo[]>;
        print: (payload: {
          filepath: string;
          copies: number;
          printerName?: string;
        }) => Promise<{ ok: boolean }>;
      };
      dialog: {
        openImage: () => Promise<string | null>;
      };
      email: {
        send: (payload: {
          to: string;
          filepath: string;
          eventName?: string;
        }) => Promise<{ ok: boolean; error?: string }>;
        sendVideo: (payload: {
          to: string;
          shareUrl: string;
          eventName?: string;
        }) => Promise<{ ok: boolean; error?: string }>;
        test: (smtp: {
          host: string;
          port: number;
          secure: boolean;
          user: string;
          password: string;
        }) => Promise<{ ok: boolean; error?: string }>;
      };
      share: {
        url: (filepath: string) => Promise<string>;
        info: () => Promise<{ ip: string; port: number; running: boolean }>;
      };
      app: {
        quit: () => Promise<void>;
      };
    };
  }
}
