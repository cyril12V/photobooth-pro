/**
 * Liaison minimale vers le SDK Canon (EDSDK.dll) via koffi (FFI, licence MIT).
 *
 * Ne contient que ce dont le photobooth a besoin : session, propriétés,
 * déclenchement, LiveView, téléchargement de fichiers et évènements.
 * Les valeurs des constantes viennent des en-têtes EDSDK 13.x (EDSDKTypes.h,
 * EDSDKErrors.h). Chargé uniquement dans le process utilitaire Canon.
 */
import koffi from 'koffi';
import path from 'node:path';

export const EDS_MAX_NAME = 256;

export const PropID = {
  ProductName: 0x00000002,
  BatteryLevel: 0x00000008,
  SaveTo: 0x0000000b,
  ImageQuality: 0x00000100,
  Evf_OutputDevice: 0x00000500,
  Evf_Mode: 0x00000501,
} as const;

export const CameraCommand = {
  TakePicture: 0x00000000,
  ExtendShutDownTimer: 0x00000001,
  PressShutterButton: 0x00000004,
  SetRemoteShootingMode: 0x0000010f,
} as const;

export const ShutterButton = {
  OFF: 0x00000000,
  Halfway: 0x00000001,
  Completely: 0x00000003,
  HalfwayNonAF: 0x00010001,
  CompletelyNonAF: 0x00010003,
} as const;

export const StatusCommand = { UILock: 0, UIUnLock: 1 } as const;

export const ObjectEvent = {
  All: 0x00000200,
  DirItemRequestTransfer: 0x00000208,
} as const;

export const StateEvent = {
  All: 0x00000300,
  Shutdown: 0x00000301,
  WillSoonShutDown: 0x00000303,
} as const;

export const SaveTo = { Camera: 1, Host: 2, Both: 3 } as const;
export const EvfOutputDevice = { TFT: 1, PC: 2 } as const;
export const ImageQualityLargeFineJpeg = 0x0013ff0f;
export const FileCreateAlways = 1;
export const AccessReadWrite = 2;

export const Err = {
  OK: 0x00000000,
  NOT_SUPPORTED: 0x00000007,
  INVALID_PARAMETER: 0x00000060,
  DEVICE_NOT_FOUND: 0x00000080,
  DEVICE_BUSY: 0x00000081,
  COMM_DISCONNECTED: 0x000000c1,
  SESSION_NOT_OPEN: 0x00002003,
  OBJECT_NOTREADY: 0x0000a102,
  TAKE_PICTURE_AF_NG: 0x00008d01,
} as const;

const ERROR_NAMES: Record<number, string> = {
  0x00000001: 'UNIMPLEMENTED',
  0x00000002: 'INTERNAL_ERROR',
  0x00000007: 'NOT_SUPPORTED',
  0x00000023: 'FILE_OPEN_ERROR',
  0x00000040: 'DIR_NOT_FOUND',
  0x00000050: 'PROPERTIES_UNAVAILABLE',
  0x00000060: 'INVALID_PARAMETER',
  0x00000080: 'DEVICE_NOT_FOUND',
  0x00000081: 'DEVICE_BUSY',
  0x00000082: 'DEVICE_INVALID',
  0x00000083: 'DEVICE_EMERGENCY',
  0x00000084: 'DEVICE_MEMORY_FULL',
  0x00000085: 'DEVICE_INTERNAL_ERROR',
  0x00000089: 'DEVICE_CF_GATE_CHANGED',
  0x0000008d: 'DEVICE_NOT_RELEASED',
  0x000000a8: 'STREAM_WRITE_ERROR',
  0x000000c1: 'COMM_DISCONNECTED',
  0x000000c2: 'COMM_DEVICE_INCOMPATIBLE',
  0x000000c4: 'COMM_USB_BUS_ERR',
  0x00002003: 'SESSION_NOT_OPEN',
  0x00002021: 'NOT_CAMERA_SUPPORT_SDK_VERSION',
  0x0000a102: 'OBJECT_NOTREADY',
  0x00008d01: 'TAKE_PICTURE_AF_NG',
  0x00008d03: 'TAKE_PICTURE_MIRROR_UP_NG',
  0x00008d04: 'TAKE_PICTURE_SENSOR_CLEANING_NG',
  0x00008d05: 'TAKE_PICTURE_SILENCE_NG',
  0x00008d06: 'TAKE_PICTURE_NO_CARD_NG',
  0x00008d07: 'TAKE_PICTURE_CARD_NG',
  0x00008d08: 'TAKE_PICTURE_CARD_PROTECT_NG',
  0x00008d09: 'TAKE_PICTURE_MOVIE_CROP_NG',
  0x00008d0a: 'TAKE_PICTURE_STROBO_CHARGE_NG',
  0x00008d0b: 'TAKE_PICTURE_NO_LENS_NG',
  0x00008d0d: 'TAKE_PICTURE_LV_REL_PROHIBIT_MODE_NG',
};

