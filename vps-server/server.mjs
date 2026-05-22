import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './storage');
const PHOTOBOOTH_API_KEY = String(process.env.PHOTOBOOTH_API_KEY || '').trim();
const PUBLIC_BASE_URL = normalizeBaseUrl(String(process.env.PUBLIC_BASE_URL || ''));
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);

await fsPromises.mkdir(STORAGE_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
      if (!isAuthorized(req)) {
        return json(res, 401, { ok: false, error: 'Unauthorized' });
      }
      return json(res, 200, {
        ok: true,
        server: getPublicBaseUrl(req),
        storageDir: STORAGE_DIR,
      });
    }

    if (req.method === 'POST' && pathname === '/api/upload') {
      if (!isAuthorized(req)) {
        return json(res, 401, { ok: false, error: 'Unauthorized' });
      }
      return handleUpload(req, res);
    }

    if (req.method === 'GET' && pathname.startsWith('/share/')) {
      return handleSharePage(req, res, pathname);
    }

    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      return handleMedia(req, res, pathname, false);
    }

    if (req.method === 'GET' && pathname.startsWith('/download/')) {
      return handleMedia(req, res, pathname.replace('/download/', '/media/'), true);
    }

    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    console.error('[photobooth-vps] unhandled error', error);
    return json(res, 500, { ok: false, error: 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[photobooth-vps] listening on http://${HOST}:${PORT}`);
  console.log(`[photobooth-vps] public base ${PUBLIC_BASE_URL || '(derived from request headers)'}`);
  console.log(`[photobooth-vps] storage ${STORAGE_DIR}`);
});

async function handleUpload(req, res) {
  const kind = req.headers['x-photobooth-kind'];
  if (kind !== 'photo' && kind !== 'video') {
    return json(res, 400, { ok: false, error: 'Invalid media kind' });
  }

  const eventName = String(req.headers['x-photobooth-event-name'] || 'event');
  const eventSlug = slugify(eventName);
  const originalFilename = sanitizeFilename(
    String(req.headers['x-photobooth-filename'] || `${kind}.bin`),
  );
  const extension = path.extname(originalFilename) || defaultExtension(kind);
  const finalFilename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension.toLowerCase()}`;
  const mediaDir = path.join(STORAGE_DIR, eventSlug, kind);
  await fsPromises.mkdir(mediaDir, { recursive: true });

  const finalPath = path.join(mediaDir, finalFilename);
  const tempPath = `${finalPath}.part`;
  const limiter = createSizeLimiter(MAX_UPLOAD_BYTES);

  try {
    await pipeline(req, limiter, fs.createWriteStream(tempPath, { flags: 'wx' }));
    await fsPromises.rename(tempPath, finalPath);
  } catch (error) {
    try {
      await fsPromises.unlink(tempPath);
    } catch {}

    if (error instanceof Error && error.message === 'LIMIT_EXCEEDED') {
      return json(res, 413, { ok: false, error: 'Upload too large' });
    }

    console.error('[photobooth-vps] upload failed', error);
    return json(res, 500, { ok: false, error: 'Upload failed' });
  }

  let servedFilename = finalFilename;
  let servedPath = finalPath;

  if (kind === 'video' && extension.toLowerCase() === '.webm') {
    const mp4Filename = finalFilename.replace(/\.webm$/i, '.mp4');
    const mp4Path = path.join(mediaDir, mp4Filename);
    try {
      await transcodeWebmToMp4(finalPath, mp4Path);
      await fsPromises.unlink(finalPath).catch(() => {});
      servedFilename = mp4Filename;
      servedPath = mp4Path;
    } catch (error) {
      console.error('[photobooth-vps] transcode failed, serving webm', error);
    }
  }

  const publicBaseUrl = getPublicBaseUrl(req);
  const sharePath = `/share/${eventSlug}/${kind}/${encodeURIComponent(servedFilename)}`;
  const mediaPath = `/media/${eventSlug}/${kind}/${encodeURIComponent(servedFilename)}`;

  return json(res, 201, {
    ok: true,
    shareUrl: `${publicBaseUrl}${sharePath}`,
    mediaUrl: `${publicBaseUrl}${mediaPath}`,
    eventSlug,
    kind,
    filename: servedFilename,
    size: limiter.bytesRead,
  });
}

function transcodeWebmToMp4(input, output) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(new Error('ffmpeg binary not found'));
    }
    const args = [
      '-y',
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      output,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4096) stderr = stderr.slice(-4096);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

function handleSharePage(req, res, pathname) {
  const match = parseMediaRoute(pathname, '/share/');
  if (!match) {
    return json(res, 404, { ok: false, error: 'Not found' });
  }

  const { eventSlug, kind, filename, absolutePath } = match;
  if (!fs.existsSync(absolutePath)) {
    return notFoundPage(res);
  }

  const publicBaseUrl = getPublicBaseUrl(req);
  const mediaUrl = `${publicBaseUrl}/media/${eventSlug}/${kind}/${encodeURIComponent(filename)}`;
  const downloadUrl = `${publicBaseUrl}/download/${eventSlug}/${kind}/${encodeURIComponent(filename)}`;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(kind === 'video' ? videoPage(mediaUrl, downloadUrl) : photoPage(mediaUrl, downloadUrl));
}

function handleMedia(req, res, pathname, download) {
  const match = parseMediaRoute(pathname, '/media/');
  if (!match) {
    return json(res, 404, { ok: false, error: 'Not found' });
  }

  const { absolutePath, filename } = match;
  if (!fs.existsSync(absolutePath)) {
    return notFoundPage(res);
  }

  const stat = fs.statSync(absolutePath);
  const total = stat.size;
  const mime = mimeFromPath(filename);
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }

  if (!isVideoFile(filename)) {
    res.writeHead(200, {
      ...headers,
      'Content-Length': total,
    });
    fs.createReadStream(absolutePath).pipe(res);
    return;
  }

  const range = req.headers.range;
  if (range) {
    const matchRange = /bytes=(\d+)-(\d*)/.exec(range);
    const start = matchRange ? Number(matchRange[1]) : 0;
    const end = matchRange && matchRange[2] ? Number(matchRange[2]) : total - 1;

    if (start >= total || end >= total || end < start) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` });
      res.end();
      return;
    }

    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': end - start + 1,
    });
    fs.createReadStream(absolutePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    ...headers,
    'Content-Length': total,
  });
  fs.createReadStream(absolutePath).pipe(res);
}

