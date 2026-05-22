export interface CloudUploadConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CloudUploadMeta {
  eventId: number;
  eventName: string;
  eventDate: string | null;
  kind: 'photo' | 'video';
  filename: string;
}

export interface CloudUploadResult {
  shareUrl: string;
  mediaUrl: string;
  filename: string;
  transcoding?: boolean;
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function buildHeaders(config: CloudUploadConfig, meta: CloudUploadMeta, contentType: string): HeadersInit {
  return {
    'content-type': contentType,
    'x-api-key': config.apiKey,
    'x-photobooth-kind': meta.kind,
    'x-photobooth-event-id': String(meta.eventId),
    'x-photobooth-event-name': meta.eventName,
    'x-photobooth-event-date': meta.eventDate ?? '',
    'x-photobooth-filename': meta.filename,
  };
}

export function isCloudConfigured(config: Partial<CloudUploadConfig> | null | undefined): config is CloudUploadConfig {
  return Boolean(config?.baseUrl?.trim() && config?.apiKey?.trim());
}

export async function uploadBlobToCloud(
  blob: Blob,
  config: CloudUploadConfig,
  meta: CloudUploadMeta,
  signal?: AbortSignal,
): Promise<CloudUploadResult> {
  const url = `${normalizeBase(config.baseUrl)}/api/upload`;
  const contentType = meta.kind === 'video' ? blob.type || 'video/webm' : blob.type || 'image/jpeg';
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(config, meta, contentType),
    body: blob,
    signal,
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !payload || typeof payload.shareUrl !== 'string') {
    const errMsg = typeof payload?.error === 'string' ? payload.error : `Upload VPS refusé (${res.status})`;
    throw new Error(errMsg);
  }
  return {
    shareUrl: String(payload.shareUrl),
    mediaUrl: typeof payload.mediaUrl === 'string' ? payload.mediaUrl : '',
    filename: typeof payload.filename === 'string' ? payload.filename : meta.filename,
    transcoding: payload.transcoding === true,
  };
}

export interface StreamUploadSession {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  response: Promise<CloudUploadResult>;
}

export function createCloudStreamSession(
  config: CloudUploadConfig,
  meta: CloudUploadMeta,
  contentType: string,
): StreamUploadSession {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const url = `${normalizeBase(config.baseUrl)}/api/upload`;
  const response = (async (): Promise<CloudUploadResult> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config, meta, contentType),
      body: stream.readable,
      // duplex 'half' required to send a streaming body without Content-Length (Electron/Chrome 105+)
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !payload || typeof payload.shareUrl !== 'string') {
      const errMsg = typeof payload?.error === 'string' ? payload.error : `Upload VPS refusé (${res.status})`;
      throw new Error(errMsg);
    }
    return {
      shareUrl: String(payload.shareUrl),
      mediaUrl: typeof payload.mediaUrl === 'string' ? payload.mediaUrl : '',
      filename: typeof payload.filename === 'string' ? payload.filename : meta.filename,
      transcoding: payload.transcoding === true,
    };
  })();
  return { writer: stream.writable.getWriter(), response };
}
