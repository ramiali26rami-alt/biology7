const fs = require('fs');
const path = require('path');

function walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== '.system_generated') {
        walk(fullPath);
      }
    } else {
      if (entry.name.toLowerCase().includes('admindashboard')) {
        const stat = fs.statSync(fullPath);
        console.log(`Found: ${fullPath} (${stat.size} bytes, modified: ${stat.mtime})`);
      }
    }
  }
}

console.log('Searching F:\\تطبيق case-insensitively...');
walk('f:\\تطبيق');
console.log('Search complete.');
