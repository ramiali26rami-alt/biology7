import fs from 'fs';
import path from 'path';
import { triggerBackupAfterSave } from '../src/server/apiMiddleware';

async function test() {
  console.log('--- STARTING FLOW TEST ---');
  const versionPath = 'data/curriculum_version.json';
  
  // Save current version
  let originalContent = '';
  if (fs.existsSync(versionPath)) {
    originalContent = fs.readFileSync(versionPath, 'utf-8');
    console.log('Original version content:', originalContent.trim());
  }

  // Set initial version for test
  const initial = { version: '1.0.0', updatedAt: '2026-01-01', totalLessons: 0 };
  fs.writeFileSync(versionPath, JSON.stringify(initial, null, 2), 'utf-8');
  console.log('Set initial test version: 1.0.0');

  // Trigger backup after save
  console.log('Triggering triggerBackupAfterSave with count = 42...');
  await triggerBackupAfterSave(42);

  // Give a small delay for async backup
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check updated version
  const updatedContent = fs.readFileSync(versionPath, 'utf-8');
  console.log('Updated version content:', updatedContent.trim());
  const updatedObj = JSON.parse(updatedContent);

  if (updatedObj.version === '1.0.1' && updatedObj.totalLessons === 42) {
    console.log('✅ Version increment test passed!');
  } else {
    console.error('❌ Version increment test failed!');
  }

  // Check backup directory for today
  const today = new Date().toISOString().split('T')[0];
  const backupDir = path.join('backups', today);
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    console.log(`✅ Backup directory exists for today (${today}). Files:`, files);
  } else {
    console.error(`❌ Backup directory does not exist for today!`);
  }

  // Restore original content
  if (originalContent) {
    fs.writeFileSync(versionPath, originalContent, 'utf-8');
    console.log('Restored original version content.');
  }
  console.log('--- FLOW TEST COMPLETE ---');
}

test().catch(err => {
  console.error('Error running test:', err);
});
