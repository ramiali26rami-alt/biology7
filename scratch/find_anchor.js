import fs from 'fs';

const content = fs.readFileSync('src/utils/translations.ts.step408_clean', 'utf-8');

const matches = [];
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('retake') || line.includes('Retake') || line.includes('إعادة')) {
    matches.push({ lineNum: i + 1, text: line });
  }
});

console.log("Matches in step408_clean:", matches);
