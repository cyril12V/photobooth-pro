/**
 * Worker d'enregistrement : images caméra → VideoEncoder H.264 matériel (carte graphique),
 * son → AudioEncoder Opus, multiplexés en MP4. Hors du fil principal, l'aperçu reste fluide.
 * Piloté par gpuRecorder.ts.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

interface InitMessage {
  cmd: 'init';
  width: number;
  height: number;
  bitrate: number;
}

interface StartMessage {
  cmd: 'start';
  video: ReadableStream<VideoFrame>;
  audio: ReadableStream<AudioData> | null;
}

const ctx = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<InitMessage | StartMessage | { cmd: 'stop' }>) => void) | null;
};

let size = { width: 0, height: 0 };
let videoEncoder: VideoEncoder | null = null;
/** Destination des images encodées : jetées pendant la mise en route, puis le MP4. */
let onVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void = () => {};
let warmMeta: EncodedVideoChunkMetadata | undefined;
let stopping = false;
let session: {
  muxer: Muxer<ArrayBufferTarget>;
  audioEncoder: AudioEncoder | null;
  pumps: Promise<void>[];
  stats: { encoded: number; dropped: number; firstUs: number; lastUs: number };
  /** Donne au MP4 ce qui attend encore son calage (fin d'enregistrement). */
  flush: () => void;
} | null = null;
let started: Promise<void> = Promise.resolve();

const fail = (error: unknown) => ctx.postMessage({ type: 'error', error: String(error) });

async function pump<T>(reader: ReadableStreamDefaultReader<T>, onItem: (item: T) => void) {
  while (!stopping) {
    const { value, done } = await reader.read();
    if (done) break;
    onItem(value);
  }
  await reader.cancel().catch(() => {});
}

/**
 * Ouvre l'encodeur vidéo avant l'enregistrement : la carte graphique met ~1 s à le démarrer,
 * ce qui ferait sauter la 1re seconde de la vidéo et saccader l'aperçu.
 */
async function init(msg: InitMessage) {
  size = { width: msg.width, height: msg.height };
  // Pendant la mise en route, la sortie est jetée ; on garde seulement sa description
  // du flux (SPS/PPS), au cas où la 1re vraie image ne la renverrait pas.
  onVideoChunk = (_chunk, meta) => {
    if (meta?.decoderConfig) warmMeta = meta;
  };
  const encoder = new VideoEncoder({ output: (chunk, meta) => onVideoChunk(chunk, meta), error: fail });
  encoder.configure({
    codec: 'avc1.640033', // H.264 High 5.1 : jusqu'à la 4K30
    width: msg.width,
    height: msg.height,
    bitrate: msg.bitrate,
    framerate: 30,
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'realtime',
    avc: { format: 'avc' },
  });
  const black = new VideoFrame(new Uint8Array((msg.width * msg.height * 3) / 2), {
    format: 'I420',
    codedWidth: msg.width,
    codedHeight: msg.height,
    timestamp: 0,
  });
  encoder.encode(black, { keyFrame: true });
  black.close();
  await encoder.flush();
  videoEncoder = encoder;
  ctx.postMessage({ type: 'ready' });
}

/** 1er morceau de son, ou rien si le micro se tait plus d'une seconde (micro muet ou débranché). */
async function firstAudio(reader: ReadableStreamDefaultReader<AudioData>): Promise<AudioData | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1000));
  const first = await Promise.race([reader.read().then((r) => r.value ?? null), timeout]);
  return first;
}

