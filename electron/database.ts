import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import crypto from 'node:crypto';

let _db: Database.Database;

type CaptureResolution = '4k' | '1080p' | '720p' | '480p';

export function getDb() {
  return _db;
}

// Petit alias pour les imports
export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (_db as any)[prop];
  },
});

export async function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'photobooth.sqlite');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // ─── Schéma ───────────────────────────────────────────────────────────────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT,
      logo_path TEXT,
      background_path TEXT,
      theme_primary TEXT DEFAULT '#0a0e1f',
      theme_secondary TEXT DEFAULT '#d4a574',
      theme_accent TEXT DEFAULT '#ff8e72',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      filepath TEXT NOT NULL,
      mode TEXT,
      qr_code TEXT,
      cloud_url TEXT,
      printed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenge_poses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      image_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER,
      copies INTEGER,
      printer_name TEXT,
      success INTEGER,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      filepath TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('interview','free_message')),
      duration_ms INTEGER NOT NULL DEFAULT 0,
      interview_log_path TEXT,
      qr_code TEXT,
      cloud_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 15,
      order_index INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn('photos', 'cloud_url', 'TEXT');
  ensureColumn('videos', 'cloud_url', 'TEXT');

  // ─── Valeurs par défaut ───────────────────────────────────────────────────
  const legacyVideoResolution = readCaptureResolution(
    (_db.prepare("SELECT value FROM settings WHERE key = 'video_resolution'").get() as
      | { value?: string }
      | undefined)?.value,
  );

  const legacyVideoEnabled = (
    _db.prepare("SELECT value FROM settings WHERE key = 'video_enabled'").get() as
      | { value?: string }
      | undefined
  )?.value;
  const legacyCaptureMode: 'photo' | 'video' | 'both' =
    legacyVideoEnabled === undefined
      ? 'both'
      : (() => {
          try {
            return JSON.parse(legacyVideoEnabled) ? 'both' : 'photo';
          } catch {
            return 'both';
          }
        })();

  const defaults: Record<string, any> = {
    admin_password_hash: hashPassword('admin'),
    max_copies: 4,
    countdown_seconds: 3,
    enable_qr: true,
    enable_cloud: false,
    cloud_vps_url: '',
    cloud_vps_api_key: '',
    printer_name: '',
    paper_format: '4x6',
    camera_device_id: '',
    flash_enabled: true,
    sound_enabled: true,
    share_server_port: 4321,
    decor_style: 'floral',
    decor_custom_path: null,
    photo_resolution: legacyVideoResolution,
    // ─── VideoBooth ─────────────────────────────────────────────────────────
    video_enabled: true,
    capture_mode: legacyCaptureMode,
    microphone_device_id: '',
    video_capture_resolution: legacyVideoResolution,
    video_preview_resolution: '1080p',
    video_max_duration_seconds: 30,
    video_default_question_seconds: 15,
    video_interview_beep: true,
    video_interview_flash: true,
    // ─── Compilation vidéo ─────────────────────────────────────────────────
    video_compilation_enabled: true,
    video_compilation_show_questions: true,
    video_compilation_show_logo: true,
    video_compilation_show_event_name: true,
    video_compilation_intro_duration: 3,
  };

  // Upsert : insère seulement les clés manquantes (pour les anciennes BDD)
  const stmt = _db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
  );
  for (const [k, v] of Object.entries(defaults)) {
    stmt.run(k, JSON.stringify(v));
  }

  // Évènement par défaut si aucun
  const ev = _db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number };
  if (ev.c === 0) {
    _db.prepare(
      `INSERT INTO events (name, date, theme_primary, theme_secondary, theme_accent, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    ).run('Mon Évènement', new Date().toISOString().slice(0, 10), '#0a0e1f', '#d4a574', '#ff8e72');
  }

  console.log('[DB] Initialisée :', dbPath);
}

// Hash simple SHA-256 (suffit pour mot de passe admin local — pas de réseau)
function readCaptureResolution(raw?: string): CaptureResolution {
  if (!raw) return '1080p';
  try {
    const parsed = JSON.parse(raw) as CaptureResolution;
    if (parsed === '4k' || parsed === '1080p' || parsed === '720p' || parsed === '480p') {
      return parsed;
    }
  } catch {
    // Ignore malformed legacy value.
  }
  return '1080p';
}

function ensureColumn(table: string, column: string, definition: string) {
  const rows = _db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) return;
  _db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}
