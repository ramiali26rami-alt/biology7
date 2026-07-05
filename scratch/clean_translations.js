import fs from 'fs';

const logPath = 'C:/Users/HP/.gemini/antigravity/brain/dc2c2d34-c0b3-444e-8541-9a8565f19676/.system_generated/logs/transcript_full.jsonl';
const fileStream = fs.readFileSync(logPath, 'utf-8');
const lines = fileStream.split('\n');

let step10Line = null;
let stepCount = 0;
for (const line of lines) {
  if (!line.trim()) continue;
  stepCount++;
  if (stepCount === 10) {
    step10Line = line;
    break;
  }
}

if (!step10Line) {
  console.log("Could not find step 10");
  process.exit(1);
}

const obj = JSON.parse(step10Line);
const rawContent = obj.content || '';

console.log("Raw content sample:\n", rawContent.slice(0, 500));
