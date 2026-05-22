import { create } from 'zustand';
import type {
  PhotoboothEvent,
  AppSettings,
  ChallengePose,
  InterviewLogEntry,
  VideoMode,
} from '@shared/types';
import { isCloudConfigured, uploadBlobToCloud } from '@shared/lib/cloudUpload';

export type Screen =
  | 'splash'
  | 'home'
  | 'pose-select'
  | 'capture'
  | 'preview'
  | 'print-share'
  | 'video-home'
  | 'video-mode-select'
  | 'video-interview'
  | 'video-free'
  | 'video-preview'
  | 'video-share';

export type CaptureMode = 'classic' | 'challenge';

export type AppFlow = 'photo' | 'video' | null;

export type VideoSaveResult = { filepath: string; share_url: string };

interface AppState {
  // Données
  event: PhotoboothEvent | null;
  settings: AppSettings | null;
  poses: ChallengePose[];

  // Navigation client
  screen: Screen;
  flow: AppFlow;
  mode: CaptureMode;
  videoMode: VideoMode | null;
  selectedPose: ChallengePose | null;
  selectedPoses: ChallengePose[];

  // Photo en cours
  currentPhotoDataUrl: string | null;
  currentPhotoDataUrls: string[];
  currentPhotoFilepath: string | null;
  currentPhotoShareUrl: string | null;

  // Vidéo en cours
  currentVideoBlob: Blob | null;
  currentVideoMime: string | null;
  currentVideoBlobUrl: string | null;
  currentVideoFilepath: string | null;
  currentVideoShareUrl: string | null;
  currentVideoDurationMs: number;
  currentInterviewLog: InterviewLogEntry[];
  currentVideoSavePromise: Promise<VideoSaveResult> | null;
  currentVideoSaveError: string | null;

  // Admin
  adminMode: boolean;
  adminAuthenticated: boolean;

  // Actions
  setEvent: (e: PhotoboothEvent | null) => void;
  setSettings: (s: AppSettings | null) => void;
  setPoses: (p: ChallengePose[]) => void;
  setScreen: (s: Screen) => void;
  setFlow: (f: AppFlow) => void;
  setMode: (m: CaptureMode) => void;
  setVideoMode: (m: VideoMode | null) => void;
  setSelectedPose: (p: ChallengePose | null) => void;
  setSelectedPoses: (p: ChallengePose[]) => void;
  setCurrentPhoto: (dataUrl: string | null, filepath: string | null, shareUrl?: string | null) => void;
  pushPhoto: (dataUrl: string) => void;
  clearPhotos: () => void;
  setVideoCapture: (data: {
    blob: Blob;
    blobUrl: string;
    mime: string;
    durationMs: number;
    interviewLog: InterviewLogEntry[];
  }) => void;
  setVideoSaved: (data: { filepath: string; shareUrl: string }) => void;
  clearVideo: () => void;
  setAdminMode: (v: boolean) => void;
  setAdminAuthenticated: (v: boolean) => void;
  resetCapture: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  event: null,
  settings: null,
  poses: [],
  screen: 'splash',
  flow: null,
  mode: 'classic',
  videoMode: null,
  selectedPose: null,
  selectedPoses: [],
  currentPhotoDataUrl: null,
  currentPhotoDataUrls: [],
  currentPhotoFilepath: null,
  currentPhotoShareUrl: null,
  currentVideoBlob: null,
  currentVideoMime: null,
  currentVideoBlobUrl: null,
  currentVideoFilepath: null,
  currentVideoShareUrl: null,
  currentVideoDurationMs: 0,
  currentInterviewLog: [],
  currentVideoSavePromise: null,
  currentVideoSaveError: null,
  adminMode: false,
  adminAuthenticated: false,

