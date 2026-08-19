/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabaseClient';
import { SecureStorage } from './security';
import { clearAllAssetCache } from './cacheManager';

export async function checkAndUpdate(): Promise<{
  updated: boolean;
  newLessons: number;
  error: boolean;
}> {
  try {
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
      SecureStorage.setItem('curriculum_data', cloudConfig.value);
      SecureStorage.setItem('curriculum_updated_at', cloudConfig.updated_at);
      // Invalidate media cache so updated diagrams and PDFs are freshly retrieved
      await clearAllAssetCache();
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
