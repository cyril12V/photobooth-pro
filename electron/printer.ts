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
  isLandscape?: boolean;
}

/**
 * Imprime une photo en silencieux (sans dialogue système).
 *
 * Stratégie pour la DNP DS620 (et autres thermiques sublimation) :
 * - On imprime TOUJOURS en orientation portrait. Le pilote DS620 gère mal
 *   le flag `landscape: true` d'Electron (rejette la commande ou produit
 *   des bandes noires).
 * - Si l'image composée est paysage, on la rotate de 90° côté HTML pour
 *   qu'elle remplisse correctement le papier portrait. L'utilisateur peut
 *   ensuite tourner physiquement le tirage à 90° pour le lire en paysage.
 *
 * Cette approche garantit qu'aucune commande d'impression n'échoue, et
 * que la photo couvre 100% du papier sans bande blanche ni noire.
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName, isLandscape: requestedLandscape }: PrintArgs,
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

  // 2. Détecte l'orientation de l'image (priorité au flag explicite, sinon
  //    fallback sur les dimensions du fichier).
  let isLandscape = requestedLandscape ?? false;
  if (typeof requestedLandscape !== 'boolean') {
    try {
      const img = nativeImage.createFromPath(filepath);
      const size = img.getSize();
      if (size.width > size.height) isLandscape = true;
    } catch {
      // Fallback portrait par défaut
    }
  }

  // 3. Encode le chemin en file:// (gère accents/espaces/caractères spéciaux)
  const fileUrl = pathToFileURL(filepath).toString();

  // 4. Charge la photo dans une fenêtre cachée
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

  // 5. Construit le HTML.
  //    - `@page { size: auto }` : on laisse le pilote DS620 utiliser son
  //       format papier physique configuré dans Windows (4×6, 5×7…).
  //    - Image portrait : remplit 100% du viewport via object-fit: cover.
  //    - Image paysage  : rotated de 90° dans le viewport portrait, et
  //       dimensionnée pour couvrir 100% (largeur image = hauteur papier,
  //       et inversement).
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

  // Délai pour rendu complet (rotate CSS + chargement image)
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
            margins: { marginType: 'none' },
            // Toujours portrait au niveau pilote — la rotation paysage est
            // gérée côté HTML via CSS transform. Ça évite tout problème
            // avec le pilote DS620 qui ne respecte pas `landscape: true`.
            landscape: false,
            color: true,
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

  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}