export function errorName(code: number): string {
  const hex = `0x${code.toString(16).padStart(8, '0')}`;
  return ERROR_NAMES[code] ? `${ERROR_NAMES[code]} (${hex})` : hex;
}

export class EdsError extends Error {
  constructor(
    public readonly fn: string,
    public readonly code: number,
  ) {
    super(`${fn} → ${errorName(code)}`);
  }
}

/** Pointeur opaque EDSDK (EdsBaseRef, EdsCameraRef…). */
export type Ref = unknown;

const DeviceInfo = koffi.struct('EdsDeviceInfo', {
  szPortName: koffi.array('char', EDS_MAX_NAME, 'String'),
  szDeviceDescription: koffi.array('char', EDS_MAX_NAME, 'String'),
  deviceSubType: 'uint32',
  reserved: 'uint32',
});

const DirectoryItemInfo = koffi.struct('EdsDirectoryItemInfo', {
  size: 'uint64',
  isFolder: 'int',
  groupID: 'uint32',
  option: 'uint32',
  szFileName: koffi.array('char', EDS_MAX_NAME, 'String'),
  format: 'uint32',
  dateTime: 'uint32',
});

const Capacity = koffi.struct('EdsCapacity', {
  numberOfFreeClusters: 'int32',
  bytesPerSector: 'int32',
  reset: 'int',
});

export const ObjectEventHandler = koffi.proto(
  'uint32 __stdcall EdsObjectEventHandler(uint32 inEvent, void *inRef, void *inContext)',
);
export const StateEventHandler = koffi.proto(
  'uint32 __stdcall EdsStateEventHandler(uint32 inEvent, uint32 inEventData, void *inContext)',
);

export interface DirectoryItem {
  size: number;
  isFolder: boolean;
  name: string;
  dateTime: number;
}

