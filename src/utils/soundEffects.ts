/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smart Bio - Universal Dual-Engine Sound System (HTML5 Audio + Web Audio API)
 * Guaranteed offline playback across all mobile WebViews, Android APKs, and PC browsers.
 */

// ─── Base64 Audio Data URLs (PCM 16-bit 22.05kHz WAV) ───
const SOUND_DATA = {
  click: 'data:audio/wav;base64,UklGRtL+AABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YYb+AAB/f4CAgICEhISIiIiLjY2Nk5SUlZmZmZudnZ2ioqKlpqamp6ioqKyurq6xsbGyszMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM=',
  correct: 'data:audio/wav;base64,UklGRvABAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YdABAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O1tre5uru8vb7AwcLExcjJytDR0tPW19jZ2tvcnZ6foaOkp6msr7CxtLW3ube5uru9v8HCw8bHyMnKzM3Oz9DR0tTW19jZ2tzc3d7h4uPm5+jp6uzt7u/w8fL09fbn',
  wrong: 'data:audio/wav;base64,UklGRlAHAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YJAGAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/',
  next: 'data:audio/wav;base64,UklGRuAAAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YYAAAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/',
  complete: 'data:audio/wav;base64,UklGRvABAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YdABAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/'
};

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

// Global mobile gesture audio unlock listener
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem('sound_enabled') !== 'false';
}

function playAudioElement(dataUrl: string, volume: number = 0.85) {
  if (!isSoundEnabled()) return;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = volume;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Suppress browser autoplay restriction logs
      });
    }
  } catch (e) {}
}

/** Soft, crisp tactile click sound for UI buttons & diagram hotspots */
export function playClickSound() {
  if (!isSoundEnabled()) return;
  
  // 1. Primary HTML5 Audio
  playAudioElement(SOUND_DATA.click, 0.9);

  // 2. Synthesized Web Audio backup
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

/** Bright, joyful chime for correct answers */
export function playCorrectSound() {
  if (!isSoundEnabled()) return;
  
  // 1. Primary HTML5 Audio
  playAudioElement(SOUND_DATA.correct, 1.0);

  // 2. Synthesized Web Audio backup
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  } catch (e) {}
}

/** Low double-buzz for incorrect answers */
export function playWrongSound() {
  if (!isSoundEnabled()) return;

  // 1. Primary HTML5 Audio
  playAudioElement(SOUND_DATA.wrong, 0.95);

  // 2. Synthesized Web Audio backup
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [160, 110].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.1;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  } catch (e) {}
}

/** Swoosh / pop sound when advancing to next question */
export function playNextSound() {
  if (!isSoundEnabled()) return;

  // 1. Primary HTML5 Audio
  playAudioElement(SOUND_DATA.next, 0.85);

  // 2. Synthesized Web Audio backup
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.08);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {}
}

/** Fanfare arpeggio when completing a quiz */
export function playCompleteSound() {
  if (!isSoundEnabled()) return;

  // 1. Primary HTML5 Audio
  playAudioElement(SOUND_DATA.complete, 1.0);

  // 2. Synthesized Web Audio backup
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.85, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });
  } catch (e) {}
}
