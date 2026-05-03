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
    }) => ipcRenderer.invoke('video:save', payload),
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
    print: (payload: { filepath: string; copies: number; printerName?: string; isLandscape?: boolean; objectPosition?: string }) =>
      ipcRenderer.invoke('printer:print', payload),
  },
  // Dialog
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
  },
  // Email SMTP
  email: {
    send: (payload: { to: string; filepath: string; eventName?: string }) =>
      ipcRenderer.invoke('email:send', payload),
    sendVideo: (payload: { to: string; shareUrl: string; eventName?: string }) =>
      ipcRenderer.invoke('email:sendVideo', payload),
    test: (smtp: any) => ipcRenderer.invoke('email:test', smtp),
  },
  // Partage local (serveur HTTP / QR)
  share: {
    url: (filepath: string) => ipcRenderer.invoke('share:url', filepath),
    info: () => ipcRenderer.invoke('share:info'),
  },
  // App
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
  },
});
