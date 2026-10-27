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
