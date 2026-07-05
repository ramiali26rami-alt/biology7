/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import CryptoJS from 'crypto-js';

// Get device-specific cryptographic key
const getRuntimeKey = (): string => {
  let uuid = localStorage.getItem('client_device_uuid');
  if (!uuid) {
    uuid = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('client_device_uuid', uuid);
  }
  return `Biotech_2026_${uuid}`;
};

// Simple IndexedDB fallback for PWA/Web
class IndexedDBCache {
  private dbName = 'BiologyCurriculumCache';
  private storeName = 'AssetsStore';
  private db: IDBDatabase | null = null;

  private init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<string | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

const webCache = new IndexedDBCache();

// Helper to convert arrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to determine mime type
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

// Ensure native directory exists
async function ensureDirectoryExists(path: string) {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Data,
      recursive: true
    });
  } catch (e) {
    // Directory might already exist
  }
}

/**
 * Checks if a specific asset (PDF, Image) is already cached locally.
 */
export async function isAssetCached(lessonId: string, fileName: string): Promise<boolean> {
  const cleanFileName = fileName.replace(/\\|\//g, '_');
  const cacheKey = `lessons/${lessonId}/${cleanFileName}`;

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.stat({
        path: `lessons/${lessonId}/${cleanFileName}.bin`,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  } else {
    const cached = await webCache.get(cacheKey);
    return cached !== null;
  }
}

/**
 * Downloads an asset from the server, encrypts it (AES-256), and stores it locally.
 */
export async function cacheAsset(lessonId: string, fileName: string, serverUrl: string): Promise<void> {
  const cleanFileName = fileName.replace(/\\|\//g, '_');
  const cacheKey = `lessons/${lessonId}/${cleanFileName}`;

  try {
    // 1. Fetch file from server as ArrayBuffer
    const response = await fetch(serverUrl);
    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();

    // 2. Convert to Base64 string
    const base64Str = arrayBufferToBase64(buffer);

    // 3. Encrypt base64 string using AES-256
    const key = getRuntimeKey();
    const encryptedStr = CryptoJS.AES.encrypt(base64Str, key).toString();

    // 4. Save to storage
    if (Capacitor.isNativePlatform()) {
      await ensureDirectoryExists(`lessons/${lessonId}`);
      await Filesystem.writeFile({
        path: `lessons/${lessonId}/${cleanFileName}.bin`,
        data: encryptedStr,
        directory: Directory.Data,
        encoding: 'utf8' as any
      });
    } else {
      await webCache.set(cacheKey, encryptedStr);
    }
  } catch (err) {
    console.error(`Error caching asset ${fileName}:`, err);
    throw err;
  }
}

/**
 * Decrypts a cached asset in-memory and returns a temporary blob URL for rendering.
 */
export async function getCachedAssetUrl(lessonId: string, fileName: string, fallbackUrl?: string): Promise<string> {
  const cleanFileName = fileName.replace(/\\|\//g, '_');
  const cacheKey = `lessons/${lessonId}/${cleanFileName}`;

  try {
    let encryptedStr: string | null = null;

    if (Capacitor.isNativePlatform()) {
      try {
        const file = await Filesystem.readFile({
          path: `lessons/${lessonId}/${cleanFileName}.bin`,
          directory: Directory.Data,
          encoding: 'utf8' as any
        });
        encryptedStr = typeof file.data === 'string' ? file.data : '';
      } catch (e) {
        console.warn(`Asset not found in local cache: ${fileName}`);
      }
    } else {
      encryptedStr = await webCache.get(cacheKey);
    }

    if (!encryptedStr) {
      if (fallbackUrl) {
        // Fallback to direct network URL if not cached
        return fallbackUrl;
      }
      throw new Error(`Asset ${fileName} is not cached and no fallback URL was provided.`);
    }

    // Decrypt encrypted string in memory
    const key = getRuntimeKey();
    const bytes = CryptoJS.AES.decrypt(encryptedStr, key);
    const base64Str = bytes.toString(CryptoJS.enc.Utf8);
    if (!base64Str) {
      throw new Error(`Decryption failed for asset ${fileName}`);
    }

    // Convert Base64 back to Uint8Array/Blob
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: getMimeType(fileName) });

    // Create and return Blob URL
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(`Error retrieving cached asset ${fileName}:`, err);
    if (fallbackUrl) return fallbackUrl;
    throw err;
  }
}
