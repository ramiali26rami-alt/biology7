/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

const FILES_TO_BACKUP = [
  'data/activation_keys.json',
  'data/curriculum_version.json',
  'public/lessons_config.json'
];

const MAX_BACKUPS = 30;

export async function runBackup(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const backupDir = path.join('backups', today);

  if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups');
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  for (const filePath of FILES_TO_BACKUP) {
    if (fs.existsSync(filePath)) {
      const fileName = path.basename(filePath);
      const timestamp = new Date()
        .toTimeString()
        .slice(0, 5)
        .replace(':', '-');
      fs.copyFileSync(
        filePath,
        path.join(backupDir, `${timestamp}_${fileName}`)
      );
      console.log(`✅ Backed up: ${fileName}`);
    } else {
      console.warn(`⚠️ Not found: ${filePath}`);
    }
  }

  // Clean old backups — keep last 30 only
  const allBackups = fs.readdirSync('backups')
    .filter(d =>
      fs.statSync(path.join('backups', d)).isDirectory()
    )
    .sort();

  if (allBackups.length > MAX_BACKUPS) {
    allBackups
      .slice(0, allBackups.length - MAX_BACKUPS)
      .forEach(dir => {
        fs.rmSync(path.join('backups', dir), {
          recursive: true
        });
        console.log(`🗑️ Deleted old backup: ${dir}`);
      });
  }

  console.log(`✅ Backup complete: ${today}`);
}
