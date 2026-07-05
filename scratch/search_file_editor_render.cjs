const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminDashboardScreen.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for fileEditorPath render block:');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('fileEditorPath') && (line.includes('&&') || line.includes('?'))) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
