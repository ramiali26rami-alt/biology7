/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleApiRequest, triggerBackupAfterSave } from './src/server/apiMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '50mb' }));

// CORS middleware to support native Capacitor WebView calls
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-gemini-key,x-admin-passcode');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const publicDir = path.resolve(__dirname, 'public');
const dataDir = path.resolve(__dirname, 'data');

// 1. Shared API middleware (version, backups)
app.use(async (req, res, next) => {
  await handleApiRequest(req, res, () => next());
});

// Helper to re-scan public assets
function rescanAssets(publicDir) {
  const outputFile = path.join(publicDir, 'detected_assets.json');
  const groups = {};

  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = path.relative(publicDir, fullPath).replace(/\\/g, '/');
        const parts = relPath.split('/');
        if (parts.length > 1) {
          const fileName = parts.pop();
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

// ─── Vercel KV Database Helper ───
const KV = {
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
  isConfigured() {
    return !!(this.url && this.token);
  },
  async get(key) {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', key])
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.result) {
        try {
          return JSON.parse(data.result);
        } catch {
          return data.result;
        }
      }
      return null;
    } catch (e) {
      console.error(`Vercel KV read error for ${key}:`, e);
      return null;
    }
  },
  async set(key, value) {
    if (!this.isConfigured()) return false;
    try {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', key, valStr])
      });
      return res.ok;
    } catch (e) {
      console.error(`Vercel KV write error for ${key}:`, e);
      return false;
    }
  }
};

// ─── GET /api/get-config ───
app.get('/api/get-config', async (req, res) => {
  try {
    if (KV.isConfigured()) {
      const cachedData = await KV.get('curriculum_data');
      if (cachedData) {
        return res.json(cachedData);
      }
    }
    const configPath = path.join(publicDir, 'lessons_config.json');
    if (fs.existsSync(configPath)) {
      const text = fs.readFileSync(configPath, 'utf-8');
      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.send(text);
      }
    }
    res.status(404).json({ error: 'Config file not found' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/save-config ───
app.post('/api/save-config', async (req, res) => {
  try {
    const data = req.body;
    let savedToKv = false;

    if (KV.isConfigured()) {
      savedToKv = await KV.set('curriculum_data', data);
    }

    const configPath = path.join(publicDir, 'lessons_config.json');
    try {
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
    } catch (fsErr) {
      console.warn("Local filesystem write skipped/failed:", fsErr.message);
      if (!savedToKv) {
        throw fsErr;
      }
    }

    await triggerBackupAfterSave(data.length);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/generate-quiz ───
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const {
      lessonTitleAr,
      lessonTitleEn,
      lessonSummaryAr,
      lessonSummaryEn,
      questionCount,
      questionType
    } = req.body;

    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API Key. Please supply a Gemini API key in settings or set GEMINI_API_KEY in process env.' });
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
      model: 'gemini-3.1-flash-lite',
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
      return res.status(500).json({ error: 'Gemini returned an empty response.' });
    }

    const generatedQuestions = JSON.parse(text);
    res.json({ success: true, quiz: generatedQuestions });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/analyze-diagram ───
app.post('/api/analyze-diagram', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 parameter.' });
    }

    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API Key. Please supply a Gemini API key in settings or set GEMINI_API_KEY in process env.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: String(apiKey) });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: imageBase64
          }
        },
        `Analyze this biology diagram image and identify the main anatomical labels or structures.
         For each structure, return:
         1. partNumber: e.g. H1, H2, H3
         2. partName: Arabic name of the structure.
         3. partDetails: Arabic explanation of its function or details.
         4. x: estimated horizontal coordinate (0-100) pointing to the center of the part or label.
         5. y: estimated vertical coordinate (0-100) pointing to the center of the part or label.
         
         Make sure x and y coordinates are numbers between 0 and 100 representing the exact relative positions of the labels or structures in the image (0,0 is top-left, 100,100 is bottom-right).`
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              partNumber: { type: 'STRING' },
              partName: { type: 'STRING' },
              partDetails: { type: 'STRING' },
              x: { type: 'NUMBER' },
              y: { type: 'NUMBER' }
            },
            required: ['partNumber', 'partName', 'partDetails', 'x', 'y']
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(500).json({ error: 'Gemini returned an empty response.' });
    }

    const hotspots = JSON.parse(text);
    res.json({ success: true, hotspots });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/tutor-chat ───
