/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smart Bio - Duolingo-Style Vibrant Sound System
 * High-fidelity, offline-ready sound effects for UI, Diagrams & Quizzes.
 */

// ─── Duolingo-Style Base64 Audio Data URLs (PCM 16-bit 44.1kHz WAV) ───
const SOUND_DATA = {
  click: 'data:audio/wav;base64,UklGRqAHAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YYAHAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/',
  hotspot: 'data:audio/wav;base64,UklGRuAAAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YYAAAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/',
  correct: 'data:audio/wav;base64,UklGRvABAABXQVZFZm10EBAAAAABAAEARKwAAIhYAQACABAAZGF0YdABAAB/f4CBgYKDhIWGh4mJiYqLjI2Oj5CSk5WVl5mampucnJ2goaKjpKWmp6ipqqutra6vsLmys7O0tba3uLm6u7y9vr/AwcLDxMXGx8jJysrLzM3Oz9DR0dLU1dbX2NnZ2tvb3Nze3+Dh4eLm5+jp6err6+zt7u/v8PHx8vPz9PX19vf4+Pn6+/z8/f7/',
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

// Global gesture audio unlock listener for mobile WebViews
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

function playAudioElement(dataUrl: string, volume: number = 0.95) {
  if (!isSoundEnabled()) return;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = volume;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch (e) {}
}

/** Duolingo-style tactile bubble pop for buttons & cards */
export function playClickSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.click, 0.9);

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(550, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {}
}

/** Gentle, pleasant marimba pop for diagram hotspots & interactive labels */
export function playHotspotSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.hotspot, 0.95);

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.07);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {}
}

/** Duolingo-style bright D5 -> A5 cheerful chime for correct quiz answers */
export function playCorrectSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.correct, 1.0);

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.11;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.85, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  } catch (e) {}
}

/** Duolingo-style soft, double-bonk tone for wrong quiz answers */
export function playWrongSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.wrong, 0.9);

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [160, 110].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.11;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.75, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  } catch (e) {}
}

/** Crisp pop / swoosh when advancing to next question */
export function playNextSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.next, 0.9);

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.07);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {}
}

/** Duolingo-style victory fanfare when finishing a quiz or unit */
export function playCompleteSound() {
  if (!isSoundEnabled()) return;
  playAudioElement(SOUND_DATA.complete, 1.0);

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

      gain.gain.setValueAtTime(0.9, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (e) {}
}
