/**
 * Process utilitaire qui pilote l'appareil Canon via EDSDK (photos en USB).
 *
 * Séparé du process principal : les appels EDSDK sont bloquants et ne doivent
 * pas figer l'app. Lancé par electron/canon/service.ts (utilityProcess.fork).
 */
import fs from 'node:fs';
import path from 'node:path';
import koffi from 'koffi';
import {
  CameraCommand,
  EdsError,
  Err,
  EvfOutputDevice,
  ImageQualityLargeFineJpeg,
  ObjectEvent,
  ObjectEventHandler,
  PropID,
  RecordStart,
  RecordStop,
  SaveTo,
  ShutterButton,
  StateEvent,
  StateEventHandler,
  StatusCommand,
  errorName,
  loadEdsdk,
  type Edsdk,
  type Ref,
} from './edsdk';
import type {
  CanonCaptureResult,
  CanonMovieResult,
  CanonRequest,
  CanonStatus,
  CanonWorkerMessage,
} from './protocol';

const port = process.parentPort;
const post = (msg: CanonWorkerMessage) => port.postMessage(msg);
const log = (line: string) => post({ type: 'log', line });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class UserError extends Error {}

let sdk: Edsdk | null = null;
let sdkError: string | undefined;
let camera: Ref = null;
let model: string | undefined;
let capturing = false;
let liveviewOn = false;
let liveviewTimer: ReturnType<typeof setTimeout> | null = null;
let liveviewErrors = 0;
let frameCount = 0;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let objectHandler: unknown = null;
let stateHandler: unknown = null;
const transferQueue: Ref[] = [];
// Vidéo : l'appareil enregistre sur sa carte, on rapatrie le fichier ensuite.
const createdQueue: Ref[] = [];
let movieMode = false;
let recording = false;

function ensureSdk(): Edsdk {
  if (sdk) return sdk;
  const dir = process.env.CANON_EDSDK_DIR ?? '';
  try {
    const s = loadEdsdk(dir);
    s.initialize();
    objectHandler = koffi.register((event: number, ref: Ref) => {
      if (event === ObjectEvent.DirItemRequestTransfer) transferQueue.push(ref);
      else if (event === ObjectEvent.DirItemCreated) createdQueue.push(ref);
      else s.release(ref);
      return Err.OK;
    }, koffi.pointer(ObjectEventHandler));
    stateHandler = koffi.register((event: number) => {
      if (event === StateEvent.Shutdown) {
        log('Appareil déconnecté (câble débranché ou appareil éteint)');
        setImmediate(() => dropCamera(true));
      } else if (event === StateEvent.WillSoonShutDown && camera) {
        s.sendCommand(camera, CameraCommand.ExtendShutDownTimer);
      }
      return Err.OK;
    }, koffi.pointer(StateEventHandler));
    setInterval(() => s.getEvent(), 50);
    sdk = s;
    sdkError = undefined;
    log(`SDK Canon chargé depuis ${dir}`);
    return s;
  } catch (e) {
    sdkError = e instanceof Error ? e.message : String(e);
    log(`Échec du chargement du SDK Canon : ${sdkError}`);
    throw new UserError(`SDK Canon indisponible : ${sdkError}`);
  }
}

function requireCamera(): { s: Edsdk; cam: Ref } {
  const s = ensureSdk();
  if (!camera) throw new UserError("Aucun appareil Canon connecté. Clique d'abord sur « Connecter ».");
  return { s, cam: camera };
}

/** Après chaque attente : l'appareil a pu être débranché (et son ref libéré) entre-temps. */
function assertStillConnected(cam: Ref) {
  if (camera !== cam) throw new UserError("L'appareil a été déconnecté pendant la prise de vue.");
}

/** Les demandes de transfert non voulues doivent être annulées, sinon elles restent bloquées dans l'appareil. */
function cancelPendingTransfers() {
  while (transferQueue.length) sdk?.cancelTransfer(transferQueue.shift());
}

