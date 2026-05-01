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
}

/**
 * Imprime une photo en silencieux (sans dialogue système).
 * - Encode le chemin en file:// via pathToFileURL pour gérer les accents/espaces.
 * - Vérifie que le fichier existe avant de tenter l'impression.
 * - Force l'image à occuper toute la page (object-fit: contain pour ne rien couper).
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName }: PrintArgs,
) {
  const db = getDb();

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

  // 2. Encode le chemin en file:// (gère les accents, espaces, caractères spéciaux)
  const fileUrl = pathToFileURL(filepath).toString();

  // 3. Charge la photo dans une fenêtre cachée
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

  // HTML : photo en plein papier, ratio préservé (object-fit: contain)
  // pour ne rien couper du template ni des bords de la photo.
  const html = `
    <!doctype html>
    <html><head><style>
      @page { margin: 0; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; }
      img {
        display: block;
        width: 100vw;
        height: 100vh;
        object-fit: contain;
        margin: 0;
        padding: 0;
      }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Petit délai pour s'assurer que l'image est rendue avant l'impression
  await new Promise<void>((resolve) => setTimeout(resolve, 200));

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
            scaleFactor: 100,
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
