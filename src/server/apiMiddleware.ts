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
      const KV_REST_API_URL = process.env.KV_REST_API_URL;
      const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
      if (KV_REST_API_URL && KV_REST_API_TOKEN) {
        const resKv = await fetch(KV_REST_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(['GET', 'curriculum_version'])
        });
        if (resKv.ok) {
          const resKvData = await resKv.json();
          if (resKvData && resKvData.result) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(resKvData.result);
            return;
          }
        }
      }

      const versionPath = 'data/curriculum_version.json';
      if (!fs.existsSync(versionPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          version: '1.0.0',
          updatedAt: new Date().toISOString().split('T')[0],
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
  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

  // 1. Update version file
  let current = { version: '1.0.0' };

  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    try {
      const resKv = await fetch(KV_REST_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', 'curriculum_version'])
      });
      if (resKv.ok) {
        const resKvData = await resKv.json();
        if (resKvData && resKvData.result) {
          current = JSON.parse(resKvData.result);
        }
      }
    } catch (e) {
      console.warn("KV version fetch failed:", e);
    }
  } else {
    const versionPath = 'data/curriculum_version.json';
    if (fs.existsSync(versionPath)) {
      current = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    }
  }

  const parts = (current.version as string).split('.');
  parts[2] = String(Number(parts[2]) + 1);

  const newVersion = {
    version: parts.join('.'),
    updatedAt: new Date().toISOString().split('T')[0],
    totalLessons: lessonsCount
  };

  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    try {
      await fetch(KV_REST_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'curriculum_version', JSON.stringify(newVersion)])
      });
    } catch (e) {
      console.warn("KV version set failed:", e);
    }
  }

  const versionPath = 'data/curriculum_version.json';
  try {
    const tempPath = versionPath + '_temp.json';
    fs.writeFileSync(
      tempPath,
      JSON.stringify(newVersion, null, 2),
      'utf-8'
    );
    fs.renameSync(tempPath, versionPath);
  } catch (e) {
    console.warn("Local version file write skipped/failed:", e.message);
  }

  // 2. Run backup asynchronously — never blocks response
  runBackup().catch(e =>
    console.warn('Backup failed silently:', e.message)
  );
}