export function loadEdsdk(dllDir: string) {
  // EDSDK.dll ne charge EdsImage.dll qu'à la demande (traitement d'images, non utilisé ici) :
  // on ne la livre pas, mais on garde le dossier dans le chemin de recherche des DLL.
  process.env.PATH = `${dllDir};${process.env.PATH ?? ''}`;
  try {
    const kernel32 = koffi.load('kernel32.dll');
    kernel32.func('int __stdcall SetDllDirectoryW(const char16_t *lpPathName)')(dllDir);
  } catch {
    // Le PATH suffit en général.
  }
  const lib = koffi.load(path.join(dllDir, 'EDSDK.dll'));
  const f = (sig: string) => lib.func(sig);

  const raw = {
    EdsInitializeSDK: f('uint32 __stdcall EdsInitializeSDK()'),
    EdsTerminateSDK: f('uint32 __stdcall EdsTerminateSDK()'),
    EdsRelease: f('uint32 __stdcall EdsRelease(void *inRef)'),
    EdsGetChildCount: f('uint32 __stdcall EdsGetChildCount(void *inRef, _Out_ uint32 *outCount)'),
    EdsGetChildAtIndex: f('uint32 __stdcall EdsGetChildAtIndex(void *inRef, int32 inIndex, _Out_ void **outRef)'),
    EdsGetCameraList: f('uint32 __stdcall EdsGetCameraList(_Out_ void **outCameraListRef)'),
    EdsGetDeviceInfo: f('uint32 __stdcall EdsGetDeviceInfo(void *inCameraRef, _Out_ EdsDeviceInfo *outDeviceInfo)'),
    EdsOpenSession: f('uint32 __stdcall EdsOpenSession(void *inCameraRef)'),
    EdsCloseSession: f('uint32 __stdcall EdsCloseSession(void *inCameraRef)'),
    EdsGetPropertySize: f(
      'uint32 __stdcall EdsGetPropertySize(void *inRef, uint32 inPropertyID, int32 inParam, _Out_ uint32 *outDataType, _Out_ uint32 *outSize)',
    ),
    EdsGetPropertyData: f(
      'uint32 __stdcall EdsGetPropertyData(void *inRef, uint32 inPropertyID, int32 inParam, uint32 inPropertySize, _Out_ uint8_t *outPropertyData)',
    ),
    EdsSetPropertyData: f(
      'uint32 __stdcall EdsSetPropertyData(void *inRef, uint32 inPropertyID, int32 inParam, uint32 inPropertySize, const uint8_t *inPropertyData)',
    ),
    EdsSendCommand: f('uint32 __stdcall EdsSendCommand(void *inCameraRef, uint32 inCommand, int32 inParam)'),
    EdsSendStatusCommand: f('uint32 __stdcall EdsSendStatusCommand(void *inCameraRef, uint32 inStatusCommand, int32 inParam)'),
    EdsSetCapacity: f('uint32 __stdcall EdsSetCapacity(void *inCameraRef, EdsCapacity inCapacity)'),
    EdsGetDirectoryItemInfo: f(
      'uint32 __stdcall EdsGetDirectoryItemInfo(void *inDirItemRef, _Out_ EdsDirectoryItemInfo *outDirItemInfo)',
    ),
    EdsDownload: f('uint32 __stdcall EdsDownload(void *inDirItemRef, uint64 inReadSize, void *outStream)'),
    EdsDownloadComplete: f('uint32 __stdcall EdsDownloadComplete(void *inDirItemRef)'),
    EdsDownloadCancel: f('uint32 __stdcall EdsDownloadCancel(void *inDirItemRef)'),
    // Variante Ex : chemin UTF-16 sous Windows (EdsCreateFileStream lit le chemin en ANSI
    // et échoue dès qu'un dossier contient un accent, ex. profil « Clément »).
    EdsCreateFileStreamEx: f(
      'uint32 __stdcall EdsCreateFileStreamEx(const char16_t *inFileName, int inCreateDisposition, int inDesiredAccess, _Out_ void **outStream)',
    ),
    EdsCreateMemoryStream: f('uint32 __stdcall EdsCreateMemoryStream(uint64 inBufferSize, _Out_ void **outStream)'),
    EdsGetPointer: f('uint32 __stdcall EdsGetPointer(void *inStream, _Out_ void **outPointer)'),
    EdsGetLength: f('uint32 __stdcall EdsGetLength(void *inStream, _Out_ uint64 *outLength)'),
    EdsCreateEvfImageRef: f('uint32 __stdcall EdsCreateEvfImageRef(void *inStreamRef, _Out_ void **outEvfImageRef)'),
    EdsDownloadEvfImage: f('uint32 __stdcall EdsDownloadEvfImage(void *inCameraRef, void *inEvfImageRef)'),
    EdsSetObjectEventHandler: f(
      'uint32 __stdcall EdsSetObjectEventHandler(void *inCameraRef, uint32 inEvent, EdsObjectEventHandler *inHandler, void *inContext)',
    ),
    EdsSetCameraStateEventHandler: f(
      'uint32 __stdcall EdsSetCameraStateEventHandler(void *inCameraRef, uint32 inEvent, EdsStateEventHandler *inHandler, void *inContext)',
    ),
    EdsGetEvent: f('uint32 __stdcall EdsGetEvent()'),
  };

  const check = (fn: string, code: number) => {
    if (code !== Err.OK) throw new EdsError(fn, code);
  };

  const outRef = (fn: string, call: (out: Ref[]) => number): Ref => {
    const out: Ref[] = [null];
    check(fn, call(out));
    return out[0];
  };

  return {
    raw,
    check,
    initialize: () => check('EdsInitializeSDK', raw.EdsInitializeSDK()),
    terminate: () => raw.EdsTerminateSDK() as number,
    release: (ref: Ref) => {
      if (ref) raw.EdsRelease(ref);
    },
    getEvent: () => raw.EdsGetEvent() as number,

    /** Liste les appareils branchés : [{ ref, description, port }]. Le ref de chacun est à libérer. */
    listCameras(): Array<{ ref: Ref; description: string; port: string }> {
      const list = outRef('EdsGetCameraList', (o) => raw.EdsGetCameraList(o));
      try {
        const count = [0];
        check('EdsGetChildCount', raw.EdsGetChildCount(list, count));
        const cameras: Array<{ ref: Ref; description: string; port: string }> = [];
        for (let i = 0; i < count[0]; i++) {
          const ref = outRef('EdsGetChildAtIndex', (o) => raw.EdsGetChildAtIndex(list, i, o));
          const info: { szPortName: string; szDeviceDescription: string } = {
            szPortName: '',
            szDeviceDescription: '',
          };
          check('EdsGetDeviceInfo', raw.EdsGetDeviceInfo(ref, info));
          cameras.push({ ref, description: info.szDeviceDescription, port: info.szPortName });
        }
        return cameras;
      } finally {
        raw.EdsRelease(list);
      }
    },

    getUInt32(ref: Ref, prop: number, param = 0): number {
      const buf = Buffer.alloc(4);
      check(`EdsGetPropertyData(0x${prop.toString(16)})`, raw.EdsGetPropertyData(ref, prop, param, 4, buf));
      return buf.readUInt32LE(0);
    },

    /** Code d'erreur brut, pour les diagnostics (ne jette pas). */
    tryGetUInt32(ref: Ref, prop: number): { value?: number; error?: string } {
      const buf = Buffer.alloc(4);
      const code = raw.EdsGetPropertyData(ref, prop, 0, 4, buf) as number;
      return code === Err.OK ? { value: buf.readUInt32LE(0) } : { error: errorName(code) };
    },

    getString(ref: Ref, prop: number): string {
      const type = [0];
      const size = [0];
      check('EdsGetPropertySize', raw.EdsGetPropertySize(ref, prop, 0, type, size));
      const buf = Buffer.alloc(Math.max(1, size[0]));
      check('EdsGetPropertyData', raw.EdsGetPropertyData(ref, prop, 0, buf.length, buf));
      const end = buf.indexOf(0);
      return buf.toString('latin1', 0, end === -1 ? buf.length : end);
    },

    setUInt32Raw(ref: Ref, prop: number, value: number): number {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(value >>> 0, 0);
      return raw.EdsSetPropertyData(ref, prop, 0, 4, buf) as number;
    },

    sendCommand: (cam: Ref, command: number, param = 0) => raw.EdsSendCommand(cam, command, param) as number,
    sendStatusCommand: (cam: Ref, command: number) => raw.EdsSendStatusCommand(cam, command, 0) as number,

    /** Indispensable quand SaveTo = Host : sinon l'appareil se croit sans place et refuse de déclencher. */
    setHostCapacity: (cam: Ref) =>
      raw.EdsSetCapacity(cam, { numberOfFreeClusters: 0x7fffffff, bytesPerSector: 0x1000, reset: 1 }) as number,

    directoryItemInfo(item: Ref): DirectoryItem {
      const info = { size: 0, isFolder: 0, groupID: 0, option: 0, szFileName: '', format: 0, dateTime: 0 };
      check('EdsGetDirectoryItemInfo', raw.EdsGetDirectoryItemInfo(item, info));
      return { size: Number(info.size), isFolder: !!info.isFolder, name: info.szFileName, dateTime: info.dateTime };
    },

    /** Abandonne une demande de transfert (sinon elle reste en attente dans l'appareil) et la libère. */
    cancelTransfer(item: Ref) {
      if (!item) return;
      raw.EdsDownloadCancel(item);
      raw.EdsRelease(item);
    },

    /** Télécharge un fichier de l'appareil vers `filePath` (bloquant). */
    downloadToFile(item: Ref, size: number, filePath: string) {
      const stream = outRef('EdsCreateFileStreamEx', (o) =>
        raw.EdsCreateFileStreamEx(filePath, FileCreateAlways, AccessReadWrite, o),
      );
      try {
        check('EdsDownload', raw.EdsDownload(item, size, stream));
        check('EdsDownloadComplete', raw.EdsDownloadComplete(item));
      } finally {
        raw.EdsRelease(stream);
      }
    },

    /** Une image du LiveView en JPEG, ou null si l'appareil n'en a pas encore. */
    downloadEvfFrame(cam: Ref): Buffer | null {
      const stream = outRef('EdsCreateMemoryStream', (o) => raw.EdsCreateMemoryStream(0, o));
      let evf: Ref = null;
      try {
        evf = outRef('EdsCreateEvfImageRef', (o) => raw.EdsCreateEvfImageRef(stream, o));
        const code = raw.EdsDownloadEvfImage(cam, evf) as number;
        if (code === Err.OBJECT_NOTREADY) return null;
        check('EdsDownloadEvfImage', code);
        const length = [0];
        check('EdsGetLength', raw.EdsGetLength(stream, length));
        const len = Number(length[0]);
        if (!len) return null;
        const ptr = outRef('EdsGetPointer', (o) => raw.EdsGetPointer(stream, o));
        // decode copie les octets (koffi.view est interdit sous Electron).
        const bytes = koffi.decode(ptr, 'uint8_t', len) as Uint8Array;
        return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      } finally {
        if (evf) raw.EdsRelease(evf);
        raw.EdsRelease(stream);
      }
    },
  };
}

export type Edsdk = ReturnType<typeof loadEdsdk>;
