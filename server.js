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

// FIX: تقييد CORS بدلاً من السماح لجميع المصادر
const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.ALLOWED_ORIGIN || ''
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // السماح لطلبات Capacitor الأصلية وطلبات التطوير المحلي
  if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.startsWith('capacitor://')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-admin-passcode,x-gemini-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // FIX: إضافة Security Headers لحماية إضافية
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// FIX: Rate Limiting يدوي بدون حاجة لمكتبة خارجية
const rateLimitStore = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.path}`;

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const record = rateLimitStore.get(key);
    if (now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }
    next();
  };
}

// تنظيف دوري لـ rateLimitStore كل 10 دقائق لمنع تراكم الذاكرة
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

const publicDir = path.resolve(__dirname, 'public');
const dataDir = path.resolve(__dirname, 'data');

/** Helper: Safe path resolution against path traversal */
function resolveSafePath(base, inputPath) {
  const root = path.resolve(base);
  const target = path.resolve(root, inputPath || '');
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Forbidden path: ' + inputPath);
  }
  return target;
}

/** Helper: Admin Passcode Check */
function checkAdminAuth(req, res) {
  const passcode = req.headers['x-admin-passcode'];
  const adminPasscode = process.env.ADMIN_PASSCODE;
  if (!passcode || !adminPasscode || passcode !== adminPasscode) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

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

// Real Vercel KV / Upstash Redis REST Client
const KV = {
  isConfigured: () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return !!(url && token);
  },
  
  _getCredentials: () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return { url, token };
  },

  get: async (key) => {
    try {
      const { url, token } = KV._getCredentials();
      if (!url || !token) return null;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', key])
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          try {
            return JSON.parse(data.result);
          } catch {
            return data.result;
          }
        }
      }
    } catch (e) {
      console.error('KV get error:', e);
    }
    return null;
  },

  set: async (key, value) => {
    try {
      const { url, token } = KV._getCredentials();
      if (!url || !token) return false;
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', key, strValue])
      });
      return res.ok;
    } catch (e) {
      console.error('KV set error:', e);
      return false;
    }
  },

  del: async (key) => {
    try {
      const { url, token } = KV._getCredentials();
      if (!url || !token) return false;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['DEL', key])
      });
      return res.ok;
    } catch (e) {
      console.error('KV del error:', e);
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
    const configPath = resolveSafePath(publicDir, 'lessons_config.json');
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

// ─── POST /api/publish-update ───
app.post('/api/publish-update', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    let currentLessonsCount = 0;
    if (KV.isConfigured()) {
      const cachedData = await KV.get('curriculum_data');
      if (cachedData && Array.isArray(cachedData)) {
        currentLessonsCount = cachedData.length;
      }
    } else {
      const configPath = resolveSafePath(publicDir, 'lessons_config.json');
      if (fs.existsSync(configPath)) {
        const text = fs.readFileSync(configPath, 'utf-8');
        try {
          const parsed = JSON.parse(text);
          currentLessonsCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {}
      }
    }
    await triggerBackupAfterSave(currentLessonsCount);
    
    // Read new version to return
    let newVer = "1.0.0";
    if (KV.isConfigured()) {
      const vData = await KV.get('curriculum_version');
      if (vData && vData.version) newVer = vData.version;
    }
    res.json({ success: true, version: newVer });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ─── POST /api/save-config ───
app.post('/api/save-config', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const data = req.body;
    let savedToKv = false;

    if (KV.isConfigured()) {
      savedToKv = await KV.set('curriculum_data', data);
    }

    const configPath = resolveSafePath(publicDir, 'lessons_config.json');
    try {
      if (fs.existsSync(configPath)) {
        const backupsDir = resolveSafePath(dataDir, 'backups');
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

// ─── POST /api/reset-curriculum-to-default ───
app.post('/api/reset-curriculum-to-default', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    let deleted = false;
    if (KV.isConfigured()) {
      await KV.del('curriculum_data');
      await KV.del('curriculum_version');
      deleted = true;
    }
    res.json({ success: true, deletedFromKv: deleted });
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured' });
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured' });
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: String(apiKey) });

    const systemInstruction = `أنت معلم أحياء يمني خبير ومساعد ذكي للطلاب في الصف الثالث الثانوي (القسم العلمي).
مهمتك هي الإجابة على أسئلة الطلاب بأسلوب تربوي، سهل ومبسط، وباللغة العربية الفصحى.

شروط صارمة للإجابة:
1. التزم تماماً بالمصطلحات العلمية والتعاريف المعتمدة في منهج الأحياء اليمني للمرحلة الثانوية.
2. أجب بااختصار ووضوح، واستخدم التنسيق (مثل النقاط والخطوط العريضة) لتسهيل القراءة على شاشات الهواتف.
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
  if (!checkAdminAuth(req, res)) return;
  const keysFilePath = resolveSafePath(dataDir, 'activation_keys.json');
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
  if (!checkAdminAuth(req, res)) return;
  try {
    const { count } = req.body;
    const keysCount = Number(count) || 10;
    const keysFilePath = resolveSafePath(dataDir, 'activation_keys.json');
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
// FIX: إضافة Rate Limiting — 10 محاولات كل 15 دقيقة لكل IP
app.post('/api/activate-key', rateLimit(15 * 60 * 1000, 10), (req, res) => {
  try {
    const { key, studentName, deviceUuid } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const keysFilePath = resolveSafePath(dataDir, 'activation_keys.json');
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
  if (!checkAdminAuth(req, res)) return;
  try {
    const { key } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const keysFilePath = resolveSafePath(dataDir, 'activation_keys.json');
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
  if (!checkAdminAuth(req, res)) return;
  try {
    const { filePath, content } = req.body;
    const fullPath = resolveSafePath(publicDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});



// ─── POST /api/upload-binary ───
app.post('/api/upload-binary', (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  try {
    const { filePath, contentBase64 } = req.body;

    if (!filePath || !contentBase64) {
      return res.status(400).json({ error: 'Missing parameter' });
    }

    // 1. Extension check
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.bin']);
    const fileExt = path.extname(filePath).toLowerCase();
    if (!allowedExtensions.has(fileExt)) {
      return res.status(415).json({ error: 'File type not allowed' });
    }

    // 2. File size check (base64 ~ 0.75 * string length)
    const fileSizeBytes = Math.ceil(contentBase64.length * 0.75);
    const maxSizeBytes = 15 * 1024 * 1024; // 15MB
    if (fileSizeBytes > maxSizeBytes) {
      return res.status(413).json({ error: 'File too large' });
    }

    // 3. Filename control character check
    const fileName = path.basename(filePath);
    if (/[<>:"|?*\x00-\x1f]/.test(fileName)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const fullPath = resolveSafePath(publicDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(contentBase64, 'base64');
    fs.writeFileSync(fullPath, buffer);
    rescanAssets(publicDir);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: String(e) });
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