/** L'appareil répond DEVICE_BUSY pendant quelques centaines de ms après certaines opérations : on réessaie. */
async function retryBusy(label: string, call: () => number, cam: Ref): Promise<number> {
  let code = call();
  for (let i = 0; i < 15 && code === Err.DEVICE_BUSY; i++) {
    await sleep(200);
    sdk?.getEvent();
    assertStillConnected(cam);
    code = call();
  }
  if (code === Err.DEVICE_BUSY) log(`${label} : appareil toujours occupé après 3 s`);
  return code;
}

function status(): CanonStatus {
  let s: Edsdk;
  try {
    s = ensureSdk();
  } catch {
    return { sdkLoaded: false, sdkError, cameras: [], connected: false, liveview: false };
  }
  let cameras: string[] = [];
  if (camera) {
    cameras = [model ?? 'Canon'];
  } else {
    for (const c of s.listCameras()) {
      cameras.push(c.description);
      s.release(c.ref);
    }
  }
  const battery = camera ? s.tryGetUInt32(camera, PropID.BatteryLevel).value : undefined;
  return { sdkLoaded: true, cameras, connected: !!camera, model, battery, liveview: liveviewOn };
}

/** Photos envoyées directement au PC, en JPEG grande taille / qualité fine. */
async function prepareForPhotos(s: Edsdk, cam: Ref) {
  const saveTo = await retryBusy('SaveTo', () => s.setUInt32Raw(cam, PropID.SaveTo, SaveTo.Host), cam);
  if (saveTo !== Err.OK) throw new EdsError('SaveTo=Host', saveTo);
  const capacity = await retryBusy('EdsSetCapacity', () => s.setHostCapacity(cam), cam);
  if (capacity !== Err.OK) throw new EdsError('EdsSetCapacity', capacity);
  const quality = await retryBusy('ImageQuality', () => s.setUInt32Raw(cam, PropID.ImageQuality, ImageQualityLargeFineJpeg), cam);
  if (quality !== Err.OK) log(`Qualité JPEG L fine non appliquée (${errorName(quality)}), réglage de l'appareil conservé`);
}

async function connect(): Promise<CanonStatus> {
  const s = ensureSdk();
  if (camera) return status();
  const cams = s.listCameras();
  if (cams.length === 0) {
    throw new UserError(
      "Aucun appareil Canon détecté. Vérifie le câble USB et que l'appareil est allumé, puis ferme EOS Utility et EOS Webcam Utility.",
    );
  }
  cams.slice(1).forEach((c) => s.release(c.ref));
  const { ref, description } = cams[0];
  s.check('EdsSetObjectEventHandler', s.raw.EdsSetObjectEventHandler(ref, ObjectEvent.All, objectHandler, null));
  s.check('EdsSetCameraStateEventHandler', s.raw.EdsSetCameraStateEventHandler(ref, StateEvent.All, stateHandler, null));
  const open = s.raw.EdsOpenSession(ref) as number;
  if (open !== Err.OK) {
    s.release(ref);
    if (open === Err.DEVICE_BUSY) {
      throw new UserError(
        "L'appareil est déjà utilisé par un autre logiciel (EOS Utility, EOS Webcam Utility…). Ferme-le puis réessaie.",
      );
    }
    throw new EdsError('EdsOpenSession', open);
  }
  camera = ref;
  model = description;
  try {
    model = s.getString(ref, PropID.ProductName) || description;
  } catch {
    // Le nom USB suffit.
  }
  log(`Connecté à ${model}`);
  keepAlive = setInterval(() => {
    if (camera) s.sendCommand(camera, CameraCommand.ExtendShutDownTimer);
  }, 60_000);
  post({ type: 'state', connected: true, model });
  log(`Mode prise de vue à distance → ${errorName(s.sendCommand(ref, CameraCommand.SetRemoteShootingMode, 1))}`);
  try {
    await prepareForPhotos(s, ref);
  } catch (e) {
    // Refait avant chaque photo : la connexion reste utilisable.
    log(`Préparation photo : ${e instanceof Error ? e.message : String(e)}`);
  }
  return status();
}

