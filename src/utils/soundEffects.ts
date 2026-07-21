/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smart Bio - Synthesized Web Audio Sound System
 * Zero-dependency, offline-ready audio effects for UI & Quiz interactions.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem('sound_enabled') !== 'false';
}

/** Soft tactile click sound for buttons and options */
export function playClickSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Ignore browser audio play errors
  }
}

/** Pleasant ascending chime for correct answer */
export function playCorrectSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Harmonic notes: E5 (659.25Hz) -> A5 (880Hz)
    [659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  } catch (e) {}
}

/** Soft low double-tone for incorrect answer */
export function playWrongSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Descending tones: D3 (146.83Hz) -> G2 (98Hz)
    [146.83, 98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.16);
    });
  } catch (e) {}
}

/** Crisp pop / swoosh sound when advancing to next question */
export function playNextSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {}
}

/** Triumphant fanfare when completing a quiz */
export function playCompleteSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Triumphant arpeggio: C5 -> E5 -> G5 -> C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.32);
    });
  } catch (e) {}
}
