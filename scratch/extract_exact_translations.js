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

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      // We want to find steps where the tool VIEW_FILE returned the translations file.
      // In Antigravity system, a tool response step has type: "VIEW_FILE" or content containing file text.
      if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('export const translations =')) {
        console.log(`Found VIEW_FILE step ${obj.step_index} in ${logPath}, length: ${obj.content.length}`);
        
        // Clean line numbers
        const rawLines = obj.content.split('\n');
        let cleanLines = [];
        for (const rawLine of rawLines) {
          // Line numbers in view_file are like "12:   lessons: 'الدروس'," or "1: /**"
          const match = rawLine.match(/^\s*\d+:\s?(.*)$/);
          if (match) {
            cleanLines.push(match[1]);
          } else {
            // Check if it's metadata or headers
            if (rawLine.includes('export const translations =') || cleanLines.length > 0) {
              if (!rawLine.includes('Showing lines') && !rawLine.includes('Total Lines') && !rawLine.includes('The following code has been modified')) {
                cleanLines.push(rawLine);
              }
            }
          }
        }
        
        const cleanContent = cleanLines.join('\n');
        if (cleanContent.length > 20000) {
          const outName = `src/utils/translations.ts.step${obj.step_index}_clean`;
          fs.writeFileSync(outName, cleanContent, 'utf-8');
          console.log(`Wrote clean file to ${outName}, length: ${cleanContent.length}`);
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

async function run() {
  await scan(logPath1);
  await scan(logPath2);
}

run();
