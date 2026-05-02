import { create } from 'zustand';
import type {
  PhotoboothEvent,
  AppSettings,
  ChallengePose,
  InterviewLogEntry,
  VideoMode,
  PhotoLayout,
} from '@shared/types';

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
  currentPhotoLayout: PhotoLayout | null;

  // Vidéo en cours
  currentVideoBlob: Blob | null;
  currentVideoMime: string | null;
  currentVideoBlobUrl: string | null;
  currentVideoFilepath: string | null;
  currentVideoShareUrl: string | null;
  currentVideoDurationMs: number;
  currentInterviewLog: InterviewLogEntry[];

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
  setCurrentPhotoLayout: (layout: PhotoLayout | null) => void;
  setCurrentPhoto: (
    dataUrl: string | null,
    filepath: string | null,
    shareUrl?: string | null,
    layout?: PhotoLayout | null,
  ) => void;
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
  currentPhotoLayout: null,
  currentVideoBlob: null,
  currentVideoMime: null,
  currentVideoBlobUrl: null,
  currentVideoFilepath: null,
  currentVideoShareUrl: null,
  currentVideoDurationMs: 0,
  currentInterviewLog: [],
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
  setCurrentPhotoLayout: (currentPhotoLayout) => set({ currentPhotoLayout }),
  setCurrentPhoto: (dataUrl, filepath, shareUrl, layout) =>
    set((state) => ({
      currentPhotoDataUrl: dataUrl,
      currentPhotoDataUrls: dataUrl ? [dataUrl] : [],
      currentPhotoFilepath: filepath,
      currentPhotoShareUrl: shareUrl ?? null,
      currentPhotoLayout: layout === undefined ? state.currentPhotoLayout : layout,
    })),
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
    });
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
    const videoEnabled = get().settings?.video_enabled ?? true;
    set({
      screen: videoEnabled ? 'splash' : 'home',
      flow: null,
      mode: 'classic',
      videoMode: null,
      selectedPose: null,
      selectedPoses: [],
      currentPhotoDataUrl: null,
      currentPhotoDataUrls: [],
      currentPhotoFilepath: null,
      currentPhotoShareUrl: null,
      currentPhotoLayout: null,
      currentVideoBlob: null,
      currentVideoMime: null,
      currentVideoBlobUrl: null,
      currentVideoFilepath: null,
      currentVideoShareUrl: null,
      currentVideoDurationMs: 0,
      currentInterviewLog: [],
    });
  },
}));
