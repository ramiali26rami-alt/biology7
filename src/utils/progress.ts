/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Progress tracking utility.
 * Stores all lesson progress in localStorage under the key 'app_progress'.
 *
 * Each lesson has 3 milestones:
 *   visited    (details screen opened) = 33%
 *   videoSeen  (video screen opened)   = 66%
 *   quizDone   (quiz completed)        = 100%
 */

export interface LessonProgress {
  visited: boolean;
  videoSeen: boolean;
  quizDone: boolean;
  bestScore: number;       // 0-100 percentage
  bestScoreRaw: string;    // e.g. "8/20"
}

export interface AppProgress {
  lessons: Record<string, LessonProgress>;
  streak: number;
  lastStudyDate: string;   // 'YYYY-MM-DD'
}

const KEY = 'app_progress';

import { saveQuizResult } from './supabaseHelper';

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function loadProgress(): AppProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppProgress;
  } catch {
    // ignore parse errors
  }
  return { lessons: {}, streak: 0, lastStudyDate: '' };
}

function saveProgress(p: AppProgress): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

/** Returns or creates the progress record for a lesson. */
function getLessonRecord(p: AppProgress, lessonId: string): LessonProgress {
  if (!p.lessons[lessonId]) {
    p.lessons[lessonId] = {
      visited: false,
      videoSeen: false,
      quizDone: false,
      bestScore: 0,
      bestScoreRaw: '',
    };
  }
  return p.lessons[lessonId];
}

/** Updates the study streak based on today's date. Call once per session. */
export function touchStreak(): void {
  const p = loadProgress();
  const today = todayStr();
  if (p.lastStudyDate === today) return; // already updated today

  const last = p.lastStudyDate;
  if (last) {
    const lastDate = new Date(last);
    const diff = Math.round((new Date(today).getTime() - lastDate.getTime()) / 86400000);
    p.streak = diff === 1 ? p.streak + 1 : 1;
  } else {
    p.streak = 1;
  }
  p.lastStudyDate = today;
  saveProgress(p);
}

/** Mark lesson as visited (details screen opened). */
export function markVisited(lessonId: string): void {
  const p = loadProgress();
  const rec = getLessonRecord(p, lessonId);
  if (!rec.visited) {
    rec.visited = true;
    saveProgress(p);
  }
  touchStreak();
}

/** Mark lesson video as seen. */
export function markVideoSeen(lessonId: string): void {
  const p = loadProgress();
  const rec = getLessonRecord(p, lessonId);
  rec.visited = true;
  if (!rec.videoSeen) {
    rec.videoSeen = true;
    saveProgress(p);
  }
  touchStreak();
}

/** Mark lesson quiz as done and save score. */
export function markQuizDone(lessonId: string, score: number, total: number): void {
  const p = loadProgress();
  const rec = getLessonRecord(p, lessonId);
  rec.visited = true;
  rec.quizDone = true;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  if (pct >= rec.bestScore) {
    rec.bestScore = pct;
    rec.bestScoreRaw = `${score}/${total}`;
  }
  saveProgress(p);
  touchStreak();
  
  // Save to Supabase (and queue offline if network is down)
  saveQuizResult(lessonId, score, total).catch(() => {});
}

/** Returns the progress percentage (0, 33, 66, 100) for a lesson. */
export function lessonPercent(lessonId: string): number {
  const p = loadProgress();
  const rec = p.lessons[lessonId];
  if (!rec) return 0;
  if (rec.quizDone) return 100;
  if (rec.videoSeen) return 66;
  if (rec.visited) return 33;
  return 0;
}

/** Returns overall completion % across all provided lesson IDs. */
export function overallPercent(lessonIds: string[]): number {
  if (lessonIds.length === 0) return 0;
  const total = lessonIds.reduce((sum, id) => sum + lessonPercent(id), 0);
  return Math.round(total / lessonIds.length);
}

/** Returns current streak (days). */
export function getStreak(): number {
  return loadProgress().streak;
}

/** Returns raw LessonProgress for a lesson (or null). */
export function getLessonProgress(lessonId: string): LessonProgress | null {
  const p = loadProgress();
  return p.lessons[lessonId] ?? null;
}
