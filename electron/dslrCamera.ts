import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { app, net } from 'electron';
import path from 'node:path';

/**
 * Pilote la Canon EOS R-series (et autres DSLR PTP) via digiCamControl.
 *
 * digiCamControl est un outil Windows gratuit (https://digicamcontrol.com) qui
 * expose la caméra en PTP/MTP au lieu du mode webcam UVC bridé. Ça permet de
 * capturer en pleine résolution capteur (24-32 MP sur EOS R-series) au lieu
 * des 1920×1080 max du mode webcam.
 *
 * Architecture :
 * - On lance `CameraControl.exe` (GUI minimisé) qui démarre un serveur HTTP
 *   local sur le port 5513 avec endpoints REST pour piloter la caméra.
 * - Pour le LiveView : GET http://localhost:5513/liveview.jpg renvoie le
 *   dernier frame JPEG (polling toutes les ~100ms côté renderer).
 * - Pour la capture : on utilise `CameraControlCmd.exe /capture /filename`
 *   qui copie le JPG haute résolution directement dans notre dossier photos.
 *
 * Prérequis utilisateur :
 * - Installer digiCamControl depuis https://digicamcontrol.com (gratuit).
 * - Désactiver Canon EOS Webcam Utility (ne peut pas coexister avec PTP).
 * - Brancher la Canon en USB, allumée, mode photo (pas vidéo).
 */

const DIGICAM_DEFAULT_PATHS = [
  'C:\\Program Files (x86)\\digiCamControl',
  'C:\\Program Files\\digiCamControl',
];

const WEBSERVER_PORT = 5513;
// IMPORTANT : utiliser 127.0.0.1 et PAS 'localhost'. Node.js sous Windows résout
// 'localhost' tantôt en IPv4 (127.0.0.1), tantôt en IPv6 (::1) selon la config
// DNS. digiCamControl bind seulement sur IPv4 0.0.0.0 → 'localhost' → ::1
// donne ECONNREFUSED. 127.0.0.1 force la bonne pile.
const WEBSERVER_BASE = `http://127.0.0.1:${WEBSERVER_PORT}`;

interface DigiCamPaths {
  installDir: string;
  guiExe: string;
  cmdExe: string;
}

function logDslr(...args: unknown[]) {
  console.log('[DSLR]', ...args);
}

/**
 * Localise digiCamControl. Retourne null si pas installé.
 * Cherche dans les chemins standards puis dans un override utilisateur.
 */
export async function findDigiCamControl(customPath?: string): Promise<DigiCamPaths | null> {
  const candidates = customPath ? [customPath, ...DIGICAM_DEFAULT_PATHS] : DIGICAM_DEFAULT_PATHS;
  for (const dir of candidates) {
    const guiExe = path.join(dir, 'CameraControl.exe');
    const cmdExe = path.join(dir, 'CameraControlCmd.exe');
    try {
      await fs.access(guiExe);
      await fs.access(cmdExe);
      return { installDir: dir, guiExe, cmdExe };
    } catch {
      // try next
    }
  }
  return null;
}

let guiProcess: ChildProcess | null = null;
let cachedPaths: DigiCamPaths | null = null;
// Mutex pour éviter les démarrages concurrents (test admin + écran capture
// peuvent appeler dslrStart en parallèle).
let startInFlight: Promise<{ ok: boolean; reason?: string }> | null = null;

const SETTINGS_FILE_CANDIDATES = [
  'C:\\ProgramData\\digiCamControl\\settings.json',
  path.join(process.env.LOCALAPPDATA ?? '', 'digiCamControl', 'settings.json'),
  path.join(process.env.APPDATA ?? '', 'digiCamControl', 'settings.json'),
];

async function findSettingsFile(): Promise<string | null> {
  for (const f of SETTINGS_FILE_CANDIDATES) {
    try {
      await fs.access(f);
      return f;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Active `UseWebserver: true` dans settings.json si nécessaire.
 * digiCamControl doit être fermé sinon il overwrite à son exit.
 * Retourne true si une modif a été faite, false si déjà activé ou pas de fichier.
 */
async function ensureWebserverEnabled(): Promise<boolean> {
  const settingsPath = await findSettingsFile();
  if (!settingsPath) {
    logDslr('settings.json introuvable — webserver doit être activé manuellement');
    return false;
  }
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const data = JSON.parse(raw) as { UseWebserver?: boolean; WebserverPort?: number };
    if (data.UseWebserver === true && data.WebserverPort === WEBSERVER_PORT) {
      logDslr('Webserver déjà activé dans settings.json');
      return false;
    }
    data.UseWebserver = true;
    data.WebserverPort = WEBSERVER_PORT;
    await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf8');
    logDslr('Webserver activé dans', settingsPath);
    return true;
  } catch (e) {
    logDslr('Échec modification settings.json :', e);
    return false;
  }
}

/**
 * Tue toute instance existante de CameraControl.exe via taskkill.
 * Indispensable AVANT de modifier settings.json (sinon overwrite à l'exit).
 */
async function killExistingDigiCam(): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn('taskkill', ['/F', '/IM', 'CameraControl.exe', '/T'], {
      windowsHide: true,
    });
    let killed = false;
    child.on('close', () => {
      if (!killed) {
        killed = true;
        resolve();
      }
    });
    child.on('error', () => {
      if (!killed) {
        killed = true;
        resolve();
      }
    });
  });
  // Petit délai pour laisser le process libérer ses handles (port, fichiers)
  await sleep(500);
}

