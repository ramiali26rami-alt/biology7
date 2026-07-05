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
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.name === 'default_api:view_file' && tc.args.AbsolutePath.endsWith('AdminDashboardScreen.tsx')) {
              console.log(`Step ${stepCount} view_file args: StartLine=${tc.args.StartLine}, EndLine=${tc.args.EndLine}`);
            }
          }
        }
        // Let's also check tool responses (outputs) if they are stored in the same line or step
        if (obj.status === 'DONE' && obj.content && obj.content.includes('export default function AdminDashboardScreen')) {
          console.log(`Step ${stepCount} contains AdminDashboardScreen definition in content! Length: ${obj.content.length}`);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

run();
