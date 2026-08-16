/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { decryptCurriculumData, SecureStorage } from './security';

function getServerUrl(): string {
  return (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || 'https://biology7.vercel.app').replace(/\/$/, '');
}

export async function loadCurriculum(bypassCache = false): Promise<any> {
  const isNative = Capacitor.isNativePlatform();
  const serverUrl = getServerUrl();

  // 1. Always attempt Network-First fetch of latest lessons_config.json (to get live curriculum changes immediately)
  try {
    const fetchUrl = isNative ? `${serverUrl}/lessons_config.json?t=${Date.now()}` : `/lessons_config.json?t=${Date.now()}`;
    const res = await fetch(fetchUrl, { cache: 'no-cache' });
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
    console.warn('Network curriculum fetch failed, checking cache:', e);
  }

  // 2. Try remote API endpoint /api/get-config
  try {
    const apiUrl = isNative ? `${serverUrl}/api/get-config?t=${Date.now()}` : `/api/get-config?t=${Date.now()}`;
    const res = await fetch(apiUrl, { cache: 'no-cache' });
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
    console.warn('API get-config failed:', e);
  }

  // 3. Fallback to cached curriculum in SecureStorage (for offline use)
  const cached = SecureStorage.getItem('curriculum_data');
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  return [];
}
