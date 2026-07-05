const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'public', 'lessons_config.json');
if (!fs.existsSync(configPath)) {
  console.log('File not found');
  process.exit(1);
}

const raw = fs.readFileSync(configPath, 'utf8');
const data = JSON.parse(raw);

data.forEach(lesson => {
  console.log(`Lesson ID: ${lesson.id}, Title: ${lesson.titleAr}`);
  if (lesson.quiz) {
    console.log(`  Quiz Questions Count: ${lesson.quiz.length}`);
    const seen = new Set();
    const dups = [];
    lesson.quiz.forEach(q => {
      const txt = q.textAr;
      if (seen.has(txt)) {
        dups.push(txt);
      } else {
        seen.add(txt);
      }
    });
    if (dups.length > 0) {
      console.log(`    ⚠️ Found ${dups.length} duplicates:`, dups);
    }
  }
});
