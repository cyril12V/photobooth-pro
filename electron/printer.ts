import { BrowserWindow, app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getDb } from './database';

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
  /** Si true, ouvre un PrintPreviewDialog Windows au lieu d'imprimer directement. */
  preview?: boolean;
}

/**
 * Imprime une photo via System.Drawing.Printing (script print-gdi.ps1).
 *
 * Pourquoi ce pipeline et pas webContents.print : le driver DNP DS620 charge le
 * papier en feed long-edge (orientation physique landscape). Quand on lui envoie
 * un raster via Chromium webContents.print avec pageSize portrait forcé, il
 * imprime moitié de page et laisse une bande noire (raster mal interprété).
 *
 * System.Drawing.PrintDocument réplique ce que fait l'app Windows Photos sous
 * clic-droit → Imprimer : récupère la pagebounds physique du driver, rote
 * l'image de 90° si son orientation diffère, draw fit-to-page, envoie au driver
 * un raster déjà bien orienté. Résultat : portrait nickel, sans bande.
 */
export async function handlePrint(
  _win: BrowserWindow,
  { filepath, copies, printerName, paperFormat = '4x6', preview = false }: PrintArgs,
) {
  const db = getDb();

  logPrint('───────────────────────────────────────────────');
  logPrint('Filepath  :', filepath);
  logPrint('Copies    :', copies);
  logPrint('Printer   :', printerName ?? '(default)');
  logPrint('Paper fmt :', paperFormat);
  logPrint('Preview   :', preview);

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

  if (!printerName) {
    throw new Error("Aucune imprimante sélectionnée (Réglages → Imprimante)");
  }

  const scriptPath = await resolveScriptPath();
  logPrint('GDI script :', scriptPath);

  let success = true;
  let errorMsg = '';
  const effectiveCopies = preview ? 1 : copies;
  const startedAt = Date.now();

  try {
    for (let i = 0; i < effectiveCopies; i++) {
      logPrint(`${preview ? 'Preview' : `Copy ${i + 1}/${copies}`}…`);
      await runPrintScript({ scriptPath, filepath, printerName, paperFormat, preview });
      if (i < effectiveCopies - 1) await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e: unknown) {
    success = false;
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  logPrint('Done in', Date.now() - startedAt, 'ms — success:', success, errorMsg || '');
  logPrint('───────────────────────────────────────────────');

  db.prepare(
    `INSERT INTO print_log (photo_id, copies, printer_name, success, error)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(null, copies, printerName ?? null, success ? 1 : 0, errorMsg || null);

  if (!success) throw new Error(errorMsg);
  return { ok: true, copies };
}

/**
 * Localise print-gdi.ps1.
 * - Dev : `electron/print-gdi.ps1` à la racine du projet (via app.getAppPath()).
 * - Prod : `resources/print-gdi.ps1` (via extraResources d'electron-builder).
 */
async function resolveScriptPath(): Promise<string> {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'print-gdi.ps1'),
    path.join(app.getAppPath(), 'electron', 'print-gdi.ps1'),
    path.join(__dirname, 'print-gdi.ps1'),
    path.join(__dirname, '..', 'electron', 'print-gdi.ps1'),
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // try next
    }
  }
  throw new Error(`Script print-gdi.ps1 introuvable. Cherché : ${candidates.join(', ')}`);
}

function runPrintScript({
  scriptPath,
  filepath,
  printerName,
  paperFormat,
  preview,
}: {
  scriptPath: string;
  filepath: string;
  printerName: string;
  paperFormat: '4x6' | '5x7' | '6x8';
  preview: boolean;
}) {
  return new Promise<void>((resolve, reject) => {
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
    const child = spawn('powershell.exe', args, { windowsHide: !preview });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (stdout) logPrint('PS stdout :\n' + stdout.trim());
      if (stderr) logPrint('PS stderr :\n' + stderr.trim());
      if (code === 0) resolve();
      else reject(new Error(`PowerShell exit ${code}: ${stderr.trim() || stdout.trim() || '(no output)'}`));
    });
  });
}