function dropCamera(lost: boolean) {
  stopLiveviewLoop();
  liveviewOn = false;
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
  if (camera && sdk) {
    if (!lost) {
      // Ne jamais laisser l'appareil en mode vidéo (il ne prendrait plus de photos).
      if (recording) sdk.setUInt32Raw(camera, PropID.Record, RecordStop);
      if (movieMode) sdk.sendCommand(camera, CameraCommand.MovieSelectSwOFF);
      cancelPendingTransfers();
      const dev = sdk.tryGetUInt32(camera, PropID.Evf_OutputDevice).value;
      if (dev !== undefined) sdk.setUInt32Raw(camera, PropID.Evf_OutputDevice, dev & ~EvfOutputDevice.PC);
      sdk.sendCommand(camera, CameraCommand.SetRemoteShootingMode, 0);
      sdk.raw.EdsCloseSession(camera);
    }
    sdk.release(camera);
  }
  // Appareil perdu : ses demandes de transfert ne peuvent plus être annulées, juste libérées.
  while (transferQueue.length) sdk?.release(transferQueue.shift());
  while (createdQueue.length) sdk?.release(createdQueue.shift());
  movieMode = false;
  recording = false;
  const wasConnected = !!camera;
  camera = null;
  if (wasConnected) post({ type: 'state', connected: false, model });
}

function stopLiveviewLoop() {
  if (liveviewTimer) clearTimeout(liveviewTimer);
  liveviewTimer = null;
}

function liveviewTick() {
  liveviewTimer = null;
  if (!liveviewOn || !camera || !sdk) return;
  const started = Date.now();
  let delay = 0;
  if (!capturing) {
    try {
      const jpeg = sdk.downloadEvfFrame(camera);
      if (jpeg) {
        frameCount++;
        liveviewErrors = 0;
        if (frameCount === 1) log(`Première image de l'aperçu USB reçue (${jpeg.length} octets)`);
        post({ type: 'frame', data: jpeg });
      } else {
        delay = 60;
      }
    } catch (e) {
      liveviewErrors++;
      if (liveviewErrors === 1 || liveviewErrors % 100 === 0) {
        log(`Aperçu USB : ${e instanceof Error ? e.message : String(e)} (×${liveviewErrors})`);
      }
      if (e instanceof EdsError && e.code === Err.COMM_DISCONNECTED) {
        dropCamera(true);
        return;
      }
      delay = 150;
    }
  } else {
    delay = 50;
  }
  // Vise ~30 i/s : le téléchargement lui-même prend une partie des 33 ms.
  liveviewTimer = setTimeout(liveviewTick, Math.max(delay, 33 - (Date.now() - started), 1));
}

async function setLiveview(on: boolean): Promise<CanonStatus> {
  if (!on) {
    liveviewOn = false;
    stopLiveviewLoop();
    if (camera && sdk) {
      const dev = sdk.tryGetUInt32(camera, PropID.Evf_OutputDevice).value;
      if (dev !== undefined) sdk.setUInt32Raw(camera, PropID.Evf_OutputDevice, dev & ~EvfOutputDevice.PC);
    }
    return status();
  }
  const { s, cam } = requireCamera();
  s.setUInt32Raw(cam, PropID.Evf_Mode, 1);
  const dev = s.tryGetUInt32(cam, PropID.Evf_OutputDevice).value ?? 0;
  const code = await retryBusy('Evf_OutputDevice', () => s.setUInt32Raw(cam, PropID.Evf_OutputDevice, dev | EvfOutputDevice.PC), cam);
  if (code !== Err.OK) throw new EdsError('Evf_OutputDevice=PC', code);
  if (!liveviewOn) {
    liveviewOn = true;
    liveviewErrors = 0;
    log('Aperçu USB demandé');
    liveviewTimer = setTimeout(liveviewTick, 100);
  }
  return status();
}

async function waitFor<T>(take: () => T | null, timeoutMs: number): Promise<T | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    sdk?.getEvent();
    const v = take();
    if (v) return v;
    await sleep(20);
  }
  return null;
}

const isJpeg = (name: string) => /\.jpe?g$/i.test(name);

