import fs from 'fs';
import path from 'path';

// Get date argument: npm run backup:restore -- 2026-06-15
const targetDate = process.argv[2];

if (!targetDate) {
  console.log('Usage: npm run backup:restore -- YYYY-MM-DD');
  const available = fs.existsSync('backups')
    ? fs.readdirSync('backups').filter(d => fs.statSync(path.join('backups', d)).isDirectory()).sort().reverse()
    : [];
  console.log('Available backups:', available.slice(0, 10));
  process.exit(1);
}

const backupDir = path.join('backups', targetDate);
if (!fs.existsSync(backupDir)) {
  console.log(`❌ No backup found for: ${targetDate}`);
  process.exit(1);
}

// Restore each file
const files = fs.readdirSync(backupDir);
files.forEach(backupFile => {
  const originalName = backupFile.split('_').slice(1).join('_');
  
  const destinations: Record<string, string> = {
    'activation_keys.json': 'data/activation_keys.json',
    'curriculum_version.json': 'data/curriculum_version.json',
    'lessons_config.json': 'public/lessons_config.json'
  };
  
  if (destinations[originalName]) {
    fs.copyFileSync(
      path.join(backupDir, backupFile),
      destinations[originalName]
    );
    console.log(`✅ Restored: ${originalName}`);
  }
});

console.log(`\n✅ Restore complete from: ${targetDate}`);
