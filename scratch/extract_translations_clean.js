import fs from 'fs';
import readline from 'readline';

const logPath = 'C:/Users/HP/.gemini/antigravity/brain/dc2c2d34-c0b3-444e-8541-9a8565f19676/.system_generated/logs/transcript_full.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let stepCount = 0;
  for await (const line of rl) {
    stepCount++;
    try {
      const obj = JSON.parse(line);
      
      if (obj.content && obj.content.includes('export const translations =')) {
        const lines = obj.content.split('\n');
        let cleanLines = [];
        for (const rawLine of lines) {
          const match = rawLine.match(/^\s*\d+:\s?(.*)$/);
          if (match) {
            cleanLines.push(match[1]);
          } else {
            if (rawLine.includes('export const translations =') || cleanLines.length > 0) {
              if (!rawLine.includes('Showing lines') && !rawLine.includes('Total Lines') && !rawLine.includes('The following code has been modified')) {
                cleanLines.push(rawLine);
              }
            }
          }
        }
        
        const cleanContent = cleanLines.join('\n');
        if (cleanContent.length > 10000) {
          const outName = `src/utils/translations.ts.step${stepCount}`;
          fs.writeFileSync(outName, cleanContent, 'utf-8');
          console.log(`Successfully wrote ${outName}, length: ${cleanContent.length}`);
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

run();
