import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import { getDb } from './database';

/**
 * Mode de print sélectionné via la variable d'env PRINT_MODE.
 *
 * - default      : pipeline Electron actuel (pageSize portrait + margins:none + cssSize portrait)
 * - no-pagesize  : retire pageSize et @page CSS — laisse le driver DNP choisir son paper natif
 * - landscape    : envoie la page en landscape avec l'image rotée 90° (match DS620 long-edge feed)
 * - no-margins   : garde pageSize mais retire margins:none
 * - gdi          : invoque print-gdi.ps1 (System.Drawing.PrintDocument) — réplique
 *                  exactement le pipeline Windows Photos avec auto-rotation native
 * - gdi-preview  : comme gdi mais ouvre une PrintPreviewDialog Windows native
 *                  (zoom, multi-pages, bouton Imprimer dans la toolbar)
 */
type PrintMode =
  | 'default'
  | 'no-pagesize'
  | 'landscape'
  | 'no-margins'
  | 'gdi'
  | 'gdi-preview';
const PRINT_MODE: PrintMode = (process.env.PRINT_MODE as PrintMode) || 'default';

function logPrint(...args: unknown[]) {
  console.log('[PRINT]', ...args);
}

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
 *
 * Le pipeline a 5 modes A/B (sélectionnés via env var PRINT_MODE) pour
 * diagnostiquer le bug DNP DS620 où une page portrait forcée produit une
 * bande noire et une mauvaise orientation. Voir PRINT_MODE en haut du fichier.
 */
