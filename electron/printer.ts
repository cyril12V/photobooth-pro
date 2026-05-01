import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDb } from './database';

/**
 * Liste les imprimantes disponibles.
 */
export async function listPrinters(win: BrowserWindow) {
  const printers = await win.webContents.getPrintersAsync();
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    isDefault: p.isDefault,
    status: p.status,
  }));
}

interface PrintArgs {
  filepath: string;
  copies: number;
  printerName?: string;
  paperFormat?: '4x6' | '5x7' | '6x8';
}

/**
 * Dimensions papier en microns (Electron `pageSize` attend des microns).
 * 1 inch = 25.4 mm = 25400 µm.
 *
 * Optimisé pour les imprimantes thermiques sublimation type DNP DS620 :
 * - 4×6 (10×15 cm) — format photobooth standard
 * - 5×7 (13×18 cm)
 * - 6×8 (15×20 cm)
 *
 * Orientation portrait : width < height. La photo capturée est en 1200×1800
 * (ratio 2:3) qui correspond exactement au 4×6 portrait.
 */
const PAPER_SIZES: Record<'4x6' | '5x7' | '6x8', { widthMicrons: number; heightMicrons: number; cssSize: string }> = {
  '4x6': {
    widthMicrons: 4 * 25400,
    heightMicrons: 6 * 25400,
    cssSize: '10.16cm 15.24cm',
  },
  '5x7': {
    widthMicrons: 5 * 25400,
    heightMicrons: 7 * 25400,
    cssSize: '12.7cm 17.78cm',
  },
  '6x8': {
    widthMicrons: 6 * 25400,
    heightMicrons: 8 * 25400,
    cssSize: '15.24cm 20.32cm',
  },
};

/**
 * Imprime une photo en silencieux (sans dialogue système).
 * - Encode le chemin en file:// via pathToFileURL pour gérer les accents/espaces.
 * - Vérifie que le fichier existe avant de tenter l'impression.
 * - Force le format papier exact (4×6 par défaut, compatible DNP DS620).
 * - Force l'image à occuper toute la page (object-fit: cover, sans bord blanc).
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName, paperFormat = '4x6' }: PrintArgs,
) {
  const db = getDb();
  const paper = PAPER_SIZES[paperFormat] ?? PAPER_SIZES['4x6'];

  // 1. Vérification d'existence du fichier
  try {
    await fs.access(filepath);
  } catch {
    const msg = `Fichier introuvable : ${filepath}`;
    db.prepare(
      `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
       VALUES (?, ?, ?, 0, ?)`,
    ).run(null, copies, printerName ?? null, msg);
    throw new Error(msg);
  }

  // 2. Encode le chemin en file:// (gère accents/espaces/caractères spéciaux)
  const fileUrl = pathToFileURL(filepath).toString();

  // 3. Charge la photo dans une fenêtre cachée
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

  // HTML : photo en plein papier, ratio préservé (object-fit: cover) pour
  // remplir 100% de la feuille. La photo capturée est déjà au bon ratio
  // (1200×1800 = 2:3 = 4×6 portrait) donc cover et contain donnent le même
  // résultat — cover assure 0 marge blanche même en cas de léger arrondi.
  const html = `
    <!doctype html>
    <html><head><style>
      @page { size: ${paper.cssSize}; margin: 0; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; }
      img {
        display: block;
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        margin: 0;
        padding: 0;
      }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Petit délai pour s'assurer que l'image est rendue avant l'impression
  await new Promise<void>((resolve) => setTimeout(resolve, 250));

  let success = true;
  let errorMsg = '';

  try {
    for (let i = 0; i < copies; i++) {
      await new Promise<void>((resolve, reject) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName,
            margins: { marginType: 'none' },
            // Force la taille de page côté Electron (en plus du @page CSS)
            pageSize: {
              width: paper.widthMicrons,
              height: paper.heightMicrons,
            },
            scaleFactor: 100,
            color: true,
            dpi: { horizontal: 300, vertical: 300 },
          },
          (ok, reason) => {
            if (ok) resolve();
            else reject(new Error(reason ?? 'Échec impression'));
          },
        );
      });
    }
  } catch (e: unknown) {
    success = false;
    errorMsg = e instanceof Error ? e.message : String(e);
  } finally {
    printWin.destroy();
  }

  // Log de l'impression
  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}
