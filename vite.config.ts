import dotenv from 'dotenv';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { 
  handleApiRequest, 
  triggerBackupAfterSave 
} from './src/server/apiMiddleware';

dotenv.config();


/** Helper: collect full request body */
function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

/** Re-scan public folder and refresh detected_assets.json */
function rescanAssets(publicDir: string) {
  const outputFile = path.join(publicDir, 'detected_assets.json');
  const groups: Record<string, { path: string; name: string; files: string[] }> = {};

  function walk(dir: string) {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = path.relative(publicDir, fullPath).replace(/\\/g, '/');
        const parts = relPath.split('/');
        if (parts.length > 1) {
          const fileName = parts.pop()!;
          const folderPath = parts.join('/');
          const folderName = parts[parts.length - 1];
          if (!groups[folderPath]) {
            groups[folderPath] = { path: folderPath, name: folderName, files: [] };
          }
          groups[folderPath].files.push(fileName);
        }
      }
    }
  }

  if (fs.existsSync(publicDir)) {
    walk(publicDir);
    fs.writeFileSync(outputFile, JSON.stringify({ folders: Object.values(groups) }, null, 2));
  }
}

/** JSON response helper */
function jsonRes(res: any, data: object, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'admin-local-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            let nextCalled = false;
            await handleApiRequest(req, res, () => { nextCalled = true; });
            if (!nextCalled) return;

            const publicDir = path.resolve(__dirname, 'public');
            const dataDir = path.resolve(__dirname, 'data');

            // Smart Static Asset Fallback Middleware for Images and PDFs
            if (req.method === 'GET' && req.url) {
              try {
                const urlObj = new URL(req.url, `http://localhost`);
                const decodedPath = decodeURIComponent(urlObj.pathname);
                const ext = path.extname(decodedPath).toLowerCase();
                
                if (['.webp', '.png', '.jpg', '.jpeg', '.pdf'].includes(ext)) {
                  const replaceDigits = (str: string, toArabic: boolean): string => {
                    const english = ['0','1','2','3','4','5','6','7','8','9'];
                    const arabic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
                    let resStr = str;
                    for (let i = 0; i < 10; i++) {
                      if (toArabic) {
                        resStr = resStr.replaceAll(english[i], arabic[i]);
                      } else {
                        resStr = resStr.replaceAll(arabic[i], english[i]);
                      }
                    }
                    return resStr;
                  };

                  let fullPath = path.join(publicDir, decodedPath);
                  
                  // Try to find the file by translating English numbers -> Arabic numbers in path
                  if (!fs.existsSync(fullPath)) {
                    const arabicPath = replaceDigits(decodedPath, true);
                    const tryPath = path.join(publicDir, arabicPath);
                    if (fs.existsSync(tryPath)) {
                      fullPath = tryPath;
                    }
                  }

                  // Try to find the file by translating Arabic numbers -> English numbers in path
                  if (!fs.existsSync(fullPath)) {
                    const englishPath = replaceDigits(decodedPath, false);
                    const tryPath = path.join(publicDir, englishPath);
                    if (fs.existsSync(tryPath)) {
                      fullPath = tryPath;
                    }
                  }

                  // If the file STILL does not exist, try to find any file of the same extension in the same directory
                  if (!fs.existsSync(fullPath)) {
                    const dir = path.dirname(fullPath);
                    if (fs.existsSync(dir)) {
                      const files = fs.readdirSync(dir);
                      const fallbackFile = files.find(f => path.extname(f).toLowerCase() === ext);
                      if (fallbackFile) {
                        fullPath = path.join(dir, fallbackFile);
                      }
                    } else {
                      // Maybe the directory path itself was written with different digits
                      const arabicDir = replaceDigits(dir, true);
                      if (fs.existsSync(arabicDir)) {
                        const files = fs.readdirSync(arabicDir);
                        const fallbackFile = files.find(f => path.extname(f).toLowerCase() === ext);
                        if (fallbackFile) {
                          fullPath = path.join(arabicDir, fallbackFile);
                        }
                      } else {
                        const englishDir = replaceDigits(dir, false);
                        if (fs.existsSync(englishDir)) {
                          const files = fs.readdirSync(englishDir);
                          const fallbackFile = files.find(f => path.extname(f).toLowerCase() === ext);
                          if (fallbackFile) {
                            fullPath = path.join(englishDir, fallbackFile);
                          }
                        }
                      }
                    }
                  }

                  // If we finally found a valid file, serve it!
                  if (fs.existsSync(fullPath)) {
                    res.setHeader('Content-Type', ext === '.pdf' ? 'application/pdf' : `image/${ext.substring(1)}`);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.end(fs.readFileSync(fullPath));
                    return;
                  }
                }
              } catch (e) {
                console.error('Smart asset fallback error:', e);
              }
            }
            
            // Migrate activation_keys.json from public to data for security if it exists
            const oldKeysPath = path.join(publicDir, 'activation_keys.json');
            const newKeysPath = path.join(dataDir, 'activation_keys.json');
            if (fs.existsSync(oldKeysPath)) {
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
              }
              fs.copyFileSync(oldKeysPath, newKeysPath);
              fs.unlinkSync(oldKeysPath);
            }

            // ─── OPTIONS pre-flight ───────────────────────────────────────
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key, x-admin-passcode');
              res.statusCode = 204;
              res.end();
              return;
            }

            // ─── POST /api/save-config ────────────────────────────────────
            // Body: JSON array of lessons → writes public/lessons_config.json
            if (req.url === '/api/save-config' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const data = JSON.parse(body);
                // Auto-Backup before overwrite
                const configPath = path.join(publicDir, 'lessons_config.json');
                if (fs.existsSync(configPath)) {
                  const backupsDir = path.join(dataDir, 'backups');
                  if (!fs.existsSync(backupsDir)) {
                    fs.mkdirSync(backupsDir, { recursive: true });
                  }
                  const now = new Date();
                  const yyyymmdd = now.getFullYear() +
                    String(now.getMonth() + 1).padStart(2, '0') +
                    String(now.getDate()).padStart(2, '0');
                  const hhmmss = String(now.getHours()).padStart(2, '0') +
                    String(now.getMinutes()).padStart(2, '0') +
                    String(now.getSeconds()).padStart(2, '0');
                  const backupFilename = `lessons_config_${yyyymmdd}_${hhmmss}.json`;
                  fs.copyFileSync(configPath, path.join(backupsDir, backupFilename));
                }

                fs.writeFileSync(
                  configPath,
                  JSON.stringify(data, null, 2),
                  'utf-8'
                );
                await triggerBackupAfterSave(data.length);
                jsonRes(res, { success: true });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── POST /api/tutor-chat ─────────────────────────────────────
            if (req.url === '/api/tutor-chat' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const { messages, lessonTitle, lessonSummary } = JSON.parse(body);

                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                  jsonRes(res, { error: 'Missing or invalid messages parameter.' }, 400);
                  return;
                }

                const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  jsonRes(res, { error: 'Missing API Key. Please supply a Gemini API key in settings or set GEMINI_API_KEY in process env.' }, 400);
                  return;
                }

                const { GoogleGenAI } = await import('@google/genai');
                const ai = new GoogleGenAI({ apiKey: String(apiKey) });

                const systemInstruction = `أنت معلم أحياء يمني خبير ومساعد ذكي للطلاب في الصف الثالث الثانوي (القسم العلمي).
مهمتك هي الإجابة على أسئلة الطلاب بأسلوب تربوي، سهل ومبسط، وباللغة العربية الفصحى.

شروط صارمة للإجابة:
1. التزم تماماً بالمصطلحات العلمية والتعاريف المعتمدة في منهج الأحياء اليمني للمرحلة الثانوية.
2. أجب باختصار ووضوح، واستخدم التنسيق (مثل النقاط والخطوط العريضة) لتسهيل القراءة على شاشات الهواتف.
3. إذا كان سؤال الطالب غير متعلق بعلم الأحياء أو المنهج الدراسي، اعتذر منه بلطف ووجهه لطرح أسئلة في مادة الأحياء فقط.
4. إذا سأل الطالب سؤالاً يتعلق بدرس آخر غير الدرس المفتوح، أجب عليه بدقة علمية مع الإشارة بلطف إلى أن هذا الموضوع ينتمي لدرس آخر في المنهج.`;

                let context = '';
                if (lessonTitle) {
                  context += `\nالدرس الحالي الذي يتصفحه الطالب هو: "${lessonTitle}"`;
                }
                if (lessonSummary) {
                  const summaryText = Array.isArray(lessonSummary) ? lessonSummary.join('\n') : String(lessonSummary);
                  if (summaryText.trim()) {
                    context += `\nملخص الدرس المعتمد:\n${summaryText}`;
                  }
                }

                let promptText = `${systemInstruction}\n`;
                if (context) {
                  promptText += `\n${context}\n`;
                }

                promptText += `\nسجل المحادثة السابقة بينك وبين الطالب (مرتبة زمنياً):\n`;
                messages.forEach((msg: any, idx: number) => {
                  const sender = msg.role === 'user' ? 'الطالب' : 'المعلم الافتراضي';
                  const textVal = msg.content || msg.text || '';
                  if (idx === messages.length - 1 && msg.role === 'user') {
                    promptText += `[السؤال الجديد للطالب]: ${textVal}\n`;
                  } else {
                    promptText += `[${sender}]: ${textVal}\n`;
                  }
                });

                promptText += `\nالآن، قم بصياغة الإجابة التربوية المناسبة للسؤال الجديد للطالب باللغة العربية:`;

                const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: promptText
                });

                const text = response.text;
                if (!text) {
                  jsonRes(res, { error: 'Gemini returned an empty response.' }, 500);
                  return;
                }

                jsonRes(res, { success: true, reply: text });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── POST /api/generate-quiz ──────────────────────────────────
            // Body: { lessonTitleAr, lessonTitleEn, lessonSummaryAr, lessonSummaryEn, questionCount, questionType }
            if (req.url === '/api/generate-quiz' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const {
                  lessonTitleAr,
                  lessonTitleEn,
                  lessonSummaryAr,
                  lessonSummaryEn,
                  questionCount,
                  questionType
                } = JSON.parse(body);

                const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  jsonRes(res, { error: 'Missing API Key. Please supply a Gemini API key in settings or set GEMINI_API_KEY in process env.' }, 400);
                  return;
                }

                const { GoogleGenAI } = await import('@google/genai');
                const ai = new GoogleGenAI({ apiKey: String(apiKey) });

                const prompt = `You are a professional biology teacher generating high-quality exam questions for the Yemeni 3rd Secondary biology syllabus.
Generate exactly ${questionCount} questions based on the following lesson details:
- Arabic Title: ${lessonTitleAr}
- English Title: ${lessonTitleEn}
- Arabic Summary: ${Array.isArray(lessonSummaryAr) ? lessonSummaryAr.join(', ') : lessonSummaryAr}
- English Summary: ${Array.isArray(lessonSummaryEn) ? lessonSummaryEn.join(', ') : lessonSummaryEn}

The questions must be generated in BOTH Arabic and English.
Question Type requested: ${questionType} (can be: 'mcq' for Multiple Choice, 'tf' for True/False, 'fill' for Fill in the Blanks, or 'all' for a mix of these).

Rules for each question type:
1. 'mcq': Must have exactly 4 options with keys "A", "B", "C", "D". correctKey must be one of "A", "B", "C", "D".
2. 'tf': Must have exactly 2 options:
   - Option A: key: "T", textAr: "✔️ صح", textEn: "True"
   - Option B: key: "F", textAr: "❌ خطأ", textEn: "False"
   correctKey must be "T" or "F".
3. 'fill': Must have correctAnswers array containing acceptable text answers in Arabic and English (e.g. the exact terms). No options/correctKey should be set.

For every question, write detailed explanationAr (in Arabic) and explanationEn (in English) explaining why the answer is correct based on biological facts.
Ensure the returned output conforms exactly to the ConfigQuestion schema.`;

                const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          id: { type: 'INTEGER' },
                          type: { type: 'STRING', enum: ['mcq', 'tf', 'fill'] },
                          textAr: { type: 'STRING' },
                          textEn: { type: 'STRING' },
                          options: {
                            type: 'ARRAY',
                            items: {
                              type: 'OBJECT',
                              properties: {
                                key: { type: 'STRING' },
                                textAr: { type: 'STRING' },
                                textEn: { type: 'STRING' }
                              },
                              required: ['key', 'textAr', 'textEn']
                            }
                          },
                          correctKey: { type: 'STRING' },
                          correctAnswers: {
                            type: 'ARRAY',
                            items: { type: 'STRING' }
                          },
                          explanationAr: { type: 'STRING' },
                          explanationEn: { type: 'STRING' }
                        },
                        required: ['id', 'type', 'textAr', 'textEn', 'explanationAr', 'explanationEn']
                      }
                    }
                  }
                });

                const text = response.text;
                if (!text) {
                  jsonRes(res, { error: 'Gemini returned an empty response.' }, 500);
                  return;
                }

                const generatedQuestions = JSON.parse(text);
                jsonRes(res, { success: true, quiz: generatedQuestions });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            const saveKeysAtomic = (filePath: string, data: any) => {
              const tempPath = filePath + '.' + Math.random().toString(36).substring(2) + '.tmp';
              fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
              fs.renameSync(tempPath, filePath);
            };

            // ─── GET /api/activation-keys ──────────────────────────────────
            if (req.url === '/api/activation-keys' && req.method === 'GET') {
              const passcode = req.headers['x-admin-passcode'];
              if (passcode !== '2026') {
                jsonRes(res, { error: 'Unauthorized admin access' }, 401);
                return;
              }
              const keysFilePath = path.join(dataDir, 'activation_keys.json');
              let keys = [];
              if (fs.existsSync(keysFilePath)) {
                try {
                  keys = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
                } catch (e) {
                  keys = [];
                }
              }
              jsonRes(res, { keys });
              return;
            }

            // ─── POST /api/generate-keys ───────────────────────────────────
            if (req.url === '/api/generate-keys' && req.method === 'POST') {
              const passcode = req.headers['x-admin-passcode'];
              if (passcode !== '2026') {
                jsonRes(res, { error: 'Unauthorized admin access' }, 401);
                return;
              }
              const body = await readBody(req);
              try {
                const { count } = JSON.parse(body);
                const keysCount = Number(count) || 10;
                const keysFilePath = path.join(dataDir, 'activation_keys.json');
                let existingKeys = [];
                if (fs.existsSync(keysFilePath)) {
                  try {
                    existingKeys = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
                  } catch (e) {
                    existingKeys = [];
                  }
                }

                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const gen = (len: number) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                
                const newKeys = [];
                for (let i = 0; i < keysCount; i++) {
                  const key = `BIOTECH-${gen(4)}-${gen(4)}`;
                  newKeys.push({
                    key,
                    status: 'unused',
                    usedBy: '',
                    activatedAt: ''
                  });
                }

                const updatedKeys = [...existingKeys, ...newKeys];
                saveKeysAtomic(keysFilePath, updatedKeys);
                jsonRes(res, { success: true, keys: updatedKeys });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── POST /api/activate-key ────────────────────────────────────
            if (req.url === '/api/activate-key' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const { key, studentName, deviceUuid } = JSON.parse(body);
                if (!key || !key.trim()) {
                  jsonRes(res, { error: 'Missing key parameter' }, 400);
                  return;
                }

                const keysFilePath = path.join(dataDir, 'activation_keys.json');
                let keys = [];
                if (fs.existsSync(keysFilePath)) {
                  try {
                    keys = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
                  } catch (e) {
                    keys = [];
                  }
                }

                const targetKey = key.trim().toUpperCase();
                const keyIndex = keys.findIndex((k: any) => k.key.toUpperCase() === targetKey);

                if (keyIndex === -1) {
                  jsonRes(res, { error: 'invalid' }, 400);
                  return;
                }

                const keyData = keys[keyIndex];
                const clientUuid = deviceUuid || 'default';

                if (keyData.status === 'used') {
                  if (keyData.deviceUuid && keyData.deviceUuid !== clientUuid) {
                    jsonRes(res, { error: 'already_used_other_device' }, 400);
                    return;
                  }
                  jsonRes(res, { success: true });
                  return;
                }

                // Update key details
                keyData.status = 'used';
                keyData.usedBy = studentName || 'Unknown Student';
                keyData.activatedAt = new Date().toISOString();
                keyData.deviceUuid = clientUuid;

                keys[keyIndex] = keyData;
                saveKeysAtomic(keysFilePath, keys);
                jsonRes(res, { success: true });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── POST /api/reset-key-device ─────────────────────────────────
            if (req.url === '/api/reset-key-device' && req.method === 'POST') {
              const passcode = req.headers['x-admin-passcode'];
              if (passcode !== '2026') {
                jsonRes(res, { error: 'Unauthorized admin access' }, 401);
                return;
              }
              const body = await readBody(req);
              try {
                const { key } = JSON.parse(body);
                if (!key || !key.trim()) {
                  jsonRes(res, { error: 'Missing key parameter' }, 400);
                  return;
                }

                const keysFilePath = path.join(dataDir, 'activation_keys.json');
                let keys = [];
                if (fs.existsSync(keysFilePath)) {
                  try {
                    keys = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));
                  } catch (e) {
                    keys = [];
                  }
                }

                const targetKey = key.trim().toUpperCase();
                const keyIndex = keys.findIndex((k: any) => k.key.toUpperCase() === targetKey);

                if (keyIndex === -1) {
                  jsonRes(res, { error: 'Key not found' }, 404);
                  return;
                }

                // Reset the device lock
                keys[keyIndex].status = 'unused';
                keys[keyIndex].usedBy = '';
                keys[keyIndex].activatedAt = '';
                keys[keyIndex].deviceUuid = '';

                saveKeysAtomic(keysFilePath, keys);
                jsonRes(res, { success: true });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── POST /api/save-file ──────────────────────────────────────
            // Body: { filePath: string, content: string }
            // Saves any UTF-8 text file (HTML, etc.) inside public/
            if (req.url === '/api/save-file' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const { filePath, content } = JSON.parse(body);
                const fullPath = path.resolve(publicDir, filePath);
                // Safety: must stay inside public/
                if (!fullPath.startsWith(publicDir)) {
                  jsonRes(res, { error: 'Forbidden path' }, 403);
                  return;
                }
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, content, 'utf-8');
                jsonRes(res, { success: true });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            // ─── GET /api/read-file?path=... ──────────────────────────────
            // Returns { content: string } for any text file inside public/
            if (req.url?.startsWith('/api/read-file') && req.method === 'GET') {
              const urlObj = new URL(req.url, `http://localhost`);
              const filePath = urlObj.searchParams.get('path');
              if (!filePath) {
                jsonRes(res, { error: 'Missing ?path parameter' }, 400);
                return;
              }
              try {
                const fullPath = path.resolve(publicDir, filePath);
                if (!fullPath.startsWith(publicDir)) {
                  jsonRes(res, { error: 'Forbidden path' }, 403);
                  return;
                }
                const content = fs.readFileSync(fullPath, 'utf-8');
                jsonRes(res, { content });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 404);
              }
              return;
            }

            // ─── POST /api/upload-binary ──────────────────────────────────
            // Body: { filePath: string, contentBase64: string }
            // Saves a binary file (image/PDF) to public/ then re-scans assets
            if (req.url === '/api/upload-binary' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const { filePath, contentBase64 } = JSON.parse(body);
                const fullPath = path.resolve(publicDir, filePath);
                if (!fullPath.startsWith(publicDir)) {
                  jsonRes(res, { error: 'Forbidden path' }, 403);
                  return;
                }
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                const buffer = Buffer.from(contentBase64, 'base64');
                fs.writeFileSync(fullPath, buffer);
                rescanAssets(publicDir);
                jsonRes(res, { success: true });
              } catch (e) {
                jsonRes(res, { error: String(e) }, 500);
              }
              return;
            }

            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/public/**']
      },
    },
  };
});
