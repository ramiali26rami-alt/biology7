import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const UPDATE_MANIFEST_URL = 'https://github.com/ramiali26rami-alt/biology7/releases/latest/download/update.json';

export interface AppUpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  mandatory?: boolean;
  notesAr?: string;
  notesEn?: string;
}

interface AppUpdaterPlugin {
  installUpdate(options: { url: string; sha256: string }): Promise<{
    started?: boolean;
    permissionRequired?: boolean;
  }>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

function isValidManifest(value: unknown): value is AppUpdateManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Record<string, unknown>;
  return Number.isInteger(manifest.versionCode)
    && Number(manifest.versionCode) > 0
    && typeof manifest.versionName === 'string'
    && typeof manifest.apkUrl === 'string'
    && String(manifest.apkUrl).startsWith('https://')
    && typeof manifest.sha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(String(manifest.sha256));
}

export async function checkForAppUpdate(): Promise<AppUpdateManifest | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const manifest: unknown = await response.json();
    if (!isValidManifest(manifest)) return null;
    const current = await App.getInfo();
    return manifest.versionCode > Number(current.build) ? manifest : null;
  } catch (error) {
    console.warn('Android app update check failed:', error);
    return null;
  }
}

export async function installAppUpdate(manifest: AppUpdateManifest) {
  return AppUpdater.installUpdate({
    url: manifest.apkUrl,
    sha256: manifest.sha256.toLowerCase()
  });
}
