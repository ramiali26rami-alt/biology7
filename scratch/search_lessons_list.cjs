const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'LessonsListScreen.tsx');
if (!fs.existsSync(filePath)) {
  console.log('LessonsListScreen.tsx not found');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching LessonsListScreen.tsx:');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('ملف') || line.includes('الملفات') || line.includes('مرفق') || line.includes('استكشف') || line.includes('احفظ') || line.includes('اختبر') || line.includes('المرفقة')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
