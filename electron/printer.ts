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
 * Imprime une photo en ouvrant l'aperçu d'impression Windows.
 *
 * Stratégie : on délègue tout au dialog d'impression natif Windows. C'est
 * exactement la même UI qu'utilise le user quand il imprime manuellement
 * depuis l'Explorateur (Aperçu Windows → bouton Imprimer). Avantages :
 * - Aucun bug avec le pilote DNP DS620 (les options silent:true /
 *   landscape:true / pageSize en microns plantaient l'envoi du job).
 * - L'utilisateur peut vérifier le format papier, l'orientation, et
 *   ajuster avant de valider.
 * - Format suggéré pour DNP DS620 : 6×4 paysage (15,24×10,16 cm) ou
 *   4×6 portrait (10,16×15,24 cm) — déjà préréglé dans le pilote DNP.
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName }: PrintArgs,
) {
  const db = getDb();

  // Vérification d'existence du fichier
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

  // Fenêtre cachée qui affiche la photo dans son ratio natif. C'est cette
  // page que l'aperçu d'impression Windows va capturer.
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });

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
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        margin: 0;
        padding: 0;
      }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise<void>((resolve) => setTimeout(resolve, 350));

  let success = true;
  let errorMsg = '';

  try {
    for (let i = 0; i < copies; i++) {
      await new Promise<void>((resolve, reject) => {
        printWin.webContents.print(
          {
            // ⚠️ silent: false → ouvre le dialog d'impression Windows.
            // L'utilisateur ajuste orientation / format papier / copies puis
            // clique sur Imprimer. C'est le SEUL mode qui marche fiablement
            // avec le pilote DNP DS620.
            silent: false,
            printBackground: true,
            deviceName: printerName,
            margins: { marginType: 'none' },
            color: true,
          },
          (ok, reason) => {
            if (ok) resolve();
            else if (reason === 'cancelled') {
              // L'utilisateur a annulé le dialog → on traite comme succès
              // pour ne pas afficher d'erreur.
              resolve();
            } else {
              reject(new Error(reason ?? 'Échec impression'));
            }
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
