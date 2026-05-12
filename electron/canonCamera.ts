/**
 * Wrapper Canon EDSDK via @brick-a-brack/napi-canon-cameras.
 *
 * Pas de GUI externe : on parle directement à la caméra via l'EDSDK officiel
 * Canon. LiveView haute qualité + capture pleine résolution (24 MP sur R6m2).
 *
 * API exposée :
 * - initCanonSDK()       : boucle d'évènements globale (à appeler 1× au boot)
 * - shutdownCanonSDK()   : stop la boucle (au shutdown app)
 * - canonDetect()        : retourne la 1re cam détectée ou null
 * - canonConnect()       : connect + config Large Fine JPEG + save to PC
 * - canonDisconnect()    : libère la cam
 * - canonStartLiveView() / canonStopLiveView()
 * - canonLiveViewFrame() : dataURL JPEG du frame courant ou null
 * - canonCapture(dir)    : prend une photo, retourne le chemin du JPEG sauvegardé
 */
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

type CameraEvent = {
  file?: { name: string; downloadToPath: (dir: string) => string };
  property?: { identifier: number };
};
type EventCallback = (eventName: string, event: CameraEvent) => void;
interface CameraInstance {
  description: string;
  portName: string;
  connect(shouldKeepAlive?: boolean): void;
  disconnect(): void;
  setEventHandler(listener: EventCallback): void;
  setProperty(id: string | number, value: unknown): void;
  setProperties(props: Record<string | number, unknown>): void;
  takePicture(): void;
  startLiveView(): void;
  stopLiveView(): void;
  isLiveViewActive(): boolean;
  downloadLiveViewImage(): string;
}
interface CameraBrowserInstance {
  getCamera(index?: number): CameraInstance | null;
  setEventHandler(listener: EventCallback): void;
  triggerEvents(): void;
}
interface CanonModule {
  cameraBrowser: CameraBrowserInstance;
  CameraProperty: { ID: Record<string, number> };
  ImageQuality: { ID: Record<string, number> };
  Option: { SaveTo: Record<string, number> };
  watchCameras: (timeout?: number) => () => void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Canon: CanonModule = require('@brick-a-brack/napi-canon-cameras');
const { cameraBrowser, CameraProperty, ImageQuality, Option, watchCameras } = Canon;

let stopWatching: (() => void) | null = null;
let camera: CameraInstance | null = null;

// Resolver pour la promise de capture en cours
let captureResolver: ((path: string) => void) | null = null;
let captureRejecter: ((err: Error) => void) | null = null;
let captureTargetDir: string | null = null;

function logCanon(...args: unknown[]) {
  console.log('[CANON]', ...args);
}

/**
 * Initialise le SDK et démarre la boucle d'évènements globale.
 * À appeler 1× au boot de l'app. Idempotent.
 */
export function initCanonSDK(): void {
  if (stopWatching) return;
  stopWatching = watchCameras(500);
  logCanon('SDK watcher started');

  // Handler global : capture finie → fichier prêt à être téléchargé
  cameraBrowser.setEventHandler((eventName, event) => {
    if (eventName === 'DownloadRequest' && event.file && captureResolver && captureTargetDir) {
      try {
        const localPath = event.file.downloadToPath(captureTargetDir);
        logCanon('Download finished:', localPath);
        captureResolver(localPath);
      } catch (e) {
        captureRejecter?.(e instanceof Error ? e : new Error(String(e)));
      } finally {
        captureResolver = null;
        captureRejecter = null;
        captureTargetDir = null;
      }
    }
  });
}

export function shutdownCanonSDK(): void {
  try {
    if (camera) {
      try { camera.disconnect(); } catch { /* ignore */ }
      camera = null;
    }
    stopWatching?.();
    stopWatching = null;
    logCanon('SDK shut down');
  } catch (e) {
    logCanon('Shutdown error:', e);
  }
}

/**
 * Détecte la 1re caméra Canon connectée en USB.
 */
export function canonDetect(): { description: string; portName: string } | null {
  const cam = cameraBrowser.getCamera();
  if (!cam) return null;
  return { description: cam.description, portName: cam.portName };
}

/**
 * Connecte la caméra + force JPEG Large Fine + sauvegarde sur le PC.
 */
export async function canonConnect(): Promise<{ ok: boolean; reason?: string }> {
  if (camera) {
    logCanon('Already connected');
    return { ok: true };
  }
  const cam = cameraBrowser.getCamera();
  if (!cam) {
    return { ok: false, reason: 'Aucune caméra Canon détectée. Vérifie le câble USB et que la cam est allumée.' };
  }
  try {
    cam.connect(true); // keep-alive
    logCanon('Connected to', cam.description);
    // Force qualité max JPEG (le SDK ne sait pas envoyer le RAW directement)
    cam.setProperties({
      [CameraProperty.ID.SaveTo]: Option.SaveTo.Host,
      [CameraProperty.ID.ImageQuality]: ImageQuality.ID.LargeJPEGFine,
    });
    logCanon('Properties set: SaveTo=Host, ImageQuality=LargeJPEGFine');
    camera = cam;
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logCanon('Connect failed:', msg);
    return { ok: false, reason: `Échec connexion : ${msg}` };
  }
}

export function canonDisconnect(): void {
  if (!camera) return;
  try {
    if (camera.isLiveViewActive()) camera.stopLiveView();
    camera.disconnect();
  } catch (e) {
    logCanon('Disconnect error:', e);
  }
  camera = null;
}

export function canonStartLiveView(): void {
  if (!camera) throw new Error('Camera not connected');
  if (!camera.isLiveViewActive()) {
    camera.startLiveView();
    logCanon('LiveView started');
  }
}

export function canonStopLiveView(): void {
  if (!camera) return;
  try {
    if (camera.isLiveViewActive()) {
      camera.stopLiveView();
      logCanon('LiveView stopped');
    }
  } catch (e) {
    logCanon('LiveView stop error:', e);
  }
}

let liveviewFrameCount = 0;

/**
 * Récupère le frame LiveView courant sous forme de dataURL JPEG (déjà encodé).
 */
export function canonLiveViewFrame(): string | null {
  if (!camera || !camera.isLiveViewActive()) return null;
  try {
    const dataUrl = camera.downloadLiveViewImage();
    liveviewFrameCount++;
    if (liveviewFrameCount % 60 === 0) {
      logCanon(`LiveView frames delivered: ${liveviewFrameCount}`);
    }
    return dataUrl || null;
  } catch (e) {
    if (liveviewFrameCount === 0) logCanon('LiveView frame error:', e);
    return null;
  }
}

/**
 * Capture une photo pleine résolution. Le fichier est sauvegardé dans `outputDir`
 * via `downloadToPath`. Le nom est celui que la cam choisit (DSC_XXXX.JPG).
 *
 * Timeout 15s — au-delà on rejette (cam déconnectée, erreur AF, etc.).
 */
export function canonCapture(outputDir: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!camera) {
      reject(new Error('Camera not connected'));
      return;
    }
    if (captureResolver) {
      reject(new Error('Capture déjà en cours'));
      return;
    }
    // Assure que le dossier existe
    fs.mkdir(outputDir, { recursive: true }).catch(() => { /* ignore */ });

    captureTargetDir = outputDir;
    captureResolver = (p) => {
      clearTimeout(timer);
      resolve(p);
    };
    captureRejecter = (e) => {
      clearTimeout(timer);
      reject(e);
    };

    const timer = setTimeout(() => {
      captureResolver = null;
      const rej = captureRejecter;
      captureRejecter = null;
      captureTargetDir = null;
      rej?.(new Error('Capture timeout (15s)'));
    }, 15_000);

    try {
      camera.takePicture();
      logCanon('Capture triggered');
    } catch (e) {
      clearTimeout(timer);
      captureResolver = null;
      captureRejecter = null;
      captureTargetDir = null;
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Path temporaire pour sauvegarder les captures DSLR. */
export function canonTempCaptureDir(): string {
  return path.join(app.getPath('temp'), 'photobooth-canon');
}
