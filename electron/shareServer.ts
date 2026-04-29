import express from 'express';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { Server } from 'node:http';

interface SharedFile {
  filepath: string;
  expiresAt: number;
}

class ShareServer {
  private app = express();
  private server: Server | null = null;
  private files = new Map<string, SharedFile>();
  private port = 0;
  private localIp = '127.0.0.1';

  constructor() {
    this.app.get('/', (_req, res) => {
      res.send('PhotoBooth share server');
    });

    // Page de téléchargement (HTML mobile-friendly)
    this.app.get('/p/:token', (req, res) => {
      const entry = this.files.get(req.params.token);
      if (!entry || entry.expiresAt < Date.now()) {
        res.status(404).send(this.notFoundPage());
        return;
      }
      const fileExists = fs.existsSync(entry.filepath);
      if (!fileExists) {
        res.status(404).send(this.notFoundPage());
        return;
      }
      const isVideo = isVideoFile(entry.filepath);
      res.send(
        isVideo ? this.videoPage(req.params.token) : this.downloadPage(req.params.token),
      );
    });

    // Image binaire
    this.app.get('/img/:token', (req, res) => {
      const entry = this.files.get(req.params.token);
      if (!entry || entry.expiresAt < Date.now()) {
        res.status(404).send('Lien expiré');
        return;
      }
      if (!fs.existsSync(entry.filepath)) {
        res.status(404).send('Fichier introuvable');
        return;
      }
      res.sendFile(entry.filepath);
    });

    // Vidéo binaire (streaming avec Range pour lecture inline mobile)
    this.app.get('/video/:token', (req, res) => {
      const entry = this.files.get(req.params.token);
      if (!entry || entry.expiresAt < Date.now()) {
        res.status(404).send('Lien expiré');
        return;
      }
      if (!fs.existsSync(entry.filepath)) {
        res.status(404).send('Fichier introuvable');
        return;
      }
      const stat = fs.statSync(entry.filepath);
      const total = stat.size;
      const range = req.headers.range;
      const mime = mimeFromPath(entry.filepath);

      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = m ? parseInt(m[1], 10) : 0;
        const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
        if (start >= total || end >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(entry.filepath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': total,
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(entry.filepath).pipe(res);
      }
    });

    // Téléchargement direct (force download)
    this.app.get('/download/:token', (req, res) => {
      const entry = this.files.get(req.params.token);
      if (!entry || entry.expiresAt < Date.now()) {
        res.status(404).send('Lien expiré');
        return;
      }
      if (!fs.existsSync(entry.filepath)) {
        res.status(404).send('Fichier introuvable');
        return;
      }
      const filename = path.basename(entry.filepath);
      res.download(entry.filepath, filename);
    });
  }

  async start(port: number) {
    this.localIp = this.detectLocalIp();
    return new Promise<void>((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.port = port;
          console.log(`[ShareServer] http://${this.localIp}:${port}`);
          resolve();
        });
        this.server.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  stop() {
    this.server?.close();
    this.server = null;
  }

  /** Enregistre un fichier partagé et retourne l'URL publique. */
  registerFile(filepath: string, ttlMinutes = 60 * 24): string {
    const token = crypto.randomBytes(8).toString('hex');
    this.files.set(token, {
      filepath,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    });
    return `http://${this.localIp}:${this.port}/p/${token}`;
  }

  info() {
    return {
      ip: this.localIp,
      port: this.port,
      running: !!this.server,
    };
  }

  private detectLocalIp(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private videoPage(token: string) {
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Votre vidéo</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0a0e1f 0%,#1f2a55 100%);color:#faf6ef;min-height:100vh}
    .container{max-width:720px;margin:0 auto;padding:32px 20px;text-align:center}
    h1{font-family:"Times New Roman",Georgia,serif;font-style:italic;font-weight:400;font-size:42px;margin:24px 0 8px;background:linear-gradient(135deg,#e8c79a,#d4a574);-webkit-background-clip:text;background-clip:text;color:transparent}
    p{opacity:.7;margin:0 0 24px}
    video{width:100%;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);margin-bottom:24px;background:#000}
    .btn{display:inline-flex;align-items:center;gap:10px;padding:18px 32px;border-radius:999px;background:linear-gradient(135deg,#ff8e72,#e26b4f);color:#fff;text-decoration:none;font-weight:600;letter-spacing:.5px;box-shadow:0 20px 60px -10px rgba(255,142,114,.5);transition:transform .2s}
    .btn:hover{transform:translateY(-2px)}
    .meta{margin-top:24px;opacity:.4;font-size:13px;letter-spacing:.15em;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="container">
    <h1>Votre vidéo</h1>
    <p>Souvenir capturé avec PhotoBooth Pro</p>
    <video src="/video/${token}" controls playsinline preload="metadata"></video>
    <a class="btn" href="/download/${token}" download>📥 Télécharger</a>
    <p class="meta">Lien valable 24 heures</p>
  </div>
</body>
</html>`;
  }

  private downloadPage(token: string) {
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Votre photo</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0a0e1f 0%,#1f2a55 100%);color:#faf6ef;min-height:100vh}
    .container{max-width:520px;margin:0 auto;padding:32px 20px;text-align:center}
    h1{font-family:"Times New Roman",Georgia,serif;font-style:italic;font-weight:400;font-size:42px;margin:24px 0 8px;background:linear-gradient(135deg,#e8c79a,#d4a574);-webkit-background-clip:text;background-clip:text;color:transparent}
    p{opacity:.7;margin:0 0 32px}
    .photo{width:100%;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);margin-bottom:24px;background:#000}
    .btn{display:inline-flex;align-items:center;gap:10px;padding:18px 32px;border-radius:999px;background:linear-gradient(135deg,#ff8e72,#e26b4f);color:#fff;text-decoration:none;font-weight:600;letter-spacing:.5px;box-shadow:0 20px 60px -10px rgba(255,142,114,.5);transition:transform .2s}
    .btn:hover{transform:translateY(-2px)}
    .meta{margin-top:24px;opacity:.4;font-size:13px;letter-spacing:.15em;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="container">
    <h1>Votre photo</h1>
    <p>Souvenir capturé avec PhotoBooth Pro</p>
    <img class="photo" src="/img/${token}" alt="Photo" />
    <a class="btn" href="/download/${token}" download>📥 Télécharger</a>
    <p class="meta">Lien valable 24 heures</p>
  </div>
</body>
</html>`;
  }

  private notFoundPage() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Lien expiré</title><style>body{font-family:sans-serif;background:#0a0e1f;color:#faf6ef;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}</style></head><body><div><h1>Lien expiré ou introuvable</h1><p>Cette photo n'est plus disponible.</p></div></body></html>`;
  }
}

export const shareServer = new ShareServer();

function isVideoFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  return ext === '.webm' || ext === '.mp4' || ext === '.mov' || ext === '.mkv';
}

function mimeFromPath(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  switch (ext) {
    case '.webm':
      return 'video/webm';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.mkv':
      return 'video/x-matroska';
    default:
      return 'application/octet-stream';
  }
}
