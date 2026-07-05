const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminDashboardScreen.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for loadFileForEditing or fileEditor:');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('loadFileForEditing') || line.includes('fileEditor') || line.includes('WYSIWYG')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
