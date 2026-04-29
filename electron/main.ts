import { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { autoUpdater } from 'electron-updater';
import { initDatabase, db } from './database';
import { handlePrint, listPrinters } from './printer';
import { shareServer } from './shareServer';
import { sendPhotoEmail, sendVideoLinkEmail, testSmtp } from './mailer';
import {
  compileEventVideos,
  type VideoCompilerEvent,
  type VideoCompilerSettings,
} from './videoCompiler';

// ─── Configuration ──────────────────────────────────────────────────────────
const KIOSK_MODE = process.env.KIOSK === '1' || process.env.NODE_ENV === 'production';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

// ─── Création de la fenêtre principale ─────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: KIOSK_MODE,
    kiosk: KIOSK_MODE,
    autoHideMenuBar: true,
    backgroundColor: '#0a0e1f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // App locale : le renderer doit pouvoir afficher les images choisies par l'utilisateur
      // depuis n'importe quel chemin du disque (logo, photo de fond, image template…).
      // Le contextIsolation + nodeIntegration:false + preload propre garantissent la sécurité.
      webSecurity: false,
    },
  });

  if (KIOSK_MODE) {
    mainWindow.setMenu(null);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Raccourci secret pour quitter le mode kiosque (Ctrl+Shift+Q trois fois rapproché)
  let quitTaps = 0;
  let quitTimer: NodeJS.Timeout | null = null;
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    quitTaps++;
    if (quitTimer) clearTimeout(quitTimer);
    quitTimer = setTimeout(() => (quitTaps = 0), 1500);
    if (quitTaps >= 3) {
      app.quit();
    }
  });
}

