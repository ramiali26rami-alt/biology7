import fs from 'fs';

const recoveredPath = 'src/utils/translations.ts.step10_clean';
const destPath = 'src/utils/translations.ts';

let content = fs.readFileSync(recoveredPath, 'utf-8');

// Insert Arabic keys
const arRegex = /retakeQuiz:\s*['"]إعادة الاختبار['"]/;
const arMatch = content.match(arRegex);
if (!arMatch) {
  console.log("Could not find Arabic search anchor in translations!");
  process.exit(1);
}

const arInsertionPoint = arMatch.index + arMatch[0].length;
const arKeys = `,
    aiQuizGenerator: 'توليد الأسئلة بالذكاء الاصطناعي 🪄',
    generateQuestionsCount: 'عدد الأسئلة المطلوبة:',
    questionType: 'نوع الأسئلة:',
    apiKeyLabel: 'مفتاح Gemini API (اختياري، لحسابك الشخصي):',
    apiKeyPlaceholder: 'أدخل مفتاح API هنا...',
    generateQuizBtn: 'توليد وإدراج الأسئلة 🪄',
    generatingQuiz: 'جارٍ التوليد عبر الذكاء الاصطناعي... يرجى الانتظار ⏳',
    generateSuccess: 'تم توليد وإدراج الأسئلة بنجاح! تم حفظ المنهج.',
    generateError: 'فشل في توليد الأسئلة. تأكد من صحة مفتاح API أو اتصال الإنترنت.',
    allTypes: 'كل الأنواع (MCQ، صح/خطأ، إكمال)',
    mcqOnly: 'اختيار من متعدد فقط',
    tfOnly: 'صح أو خطأ فقط',
    fillOnly: 'إكمال الفراغ فقط',`;

content = content.slice(0, arInsertionPoint) + arKeys + content.slice(arInsertionPoint);

// Insert English keys
const enRegex = /retakeQuiz:\s*['"]Retake Quiz['"]/;
const enMatch = content.match(enRegex);
if (!enMatch) {
  console.log("Could not find English search anchor in translations!");
  process.exit(1);
}

const enInsertionPoint = enMatch.index + enMatch[0].length;
const enKeys = `,
    aiQuizGenerator: 'AI Quiz Generator 🪄',
    generateQuestionsCount: 'Number of Questions:',
    questionType: 'Question Type:',
    apiKeyLabel: 'Gemini API Key (optional, for your personal quota):',
    apiKeyPlaceholder: 'Enter API key here...',
    generateQuizBtn: 'Generate & Insert Questions 🪄',
    generatingQuiz: 'Generating via AI... Please wait ⏳',
    generateSuccess: 'Questions generated and inserted successfully! Syllabus saved.',
    generateError: 'Failed to generate questions. Verify your API key or internet connection.',
    allTypes: 'All Types (MCQs, T/F, Fill)',
    mcqOnly: 'MCQs Only',
    tfOnly: 'T/F Only',
    fillOnly: 'Fill Blanks Only',`;

content = content.slice(0, enInsertionPoint) + enKeys + content.slice(enInsertionPoint);

fs.writeFileSync(destPath, content, 'utf-8');
console.log("Successfully merged translations on clean typescript file!");
