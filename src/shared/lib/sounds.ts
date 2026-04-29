/**
 * Génère un beep court avec Web Audio API (pas besoin de fichiers).
 */
function beep(freq: number, durationMs: number, volume = 0.15) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch (e) {
    console.warn('Audio non disponible', e);
  }
}

export const sounds = {
  tick: () => beep(880, 100, 0.12),
  shutter: () => {
    beep(1200, 50, 0.2);
    setTimeout(() => beep(600, 80, 0.15), 50);
  },
  success: () => {
    beep(660, 100, 0.15);
    setTimeout(() => beep(880, 200, 0.15), 100);
  },
  /** Bip distinct utilisé pour signaler un changement de question en interview */
  questionChange: () => beep(520, 220, 0.18),
  /** Tonalité longue utilisée pour la fin d'enregistrement */
  recordingEnd: () => beep(440, 320, 0.18),
};
