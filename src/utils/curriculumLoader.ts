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

  // 2. Fetch from database endpoint (/api/get-config)
  try {
    const res = await fetch(`/api/get-config?t=${Date.now()}`);
    if (res.ok) {
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
    }
  } catch (e) {
    console.warn('API config load failed, trying file fallback:', e);
  }

  // 3. Fallback to locally bundled file (works 100% offline on first run)
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

  // 4. Remote fallback if local bundle fails
  try {
    const SERVER_URL = (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
    const res = await fetch(`${SERVER_URL}/api/get-config?t=${Date.now()}`);
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
