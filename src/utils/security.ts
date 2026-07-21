/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';

const getRuntimeKey = (): string => {
  let uuid = localStorage.getItem('client_device_uuid');
  if (!uuid) {
    uuid = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
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
      console.error(`Error encrypting key ${key}:`, e);
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
      console.error(`Error decrypting key ${key}:`, e);
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
    throw new Error('Decryption failed, result is empty');
  }
  return JSON.parse(decryptedText);
}
