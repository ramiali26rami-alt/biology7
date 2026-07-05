import fs from 'fs';
import readline from 'readline';

const logPath1 = 'C:/Users/HP/.gemini/antigravity/brain/dc2c2d34-c0b3-444e-8541-9a8565f19676/.system_generated/logs/transcript_full.jsonl';
const logPath2 = 'C:/Users/HP/.gemini/antigravity/brain/084197cd-e7fa-43aa-a736-203cd0696c64/.system_generated/logs/transcript_full.jsonl';

async function scan(logPath) {
  if (!fs.existsSync(logPath)) return;
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let stepCount = 0;
  for await (const line of rl) {
    stepCount++;
    if (line.includes('translations.ts') && line.includes('DONE')) {
      try {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('export const translations')) {
          console.log(`Found translations.ts content in ${logPath} at step ${stepCount}, length: ${obj.content.length}`);
          fs.writeFileSync('src/utils/translations.ts.bak', obj.content, 'utf-8');
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

async function run() {
  await scan(logPath1);
  await scan(logPath2);
}

run();