function parseMediaRoute(pathname, prefix) {
  const relative = pathname.slice(prefix.length);
  const segments = relative.split('/').filter(Boolean);
  if (segments.length !== 3) return null;

  const [eventSlug, kind, encodedFilename] = segments;
  const filename = decodeURIComponent(encodedFilename);
  if (!isSafeSegment(eventSlug) || !isSafeSegment(kind) || !isSafeSegment(filename)) {
    return null;
  }

  const absolutePath = path.join(STORAGE_DIR, eventSlug, kind, filename);
  if (!absolutePath.startsWith(STORAGE_DIR)) {
    return null;
  }

  return { eventSlug, kind, filename, absolutePath };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function notFoundPage(res) {
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end('<!doctype html><html><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>Lien introuvable</h1><p>Le mÃ©dia demandÃ© est introuvable.</p></body></html>');
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function getPublicBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const proto = String(req.headers['x-forwarded-proto'] || 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`);
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function isAuthorized(req) {
  if (!PHOTOBOOTH_API_KEY) return true;
  return String(req.headers['x-api-key'] || '') === PHOTOBOOTH_API_KEY;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'event';
}

function sanitizeFilename(value) {
  const basename = path.basename(value);
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload.bin';
}

function defaultExtension(kind) {
  return kind === 'video' ? '.webm' : '.jpg';
}

function createSizeLimiter(maxBytes) {
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      limiter.bytesRead += chunk.length;
      if (limiter.bytesRead > maxBytes) {
        callback(new Error('LIMIT_EXCEEDED'));
        return;
      }
      callback(null, chunk);
    },
  });
  limiter.bytesRead = 0;
  return limiter;
}

function isSafeSegment(value) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function isVideoFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.webm' || ext === '.mp4' || ext === '.mov' || ext === '.mkv';
}

function mimeFromPath(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
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

function videoPage(mediaUrl, downloadUrl) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Votre video</title>
  <style>
    body{margin:0;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0a0e1f 0%,#1f2a55 100%);color:#faf6ef;text-align:center}
    .wrap{max-width:720px;margin:0 auto}
    h1{font-size:42px;font-family:Georgia,serif;font-style:italic;font-weight:400}
    p{opacity:.75;line-height:1.6}
    video{width:100%;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);background:#000;margin:24px 0}
    a{display:inline-block;padding:16px 28px;border-radius:999px;background:#ff8e72;color:#fff;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Votre video</h1>
    <p>Souvenir capture avec PhotoBooth Pro</p>
    <video src="${escapeHtml(mediaUrl)}" controls playsinline preload="metadata"></video>
    <a href="${escapeHtml(downloadUrl)}">Telecharger</a>
  </div>
</body>
</html>`;
}

function photoPage(mediaUrl, downloadUrl) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Votre photo</title>
  <style>
    body{margin:0;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0a0e1f 0%,#1f2a55 100%);color:#faf6ef;text-align:center}
    .wrap{max-width:520px;margin:0 auto}
    h1{font-size:42px;font-family:Georgia,serif;font-style:italic;font-weight:400}
    p{opacity:.75;line-height:1.6}
    img{width:100%;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);background:#000;margin:24px 0}
    a{display:inline-block;padding:16px 28px;border-radius:999px;background:#ff8e72;color:#fff;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Votre photo</h1>
    <p>Souvenir capture avec PhotoBooth Pro</p>
    <img src="${escapeHtml(mediaUrl)}" alt="Photo" />
    <a href="${escapeHtml(downloadUrl)}">Telecharger</a>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}
