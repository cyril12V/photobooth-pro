import { contextBridge, ipcRenderer } from 'electron';

// API exposée au renderer via window.api
contextBridge.exposeInMainWorld('api', {
  // Évènements
  event: {
    current: () => ipcRenderer.invoke('event:current'),
    save: (data: any) => ipcRenderer.invoke('event:save', data),
  },
  // Photos
  photo: {
    save: (payload: { dataUrl: string; eventId: number; mode: string }) =>
      ipcRenderer.invoke('photo:save', payload),
    list: (eventId: number) => ipcRenderer.invoke('photo:list', eventId),
    openFolder: (eventId?: number) => ipcRenderer.invoke('photo:openFolder', eventId),
    folder: (eventId?: number) => ipcRenderer.invoke('photo:folder', eventId),
  },
  // Templates
  template: {
    list: () => ipcRenderer.invoke('template:list'),
    save: (data: any) => ipcRenderer.invoke('template:save', data),
    delete: (id: number) => ipcRenderer.invoke('template:delete', id),
  },
  // Poses challenge
  pose: {
    list: () => ipcRenderer.invoke('pose:list'),
    add: (data: { label: string; image_path: string }) => ipcRenderer.invoke('pose:add', data),
    delete: (id: number) => ipcRenderer.invoke('pose:delete', id),
  },
  // Vidéos
  video: {
    save: (payload: {
      buffer: ArrayBuffer | Uint8Array;
      eventId: number;
      mode: 'interview' | 'free_message';
      durationMs: number;
      interviewLog?: {
        questions: Array<{ index: number; text: string; startMs: number; endMs: number }>;
      };
      cloudShareUrl?: string | null;
      skipCloudUpload?: boolean;
    }) => ipcRenderer.invoke('video:save', payload),
    saveFile: (payload: {
      sourcePath: string;
      eventId: number;
      mode: 'interview' | 'free_message';
      durationMs: number;
      interviewLog?: {
        questions: Array<{ index: number; text: string; startMs: number; endMs: number }>;
      };
    }) => ipcRenderer.invoke('video:saveFile', payload),
    list: (eventId: number) => ipcRenderer.invoke('video:list', eventId),
    delete: (id: number) => ipcRenderer.invoke('video:delete', id),
    openFolder: (eventId?: number) => ipcRenderer.invoke('video:openFolder', eventId),
    compile: (eventId?: number) => ipcRenderer.invoke('video:compile', eventId),
    onCompileProgress: (
      callback: (data: { percent: number; stage: string }) => void,
    ) => {
      const listener = (_e: unknown, data: { percent: number; stage: string }) =>
        callback(data);
      ipcRenderer.on('video:compile-progress', listener);
      return () => {
        ipcRenderer.removeListener('video:compile-progress', listener);
      };
    },
  },
  // Questions interview
  question: {
    list: () => ipcRenderer.invoke('question:list'),
    add: (data: { label: string; duration_seconds: number }) =>
      ipcRenderer.invoke('question:add', data),
    update: (data: { id: number; label?: string; duration_seconds?: number }) =>
      ipcRenderer.invoke('question:update', data),
    delete: (id: number) => ipcRenderer.invoke('question:delete', id),
    reorder: (ids: number[]) => ipcRenderer.invoke('question:reorder', ids),
  },
  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
  // Imprimante
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    print: (payload: { filepath: string; copies: number; printerName?: string; preview?: boolean }) =>
      ipcRenderer.invoke('printer:print', payload),
  },
  // Dialog
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
  },
  cloud: {
    test: (payload: { baseUrl: string; apiKey: string }) =>
      ipcRenderer.invoke('cloud:test', payload),
  },
  // Partage local (serveur HTTP / QR)
  share: {
    url: (filepath: string) => ipcRenderer.invoke('share:url', filepath),
    info: () => ipcRenderer.invoke('share:info'),
    restart: () => ipcRenderer.invoke('share:restart'),
  },
  // Appareil Canon en USB (EDSDK)
  canon: {
    status: () => ipcRenderer.invoke('canon:status'),
    connect: () => ipcRenderer.invoke('canon:connect'),
    disconnect: () => ipcRenderer.invoke('canon:disconnect'),
    liveview: (on: boolean) => ipcRenderer.invoke('canon:liveview', on),
    capture: () => ipcRenderer.invoke('canon:capture'),
    logs: () => ipcRenderer.invoke('canon:logs'),
    windowsCheck: () => ipcRenderer.invoke('canon:windowsCheck'),
    onFrame: (cb: (jpeg: Uint8Array) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, data: Uint8Array) => cb(data);
      ipcRenderer.on('canon:frame', listener);
      return () => {
        ipcRenderer.removeListener('canon:frame', listener);
      };
    },
    movieMode: (on: boolean) => ipcRenderer.invoke('canon:movieMode', on),
    movieStart: () => ipcRenderer.invoke('canon:movieStart'),
    movieStop: (keep: boolean) => ipcRenderer.invoke('canon:movieStop', keep),
    onProgress: (cb: (percent: number) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, percent: number) => cb(percent);
      ipcRenderer.on('canon:progress', listener);
      return () => {
        ipcRenderer.removeListener('canon:progress', listener);
      };
    },
    onState: (cb: (state: { connected: boolean; model?: string }) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, state: { connected: boolean; model?: string }) => cb(state);
      ipcRenderer.on('canon:state', listener);
      return () => {
        ipcRenderer.removeListener('canon:state', listener);
      };
    },
  },
  // App
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    copyText: (text: string) => ipcRenderer.invoke('app:copyText', text),
    version: () => ipcRenderer.invoke('app:version'),
  },
  // Mises à jour automatiques (GitHub Releases)
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    install: () => ipcRenderer.invoke('update:install'),
  },
});
