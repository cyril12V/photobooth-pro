import { BrowserWindow } from 'electron';
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
}

/**
 * Imprime une photo en silencieux (sans dialogue système).
 * Utilise printToPDF + page silentPrint pour les imprimantes photo.
 *
 * Pour la V2 : remplacer par les SDK natifs DNP / Mitsubishi pour
 * un contrôle précis du format (10x15, bandeau, etc.).
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName }: PrintArgs,
) {
  const db = getDb();

  // On charge la photo dans une fenêtre cachée pour l'impression
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });

  const html = `
    <!doctype html>
    <html><head><style>
      @page { margin: 0; size: 10cm 15cm; }
      html, body { margin: 0; padding: 0; height: 100%; }
      img { width: 100%; height: 100%; object-fit: cover; }
    </style></head>
    <body><img src="file://${filepath.replace(/\\/g, '/')}" /></body></html>
  `;
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

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
          },
          (ok, reason) => {
            if (ok) resolve();
            else reject(new Error(reason ?? 'Échec impression'));
          },
        );
      });
    }
  } catch (e: any) {
    success = false;
    errorMsg = e.message ?? String(e);
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
