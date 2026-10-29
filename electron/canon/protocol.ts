// Messages échangés entre le process principal et le process utilitaire Canon.

export type CanonCommand =
  | { cmd: 'status' }
  | { cmd: 'connect' }
  | { cmd: 'disconnect' }
  | { cmd: 'liveview'; on: boolean }
  | { cmd: 'capture'; dir: string };

export type CanonRequest = CanonCommand & { id: number };

export interface CanonStatus {
  sdkLoaded: boolean;
  sdkError?: string;
  cameras: string[];
  connected: boolean;
  model?: string;
  battery?: number;
  liveview: boolean;
}

export interface CanonCaptureResult {
  path: string;
  name: string;
  bytes: number;
  ms: number;
  afFallback: boolean;
}

export type CanonWorkerMessage =
  | { type: 'reply'; id: number; ok: true; result: unknown }
  | { type: 'reply'; id: number; ok: false; error: string }
  | { type: 'frame'; data: Uint8Array }
  | { type: 'log'; line: string }
  | { type: 'state'; connected: boolean; model?: string };
