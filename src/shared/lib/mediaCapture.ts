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

export const VIDEO_BITRATE_MAP: Record<CaptureResolution, number> = {
  '4k': 10_000_000,
  '1080p': 4_000_000,
  '720p': 2_000_000,
  '480p': 1_000_000,
};

export const VIDEO_RECORDING_SLICE_MS = 400;

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
