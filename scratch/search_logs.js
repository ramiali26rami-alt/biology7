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
    if (line.includes('AdminDashboardScreen.tsx')) {
      try {
        const obj = JSON.parse(line);
        console.log(`Step ${stepCount} type: ${obj.type}, source: ${obj.source}`);
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            console.log(`  Tool: ${tc.name}, keys in args: ${Object.keys(tc.args || {})}`);
            if (tc.args && tc.args.TargetFile) {
              console.log(`    TargetFile: ${tc.args.TargetFile}`);
            }
            if (tc.args && tc.args.AbsolutePath) {
              console.log(`    AbsolutePath: ${tc.args.AbsolutePath}`);
            }
          });
        }
      } catch (e) {
        // console.log(`Step ${stepCount} failed parsing JSON`);
      }
    }
  }
}

run();
