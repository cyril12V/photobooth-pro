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
  /** null : pas de micro. */
  audio: { sampleRate: number; channels: number } | null;
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

let stopping = false;
let session: {
  muxer: Muxer<ArrayBufferTarget>;
  videoEncoder: VideoEncoder;
  audioEncoder: AudioEncoder | null;
  pumps: Promise<void>[];
  stats: { encoded: number; dropped: number; firstUs: number; lastUs: number };
} | null = null;

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
 * Ouvre les encodeurs avant l'enregistrement : la carte graphique met ~1 s à démarrer
 * son encodeur, ce qui ferait sauter la 1re seconde de la vidéo et saccader l'aperçu.
 */
async function init(msg: InitMessage) {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: msg.width, height: msg.height },
    audio: msg.audio ? { codec: 'opus', numberOfChannels: msg.audio.channels, sampleRate: msg.audio.sampleRate } : undefined,
    fastStart: 'in-memory',
    // Images et son sont datés par la même horloge : un décalage commun garde la synchro des lèvres.
    firstTimestampBehavior: 'cross-track-offset',
  });

  // Pendant la mise en route, la sortie est jetée ; on garde seulement sa description
  // du flux (SPS/PPS), au cas où la 1re vraie image ne la renverrait pas.
  let warming = true;
  let warmMeta: EncodedVideoChunkMetadata | undefined;
  let firstChunk = true;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (warming) {
        if (meta?.decoderConfig) warmMeta = meta;
        return;
      }
      if (firstChunk && !meta?.decoderConfig) meta = warmMeta;
      firstChunk = false;
      muxer.addVideoChunk(chunk, meta);
    },
    error: fail,
  });
  videoEncoder.configure({
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
  videoEncoder.encode(black, { keyFrame: true });
  black.close();
  await videoEncoder.flush();
  warming = false;

  let audioEncoder: AudioEncoder | null = null;
  if (msg.audio) {
    audioEncoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: fail });
    audioEncoder.configure({ codec: 'opus', sampleRate: msg.audio.sampleRate, numberOfChannels: msg.audio.channels, bitrate: 128_000 });
  }
  session = { muxer, videoEncoder, audioEncoder, pumps: [], stats: { encoded: 0, dropped: 0, firstUs: 0, lastUs: 0 } };
  ctx.postMessage({ type: 'ready' });
}

function start(msg: StartMessage) {
  if (!session) return fail('Encodeur non prêt');
  const { videoEncoder, audioEncoder, stats } = session;
  session.pumps.push(
    pump(msg.video.getReader(), (frame) => {
      // Encodeur en retard : on saute l'image plutôt que de prendre du retard sur le direct.
      if (videoEncoder.encodeQueueSize <= 4) {
        videoEncoder.encode(frame, { keyFrame: stats.encoded % 60 === 0 });
        if (stats.encoded === 0) stats.firstUs = frame.timestamp;
        stats.lastUs = frame.timestamp;
        stats.encoded++;
      } else {
        stats.dropped++;
      }
      frame.close();
    }),
  );
  if (msg.audio && audioEncoder) {
    session.pumps.push(
      pump(msg.audio.getReader(), (data) => {
        audioEncoder.encode(data);
        data.close();
      }),
    );
  }
}

async function stop() {
  if (!session) return fail('Enregistrement non démarré');
  stopping = true;
  const { muxer, videoEncoder, audioEncoder, pumps, stats } = session;
  await Promise.all(pumps);
  await videoEncoder.flush();
  await audioEncoder?.flush();
  muxer.finalize();
  const buffer = muxer.target.buffer;
  const seconds = (stats.lastUs - stats.firstUs) / 1e6;
  const fps = seconds > 0 ? Math.round((stats.encoded - 1) / seconds) : 0;
  ctx.postMessage({ type: 'done', buffer, fps, dropped: stats.dropped }, [buffer]);
}

ctx.onmessage = (e) => {
  try {
    if (e.data.cmd === 'init') init(e.data).catch(fail);
    else if (e.data.cmd === 'start') start(e.data);
    else stop().catch(fail);
  } catch (err) {
    fail(err);
  }
};
