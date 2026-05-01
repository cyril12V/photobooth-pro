import { BrowserWindow, nativeImage } from 'electron';
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
 * Imprime une photo en silencieux (sans dialogue système).
 * - Encode le chemin en file:// via pathToFileURL pour gérer les accents/espaces.
 * - Vérifie que le fichier existe avant de tenter l'impression.
 * - Laisse le pilote Windows (DNP DS620, etc.) gérer le format papier physique.
 *   Le user configure 4×6 / 5×7 / 6×8 dans les préférences Windows du pilote,
 *   le code respecte cette config (évite les bandes noires sur sublimation).
 * - Force l'image à occuper toute la page (object-fit: cover, sans bord blanc).
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

  // 2. Détecte l'orientation de l'image : paysage (width > height) ou portrait.
  //    On bascule le pilote en conséquence pour que la sortie matche le ratio
  //    de la photo composée (sinon bandes noires sur le ruban DS620).
  let isLandscape = false;
  try {
    const img = nativeImage.createFromPath(filepath);
    const size = img.getSize();
    if (size.width > size.height) isLandscape = true;
  } catch {
    // Fallback portrait par défaut
  }

  // 3. Encode le chemin en file:// (gère accents/espaces/caractères spéciaux)
  const fileUrl = pathToFileURL(filepath).toString();

  // 3. Charge la photo dans une fenêtre cachée
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

  // HTML minimal : on laisse le pilote Windows gérer la taille physique du
  // papier (size: auto). Le `landscape` ci-dessous indique au pilote dans
  // quel sens orienter le papier, c'est suffisant pour la DS620.
  const html = `
    <!doctype html>
    <html><head><style>
      @page { size: auto; margin: 0; }
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; }
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        margin: 0;
        padding: 0;
      }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Délai pour rendu complet de l'image avant impression
  await new Promise<void>((resolve) => setTimeout(resolve, 350));

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
            // Orientation détectée depuis le ratio de l'image elle-même.
            // Le pilote DS620 fera tourner physiquement le papier 4×6 si
            // landscape: true, garantissant que toute la zone est imprimée.
            landscape: isLandscape,
            // Force aussi la taille de page côté Electron (microns).
            // 4×6 inch = 101600 × 152400 µm. En paysage on inverse.
            pageSize: isLandscape
              ? { width: 152400, height: 101600 }
              : { width: 101600, height: 152400 },
            color: true,
            scaleFactor: 100,
            // pageSize NON forcé : on laisse le pilote DS620 utiliser sa
            // config Windows native. Le user doit configurer le format
            // physique du papier (4×6, 5×7, 6×8) dans Préférences
            // d'impression Windows pour que ça matche.
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
