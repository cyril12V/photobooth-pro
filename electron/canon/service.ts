/**
 * Côté process principal du pilotage Canon : lance le process utilitaire
 * (worker.ts), lui transmet les commandes et relaie l'aperçu au renderer.
 */
import { app, utilityProcess, type UtilityProcess, type WebContents } from 'electron';
import path from 'node:path';
import type { CanonCommand, CanonWorkerMessage } from './protocol';

const LOG_LINES = 300;

function edsdkDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'edsdk')
    : path.join(app.getAppPath(), 'node_modules/@brick-a-brack/napi-canon-cameras/prebuilds/win32-x64');
}

class CanonService {
  private child: UtilityProcess | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; child: UtilityProcess }
  >();
  private logs: string[] = [];
  private frameTarget: WebContents | null = null;
  private stateListeners = new Set<WebContents>();

  log(line: string) {
    const stamped = `${new Date().toISOString().slice(11, 23)} ${line}`;
    this.logs.push(stamped);
    if (this.logs.length > LOG_LINES) this.logs.shift();
    console.log('[Canon]', line);
  }

  recentLogs(): string[] {
    return [...this.logs];
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child;
    const child = utilityProcess.fork(path.join(__dirname, 'canonWorker.js'), [], {
      serviceName: 'Canon EDSDK',
      env: { ...process.env, CANON_EDSDK_DIR: edsdkDir() },
      stdio: 'pipe',
    });
    child.stdout?.on('data', (d) => this.log(`[worker] ${String(d).trim()}`));
    child.stderr?.on('data', (d) => this.log(`[worker:err] ${String(d).trim()}`));
    child.on('message', (msg: CanonWorkerMessage) => this.onMessage(msg));
    child.on('exit', (code) => {
      this.log(`Process Canon arrêté (code ${code})`);
      if (this.child === child) this.child = null;
      for (const [id, p] of this.pending) {
        if (p.child !== child) continue;
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.reject(new Error("Le pilote de l'appareil s'est arrêté. Réessaie."));
      }
      if (!this.child) this.broadcastState({ connected: false });
    });
    this.child = child;
    this.log(`Process Canon lancé (SDK : ${edsdkDir()})`);
    return child;
  }

  private onMessage(msg: CanonWorkerMessage) {
    switch (msg.type) {
      case 'reply': {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error));
        return;
      }
      case 'frame':
        if (this.frameTarget && !this.frameTarget.isDestroyed()) this.frameTarget.send('canon:frame', msg.data);
        return;
      case 'progress':
        for (const wc of this.stateListeners) if (!wc.isDestroyed()) wc.send('canon:progress', msg.percent);
        return;
      case 'log':
        this.log(msg.line);
        return;
      case 'state':
        this.broadcastState({ connected: msg.connected, model: msg.model });
        return;
    }
  }

  private broadcastState(state: { connected: boolean; model?: string }) {
    for (const wc of this.stateListeners) {
      if (wc.isDestroyed()) this.stateListeners.delete(wc);
      else wc.send('canon:state', state);
    }
  }

  request<T>(command: CanonCommand, timeoutMs = 20_000): Promise<T> {
    const child = this.ensureChild();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`L'appareil ne répond pas (${command.cmd}).`));
        // Un appel EDSDK bloqué fige tout le process : on le relance plutôt que
        // d'empiler des commandes qui partiraient bien plus tard (un déclenchement…).
        if (this.child === child) {
          this.log(`Pas de réponse à « ${command.cmd} » : redémarrage du pilote Canon`);
          this.child = null;
          child.kill();
        }
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer, child });
      child.postMessage({ ...command, id });
    });
  }

  /** Les images du LiveView partent vers ce renderer (un seul écran à la fois). */
  setFrameTarget(wc: WebContents | null) {
    this.frameTarget = wc;
    if (wc) this.stateListeners.add(wc);
  }

  watchState(wc: WebContents) {
    this.stateListeners.add(wc);
  }

  async shutdown() {
    if (!this.child) return;
    try {
      await this.request({ cmd: 'disconnect' }, 3000);
    } catch {
      // On arrête quand même.
    }
    this.child?.kill();
    this.child = null;
  }
}

export const canonService = new CanonService();
