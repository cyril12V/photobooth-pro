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
  isLandscape?: boolean;
}

/**
 * Imprime une photo en silencieux (sans dialog Windows).
 *
 * Stratégie minimale qui marche avec le pilote DNP DS620 :
 * - silent: true + printBackground + deviceName UNIQUEMENT.
 *   Aucune option `landscape`, `pageSize`, `margins` côté Electron — le
 *   pilote DS620 rejette ces commandes ou produit des bandes noires.
 * - Le pilote utilise ses préférences Windows (format papier, orientation)
 *   configurées une fois pour toutes par l'utilisateur.
 *
 * Côté HTML : si l'image est paysage, on la rote 90° dans le viewport
 * portrait pour qu'elle remplisse 100% du papier 4×6 sans bande.
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName, isLandscape = false }: PrintArgs,
) {
  const db = getDb();

  // Vérification d'existence
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

  const fileUrl = pathToFileURL(filepath).toString();

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

  // Si paysage : on rote l'image dans le viewport portrait via CSS pour
  // qu'elle remplisse correctement le papier. Le pilote DS620 reste en
  // mode portrait natif (jamais de souci de commande rejetée).
  const imgStyle = isLandscape
    ? `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100vh;
        height: 100vw;
        transform: translate(-50%, -50%) rotate(90deg);
        transform-origin: center center;
        object-fit: cover;
        margin: 0;
        padding: 0;
        display: block;
      `
    : `
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        margin: 0;
        padding: 0;
      `;

  const html = `
    <!doctype html>
    <html><head><style>
      @page { size: auto; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: white;
        overflow: hidden;
      }
      img { ${imgStyle} }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise<void>((resolve) => setTimeout(resolve, 400));

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

  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}