app.post('/api/tutor-chat', async (req, res) => {
  try {
    const { messages, lessonTitle, lessonSummary } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid messages parameter.' });
    }

    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API Key. Please supply a Gemini API key in settings or set GEMINI_API_KEY in process env.' });
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
    messages.forEach((msg, idx) => {
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
      model: 'gemini-3.1-flash-lite',
      contents: promptText
    });

    const text = response.text;
    if (!text) {
      return res.status(500).json({ error: 'Gemini returned an empty response.' });
    }

    res.json({ success: true, reply: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});


// Helper for atomic key writes
const saveKeysAtomic = (filePath, data) => {
  const tempPath = filePath + '.' + Math.random().toString(36).substring(2) + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
};

// ─── GET /api/activation-keys ───
app.get('/api/activation-keys', (req, res) => {
  const passcode = req.headers['x-admin-passcode'];
  if (passcode !== '2026') {
    return res.status(401).json({ error: 'Unauthorized admin access' });
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
  res.json({ keys });
});

// ─── POST /api/generate-keys ───
app.post('/api/generate-keys', (req, res) => {
  const passcode = req.headers['x-admin-passcode'];
  if (passcode !== '2026') {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }
  try {
    const { count } = req.body;
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
    const gen = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

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
    res.json({ success: true, keys: updatedKeys });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/activate-key ───
app.post('/api/activate-key', (req, res) => {
  try {
    const { key, studentName, deviceUuid } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Missing key parameter' });
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
    const keyIndex = keys.findIndex((k) => k.key.toUpperCase() === targetKey);

    if (keyIndex === -1) {
      return res.status(400).json({ error: 'invalid' });
    }

    const keyData = keys[keyIndex];
    const clientUuid = deviceUuid || 'default';

    if (keyData.status === 'used') {
      if (keyData.deviceUuid && keyData.deviceUuid !== clientUuid) {
        return res.status(400).json({ error: 'already_used_other_device' });
      }
      return res.json({ success: true });
    }

    // Update key details
    keyData.status = 'used';
    keyData.usedBy = studentName || 'Unknown Student';
    keyData.activatedAt = new Date().toISOString();
    keyData.deviceUuid = clientUuid;

    keys[keyIndex] = keyData;
    saveKeysAtomic(keysFilePath, keys);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/reset-key-device ───
app.post('/api/reset-key-device', (req, res) => {
  const passcode = req.headers['x-admin-passcode'];
  if (passcode !== '2026') {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }
  try {
    const { key } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Missing key parameter' });
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
    const keyIndex = keys.findIndex((k) => k.key.toUpperCase() === targetKey);

    if (keyIndex === -1) {
      return res.status(404).json({ error: 'Key not found' });
    }

    // Reset the device lock
    keys[keyIndex].status = 'unused';
    keys[keyIndex].usedBy = '';
    keys[keyIndex].activatedAt = '';
    keys[keyIndex].deviceUuid = '';

    saveKeysAtomic(keysFilePath, keys);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/save-file ───
app.post('/api/save-file', (req, res) => {
  try {
    const { filePath, content } = req.body;
    const fullPath = path.resolve(publicDir, filePath);
    if (!fullPath.startsWith(publicDir)) {
      return res.status(403).json({ error: 'Forbidden path' });
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── GET /api/read-file ───
app.get('/api/read-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }
  try {
    const fullPath = path.resolve(publicDir, String(filePath));
    if (!fullPath.startsWith(publicDir)) {
      return res.status(403).json({ error: 'Forbidden path' });
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content });
  } catch (e) {
    res.status(404).json({ error: String(e) });
  }
});

// ─── POST /api/upload-binary ───
app.post('/api/upload-binary', (req, res) => {
  try {
    const { filePath, contentBase64 } = req.body;
    const fullPath = path.resolve(publicDir, filePath);
    if (!fullPath.startsWith(publicDir)) {
      return res.status(403).json({ error: 'Forbidden path' });
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(contentBase64, 'base64');
    fs.writeFileSync(fullPath, buffer);
    rescanAssets(publicDir);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// 2. Serve static React files
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Fallback to SPA Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = Number(process.env.PORT ?? 3000);
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Production server running on port ${PORT}`);
  });
}

export default app;
