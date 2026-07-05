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
  console.log(`\nLesson ID: ${lesson.id}, Title: ${lesson.titleAr}`);
  if (lesson.quiz) {
    console.log(`  Original Quiz Questions Count: ${lesson.quiz.length}`);
    const seen = new Set();
    const uniqueQuestions = [];
    
    lesson.quiz.forEach(q => {
      const cleanText = q.textAr.trim();
      if (!seen.has(cleanText)) {
        seen.add(cleanText);
        uniqueQuestions.push(q);
      }
    });

    // Re-index the IDs sequentially
    uniqueQuestions.forEach((q, idx) => {
      q.id = idx + 1;
    });

    console.log(`  Cleaned Quiz Questions Count: ${uniqueQuestions.length}`);
    lesson.quiz = uniqueQuestions;
  }

  // Also clean duplicate flashcards just in case
  if (lesson.flashcards) {
    console.log(`  Original Flashcards Count: ${lesson.flashcards.length}`);
    const seenF = new Set();
    const uniqueFlashcards = [];
    lesson.flashcards.forEach(f => {
      const cleanQ = f.qAr.trim();
      if (!seenF.has(cleanQ)) {
        seenF.add(cleanQ);
        uniqueFlashcards.push(f);
      }
    });
    console.log(`  Cleaned Flashcards Count: ${uniqueFlashcards.length}`);
    lesson.flashcards = uniqueFlashcards;
  }
});

fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\nSuccessfully saved cleaned lessons_config.json');