export async function handlePrint(
  win: BrowserWindow,
  { filepath, copies, printerName, paperFormat = '4x6' }: PrintArgs,
) {
  const db = getDb();
  const paper = PAPER_SIZES[paperFormat] ?? PAPER_SIZES['4x6'];

  logPrint('───────────────────────────────────────────────');
  logPrint('Mode      :', PRINT_MODE);
  logPrint('Filepath  :', filepath);
  logPrint('Copies    :', copies);
  logPrint('Printer   :', printerName ?? '(default)');
  logPrint('Paper fmt :', paperFormat, '→', `${paper.widthMicrons}×${paper.heightMicrons} µm`, '/', paper.cssSize);

  // Capabilities driver — log complet de l'imprimante cible
  try {
    const printers = await win.webContents.getPrintersAsync();
    const target = printerName ? printers.find((p) => p.name === printerName) : printers.find((p) => p.isDefault);
    logPrint('Driver detected :', JSON.stringify(target ?? printers, null, 2));
  } catch (e) {
    logPrint('Driver detect failed :', e);
  }

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

  // ─── Mode "gdi" / "gdi-preview" : System.Drawing via PowerShell ──
  if (PRINT_MODE === 'gdi' || PRINT_MODE === 'gdi-preview') {
    return printViaGdi({
      filepath,
      copies,
      printerName,
      paperFormat,
      preview: PRINT_MODE === 'gdi-preview',
      db,
    });
  }

  // 2. Encode le chemin en file:// (gère accents/espaces/caractères spéciaux)
  const fileUrl = pathToFileURL(filepath).toString();

  // 3. Construit le HTML selon le mode
  const isLandscape = PRINT_MODE === 'landscape';
  const cssSize = isLandscape
    ? paper.cssSize.split(' ').reverse().join(' ') // "10.16cm 15.24cm" → "15.24cm 10.16cm"
    : paper.cssSize;
  const pageRule = PRINT_MODE === 'no-pagesize' ? '' : `@page { size: ${cssSize}; margin: 0; }`;

  // En mode landscape : l'image source est portrait (1200×1800), le viewport est
  // landscape (W×H avec W>H). On dimensionne l'img en pré-rotation comme un
  // portrait H×W puis on la rote 90°, ce qui la fait visuellement remplir W×H.
  const imgRule = isLandscape
    ? 'width: 100vh; height: 100vw; transform: rotate(90deg); transform-origin: center center;'
    : 'width: 100vw; height: 100vh;';
  const bodyRule = isLandscape ? 'display: flex; align-items: center; justify-content: center;' : '';

  const html = `
    <!doctype html>
    <html><head><style>
      ${pageRule}
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; ${bodyRule} }
      img {
        display: block;
        object-fit: cover;
        margin: 0;
        padding: 0;
        ${imgRule}
      }
    </style></head>
    <body><img src="${fileUrl}" /></body></html>
  `;

  // 4. Charge la photo dans une fenêtre cachée
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, webSecurity: false },
  });
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Capture les dimensions réelles du JPG dans la page
  try {
    const dims = await printWin.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const img = document.querySelector('img');
        if (img.complete) resolve({ w: img.naturalWidth, h: img.naturalHeight });
        else img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      })
    `);
    logPrint('Image natural dims :', dims);
  } catch (e) {
    logPrint('Image dims read failed :', e);
  }

  // Petit délai pour s'assurer que l'image est rendue avant l'impression
  await new Promise<void>((resolve) => setTimeout(resolve, 250));

  // 5. Construit les options de print selon le mode
  type PrintOpts = Parameters<typeof printWin.webContents.print>[0];
  const printOpts: PrintOpts = {
    silent: true,
    printBackground: true,
    deviceName: printerName,
    scaleFactor: 100,
    color: true,
    dpi: { horizontal: 300, vertical: 300 },
  };

  if (PRINT_MODE !== 'no-margins') {
    printOpts.margins = { marginType: 'none' };
  }
  if (PRINT_MODE !== 'no-pagesize') {
    printOpts.pageSize = isLandscape
      ? { width: paper.heightMicrons, height: paper.widthMicrons }
      : { width: paper.widthMicrons, height: paper.heightMicrons };
  }

  logPrint('Print opts sent :', JSON.stringify(printOpts, null, 2));

  let success = true;
  let errorMsg = '';
  const startedAt = Date.now();

  try {
    for (let i = 0; i < copies; i++) {
      logPrint(`Copy ${i + 1}/${copies} starting…`);
      await new Promise<void>((resolve, reject) => {
        printWin.webContents.print(printOpts, (ok, reason) => {
          logPrint(`Copy ${i + 1}/${copies} callback :`, { ok, reason });
          if (ok) resolve();
          else reject(new Error(reason ?? 'Échec impression'));
        });
      });
    }
  } catch (e: unknown) {
    success = false;
    errorMsg = e instanceof Error ? e.message : String(e);
  } finally {
    printWin.destroy();
  }

  logPrint('Done in', Date.now() - startedAt, 'ms — success:', success, errorMsg);
  logPrint('───────────────────────────────────────────────');

  // Log de l'impression
  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}

/**
 * Mode "gdi" : invoque `print-gdi.ps1` (System.Drawing.Printing.PrintDocument).
 *
 * Ce pipeline réplique exactement ce que fait l'app Windows Photos quand on
 * clic-droit → Imprimer un JPG : charge l'image, récupère la pagebounds réelle
 * du driver, rote 90° si orientation image ≠ orientation papier, puis envoie
 * un raster correctement orienté au driver. Le DNP DS620 reçoit alors un
 * payload qu'il accepte sans transformation supplémentaire → impression
 * portrait parfaite avec template + photo + date.
 */
function getScriptPath() {
  // En dev (vite-plugin-electron compile dans dist-electron), le .ps1 est copié
  // au même niveau que main.js. En prod, il sera dans resources/app.asar.unpacked
  // ou similaire. On résout depuis __dirname.
  const compiled = path.join(__dirname, 'print-gdi.ps1');
  // Fallback : projet source (dev quand le ps1 n'a pas encore été copié)
  const source = path.join(app.getAppPath(), 'electron', 'print-gdi.ps1');
  return { compiled, source };
}

async function printViaGdi({
  filepath,
  copies,
  printerName,
  paperFormat,
  preview = false,
  db,
}: {
  filepath: string;
  copies: number;
  printerName?: string;
  paperFormat: '4x6' | '5x7' | '6x8';
  preview?: boolean;
  db: ReturnType<typeof getDb>;
}) {
  if (!printerName) {
    throw new Error('Mode GDI : aucune imprimante sélectionnée (réglages → Imprimante)');
  }

  // Résolution du script PowerShell — cherche dans plusieurs emplacements
  const { compiled, source } = getScriptPath();
  let scriptPath = compiled;
  try {
    await fs.access(scriptPath);
  } catch {
    scriptPath = source;
    try {
      await fs.access(scriptPath);
    } catch {
      throw new Error(`Script print-gdi.ps1 introuvable (cherché : ${compiled}, ${source})`);
    }
  }
  logPrint('GDI script :', scriptPath);

  let success = true;
  let errorMsg = '';

  // En mode preview : 1 dialogue interactif (pas de boucle de copies).
  // -NonInteractive doit être retiré pour autoriser l'affichage de la fenêtre.
  const effectiveCopies = preview ? 1 : copies;

  try {
    for (let i = 0; i < effectiveCopies; i++) {
      logPrint(`GDI ${preview ? 'preview' : 'copy ' + (i + 1) + '/' + copies}…`);
      await new Promise<void>((resolve, reject) => {
        const args = [
          '-NoProfile',
          ...(preview ? ['-STA'] : ['-NonInteractive']),
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          '-Path', filepath,
          '-Printer', printerName,
          '-PaperFormat', paperFormat,
          ...(preview ? ['-Preview'] : []),
        ];
        logPrint('Spawning : powershell.exe', args.join(' '));
        // En preview on doit autoriser la fenêtre → pas windowsHide
        const child = spawn('powershell.exe', args, { windowsHide: !preview });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('error', (e) => reject(e));
        child.on('close', (code) => {
          if (stdout) logPrint('GDI stdout :\n' + stdout.trim());
          if (stderr) logPrint('GDI stderr :\n' + stderr.trim());
          logPrint(`GDI exit : ${code}`);
          if (code === 0) resolve();
          else reject(new Error(`PowerShell exit ${code}: ${stderr || stdout}`));
        });
      });
      if (i < effectiveCopies - 1) await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e: unknown) {
    success = false;
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}
