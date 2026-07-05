/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { decryptCurriculumData, SecureStorage } from './security';

export async function loadCurriculum(): Promise<any> {
  const isLocalDev = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.5.1' || 
    window.location.hostname === '127.0.0.1';

  // 1. Check secure storage cache first (bypass in local dev to see config changes instantly)
  const cached = SecureStorage.getItem('curriculum_data');
  if (cached && !isLocalDev) return cached;

  // 2. Fallback to locally bundled file (works 100% offline on first run)
  try {
    const res = await fetch(`/lessons_config.json?t=${Date.now()}`);
    const text = await res.text();
    let data;
    try {
      data = decryptCurriculumData(text);
    } catch {
      data = JSON.parse(text);
    }
    if (data) {
      SecureStorage.setItem('curriculum_data', data);
      return data;
    }
  } catch (e) {
    console.warn('Local bundle load failed:', e);
  }

  // 3. Remote fallback if local bundle fails
  try {
    const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${SERVER_URL}/lessons_config.json?t=${Date.now()}`);
    const text = await res.text();
    let data;
    try {
      data = decryptCurriculumData(text);
    } catch {
      data = JSON.parse(text);
    }
    SecureStorage.setItem('curriculum_data', data);
    return data;
  } catch (e) {
    console.error('Remote curriculum load failed:', e);
    return null;
  }
}
