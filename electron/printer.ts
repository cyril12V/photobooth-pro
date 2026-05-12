import { BrowserWindow, shell } from 'electron';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { getDb } from './database';

/**
 * Mode de print sélectionné via la variable d'env PRINT_MODE.
 * Permet d'A/B-tester les hypothèses de fix sans recompiler à chaque variante.
 *
 * - default     : pipeline actuel (pageSize portrait + margins:none + cssSize portrait)
 * - no-pagesize : retire pageSize et @page CSS — laisse le driver DNP choisir son paper natif
 * - landscape   : envoie la page en landscape avec l'image rotée 90° (match DS620 long-edge feed)
 * - no-margins  : garde pageSize mais retire margins:none (pour voir si margins:none désactive l'auto-rotate)
 * - shell       : délègue l'impression à Windows (Start-Process -Verb Print) — réplique le chemin "clic droit"
 */
type PrintMode = 'default' | 'no-pagesize' | 'landscape' | 'no-margins' | 'shell';
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

  // ─── Mode "shell" : délègue à Windows (réplique le clic droit → Imprimer) ──
  if (PRINT_MODE === 'shell') {
    return printViaShell({ filepath, copies, printerName, db });
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
 * Mode "shell" : délègue l'impression à Windows via Start-Process -Verb Print.
 * Réplique exactement le chemin "clic droit → Imprimer" qui fonctionne chez l'utilisateur.
 * Inconvénient : pas de garantie 100% silent — peut ouvrir l'app Photos brièvement.
 */
async function printViaShell({
  filepath,
  copies,
  printerName,
  db,
}: {
  filepath: string;
  copies: number;
  printerName?: string;
  db: ReturnType<typeof getDb>;
}) {
  void shell; // évite que TS le marque unused si shell n'est pas utilisé ici
  let success = true;
  let errorMsg = '';

  try {
    for (let i = 0; i < copies; i++) {
      logPrint(`Shell print copy ${i + 1}/${copies}…`);
      await new Promise<void>((resolve, reject) => {
        const printerArg = printerName ? `-PrinterName '${printerName.replace(/'/g, "''")}'` : '';
        const psCmd = `Start-Process -FilePath '${filepath.replace(/'/g, "''")}' -Verb Print ${printerArg}`;
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
          windowsHide: true,
        });
        let stderr = '';
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('close', (code) => {
          logPrint(`Shell print copy ${i + 1} exit :`, code, stderr || '(no stderr)');
          if (code === 0) resolve();
          else reject(new Error(`PowerShell exit ${code}: ${stderr}`));
        });
      });
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