/** Appuie sur le déclencheur. Renvoie le fichier à transférer, ou null si l'appareil n'a pas déclenché. */
async function shoot(s: Edsdk, cam: Ref, nonAf: boolean, timeoutMs: number): Promise<Ref | null> {
  const half = nonAf ? ShutterButton.HalfwayNonAF : ShutterButton.Halfway;
  const full = nonAf ? ShutterButton.CompletelyNonAF : ShutterButton.Completely;
  let code = await retryBusy('Déclencheur', () => s.sendCommand(cam, CameraCommand.PressShutterButton, half), cam);
  if (code === Err.INVALID_PARAMETER || code === Err.NOT_SUPPORTED) {
    // Anciens boîtiers : commande TakePicture.
    s.sendStatusCommand(cam, StatusCommand.UILock);
    code = s.sendCommand(cam, CameraCommand.TakePicture);
    s.sendStatusCommand(cam, StatusCommand.UIUnLock);
    log(`TakePicture → ${errorName(code)}`);
  } else {
    code = await retryBusy('Déclencheur', () => s.sendCommand(cam, CameraCommand.PressShutterButton, full), cam);
    s.sendCommand(cam, CameraCommand.PressShutterButton, ShutterButton.OFF);
    log(`Déclencheur${nonAf ? ' sans AF' : ''} → ${errorName(code)}`);
  }
  if (code === Err.TAKE_PICTURE_AF_NG) return null;
  if (code !== Err.OK) throw new EdsError('PressShutterButton', code);

  // Si l'appareil envoie aussi un RAW, on garde le JPEG et on annule le reste.
  const first = await waitFor(() => transferQueue.shift() ?? null, timeoutMs);
  assertStillConnected(cam);
  if (!first) return null;
  let jpeg: Ref | null = null;
  const pending = [first];
  const deadline = Date.now() + 1500;
  while (!jpeg) {
    while (pending.length) {
      const item = pending.shift();
      if (!jpeg && isJpeg(s.directoryItemInfo(item).name)) jpeg = item;
      else s.cancelTransfer(item);
    }
    if (jpeg || Date.now() > deadline) break;
    const next = await waitFor(() => transferQueue.shift() ?? null, deadline - Date.now());
    assertStillConnected(cam);
    if (next) pending.push(next);
  }
  if (!jpeg) throw new UserError("L'appareil n'a envoyé qu'un fichier RAW : règle la qualité d'image sur JPEG.");
  return jpeg;
}

async function capture(dir: string): Promise<CanonCaptureResult> {
  const { s, cam } = requireCamera();
  if (capturing) throw new UserError('Une prise de vue est déjà en cours.');
  capturing = true;
  try {
    fs.mkdirSync(dir, { recursive: true });
    cancelPendingTransfers();
    // Après une vidéo, l'appareil peut être resté en mode vidéo : on le remet en photo.
    if (movieMode) await setMovieMode(false);
    await prepareForPhotos(s, cam);
    const t0 = Date.now();
    let afFallback = false;
    let item = await shoot(s, cam, false, 5000);
    if (!item) {
      log("Pas de photo avec l'autofocus : nouvel essai sans autofocus");
      afFallback = true;
      item = await shoot(s, cam, true, 8000);
    }
    if (!item) {
      throw new UserError(
        "L'appareil n'a pas déclenché. Vérifie qu'il est en mode photo, la batterie, et que rien ne bloque la mise au point.",
      );
    }
    const info = s.directoryItemInfo(item);
    const file = path.join(dir, `${Date.now()}_${info.name}`);
    try {
      s.downloadToFile(item, info.size, file);
      s.release(item);
    } catch (e) {
      s.cancelTransfer(item);
      throw e;
    }
    // Une photo arrivée en retard (essai avec AF puis sans AF) ne doit pas rester bloquée.
    setTimeout(() => {
      if (!capturing) cancelPendingTransfers();
    }, 3000);
    const ms = Date.now() - t0;
    log(`Photo ${info.name} : ${(info.size / 1e6).toFixed(1)} Mo en ${ms} ms`);
    return { path: file, name: info.name, bytes: info.size, ms, afFallback };
  } finally {
    capturing = false;
  }
}

const isMovie = (name: string) => /\.(mp4|mov)$/i.test(name);