  setEvent: (event) => set({ event }),
  setSettings: (settings) => set({ settings }),
  setPoses: (poses) => set({ poses }),
  setScreen: (screen) => set({ screen }),
  setFlow: (flow) => set({ flow }),
  setMode: (mode) => set({ mode }),
  setVideoMode: (videoMode) => set({ videoMode }),
  setSelectedPose: (selectedPose) => set({ selectedPose }),
  setSelectedPoses: (selectedPoses) => set({ selectedPoses }),
  setCurrentPhoto: (dataUrl, filepath, shareUrl) =>
    set({
      currentPhotoDataUrl: dataUrl,
      currentPhotoDataUrls: dataUrl ? [dataUrl] : [],
      currentPhotoFilepath: filepath,
      currentPhotoShareUrl: shareUrl ?? null,
    }),
  pushPhoto: (dataUrl) =>
    set((state) => ({
      currentPhotoDataUrls: [...state.currentPhotoDataUrls, dataUrl],
    })),
  clearPhotos: () =>
    set({
      currentPhotoDataUrl: null,
      currentPhotoDataUrls: [],
      currentPhotoFilepath: null,
      currentPhotoShareUrl: null,
    }),
  setVideoCapture: ({ blob, blobUrl, mime, durationMs, interviewLog }) => {
    const prev = get().currentVideoBlobUrl;
    if (prev && prev !== blobUrl) {
      try {
        URL.revokeObjectURL(prev);
      } catch {}
    }
    set({
      currentVideoBlob: blob,
      currentVideoMime: mime,
      currentVideoBlobUrl: blobUrl,
      currentVideoFilepath: null,
      currentVideoShareUrl: null,
      currentVideoDurationMs: durationMs,
      currentInterviewLog: interviewLog,
      currentVideoSavePromise: null,
      currentVideoSaveError: null,
    });

    const ev = get().event;
    if (!ev) return;
    const settings = get().settings;
    const mode = get().videoMode ?? 'free_message';
    const cloudConfig = isCloudConfigured({
      baseUrl: settings?.cloud_vps_url ?? '',
      apiKey: settings?.cloud_vps_api_key ?? '',
    }) && settings?.enable_cloud
      ? { baseUrl: settings.cloud_vps_url, apiKey: settings.cloud_vps_api_key }
      : null;

    const buildLocalSavePayload = (buf: ArrayBuffer) => ({
      buffer: new Uint8Array(buf),
      eventId: ev.id,
      mode,
      durationMs,
      interviewLog: mode === 'interview' ? { questions: interviewLog } : undefined,
    });

    let savePromise: Promise<VideoSaveResult>;

    if (cloudConfig) {
      const cloudUploadPromise = uploadBlobToCloud(blob, cloudConfig, {
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date ?? null,
        kind: 'video',
        filename: `${Date.now()}_${mode}.webm`,
      });

      savePromise = cloudUploadPromise
        .then(async (cloudRes) => {
          // Save locale en arrière-plan (DB + disque) avec le cloud URL déjà obtenu —
          // n'affecte pas le temps que voit l'invité.
          blob
            .arrayBuffer()
            .then((buf) =>
              window.api.video.save({
                ...buildLocalSavePayload(buf),
                cloudShareUrl: cloudRes.shareUrl,
                skipCloudUpload: true,
              }),
            )
            .then((localRes) => {
              if (get().currentVideoBlobUrl === blobUrl) {
                set({ currentVideoFilepath: localRes.filepath });
              }
            })
            .catch((e) => {
              console.warn('Sauvegarde locale en arrière-plan échouée:', e);
            });
          return { filepath: '', share_url: cloudRes.shareUrl } satisfies VideoSaveResult;
        })
        .catch(async (err) => {
          console.warn('Upload cloud direct a échoué, fallback IPC:', err);
          const buf = await blob.arrayBuffer();
          return window.api.video.save(buildLocalSavePayload(buf));
        });
    } else {
      savePromise = blob
        .arrayBuffer()
        .then((buf) => window.api.video.save(buildLocalSavePayload(buf)));
    }

    savePromise.catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (get().currentVideoSavePromise === savePromise) {
        set({ currentVideoSaveError: msg });
      }
    });
    set({ currentVideoSavePromise: savePromise });
  },
  setVideoSaved: ({ filepath, shareUrl }) =>
    set({ currentVideoFilepath: filepath, currentVideoShareUrl: shareUrl }),
  clearVideo: () => {
    const prev = get().currentVideoBlobUrl;
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {}
    }
    set({
      currentVideoBlob: null,
      currentVideoMime: null,
      currentVideoBlobUrl: null,
      currentVideoFilepath: null,
      currentVideoShareUrl: null,
      currentVideoDurationMs: 0,
      currentInterviewLog: [],
      currentVideoSavePromise: null,
      currentVideoSaveError: null,
    });
  },
  setAdminMode: (adminMode) => set({ adminMode, adminAuthenticated: false }),
  setAdminAuthenticated: (adminAuthenticated) => set({ adminAuthenticated }),
  resetCapture: () => {
    const prev = get().currentVideoBlobUrl;
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {}
    }
    const captureMode = get().settings?.capture_mode ?? 'both';
    const nextScreen =
      captureMode === 'photo'
        ? 'home'
        : captureMode === 'video'
          ? 'video-home'
          : 'splash';
    set({
      screen: nextScreen,
      flow: captureMode === 'photo' ? 'photo' : captureMode === 'video' ? 'video' : null,
      mode: 'classic',
      videoMode: null,
      selectedPose: null,
      selectedPoses: [],
      currentPhotoDataUrl: null,
      currentPhotoDataUrls: [],
      currentPhotoFilepath: null,
      currentPhotoShareUrl: null,
      currentVideoBlob: null,
      currentVideoMime: null,
      currentVideoBlobUrl: null,
      currentVideoFilepath: null,
      currentVideoShareUrl: null,
      currentVideoDurationMs: 0,
      currentInterviewLog: [],
      currentVideoSavePromise: null,
      currentVideoSaveError: null,
    });
  },
}));
