import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.biotech.biology',
  appName: 'الأحياء',
  webDir: process.env.CAPACITOR_WEB_DIR || 'dist'
};

export default config;
