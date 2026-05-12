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

let liveviewInterval: ReturnType<typeof setInterval> | null = null;
let liveviewFrameCount = 0;
let frameSubscriber: ((frame: string) => void) | null = null;

/**
 * Démarre le LiveView ET lance le push des frames vers le subscriber (renderer).
 * Le push est ~10 fps. On évite le pull renderer→main IPC qui satisaturait
 * les headers HTTP du dev server Vite (erreurs 431).
 */
export function canonStartLiveView(subscriber: (frame: string) => void): void {
  if (!camera) throw new Error('Camera not connected');
  if (!camera.isLiveViewActive()) {
    camera.startLiveView();
    logCanon('LiveView started');
  }
  frameSubscriber = subscriber;
  liveviewFrameCount = 0;

  if (liveviewInterval) clearInterval(liveviewInterval);
  liveviewInterval = setInterval(() => {
    if (!camera || !camera.isLiveViewActive() || !frameSubscriber) return;
    try {
      const dataUrl = camera.downloadLiveViewImage();
      if (!dataUrl) return;
      liveviewFrameCount++;
      if (liveviewFrameCount % 60 === 0) {
        logCanon(`LiveView frames delivered: ${liveviewFrameCount}`);
      }
      frameSubscriber(dataUrl);
    } catch (e) {
      if (liveviewFrameCount === 0) logCanon('LiveView frame error:', e);
    }
  }, 100);
}

export function canonStopLiveView(): void {
  if (liveviewInterval) {
    clearInterval(liveviewInterval);
    liveviewInterval = null;
  }
  frameSubscriber = null;
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

/**
 * Constantes EDSDK pour le shutter manuel (bypass AF).
 * Source : Camera.Command.PressShutterButton + Camera.PressShutterButton.*
 */
const SHUTTER_CMD = 4;
const SHUTTER_HALFWAY_NO_AF = 65537;
const SHUTTER_COMPLETELY_NO_AF = 65539;
const SHUTTER_OFF = 0;

/**
 * Tente la capture avec AutoFocus standard. Si AF_NG (focus loupé), retry
 * avec un délai. En dernier ressort, déclenche en mode non-AF (photo nette
 * uniquement si la cam a déjà fait le focus pendant le LiveView).
 *
 * @param outputDir dossier où downloadToPath sauvegardera le JPG natif
 */
export async function canonCapture(outputDir: string): Promise<string> {
  // Tentative 1 + 2 : takePicture avec AF normal
  const maxAFRetries = 2;
  for (let i = 0; i < maxAFRetries; i++) {
    try {
      return await singleCapture(outputDir, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isAFError = msg.includes('AF_NG') || msg.includes('AUTOFOCUS_FAILED');
      if (isAFError && i < maxAFRetries - 1) {
        logCanon(`AF failed (try ${i + 1}/${maxAFRetries}), retry in 500ms…`);
        await sleep(500);
        continue;
      }
      if (isAFError) {
        logCanon('AF still failing — falling back to shutter without AF');
        break;
      }
      throw e;
    }
  }
  // Tentative 3 : shutter manuel sans AF (la cam a normalement déjà focus en LiveView)
  return singleCapture(outputDir, true);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function singleCapture(outputDir: string, bypassAF: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!camera) return reject(new Error('Camera not connected'));
    if (captureResolver) return reject(new Error('Capture déjà en cours'));
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
      const rej = captureRejecter;
      captureResolver = null;
      captureRejecter = null;
      captureTargetDir = null;
      rej?.(new Error('Capture timeout (15s)'));
    }, 15_000);

    try {
      if (bypassAF) {
        // Press halfway no-AF (verrouille expo, pas d'AF)
        camera.sendCommand(SHUTTER_CMD, SHUTTER_HALFWAY_NO_AF);
        // Press completely no-AF (déclenche)
        camera.sendCommand(SHUTTER_CMD, SHUTTER_COMPLETELY_NO_AF);
        // Release
        camera.sendCommand(SHUTTER_CMD, SHUTTER_OFF);
        logCanon('Shutter triggered (no AF)');
      } else {
        camera.takePicture();
        logCanon('Capture triggered (with AF)');
      }
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
