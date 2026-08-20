/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';
import { logger } from './logger';

// Secure device UUID generator
function generateSecureUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Cryptographic fallback for older browsers
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

const getRuntimeKey = (): string => {
  let uuid = localStorage.getItem('client_device_uuid');
  if (!uuid) {
    uuid = generateSecureUuid();
    localStorage.setItem('client_device_uuid', uuid);
  }
  return `Biotech_2026_${uuid}`;
};

export const SecureStorage = {
  setItem(key: string, value: any): void {
    try {
      const secret = getRuntimeKey();
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = CryptoJS.AES.encrypt(stringValue, secret).toString();
      localStorage.setItem(key, encrypted);
    } catch (e) {
      logger.error(`SecureStorage.setItem error for key "${key}":`, e);
    }
  },

  getItem(key: string): any {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      const secret = getRuntimeKey();
      const bytes = CryptoJS.AES.decrypt(encrypted, secret);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) return null;
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (e) {
      logger.error(`SecureStorage.getItem error for key "${key}":`, e);
      return null;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
};

export function decryptCurriculumData(encryptedText: string): any {
  const secret = getRuntimeKey();
  const bytes = CryptoJS.AES.decrypt(encryptedText, secret);
  const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedText) {
    throw new Error('Decryption failed: empty result');
  }
  return JSON.parse(decryptedText);
}

export function checkPremiumStatus(): boolean {
  try {
    let deviceUuid = localStorage.getItem('client_device_uuid');
    if (!deviceUuid) {
      deviceUuid = generateSecureUuid();
      localStorage.setItem('client_device_uuid', deviceUuid);
    }

    const rawUnlocked = SecureStorage.getItem('premium_unlocked');
    const isUnlocked = rawUnlocked === true || rawUnlocked === 'true';
    if (isUnlocked) return true;

    // Check stored signature
    const storedSig = SecureStorage.getItem('premium_signature') || localStorage.getItem('premium_signature');
    const expectedSig = CryptoJS.SHA256(deviceUuid + "_AlhayaaBiologyPremium_2026_SecuredSalt").toString();
    if (storedSig && storedSig === expectedSig) return true;

    // Check fallback status object
    const rawStatus = SecureStorage.getItem('premium_status');
    if (rawStatus) {
      try {
        const parsed = typeof rawStatus === 'string' ? JSON.parse(rawStatus) : rawStatus;
        if (parsed?.unlocked === true) return true;
      } catch {}
    }
  } catch (e) {}
  return false;
}

export function setPremiumUnlockedState(unlocked: boolean): void {
  try {
    let deviceUuid = localStorage.getItem('client_device_uuid');
    if (!deviceUuid) {
      deviceUuid = generateSecureUuid();
      localStorage.setItem('client_device_uuid', deviceUuid);
    }

    if (unlocked) {
      SecureStorage.setItem('premium_unlocked', true);
      const sig = CryptoJS.SHA256(deviceUuid + "_AlhayaaBiologyPremium_2026_SecuredSalt").toString();
      SecureStorage.setItem('premium_signature', sig);
      SecureStorage.setItem('premium_status', {
        unlocked: true,
        activatedAt: Date.now(),
        deviceUuid
      });
      localStorage.setItem('premium_signature', sig);
    } else {
      SecureStorage.setItem('premium_unlocked', false);
      SecureStorage.removeItem('premium_signature');
      SecureStorage.removeItem('premium_status');
      localStorage.removeItem('premium_signature');
    }
  } catch (e) {
    logger.error("Error setting premium status:", e);
  }
}
