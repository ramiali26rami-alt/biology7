import fs from 'fs';
import readline from 'readline';

const logPath = 'C:/Users/HP/.gemini/antigravity/brain/084197cd-e7fa-43aa-a736-203cd0696c64/.system_generated/logs/transcript_full.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let stepCount = 0;
  for await (const line of rl) {
    stepCount++;
    if (line.includes('AdminDashboardScreen.tsx')) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.name === 'default_api:write_to_file' && tc.args.TargetFile && tc.args.TargetFile.endsWith('AdminDashboardScreen.tsx')) {
              console.log(`Step ${stepCount} wrote AdminDashboardScreen.tsx, CodeContent length: ${tc.args.CodeContent.length}`);
              // Save it to a temporary location
              fs.writeFileSync('src/components/AdminDashboardScreen.tsx.bak', tc.args.CodeContent, 'utf-8');
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

run();