/**
 * Bascule photo ↔ vidéo sans toucher à l'appareil (équivalent du levier photo/vidéo),
 * comme LumaBooth : en vidéo l'appareil enregistre sur sa carte, en photo les images
 * partent directement au PC. Toujours revenir en photo après une vidéo.
 */
async function setMovieMode(on: boolean): Promise<CanonStatus> {
  const { s, cam } = requireCamera();
  const fixedMovie = () => s.tryGetUInt32(cam, PropID.FixedMovie).value;
  const canReadMode = fixedMovie() !== undefined;
  if (on) {
    if (fixedMovie() !== 1) {
      const code = await retryBusy('Passage en mode vidéo', () => s.sendCommand(cam, CameraCommand.MovieSelectSwON), cam);
      log(`Passage en mode vidéo → ${errorName(code)}`);
      const switched = canReadMode
        ? await waitFor(() => (fixedMovie() === 1 ? true : null), 4000)
        : await sleep(1500).then(() => code === Err.OK);
      assertStillConnected(cam);
      if (!switched) {
        throw new UserError(
          `L'appareil ne passe pas en mode vidéo à distance (${errorName(code)}). Mets-le en mode vidéo à la main, ou choisis la Cam Link comme source vidéo.`,
        );
      }
    }
    movieMode = true;
    // Les vidéos s'enregistrent sur la carte de l'appareil.
    const saveTo = await retryBusy('SaveTo=Camera', () => s.setUInt32Raw(cam, PropID.SaveTo, SaveTo.Camera), cam);
    if (saveTo !== Err.OK) log(`Enregistrement sur la carte → ${errorName(saveTo)}`);
    return status();
  }
  if (recording) {
    s.setUInt32Raw(cam, PropID.Record, RecordStop);
    recording = false;
  }
  if (movieMode) {
    const code = await retryBusy('Retour en mode photo', () => s.sendCommand(cam, CameraCommand.MovieSelectSwOFF), cam);
    log(`Retour en mode photo → ${errorName(code)}`);
    if (canReadMode) await waitFor(() => (fixedMovie() === 1 ? null : true), 4000);
    movieMode = false;
  }
  try {
    await prepareForPhotos(s, cam);
  } catch (e) {
    log(`Préparation photo : ${e instanceof Error ? e.message : String(e)}`);
  }
  return status();
}

async function movieStart(): Promise<CanonStatus> {
  const { s, cam } = requireCamera();
  if (capturing || recording) throw new UserError('Une prise de vue est déjà en cours.');
  if (!movieMode) await setMovieMode(true);
  while (createdQueue.length) s.release(createdQueue.shift());
  cancelPendingTransfers();
  const code = await retryBusy('Démarrage de la vidéo', () => s.setUInt32Raw(cam, PropID.Record, RecordStart), cam);
  if (code !== Err.OK) {
    throw new UserError(
      `L'appareil refuse de démarrer la vidéo (${errorName(code)}). Vérifie la carte mémoire, la batterie et que l'appareil est en mode vidéo.`,
    );
  }
  recording = true;
  log("Enregistrement vidéo démarré sur l'appareil");
  return status();
}

/** Parcourt la carte (DCIM/<dossier>/…) et renvoie la vidéo la plus récente. */
function newestMovieOnCard(s: Edsdk, cam: Ref): Ref | null {
  let best: { ref: Ref; dateTime: number; name: string } | null = null;
  const walk = (folder: Ref, depth: number) => {
    const count = s.childCount(folder);
    for (let i = 0; i < count; i++) {
      const child = s.childAt(folder, i);
      const info = s.directoryItemInfo(child);
      if (info.isFolder && depth < 3) {
        walk(child, depth + 1);
        s.release(child);
      } else if (
        !info.isFolder &&
        isMovie(info.name) &&
        (!best || info.dateTime > best.dateTime || (info.dateTime === best.dateTime && info.name > best.name))
      ) {
        if (best) s.release(best.ref);
        best = { ref: child, dateTime: info.dateTime, name: info.name };
      } else {
        s.release(child);
      }
    }
  };
  const volumes = s.childCount(cam);
  for (let v = 0; v < volumes; v++) {
    const volume = s.childAt(cam, v);
    try {
      walk(volume, 0);
    } finally {
      s.release(volume);
    }
  }
  return (best as { ref: Ref } | null)?.ref ?? null;
}