function msToHms(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const msPart = String(ms % 1000).padStart(3, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${msPart}`;
}

/** Retourne le dossier racine d'un évènement (créé si absent + README). */
async function ensureEventFolder(event: { name: string; date?: string | null }): Promise<string> {
  const safeName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dir = path.join(app.getPath('pictures'), 'PhotoBooth', safeName);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'Interview'), { recursive: true });
  await fs.mkdir(path.join(dir, 'Messages_libres'), { recursive: true });
  await fs.mkdir(path.join(dir, 'videos'), { recursive: true });

  const readmePath = path.join(dir, 'LISEZ-MOI.txt');
  try {
    await fs.access(readmePath);
  } catch {
    // README absent, on le crée
    const readme = `PhotoBooth Pro — Dossier de l'évènement
========================================

Évènement : ${event.name}${event.date ? `\nDate : ${event.date}` : ''}

ORGANISATION DES FICHIERS
-------------------------
Ce dossier contient toutes les photos et vidéos prises pendant l'évènement.

  /  (ce dossier)
  ├─ Photos prises (fichiers .jpg)
  ├─ Interview/           Vidéos d'interview enregistrées
  ├─ Messages_libres/     Messages vidéo libres
  └─ videos/              Compilations générées (montage final)

Toutes les photos sont triées par date dans leur nom (format ISO).

Astuce : tu peux glisser-déposer ce dossier sur un disque dur externe
ou un service cloud pour archiver l'évènement.

— Application PhotoBooth Pro —
`;
    await fs.writeFile(readmePath, readme, 'utf8');
  }

  return dir;
}

function getSettings(): Record<string, any> {
  const rows: any[] = db.prepare('SELECT key, value FROM settings').all();
  const obj: Record<string, any> = {};
  for (const r of rows) {
    try {
      obj[r.key] = JSON.parse(r.value);
    } catch {
      obj[r.key] = r.value;
    }
  }
  return obj;
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────
function registerIpcHandlers() {
  // ── Évènements ────────────────────────────────
  ipcMain.handle('event:current', () => {
    return db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
  });

  ipcMain.handle('event:save', async (_e, data) => {
    const existing: any = db.prepare('SELECT id FROM events WHERE active = 1 LIMIT 1').get();
    // Crée/met à jour le dossier de l'évènement (avec README) dès l'enregistrement
    try {
      await ensureEventFolder({ name: data.name, date: data.date });
    } catch {
      // ignore
    }
    if (existing) {
      db.prepare(
        `UPDATE events SET name = ?, date = ?, logo_path = ?, background_path = ?,
         theme_primary = ?, theme_secondary = ?, theme_accent = ? WHERE id = ?`,
      ).run(
        data.name,
        data.date,
        data.logo_path ?? null,
        data.background_path ?? null,
        data.theme_primary,
        data.theme_secondary,
        data.theme_accent,
        existing.id,
      );
      return { id: existing.id };
    }
    const r = db
      .prepare(
        `INSERT INTO events (name, date, logo_path, background_path, theme_primary, theme_secondary, theme_accent, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        data.name,
        data.date,
        data.logo_path ?? null,
        data.background_path ?? null,
        data.theme_primary,
        data.theme_secondary,
        data.theme_accent,
      );
    return { id: r.lastInsertRowid };
  });

  // ── Photos ────────────────────────────────────
  ipcMain.handle('photo:save', async (_e, { dataUrl, eventId, mode }) => {
    const event: any = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) throw new Error('Aucun évènement actif');

    const dir = await ensureEventFolder(event);
    const safeName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${ts}_${safeName}.jpg`;
    const filepath = path.join(dir, filename);

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await fs.writeFile(filepath, base64, 'base64');

    // Enregistre dans le serveur de partage local pour générer l'URL QR
    const share_url = shareServer.registerFile(filepath, 60 * 24);

    const r = db
      .prepare(
        'INSERT INTO photos (event_id, filepath, mode, qr_code, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(eventId, filepath, mode, share_url, new Date().toISOString());

    return { id: r.lastInsertRowid, filepath, share_url };
  });

  ipcMain.handle('photo:list', (_e, eventId: number) => {
    return db
      .prepare('SELECT * FROM photos WHERE event_id = ? ORDER BY created_at DESC')
      .all(eventId);
  });

  // ── Templates ─────────────────────────────────
  ipcMain.handle('template:list', () => {
    return db.prepare('SELECT * FROM templates ORDER BY name').all();
  });

  ipcMain.handle('template:save', (_e, data) => {
    if (data.id) {
      db.prepare('UPDATE templates SET name = ?, config_json = ? WHERE id = ?').run(
        data.name,
        JSON.stringify(data.config),
        data.id,
      );
      return { id: data.id };
    }
    const r = db
      .prepare('INSERT INTO templates (name, config_json) VALUES (?, ?)')
      .run(data.name, JSON.stringify(data.config));
    return { id: r.lastInsertRowid };
  });

  ipcMain.handle('template:delete', (_e, id: number) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return { ok: true };
  });

  // ── Poses challenge ───────────────────────────
  ipcMain.handle('pose:list', () => {
    return db.prepare('SELECT * FROM challenge_poses ORDER BY id').all();
  });

  ipcMain.handle('pose:add', (_e, data) => {
    const r = db
      .prepare('INSERT INTO challenge_poses (label, image_path) VALUES (?, ?)')
      .run(data.label, data.image_path);
    return { id: r.lastInsertRowid };
  });

  ipcMain.handle('pose:delete', (_e, id: number) => {
    db.prepare('DELETE FROM challenge_poses WHERE id = ?').run(id);
    return { ok: true };
  });

  // ── Vidéos ────────────────────────────────────
  ipcMain.handle(
    'video:save',
    async (
      _e,
      {
        buffer,
        eventId,
        mode,
        durationMs,
        interviewLog,
      }: {
        buffer: ArrayBuffer | Uint8Array;
        eventId: number;
        mode: 'interview' | 'free_message';
        durationMs: number;
        interviewLog?: {
          videoFile?: string;
          eventName?: string;
          recordedAt?: string;
          totalDurationMs?: number;
          questions: Array<{ index: number; text: string; startMs: number; endMs: number }>;
        };
      },
    ) => {
      const event: any = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      if (!event) throw new Error('Aucun évènement actif');

      const safeName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const subFolder = mode === 'interview' ? 'Interview' : 'Messages_libres';
      const eventDir = await ensureEventFolder(event);
      const dir = path.join(eventDir, subFolder);

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${ts}_${safeName}.webm`;
      const filepath = path.join(dir, filename);

      const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      await fs.writeFile(filepath, data);

      let interview_log_path: string | null = null;
      if (mode === 'interview' && interviewLog && interviewLog.questions.length > 0) {
        const baseName = `${ts}_${safeName}_interview`;
        interview_log_path = path.join(dir, `${baseName}.json`);
        const payload = {
          videoFile: filename,
          eventName: event.name,
          recordedAt: new Date().toISOString(),
          totalDurationMs: durationMs,
          questions: interviewLog.questions,
        };
        await fs.writeFile(interview_log_path, JSON.stringify(payload, null, 2), 'utf8');

        // CSV sibling pour ouverture facile dans un logiciel de montage
        const csvPath = path.join(dir, `${baseName}.csv`);
        const csvLines = ['index,start_ms,end_ms,start_hms,end_hms,question'];
        for (const q of interviewLog.questions) {
          csvLines.push(
            [
              q.index,
              q.startMs,
              q.endMs,
              msToHms(q.startMs),
              msToHms(q.endMs),
              `"${q.text.replace(/"/g, '""')}"`,
            ].join(','),
          );
        }
        await fs.writeFile(csvPath, csvLines.join('\n'), 'utf8');
      }

      const share_url = shareServer.registerFile(filepath, 60 * 24);

      const r = db
        .prepare(
          `INSERT INTO videos (event_id, filepath, mode, duration_ms, interview_log_path, qr_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          eventId,
          filepath,
          mode,
          durationMs,
          interview_log_path,
          share_url,
          new Date().toISOString(),
        );

      return {
        id: r.lastInsertRowid,
        filepath,
        share_url,
        interview_log_path,
      };
    },
  );

  ipcMain.handle('video:list', (_e, eventId: number) => {
    return db
      .prepare('SELECT * FROM videos WHERE event_id = ? ORDER BY created_at DESC')
      .all(eventId);
  });

  ipcMain.handle('video:delete', async (_e, id: number) => {
    const v: any = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
    if (v) {
      try {
        await fs.unlink(v.filepath);
      } catch {}
      if (v.interview_log_path) {
        try {
          await fs.unlink(v.interview_log_path);
        } catch {}
        const csv = String(v.interview_log_path).replace(/\.json$/, '.csv');
        try {
          await fs.unlink(csv);
        } catch {}
      }
      db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    }
    return { ok: true };
  });

  ipcMain.handle('video:compile', async (_e, eventId?: number) => {
    const ev: any = eventId
      ? db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)
      : db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
    if (!ev) return { ok: false, error: 'Aucun évènement actif' };

    const s = getSettings();
    const settings: VideoCompilerSettings = {
      video_compilation_show_questions: Boolean(s.video_compilation_show_questions),
      video_compilation_show_logo: Boolean(s.video_compilation_show_logo),
      video_compilation_show_event_name: Boolean(s.video_compilation_show_event_name),
      video_compilation_intro_duration: Number(s.video_compilation_intro_duration ?? 3),
    };

    const event: VideoCompilerEvent = {
      id: ev.id,
      name: ev.name,
      date: ev.date ?? null,
      logo_path: ev.logo_path ?? null,
    };

    try {
      const result = await compileEventVideos(ev.id, settings, event, (percent, stage) => {
        mainWindow?.webContents.send('video:compile-progress', { percent, stage });
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle('video:openFolder', async (_e, eventId?: number) => {
    const ev: any = eventId
      ? db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)
      : db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
    if (!ev) return { ok: false, error: 'Aucun évènement' };
    const dir = await ensureEventFolder(ev);
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });

  // ── Questions interview ───────────────────────
  ipcMain.handle('question:list', () => {
    return db
      .prepare('SELECT * FROM interview_questions WHERE active = 1 ORDER BY order_index, id')
      .all();
  });

  ipcMain.handle('question:add', (_e, data: { label: string; duration_seconds: number }) => {
    const max =
      (db.prepare('SELECT MAX(order_index) as m FROM interview_questions').get() as {
        m: number | null;
      }).m ?? -1;
    const r = db
      .prepare(
        'INSERT INTO interview_questions (label, duration_seconds, order_index) VALUES (?, ?, ?)',
      )
      .run(data.label, data.duration_seconds, max + 1);
    return { id: r.lastInsertRowid };
  });

  ipcMain.handle(
    'question:update',
    (_e, data: { id: number; label?: string; duration_seconds?: number }) => {
      const current: any = db
        .prepare('SELECT * FROM interview_questions WHERE id = ?')
        .get(data.id);
      if (!current) return { ok: false };
      db.prepare(
        'UPDATE interview_questions SET label = ?, duration_seconds = ? WHERE id = ?',
      ).run(
        data.label ?? current.label,
        data.duration_seconds ?? current.duration_seconds,
        data.id,
      );
      return { ok: true };
    },
  );

  ipcMain.handle('question:delete', (_e, id: number) => {
    db.prepare('DELETE FROM interview_questions WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('question:reorder', (_e, ids: number[]) => {
    const stmt = db.prepare('UPDATE interview_questions SET order_index = ? WHERE id = ?');
    const tx = db.transaction((arr: number[]) => {
      arr.forEach((id, i) => stmt.run(i, id));
    });
    tx(ids);
    return { ok: true };
  });

  // ── Settings ──────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, key: string, value: any) => {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    ).run(key, v, v);
    return { ok: true };
  });

  // ── Imprimante ────────────────────────────────
  ipcMain.handle('printer:list', async () => {
    if (!mainWindow) return [];
    return listPrinters(mainWindow);
  });

  ipcMain.handle('printer:print', async (_e, { filepath, copies, printerName }) => {
    if (!mainWindow) throw new Error('Fenêtre indisponible');
    return handlePrint(mainWindow, { filepath, copies, printerName });
  });

  // ── Sélecteur fichier (admin) ─────────────────
  ipcMain.handle('dialog:openImage', async () => {
    if (!mainWindow) return null;
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    return r.filePaths[0];
  });

  // ── Email SMTP ────────────────────────────────
  ipcMain.handle('email:send', async (_e, { to, filepath, eventName }) => {
    const s = getSettings();
    return sendPhotoEmail(
      {
        host: s.smtp_host,
        port: s.smtp_port,
        secure: s.smtp_secure,
        user: s.smtp_user,
        password: s.smtp_password,
        from: s.smtp_from,
        fromName: s.smtp_from_name,
      },
      to,
      filepath,
      eventName,
    );
  });

  ipcMain.handle('email:test', async (_e, smtp) => {
    return testSmtp(smtp);
  });

  ipcMain.handle('email:sendVideo', async (_e, { to, shareUrl, eventName }) => {
    const s = getSettings();
    return sendVideoLinkEmail(
      {
        host: s.smtp_host,
        port: s.smtp_port,
        secure: s.smtp_secure,
        user: s.smtp_user,
        password: s.smtp_password,
        from: s.smtp_from,
        fromName: s.smtp_from_name,
      },
      to,
      shareUrl,
      eventName,
    );
  });

  // ── Partage local ─────────────────────────────
  ipcMain.handle('share:url', (_e, filepath: string) => {
    return shareServer.registerFile(filepath, 60 * 24);
  });

  ipcMain.handle('share:info', () => shareServer.info());

  // ── Dossier des photos d'un évènement ──────────
  ipcMain.handle('photo:openFolder', async (_e, eventId?: number) => {
    const ev: any = eventId
      ? db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)
      : db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
    if (!ev) return { ok: false, error: 'Aucun évènement' };
    const dir = await ensureEventFolder(ev);
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });

  ipcMain.handle('photo:folder', async (_e, eventId?: number) => {
    const ev: any = eventId
      ? db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)
      : db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
    if (!ev) return null;
    return ensureEventFolder(ev);
  });

  // ── App ───────────────────────────────────────
  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}

// ─── Lancement ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await initDatabase();

  const settings = getSettings();
  const port = settings.share_server_port || 4321;
  try {
    await shareServer.start(port);
  } catch (e) {
    console.error('[ShareServer] échec démarrage:', e);
  }

  // Crée le dossier de l'évènement actif au démarrage (avec README explicatif)
  try {
    const activeEvent: any = db.prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
    if (activeEvent) await ensureEventFolder(activeEvent);
  } catch (e) {
    console.warn('[startup] création dossier évènement échouée:', e);
  }

  registerIpcHandlers();
  await createWindow();

  // ─── Auto-update (uniquement en production, packagé) ─────────────────────
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] mise à jour disponible:', info.version);
      mainWindow?.webContents.send('update:available', { version: info.version });
    });
    autoUpdater.on('update-not-available', () => {
      console.log('[updater] aucune mise à jour');
    });
    autoUpdater.on('download-progress', (p) => {
      mainWindow?.webContents.send('update:progress', { percent: p.percent });
    });
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] téléchargée:', info.version);
      mainWindow?.webContents.send('update:downloaded', { version: info.version });
      // Affiche une notif native qui propose de redémarrer
      dialog
        .showMessageBox(mainWindow!, {
          type: 'info',
          buttons: ['Redémarrer maintenant', 'Plus tard'],
          defaultId: 0,
          cancelId: 1,
          title: 'Mise à jour PhotoBooth',
          message: `Version ${info.version} prête à être installée`,
          detail: "L'application va redémarrer pour appliquer la mise à jour.",
        })
        .then((r) => {
          if (r.response === 0) autoUpdater.quitAndInstall(false, true);
        });
    });
    autoUpdater.on('error', (err) => {
      console.error('[updater] erreur:', err);
    });

    // Check au démarrage puis toutes les 30 min
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check:', e));
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 30 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  shareServer.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  shareServer.stop();
});
