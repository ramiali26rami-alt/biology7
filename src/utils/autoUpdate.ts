/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecureStorage } from './security';

const SERVER_URL = (
  import.meta.env.VITE_SERVER_URL ?? ''
).replace(/\/$/, '');

export async function checkAndUpdate(): Promise<{
  updated: boolean;
  newLessons: number;
  error: boolean;
}> {
  try {
    const storedVersion =
      SecureStorage.getItem('curriculum_version')
      ?? '0.0.0';

    // 5 second timeout — never hangs the app
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(), 5000
    );

    const response = await fetch(
      `${SERVER_URL}/api/curriculum-version`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      return { 
        updated: false, 
        newLessons: 0, 
        error: true 
      };
    }

    const serverData = await response.json();

    // No update needed
    if (serverData.version === storedVersion) {
      return { 
        updated: false, 
        newLessons: 0, 
        error: false 
      };
    }

    // New version — download full curriculum
    const curriculumRes = await fetch(
      `${SERVER_URL}/lessons_config.json?t=${Date.now()}`
    );

    if (!curriculumRes.ok) {
      return { 
        updated: false, 
        newLessons: 0, 
        error: true 
      };
    }

    const curriculumText = await curriculumRes.text();
    let newCurriculum;
    try {
      const { decryptCurriculumData } = await import('./security');
      newCurriculum = decryptCurriculumData(curriculumText);
    } catch {
      newCurriculum = JSON.parse(curriculumText);
    }

    // Store encrypted locally
    SecureStorage.setItem(
      'curriculum_data', newCurriculum
    );
    SecureStorage.setItem(
      'curriculum_version', serverData.version
    );
    SecureStorage.setItem(
      'curriculum_updated_at', serverData.updatedAt
    );

    return {
      updated: true,
      newLessons: serverData.totalLessons,
      error: false
    };

  } catch (err) {
    console.warn('Auto-update check failed:', err);
    // Silent fail — app always works with local data
    return { 
      updated: false, 
      newLessons: 0, 
      error: true 
    };
  }
}
