/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { runBackup } from './backup.js';
import type { IncomingMessage, ServerResponse } from 'http';

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {

  // ─── GET /api/curriculum-version ───
  if (req.url === '/api/curriculum-version' && req.method === 'GET') {
    try {
      const versionPath = 'data/curriculum_version.json';
      if (!fs.existsSync(versionPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          version: '0.0.0',
          updatedAt: '',
          totalLessons: 0
        }));
        return;
      }
      const data = fs.readFileSync(versionPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'version_read_failed' }));
    }
    return;
  }

  // ─── GET /api/backups ───
  if (req.url === '/api/backups' && req.method === 'GET') {
    try {
      const backups = fs.existsSync('backups')
        ? fs.readdirSync('backups')
            .filter(d => fs.statSync(path.join('backups', d)).isDirectory())
            .sort()
            .reverse()
            .slice(0, 10)
        : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ backups }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ backups: [] }));
    }
    return;
  }

  // ─── Not an API route → pass to next ───
  next();
}

// Called after successful /api/save-config
export async function triggerBackupAfterSave(
  lessonsCount: number
): Promise<void> {

  // 1. Update version file atomically
  const versionPath = 'data/curriculum_version.json';
  const current = fs.existsSync(versionPath)
    ? JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
    : { version: '1.0.0' };

  const parts = (current.version as string).split('.');
  parts[2] = String(Number(parts[2]) + 1);

  const newVersion = {
    version: parts.join('.'),
    updatedAt: new Date().toISOString().split('T')[0],
    totalLessons: lessonsCount
  };

  const tempPath = versionPath + '_temp.json';
  fs.writeFileSync(
    tempPath,
    JSON.stringify(newVersion, null, 2),
    'utf-8'
  );
  fs.renameSync(tempPath, versionPath);

  // 2. Run backup asynchronously — never blocks response
  runBackup().catch(e =>
    console.warn('Backup failed silently:', e.message)
  );
}
