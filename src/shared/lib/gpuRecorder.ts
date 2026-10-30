/**
 * Enregistrement vidéo encodé par la carte graphique (WebCodecs, H.264 matériel) en MP4.
 *
 * MediaRecorder encode la 4K par le processeur (VP8) : sur un PC moyen l'aperçu
 * saccade. Son mode H.264 matériel n'est pas fiable (la vidéo cale au hasard),
 * alors qu'un VideoEncoder piloté dans un worker n'a jamais calé en test.
 */

// Pas encore dans les types DOM de TypeScript.
declare class MediaStreamTrackProcessor<T> {
  constructor(init: { track: MediaStreamTrack });
  readonly readable: ReadableStream<T>;
}

export const GPU_RECORDER_MIME = 'video/mp4';

// La 1re interrogation de la carte graphique prend ~2,5 s, les suivantes 0 ms :
// réponses mises en cache et lancées dès le démarrage (warmUpGpuProbe).
const probes = new Map<string, Promise<boolean>>();

/** true si la carte graphique sait encoder le H.264 à cette taille. */
function hasHardwareH264(width: number, height: number, bitrate: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof MediaStreamTrackProcessor === 'undefined') {
    return Promise.resolve(false);
  }
  const key = `${width}x${height}`;
  let probe = probes.get(key);
  if (!probe) {
    probe = VideoEncoder.isConfigSupported({
      codec: 'avc1.640033',
      width,
      height,
      bitrate,
      framerate: 30,
      hardwareAcceleration: 'prefer-hardware',
    })
      .then((r) => !!r.supported)
      .catch(() => false);
    probes.set(key, probe);
  }
  return Promise.race([probe, new Promise<boolean>((r) => setTimeout(() => r(false), 6000))]);
}

/** À appeler au démarrage de l'app : la réponse sera prête au moment d'enregistrer. */
export function warmUpGpuProbe(width: number, height: number, bitrate: number) {
  void hasHardwareH264(width, height, bitrate);
}

type WorkerMessage =
  | { type: 'ready' }
  | { type: 'done'; buffer: ArrayBuffer; fps: number; dropped: number; audio: boolean }
  | { type: 'error'; error: string };

export class GpuRecorder {
  private readonly worker = new Worker(new URL('./gpuRecorder.worker.ts', import.meta.url));
  private clones: MediaStreamTrack[] = [];
  private readonly ready: Promise<void>;
  private readonly result: Promise<Blob>;
  /** Après stop() : images par seconde réellement enregistrées, images sautées, présence du son. */
  stats: { fps: number; dropped: number; audio: boolean } | null = null;

  /**
   * Encodeur de la carte graphique démarré et prêt pour ce flux (à appeler pendant que
   * la caméra s'ouvre), ou null : l'app enregistre alors avec MediaRecorder.
   */
  static async prepare(stream: MediaStream, bitrate: number): Promise<GpuRecorder | null> {
    const s = stream.getVideoTracks()[0]?.getSettings();
    if (!s?.width || !s?.height || !(await hasHardwareH264(s.width, s.height, bitrate))) return null;
    const rec = new GpuRecorder(stream, bitrate);
    try {
      await Promise.race([
        rec.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('délai dépassé')), 8000)),
      ]);
      return rec;
    } catch (e) {
      console.warn('[video] encodeur de la carte graphique indisponible, enregistrement par le processeur :', e);
      rec.cancel();
      return null;
    }
  }

  private constructor(
    private readonly stream: MediaStream,
    bitrate: number,
  ) {
    let readyOk!: () => void;
    let readyFail!: (e: Error) => void;
    let done!: (b: Blob) => void;
    let failed!: (e: Error) => void;
    this.ready = new Promise((resolve, reject) => ((readyOk = resolve), (readyFail = reject)));
    this.result = new Promise((resolve, reject) => ((done = resolve), (failed = reject)));
    // Une erreur avant stop() est remontée par stop() : pas de rejet « non géré » entre-temps.
    this.result.catch(() => {});
    const fail = (message: string) => {
      const err = new Error(`Encodage vidéo par la carte graphique : ${message}`);
      readyFail(err);
      failed(err);
    };
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      if (e.data.type === 'ready') readyOk();
      else if (e.data.type === 'done') {
        this.stats = { fps: e.data.fps, dropped: e.data.dropped, audio: e.data.audio };
        done(new Blob([e.data.buffer], { type: GPU_RECORDER_MIME }));
      } else fail(e.data.error);
    };
    this.worker.onerror = (e) => fail(e.message);

    const v = stream.getVideoTracks()[0].getSettings();
    this.worker.postMessage({ cmd: 'init', width: v.width, height: v.height, bitrate });
  }

  start() {
    const video = this.stream.getVideoTracks()[0].clone();
    const audio = this.stream.getAudioTracks()[0]?.clone() ?? null;
    this.clones = audio ? [video, audio] : [video];
    // Les pistes ne sont pas transférables, mais leurs flux d'images et de son le sont.
    const videoReadable = new MediaStreamTrackProcessor<VideoFrame>({ track: video }).readable;
    const audioReadable = audio ? new MediaStreamTrackProcessor<AudioData>({ track: audio }).readable : null;
    this.worker.postMessage(
      { cmd: 'start', video: videoReadable, audio: audioReadable },
      audioReadable ? [videoReadable, audioReadable] : [videoReadable],
    );
  }

  /** Arrête et renvoie la vidéo MP4. */
  async stop(): Promise<Blob> {
    this.worker.postMessage({ cmd: 'stop' });
    try {
      return await this.result;
    } finally {
      this.cancel();
    }
  }

  /** Annulation : rien n'est gardé. */
  cancel() {
    this.worker.terminate();
    this.clones.forEach((t) => t.stop());
  }
}
