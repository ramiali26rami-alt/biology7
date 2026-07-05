const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminDashboardScreen.tsx');
if (!fs.existsSync(filePath)) {
  console.log('File not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Search active view states ---');
lines.forEach((line, index) => {
  if (line.includes('activeTab') || line.includes('activeView') || line.includes('currentView') || line.includes('useState') || line.includes('renderView') || line.includes('view ===') || line.includes('renderContent')) {
    if (index > 40 && index < 220) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
