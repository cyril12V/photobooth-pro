import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { db } from './database';

// ─── Configuration ffmpeg ──────────────────────────────────────────────────
// `ffmpeg-static` renvoie un chemin qui pointe vers `app.asar`. En prod, on
// doit cibler la version unpacked sinon le binaire n'est pas exécutable.
function resolveFfmpegPath(): string {
  const raw = ffmpegPath as unknown as string | null;
  if (!raw) throw new Error('ffmpeg-static introuvable');
  // Remplace 'app.asar' par 'app.asar.unpacked' si présent
  return raw.replace('app.asar', 'app.asar.unpacked');
}

const FFMPEG_BIN = resolveFfmpegPath();
ffmpeg.setFfmpegPath(FFMPEG_BIN);
// On utilise ffmpeg pour le probe également (binaire compatible)
ffmpeg.setFfprobePath(FFMPEG_BIN);

// ─── Types ─────────────────────────────────────────────────────────────────
export interface VideoCompilerSettings {
  video_compilation_show_questions: boolean;
  video_compilation_show_logo: boolean;
  video_compilation_show_event_name: boolean;
  video_compilation_intro_duration: number;
}

export interface VideoCompilerEvent {
  id: number;
  name: string;
  date: string | null;
  logo_path: string | null;
}

export interface CompileResult {
  ok: boolean;
  filepath?: string;
  error?: string;
}

export type CompileProgress = (percent: number, stage: string) => void;

interface InterviewLog {
  videoFile?: string;
  questions: Array<{ index: number; text: string; startMs: number; endMs: number }>;
}

interface VideoRow {
  id: number;
  event_id: number;
  filepath: string;
  mode: string;
  duration_ms: number;
  interview_log_path: string | null;
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
/**
 * Échappe les caractères spéciaux pour les filtres `drawtext` ffmpeg.
 * Référence : https://ffmpeg.org/ffmpeg-filters.html#Notes-on-filtergraph-escaping
 */
export function escapeFfmpegText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ');
}

/**
 * Échappe un chemin pour qu'il puisse être passé à un option ffmpeg
 * (drawtext fontfile, overlay, etc.) sur Windows et POSIX.
 */
function escapeFfmpegPath(p: string): string {
  // Sur Windows, ffmpeg attend des slashes ou des doubles antislashes
  // dans les options de filtres. On normalise vers `/` et on échappe `:`.
  const normalized = p.replace(/\\/g, '/');
  return normalized.replace(/:/g, '\\:');
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function readInterviewLog(p: string | null): Promise<InterviewLog | null> {
  if (!p) return null;
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as InterviewLog;
  } catch {
    return null;
  }
}