async function start(msg: StartMessage) {
  const encoder = videoEncoder;
  if (!encoder) return fail('Encodeur non prêt');

  // Images et son sont datés par la même horloge : le MP4 cale les deux pistes sur le plus
  // ancien des deux premiers morceaux (synchro des lèvres). Il ne reçoit donc rien avant
  // d'avoir le 1er morceau de chaque piste, et le plus ancien passe en premier.
  const waitingVideo: Array<[EncodedVideoChunk, EncodedVideoChunkMetadata | undefined]> = [];
  const waitingAudio: Array<[EncodedAudioChunk, EncodedAudioChunkMetadata | undefined]> = [];
  let muxer: Muxer<ArrayBufferTarget> | null = null;
  let withAudio = false;
  let aligned = false;
  const release = (force = false) => {
    if (aligned || !muxer) return;
    if (!force && (!waitingVideo.length || (withAudio && !waitingAudio.length))) return;
    const m = muxer;
    const audioFirst = waitingAudio.length && waitingVideo.length && waitingAudio[0][0].timestamp < waitingVideo[0][0].timestamp;
    if (audioFirst) m.addAudioChunk(...waitingAudio.shift()!);
    for (const c of waitingVideo.splice(0)) m.addVideoChunk(...c);
    for (const c of waitingAudio.splice(0)) m.addAudioChunk(...c);
    aligned = true;
  };
  let firstChunk = true;
  onVideoChunk = (chunk, meta) => {
    if (firstChunk && !meta?.decoderConfig) meta = warmMeta;
    firstChunk = false;
    if (aligned) muxer!.addVideoChunk(chunk, meta);
    else {
      waitingVideo.push([chunk, meta]);
      release();
    }
  };

  const stats = { encoded: 0, dropped: 0, firstUs: 0, lastUs: 0 };
  // La vidéo part tout de suite ; le son la rejoint dès son 1er morceau.
  const pumps = [
    pump(msg.video.getReader(), (frame) => {
      // Encodeur en retard : on saute l'image plutôt que de prendre du retard sur le direct.
      if (encoder.encodeQueueSize <= 4) {
        encoder.encode(frame, { keyFrame: stats.encoded % 60 === 0 });
        if (stats.encoded === 0) stats.firstUs = frame.timestamp;
        stats.lastUs = frame.timestamp;
        stats.encoded++;
      } else {
        stats.dropped++;
      }
      frame.close();
    }),
  ];

  const audioReader = msg.audio?.getReader() ?? null;
  // Le son est réglé sur ce que le micro envoie vraiment (Cam Link : 48 kHz stéréo),
  // pas sur ce qu'il annonce : un écart ferait échouer l'encodage.
  const first = audioReader ? await firstAudio(audioReader) : null;
  if (audioReader && !first) {
    console.warn('[gpuRecorder] aucun son reçu : vidéo sans piste son');
    audioReader.cancel().catch(() => {});
  }
  withAudio = !!first;
  const m = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: size.width, height: size.height },
    audio: first ? { codec: 'opus', numberOfChannels: first.numberOfChannels, sampleRate: first.sampleRate } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'cross-track-offset',
  });
  muxer = m;

  let audioEncoder: AudioEncoder | null = null;
  if (first && audioReader) {
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        if (aligned) m.addAudioChunk(chunk, meta);
        else {
          waitingAudio.push([chunk, meta]);
          release();
        }
      },
      error: fail,
    });
    enc.configure({ codec: 'opus', sampleRate: first.sampleRate, numberOfChannels: first.numberOfChannels, bitrate: 128_000 });
    enc.encode(first);
    first.close();
    pumps.push(
      pump(audioReader, (data) => {
        enc.encode(data);
        data.close();
      }),
    );
    audioEncoder = enc;
  }
  release();
  session = { muxer: m, audioEncoder, pumps, stats, flush: () => release(true) };
}

async function stop() {
  await started;
  if (!session || !videoEncoder) return fail('Enregistrement non démarré');
  stopping = true;
  const { muxer, audioEncoder, pumps, stats, flush } = session;
  await Promise.all(pumps);
  await videoEncoder.flush();
  await audioEncoder?.flush();
  flush();
  muxer.finalize();
  const buffer = muxer.target.buffer;
  const seconds = (stats.lastUs - stats.firstUs) / 1e6;
  const fps = seconds > 0 ? Math.round((stats.encoded - 1) / seconds) : 0;
  ctx.postMessage({ type: 'done', buffer, fps, dropped: stats.dropped, audio: !!audioEncoder }, [buffer]);
}

ctx.onmessage = (e) => {
  try {
    if (e.data.cmd === 'init') init(e.data).catch(fail);
    else if (e.data.cmd === 'start') started = start(e.data).catch(fail);
    else stop().catch(fail);
  } catch (err) {
    fail(err);
  }
};
