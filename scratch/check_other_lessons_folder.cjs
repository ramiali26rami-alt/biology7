const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'public', 'lessons_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('Folders of all lessons:');
config.forEach(l => {
  console.log(` - Lesson ID: ${l.id}, folder: "${l.folder}"`);
});