/**
 * Arrête l'enregistrement. keep = true : rapatrie la vidéo de la carte vers `dir`
 * (le fichier reste aussi sur la carte, en sauvegarde). keep = false : annulation.
 */
async function movieStop(dir: string, keep: boolean): Promise<CanonMovieResult | null> {
  const { s, cam } = requireCamera();
  if (!recording) throw new UserError("Aucune vidéo en cours d'enregistrement.");
  const code = await retryBusy("Arrêt de la vidéo", () => s.setUInt32Raw(cam, PropID.Record, RecordStop), cam);
  recording = false;
  log(`Arrêt de la vidéo → ${errorName(code)}`);
  if (!keep) return null;
  capturing = true; // aperçu en pause pendant que l'appareil écrit puis envoie le fichier
  try {
    fs.mkdirSync(dir, { recursive: true });
    const pickMovie = (queue: Ref[]) => {
      while (queue.length) {
        const ref = queue.shift();
        const info = s.directoryItemInfo(ref);
        if (!info.isFolder && isMovie(info.name)) return ref;
        if (queue === transferQueue) s.cancelTransfer(ref);
        else s.release(ref);
      }
      return null;
    };
    // L'appareil signale le fichier une fois la vidéo finalisée sur la carte.
    let item = await waitFor(() => pickMovie(createdQueue) ?? pickMovie(transferQueue), 30_000);
    assertStillConnected(cam);
    if (!item) {
      log('Aucun fichier signalé par l’appareil : recherche sur la carte');
      item = newestMovieOnCard(s, cam);
    }
    if (!item) throw new UserError("La vidéo a été enregistrée par l'appareil mais reste introuvable sur la carte.");
    const info = s.directoryItemInfo(item);
    const file = path.join(dir, `${Date.now()}_${info.name}`);
    const t0 = Date.now();
    let lastPercent = -1;
    try {
      s.downloadToFile(item, info.size, file, (percent) => {
        if (percent !== lastPercent) {
          lastPercent = percent;
          post({ type: 'progress', percent });
        }
      });
    } finally {
      s.release(item);
    }
    const downloadMs = Date.now() - t0;
    log(`Vidéo ${info.name} : ${(info.size / 1e6).toFixed(1)} Mo rapatriés en ${(downloadMs / 1000).toFixed(1)} s`);
    return { path: file, name: info.name, bytes: info.size, downloadMs };
  } finally {
    capturing = false;
  }
}

async function handle(req: CanonRequest): Promise<unknown> {
  switch (req.cmd) {
    case 'status':
      return status();
    case 'connect':
      return connect();
    case 'disconnect':
      dropCamera(false);
      return status();
    case 'liveview':
      return setLiveview(req.on);
    case 'capture':
      return capture(req.dir);
    case 'movieMode':
      return setMovieMode(req.on);
    case 'movieStart':
      return movieStart();
    case 'movieStop':
      return movieStop(req.dir, req.keep);
  }
}

function describe(e: unknown): string {
  if (e instanceof EdsError) {
    if (e.code === Err.DEVICE_BUSY) return "L'appareil est occupé. Réessaie dans un instant.";
    if (e.code === Err.COMM_DISCONNECTED) return "L'appareil a été débranché.";
    if (e.code === Err.SESSION_NOT_OPEN) return "La connexion avec l'appareil est perdue. Reconnecte-le.";
  }
  return e instanceof Error ? e.message : String(e);
}

port.on('message', (event) => {
  const req = event.data as CanonRequest;
  handle(req).then(
    (result) => post({ type: 'reply', id: req.id, ok: true, result }),
    (e) => {
      if (!(e instanceof UserError)) log(`${req.cmd} : ${e instanceof Error ? e.message : String(e)}`);
      post({ type: 'reply', id: req.id, ok: false, error: describe(e) });
    },
  );
});
