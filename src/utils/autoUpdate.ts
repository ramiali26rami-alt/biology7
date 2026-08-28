/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureAuthenticatedSession, supabase } from './supabaseClient';
import { SecureStorage } from './security';
import { clearLessonAssetCache } from './cacheManager';

const getLessonAssetSignature = (lesson: any): string => JSON.stringify({
  pdfFile: lesson?.pdfFile ?? '',
  pdfLocked: Boolean(lesson?.pdfLocked),
  diagramFile: lesson?.diagramFile ?? '',
  summaryFile: lesson?.summaryFile ?? '',
  mindmapFile: lesson?.mindmapFile ?? '',
  quizFile: lesson?.quizFile ?? '',
  ministryExamFile: lesson?.ministryExamFile ?? '',
  interactiveDiagrams: Array.isArray(lesson?.interactiveDiagrams)
    ? lesson.interactiveDiagrams.map((diagram: any) => diagram?.imageFile ?? '')
    : []
});

export async function checkAndUpdate(): Promise<{
  updated: boolean;
  newLessons: number;
  error: boolean;
}> {
  try {
    await ensureAuthenticatedSession();
    const { data: cloudConfig, error: cloudErr } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', 'curriculum_data')
      .maybeSingle();

    if (cloudErr || !cloudConfig?.value || !Array.isArray(cloudConfig.value)) {
      return { updated: false, newLessons: 0, error: false };
    }

    const currentCached = SecureStorage.getItem('curriculum_data');
    const cachedCount = Array.isArray(currentCached) ? currentCached.length : 0;
    const cloudCount = cloudConfig.value.length;
    const lastUpdatedAt = SecureStorage.getItem('curriculum_updated_at');

    if (cloudCount !== cachedCount || cloudConfig.updated_at !== lastUpdatedAt) {
      const cachedLessons = Array.isArray(currentCached) ? currentCached : [];
      const cachedById = new Map(cachedLessons.map((lesson: any) => [lesson?.id, lesson]));
      const cloudIds = new Set(cloudConfig.value.map((lesson: any) => lesson?.id));
      const lessonsWithChangedAssets = new Set<string>();

      cloudConfig.value.forEach((lesson: any) => {
        const lessonId = typeof lesson?.id === 'string' ? lesson.id : '';
        const previousLesson = cachedById.get(lessonId);
        if (lessonId && (!previousLesson || getLessonAssetSignature(previousLesson) !== getLessonAssetSignature(lesson))) {
          lessonsWithChangedAssets.add(lessonId);
        }
      });

      cachedLessons.forEach((lesson: any) => {
        if (typeof lesson?.id === 'string' && !cloudIds.has(lesson.id)) {
          lessonsWithChangedAssets.add(lesson.id);
        }
      });

      SecureStorage.setItem('curriculum_data', cloudConfig.value);
      SecureStorage.setItem('curriculum_updated_at', cloudConfig.updated_at);
      await Promise.all(Array.from(lessonsWithChangedAssets, lessonId => clearLessonAssetCache(lessonId)));
      return {
        updated: true,
        newLessons: cloudCount,
        error: false
      };
    }

    return { updated: false, newLessons: 0, error: false };
  } catch (err) {
    console.warn('Auto-update check failed:', err);
    return { updated: false, newLessons: 0, error: true };
  }
}