function probe(filepath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function rmDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ─── Génération de l'intro ─────────────────────────────────────────────────
function buildIntro(
  outFile: string,
  durationSec: number,
  event: VideoCompilerEvent,
): Promise<void> {
  const titleText = escapeFfmpegText(event.name || 'Évènement');
  const dateText = event.date ? escapeFfmpegText(event.date) : '';

  // On dessine le titre + la date sur fond noir, audio silencieux pour la concat.
  const filter =
    `drawtext=text='${titleText}':fontcolor=white:fontsize=96:` +
    `x=(w-text_w)/2:y=(h/2)-80` +
    (dateText
      ? `,drawtext=text='${dateText}':fontcolor=#d4a574:fontsize=56:` +
        `x=(w-text_w)/2:y=(h/2)+20`
      : '');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=black:s=1920x1080:d=${durationSec}:r=30`)
      .inputOptions(['-f', 'lavfi'])
      .input(`anullsrc=channel_layout=stereo:sample_rate=48000`)
      .inputOptions(['-f', 'lavfi', '-t', String(durationSec)])
      .videoFilters(filter)
      .outputOptions([
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-shortest',
        '-r',
        '30',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outFile);
  });
}

// ─── Normalisation + overlays par clip ─────────────────────────────────────
interface ClipOverlayParams {
  showQuestions: boolean;
  showLogo: boolean;
  showEventName: boolean;
  logoPath: string | null;
  eventName: string;
  log: InterviewLog | null;
}

function buildClipFilters(params: ClipOverlayParams): string[] {
  const filters: string[] = [];

  // Normalisation : 1920x1080, sar=1, fps=30
  filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
  filters.push('pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black');
  filters.push('setsar=1');
  filters.push('fps=30');

  // Nom de l'évènement en bas-gauche, discret
  if (params.showEventName && params.eventName) {
    const txt = escapeFfmpegText(params.eventName);
    filters.push(
      `drawtext=text='${txt}':fontcolor=white@0.85:fontsize=36:` +
        `box=1:boxcolor=black@0.45:boxborderw=12:x=40:y=h-th-40`,
    );
  }

  // Question dynamique selon les timecodes du log d'interview
  if (params.showQuestions && params.log && params.log.questions.length > 0) {
    for (const q of params.log.questions) {
      const txt = escapeFfmpegText(q.text);
      const startSec = (q.startMs / 1000).toFixed(3);
      const endSec = (q.endMs / 1000).toFixed(3);
      filters.push(
        `drawtext=text='${txt}':fontcolor=white:fontsize=44:` +
          `box=1:boxcolor=black@0.55:boxborderw=18:` +
          `x=(w-text_w)/2:y=60:` +
          `enable='between(t,${startSec},${endSec})'`,
      );
    }
  }

  return filters;
}

function processClip(
  inputFile: string,
  outputFile: string,
  params: ClipOverlayParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputFile);

    const filters = buildClipFilters(params);

    // Logo en haut-droit via input + overlay (gère mieux la transparence
    // qu'un drawtext) — uniquement si le fichier existe.
    if (params.showLogo && params.logoPath) {
      cmd.input(params.logoPath);
      // Premier filtre : redimensionner le logo à 160px de haut, garder ratio
      // Deuxième : overlay en haut-droit avec marge 40px
      const videoFilters = filters.join(',');
      const complex =
        `[0:v]${videoFilters}[base];` +
        `[1:v]scale=-1:160[logo];` +
        `[base][logo]overlay=W-w-40:40[outv]`;
      cmd
        .complexFilter(complex, ['outv'])
        .outputOptions([
          '-map',
          '0:a?',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-r',
          '30',
        ]);
    } else {
      cmd
        .videoFilters(filters)
        .outputOptions([
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-r',
          '30',
        ]);
    }

    cmd.on('end', () => resolve());
    cmd.on('error', (err) => reject(err));
    cmd.save(outputFile);
  });
}

// ─── Concat finale ─────────────────────────────────────────────────────────
function concatClips(clips: string[], outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (clips.length === 0) {
      reject(new Error('Aucun clip à concaténer'));
      return;
    }
    const cmd = ffmpeg();
    for (const c of clips) {
      cmd.input(c);
    }
    const inputs = clips.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('');
    const filter = `${inputs}concat=n=${clips.length}:v=1:a=1[outv][outa]`;
    cmd
      .complexFilter(filter, ['outv', 'outa'])
      .outputOptions([
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outFile);

    // Note: on n'utilise pas `escapeFfmpegPath` ici (les chemins sont passés
    // par fluent-ffmpeg qui les quote correctement). Conservé pour drawtext.
    void escapeFfmpegPath;
  });
}

// ─── Point d'entrée ────────────────────────────────────────────────────────
export async function compileEventVideos(
  eventId: number,
  settings: VideoCompilerSettings,
  event: VideoCompilerEvent,
  onProgress?: CompileProgress,
): Promise<CompileResult> {
  // Inclut interview ET free_message — la compilation regroupe toutes les vidéos
  // de l'évènement, peu importe leur mode. Les questions ne s'affichent
  // évidemment que pour les interviews (qui ont un interview_log_path).
  const rows = db
    .prepare(
      `SELECT * FROM videos
       WHERE event_id = ?
       ORDER BY datetime(created_at) ASC, id ASC`,
    )
    .all(eventId) as VideoRow[];

  if (rows.length === 0) {
    return { ok: false, error: 'Aucune vidéo à compiler. Enregistrez au moins une interview ou un message libre avant.' };
  }

  console.log(`[videoCompiler] ${rows.length} vidéo(s) trouvée(s) pour event ${eventId}`);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'photobooth-compile-'));

  try {
    onProgress?.(0, 'Préparation');

    const introFile = path.join(tempDir, 'intro.mp4');
    const introDuration = Math.max(1, Math.min(10, settings.video_compilation_intro_duration));
    await buildIntro(introFile, introDuration, event);
    onProgress?.(5, 'Intro générée');

    const processedClips: string[] = [introFile];
    const totalSteps = rows.length;
    const skipped: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i];
      const clipOut = path.join(tempDir, `clip_${i.toString().padStart(3, '0')}.mp4`);

      // 1. Vérification existence du fichier (la BDD peut pointer vers un fichier supprimé)
      try {
        await fs.access(v.filepath);
      } catch {
        console.warn('[videoCompiler] Fichier introuvable, skip:', v.filepath);
        skipped.push(`${path.basename(v.filepath)} (fichier introuvable)`);
        continue;
      }

      // 2. Probe pour vérifier que le fichier est lisible par ffmpeg
      try {
        await probe(v.filepath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[videoCompiler] Vidéo illisible, skip:', v.filepath, msg);
        skipped.push(`${path.basename(v.filepath)} (probe ffmpeg: ${msg.slice(0, 80)})`);
        continue;
      }

      // Pour les free_message, pas de log interview à charger
      const log = (settings.video_compilation_show_questions && v.mode === 'interview')
        ? await readInterviewLog(v.interview_log_path)
        : null;

      // 3. Traitement avec overlays. Si ça échoue, fallback : normalisation simple sans overlays.
      let success = false;
      try {
        await processClip(v.filepath, clipOut, {
          showQuestions: settings.video_compilation_show_questions && v.mode === 'interview',
          showLogo: settings.video_compilation_show_logo,
          showEventName: settings.video_compilation_show_event_name,
          logoPath: event.logo_path,
          eventName: event.name,
          log,
        });
        success = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[videoCompiler] Échec processClip avec overlays, fallback simple:', v.filepath, msg);
        // Fallback : tente une normalisation minimale sans overlays
        try {
          await processClip(v.filepath, clipOut, {
            showQuestions: false,
            showLogo: false,
            showEventName: false,
            logoPath: null,
            eventName: '',
            log: null,
          });
          success = true;
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          console.warn('[videoCompiler] Fallback échoué aussi, skip:', v.filepath, msg2);
          skipped.push(`${path.basename(v.filepath)} (encode: ${msg2.slice(0, 80)})`);
        }
      }

      if (success) processedClips.push(clipOut);

      const pct = 5 + Math.round(((i + 1) / totalSteps) * 80);
      onProgress?.(pct, `Clip ${i + 1}/${totalSteps}`);
    }

    if (processedClips.length <= 1) {
      // Seulement l'intro — pas de vidéo lisible
      const detail = skipped.length > 0 ? ` Détail : ${skipped.slice(0, 3).join(' · ')}` : '';
      return {
        ok: false,
        error: `Aucune vidéo exploitable parmi les ${rows.length} trouvée(s).${detail}`,
      };
    }

    if (skipped.length > 0) {
      console.warn(`[videoCompiler] ${skipped.length} vidéo(s) skippée(s) :`, skipped);
    }

    onProgress?.(88, 'Assemblage final');

    const eventNameSafe = safeName(event.name);
    const outDir = path.join(
      app.getPath('pictures'),
      'PhotoBooth',
      eventNameSafe,
      'videos',
    );
    await fs.mkdir(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, `compilation-${ts}.mp4`);

    await concatClips(processedClips, outFile);
    onProgress?.(100, 'Terminé');

    return { ok: true, filepath: outFile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    await rmDir(tempDir);
  }
}