/**
 * Déplace toutes les fenêtres de CameraControl.exe hors écran via Win32 API.
 *
 * Pourquoi : digiCamControl n'alimente `/liveview.jpg` QUE quand sa fenêtre
 * Live View est techniquement "visible" (pas minimisée). Si on minimise, le
 * buffer arrête. Solution : on déplace les fenêtres à des coordonnées hors
 * écran (par ex. -32000, -32000) — elles restent visibles selon Windows mais
 * invisibles pour l'utilisateur. Le buffer continue de se remplir.
 */
export async function hideDigiCamWindows(): Promise<void> {
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
      }
"@
    $procs = Get-Process -Name CameraControl -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }
    if (-not $procs) { exit 0 }
    [Win32+EnumWindowsProc]$callback = {
      param($hWnd, $lParam)
      $procId = 0
      [Win32]::GetWindowThreadProcessId($hWnd, [ref]$procId) | Out-Null
      if ($procs -contains $procId -and [Win32]::IsWindowVisible($hWnd)) {
        # SWP_NOSIZE=1, SWP_NOZORDER=4, SWP_NOACTIVATE=10
        [Win32]::SetWindowPos($hWnd, [IntPtr]::Zero, -32000, -32000, 0, 0, 0x15) | Out-Null
      }
      return $true
    }
    [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
  `;
  await new Promise<void>((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { windowsHide: true },
    );
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}

/**
 * Démarre CameraControl.exe en arrière-plan + active le webserver REST.
 * Idempotent : si webserver déjà reachable, ne fait rien.
 * Mutex : 2 appels parallèles partagent la même promesse (pas de double spawn).
 */
export function dslrStart(customPath?: string): Promise<{ ok: boolean; reason?: string }> {
  if (startInFlight) {
    logDslr('Start déjà en cours — partage la promesse');
    return startInFlight;
  }
  startInFlight = doStart(customPath).finally(() => {
    startInFlight = null;
  });
  return startInFlight;
}

async function doStart(customPath?: string): Promise<{ ok: boolean; reason?: string }> {
  // Cas 1 : webserver déjà reachable
  if (await isWebserverReachable()) {
    logDslr('Webserver déjà actif — pas besoin de relancer');
    return { ok: true };
  }

  // Cas 2 : on doit démarrer (et potentiellement activer le webserver)
  const paths = await findDigiCamControl(customPath);
  if (!paths) {
    return {
      ok: false,
      reason:
        "digiCamControl introuvable. Installe-le depuis https://digicamcontrol.com (gratuit).",
    };
  }
  cachedPaths = paths;
  logDslr('Found digiCamControl at', paths.installDir);

  // Tue toute instance pour pouvoir modifier le settings.json proprement
  await killExistingDigiCam();
  // Le kill libère le port immédiatement, mais le driver USB Canon prend
  // 2-3 secondes pour libérer les handles. Sans ce délai, la nouvelle
  // instance crash avec exit code 4294967295 (-1).
  await sleep(2000);

  const wasEnabled = await ensureWebserverEnabled();
  if (wasEnabled) logDslr('settings.json modifié — webserver activé pour le prochain démarrage');

  // Lance le GUI (détaché pour qu'il survive si l'app Electron crash)
  guiProcess = spawn(paths.guiExe, [], {
    detached: true,
    windowsHide: false,
    cwd: paths.installDir,
    stdio: 'ignore',
  });
  guiProcess.unref();
  guiProcess.on('exit', (code) => {
    logDslr('GUI process exited with code', code);
    guiProcess = null;
  });

  // Attend que le webserver soit joignable. 30s parce que le premier démarrage
  // post-config est lent (chargement Canon SDK + connexion caméra USB).
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (await isWebserverReachable()) {
      logDslr('Webserver ready in', Date.now() - start, 'ms');
      return { ok: true };
    }
    await sleep(500);
  }
  return {
    ok: false,
    reason:
      "digiCamControl s'est lancé mais le webserver met du temps à répondre. " +
      'Attends quelques secondes que la caméra finisse son init puis re-clique "Tester". ' +
      'Si le souci persiste : vérifie que le port 5513 n\'est pas bloqué par le pare-feu Windows.',
  };
}

/**
 * Arrête CameraControl.exe (utile au shutdown ou changement de mode).
 */
export function dslrStop(): void {
  if (guiProcess && !guiProcess.killed) {
    try { guiProcess.kill(); } catch { /* ignore */ }
    guiProcess = null;
    logDslr('GUI process killed');
  }
}

/**
 * Démarre le LiveView (preview vidéo en direct depuis le capteur).
 *
 * - Force compression `Large Fine JPEG` (sinon la cam reste en RAW, illisible).
 * - Lance `LiveView_Start` (active le buffer LV sur la cam).
 * - Lance `LiveViewWnd_Show` (alimente l'endpoint `/liveview.jpg`).
 *
 * NB : la fenêtre LiveView de digiCamControl s'ouvre en avant-plan. En kiosque
 * il faut soit la minimiser, soit la masquer derrière l'app photobooth via
 * `electron.BrowserWindow.focus()` après cet appel.
 */
export async function dslrLiveViewStart(): Promise<void> {
  try {
    await httpGet(
      `${WEBSERVER_BASE}/?slc=set&param1=compressionsetting&param2=${encodeURIComponent('Large Fine JPEG')}`,
    );
    logDslr('Compression forcée à Large Fine JPEG');
  } catch (e) {
    logDslr('Échec set compression :', e);
  }
  // Active le LiveView sur la cam (buffer interne)
  try {
    const r = await httpGet(`${WEBSERVER_BASE}/?slc=do&param1=LiveView_Start`);
    logDslr('LiveView_Start :', r.trim());
  } catch (e) {
    logDslr('LiveView_Start failed:', e);
  }
  // Ouvre la fenêtre LiveView (digiCamControl écrit les frames dans /liveview.jpg
  // uniquement quand la fenêtre est active).
  try {
    await httpGet(`${WEBSERVER_BASE}/?slc=do&param1=LiveViewWnd_Show`);
    logDslr('LiveViewWnd_Show OK');
  } catch (e) {
    logDslr('LiveViewWnd_Show failed:', e);
  }
  // Laisse 500ms à digiCamControl pour matérialiser la fenêtre Live View,
  // puis on la déplace hors écran (sans la fermer, sinon le buffer s'arrête).
  await sleep(500);
  await hideDigiCamWindows();
  logDslr('Fenêtres digiCamControl déplacées hors écran');
}

/**
 * Arrête le LiveView (ferme la fenêtre + arrête le buffer cam).
 */
export async function dslrLiveViewStop(): Promise<void> {
  try {
    await httpGet(`${WEBSERVER_BASE}/?slc=do&param1=LiveViewWnd_Hide`);
  } catch { /* ignore */ }
  try {
    await httpGet(`${WEBSERVER_BASE}/?slc=do&param1=LiveView_Stop`);
  } catch { /* ignore */ }
}

let liveviewFrameCount = 0;
let liveviewFrameBytes = 0;

/**
 * Récupère le frame LiveView courant en base64 (data URL JPEG).
 */
export async function dslrLiveViewFrame(): Promise<string | null> {
  try {
    const buf = await httpGetBuffer(`${WEBSERVER_BASE}/liveview.jpg`, 2000);
    liveviewFrameCount++;
    liveviewFrameBytes += buf.length;
    // Log toutes les 30 frames (~3s à 10 fps) pour diagnostic sans spam
    if (liveviewFrameCount % 30 === 0) {
      logDslr(`LiveView frames: ${liveviewFrameCount}, avg size: ${Math.round(liveviewFrameBytes / liveviewFrameCount)} bytes`);
    }
    if (buf.length === 0) return null;
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (e) {
    if (liveviewFrameCount === 0) {
      logDslr('First liveview frame error:', e instanceof Error ? e.message : String(e));
    }
    return null;
  }
}

/**
 * Déclenche une capture pleine résolution via l'API webserver et copie le
 * JPEG résultant vers `outputPath`.
 *
 * Pipeline :
 * 1. Lit le nom du dernier fichier capturé (baseline)
 * 2. Trigger `/?slc=capture` (utilise l'instance GUI active)
 * 3. Poll `lastcaptured` jusqu'à ce qu'il change (timeout 15s)
 * 4. Construit le path = session.folder + lastcaptured
 * 5. Attend que le fichier soit complètement écrit (taille stable)
 * 6. Copie vers outputPath
 */
export async function dslrCapture(outputPath: string): Promise<string> {
  // Baseline : nom du dernier fichier avant capture
  let previousLastFile = '';
  try {
    previousLastFile = (await httpGet(`${WEBSERVER_BASE}/?slc=get&param1=lastcaptured`)).trim();
    logDslr('Capture baseline lastcaptured =', previousLastFile);
  } catch {
    // ignore — premier shoot de la session
  }

  // Trigger capture
  logDslr('Déclenchement capture…');
  const captureRes = await httpGet(`${WEBSERVER_BASE}/?slc=capture`);
  logDslr('Capture réponse :', captureRes.trim());

  // Poll lastcaptured jusqu'à changement
  const captureStart = Date.now();
  let newLastFile = '';
  while (Date.now() - captureStart < 15_000) {
    await sleep(200);
    try {
      const r = (await httpGet(`${WEBSERVER_BASE}/?slc=get&param1=lastcaptured`)).trim();
      if (r && r !== previousLastFile && !r.includes('Unknow')) {
        newLastFile = r;
        break;
      }
    } catch {
      // retry
    }
  }
  if (!newLastFile) {
    throw new Error('Capture timeout : aucun nouveau fichier détecté en 15s');
  }
  logDslr('Nouveau fichier :', newLastFile);

  // Construit le path complet
  const sessionFolder = (await httpGet(`${WEBSERVER_BASE}/?slc=get&param1=session.folder`)).trim();
  const capturedPath = path.join(sessionFolder, newLastFile);
  logDslr('Path complet :', capturedPath);

  // Attend que le fichier soit écrit complètement (taille stable sur 2 reads)
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const fileReadyStart = Date.now();
  let lastSize = -1;
  while (Date.now() - fileReadyStart < 10_000) {
    try {
      const stat = await fs.stat(capturedPath);
      if (stat.size > 0 && stat.size === lastSize) break;
      lastSize = stat.size;
    } catch {
      // file pas encore là
    }
    await sleep(200);
  }
  if (lastSize <= 0) {
    throw new Error(`Fichier capturé non trouvé : ${capturedPath}`);
  }

  // Si c'est un RAW (.cr3, .nef, etc.) : on a échoué à forcer JPEG. Error claire.
  const ext = path.extname(capturedPath).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg') {
    throw new Error(
      `digiCamControl a capturé un fichier ${ext} (pas JPEG). ` +
      `Configure la cam en "Large Fine JPEG" dans digiCamControl (panneau Compression).`,
    );
  }

  // Copie vers outputPath
  await fs.copyFile(capturedPath, outputPath);
  logDslr('Copié vers', outputPath, `(${lastSize} bytes)`);
  return outputPath;
}

/**
 * Génère un chemin de capture temporaire DSLR.
 */
export function dslrTempCapturePath(): string {
  const dir = path.join(app.getPath('temp'), 'photobooth-dslr');
  const filename = `dslr-${Date.now()}.jpg`;
  return path.join(dir, filename);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isWebserverReachable(): Promise<boolean> {
  try {
    const body = await httpGet(`${WEBSERVER_BASE}/?slc=list&param1=cameras`);
    logDslr('Webserver reachable. Cameras response:', body.trim());
    return true;
  } catch (e) {
    logDslr('Webserver not reachable yet:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * HTTP via la stack Chromium d'Electron (electron.net) au lieu de node:http.
 *
 * Pourquoi : digiCamControl émet 2 headers `Content-Length` dans ses réponses
 * (bug serveur connu). Le parser HTTP de Node refuse ces réponses avec
 * `Parse Error: Duplicate Content-Length`, et `insecureHTTPParser: true` ne
 * couvre PAS ce cas (Node le considère comme vecteur de request smuggling).
 *
 * electron.net utilise la stack réseau de Chromium qui tolère ces malformations.
 * Bonus : timeout natif, support proxy système, gestion d'IPv4/IPv6 cohérente.
 */

function httpGet(url: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url });
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error('HTTP timeout'));
    }, timeoutMs);
    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        clearTimeout(timer);
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        else resolve(body);
      });
      res.on('error', (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.end();
  });
}

function httpGetBuffer(url: string, timeoutMs = 3000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url });
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error('HTTP timeout'));
    }, timeoutMs);
    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}`));
        else resolve(Buffer.concat(chunks));
      });
      res.on('error', (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.end();
  });
}
