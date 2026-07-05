const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminDashboardScreen.tsx');
if (!fs.existsSync(filePath)) {
  console.log('File not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Search diagrams in AdminDashboardScreen ---');
lines.forEach((line, index) => {
  if (line.includes('interactiveDiagrams') || line.includes('diagrams') || line.includes('Hotspot') || line.includes('hotspots')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
