export const CAPTURE_RESOLUTIONS = ['4k', '1080p', '720p', '480p'] as const;

export type CaptureResolution = (typeof CAPTURE_RESOLUTIONS)[number];
export type PreviewResolution = '1080p';

export const CAPTURE_RESOLUTION_MAP: Record<CaptureResolution, { width: number; height: number }> = {
  '4k': { width: 3840, height: 2160 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
};

export const PREVIEW_RESOLUTION_MAP: Record<PreviewResolution, { width: number; height: number }> = {
  '1080p': { width: 1920, height: 1080 },
};

// Débits calibrés pour VP8 (≈ 25 % moins efficace que VP9 à qualité égale).
export const VIDEO_BITRATE_MAP: Record<CaptureResolution, number> = {
  '4k': 10_000_000,
  '1080p': 5_000_000,
  '720p': 2_500_000,
  '480p': 1_200_000,
};

export const VIDEO_RECORDING_SLICE_MS = 400;

// VP8 en premier : Electron 32 (Chromium 128) n'utilise jamais l'encodeur
// matériel au-delà de 1920×1088, donc la 4K est encodée par le processeur.
// VP9 logiciel n'y tient que 6-7 i/s et fait saccader l'aperçu avec lui ;
// VP8 tient 30 i/s en 4K (mesuré sur une machine 4 cœurs / 8 threads).
const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

export function pickRecorderMimeType(): string {
  for (const c of RECORDER_MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return 'video/webm';
}

export function buildVideoTrackConstraints(
  resolution: CaptureResolution,
  deviceId?: string,
): MediaTrackConstraints {
  const target = CAPTURE_RESOLUTION_MAP[resolution];
  return {
    width: { ideal: target.width },
    height: { ideal: target.height },
    frameRate: { ideal: 30, max: 30 },
    deviceId: deviceId ? { exact: deviceId } : undefined,
  };
}

type DeviceLike = Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'groupId' | 'label'>;

/**
 * Entrée son du même appareil que la caméra : avec une Cam Link, le son HDMI de l'appareil
 * photo (son micro intégré ou le micro branché dessus). Même groupe que la caméra pour
 * Chromium, ou à défaut un nom qui contient celui de la caméra
 * (« Digital Audio Interface (Cam Link 4K) » pour « Cam Link 4K (0fd9:0066) »).
 */
export function pickCameraAudioInput<T extends DeviceLike>(devices: T[], cameraId?: string): T | null {
  const camera = devices.find((d) => d.kind === 'videoinput' && (!cameraId || d.deviceId === cameraId));
  if (!camera) return null;
  // « default » et « communications » sont des alias Windows d'un autre micro.
  const mics = devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  const name = camera.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim().toLowerCase();
  return (
    (camera.groupId ? mics.find((m) => m.groupId === camera.groupId) : undefined) ??
    (name.length >= 3 ? mics.find((m) => m.label.toLowerCase().includes(name)) : undefined) ??
    null
  );
}

export interface MicrophoneChoice {
  audio: MediaTrackConstraints | true;
  /** Micro réellement utilisé, pour l'admin et le rapport. */
  label: string;
  /** Son de l'appareil branché comme caméra. */
  fromCamera: boolean;
}

/**
 * Micro des vidéos. micId vide = automatique : le son de la caméra choisie quand elle en a
 * un, sinon le micro par défaut de Windows.
 */
export async function resolveMicrophone(micId: string | undefined, cameraId: string | undefined): Promise<MicrophoneChoice> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameraAudio = pickCameraAudioInput(devices, cameraId);
  const id = micId || cameraAudio?.deviceId;
  if (!id) {
    const fallback = devices.find((d) => d.kind === 'audioinput' && d.deviceId === 'default');
    return { audio: true, label: fallback?.label || 'Micro par défaut de Windows', fromCamera: false };
  }
  const label = devices.find((d) => d.kind === 'audioinput' && d.deviceId === id)?.label || id;
  if (id === cameraAudio?.deviceId) {
    // Son déjà réglé par l'appareil : pas d'anti-écho, de réduction de bruit ni de gain auto qui le dégradent.
    return {
      audio: { deviceId: { exact: id }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      label,
      fromCamera: true,
    };
  }
  return { audio: { deviceId: { exact: id } }, label, fromCamera: false };
}

export function applyRealtimeCaptureHints(stream: MediaStream) {
  stream.getVideoTracks().forEach((track) => {
    try {
      track.contentHint = 'motion';
    } catch {
      // Ignore unsupported browsers.
    }
  });

  stream.getAudioTracks().forEach((track) => {
    try {
      track.contentHint = 'speech';
    } catch {
      // Ignore unsupported browsers.
    }
  });
}

export function applyPreviewElementSize(
  video: HTMLVideoElement,
  previewResolution: PreviewResolution,
) {
  const target = PREVIEW_RESOLUTION_MAP[previewResolution];
  video.width = target.width;
  video.height = target.height;
}
