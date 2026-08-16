/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabaseClient';
import { decryptCurriculumData, SecureStorage } from './security';

export async function loadCurriculum(bypassCache = false): Promise<any> {
  // 1. Supabase Cloud First: Fetch latest live curriculum from cloud database
  try {
    const { data: cloudConfig, error: cloudErr } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'curriculum_data')
      .maybeSingle();

    if (!cloudErr && cloudConfig?.value && Array.isArray(cloudConfig.value) && cloudConfig.value.length > 0) {
      SecureStorage.setItem('curriculum_data', cloudConfig.value);
      return cloudConfig.value;
    }
  } catch (e) {
    console.warn('Supabase cloud curriculum load failed, falling back to local bundle:', e);
  }

  // 2. Local/Server JSON file fallback
  try {
    const res = await fetch(`/lessons_config.json?t=${Date.now()}`, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      let data;
      try {
        data = decryptCurriculumData(text);
      } catch {
        data = JSON.parse(text);
      }
      if (data && Array.isArray(data) && data.length > 0) {
        SecureStorage.setItem('curriculum_data', data);
        return data;
      }
    }
  } catch (e) {
    console.warn('Local bundle fetch failed:', e);
  }

  // 3. Offline storage cache fallback
  const cached = SecureStorage.getItem('curriculum_data');
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  return [];
}
