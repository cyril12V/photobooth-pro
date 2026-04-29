import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import crypto from 'node:crypto';

let _db: Database.Database;

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

  // ─── Valeurs par défaut ───────────────────────────────────────────────────
  const defaults: Record<string, any> = {
    admin_password_hash: hashPassword('admin'),
    max_copies: 4,
    countdown_seconds: 3,
    enable_email: true,
    enable_qr: true,
    enable_cloud: false,
    printer_name: '',
    camera_device_id: '',
    flash_enabled: true,
    sound_enabled: true,
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    smtp_from_name: 'PhotoBooth',
    share_server_port: 4321,
    decor_style: 'floral',
    decor_custom_path: null,
    // ─── VideoBooth ─────────────────────────────────────────────────────────
    video_enabled: true,
    microphone_device_id: '',
    video_resolution: '1080p',
    video_max_duration_seconds: 30,
    video_default_question_seconds: 15,
    video_interview_beep: true,
    video_interview_flash: true,
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
function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}
