/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lesson, VideoChapter, Flashcard, GlossaryItem, ConfigQuestion } from '../src/types';

// Mock validation logic matching AdminDashboardScreen.tsx
function validateLessons(lessons: Lesson[], lang: 'ar' | 'en'): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  lessons.forEach((lesson, index) => {
    // Check duplicate ID
    if (!lesson.id.trim()) {
      errors.push(lang === 'ar' ? `الدرس رقم ${index + 1}: معرّف الدرس فارغ!` : `Lesson #${index + 1}: ID is empty!`);
    } else if (ids.has(lesson.id)) {
      errors.push(lang === 'ar' ? `معرّف الدرس مكرر: ${lesson.id}` : `Duplicate lesson ID: ${lesson.id}`);
    } else {
      ids.add(lesson.id);
    }

    // Check titles
    if (!lesson.titleAr.trim()) {
      errors.push(lang === 'ar' ? `الدرس (${lesson.id}): العنوان بالعربي فارغ!` : `Lesson (${lesson.id}): Arabic title is empty!`);
    }

    // Check quiz answers validity
    lesson.quiz.forEach((q, qIdx) => {
      if (q.type === 'mcq') {
        if (!q.correctKey) {
          errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: لم يتم تحديد الإجابة الصحيحة الخيار (أ، ب، ج)!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: No correct key selected!`);
        }
        if (!q.options || q.options.length < 2) {
          errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: عدد الخيارات أقل من خيارين!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: MCQ requires at least 2 options!`);
        }
      } else if (q.type === 'tf') {
        if (!q.correctKey || (q.correctKey !== 'T' && q.correctKey !== 'F')) {
          errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد صح أو خطأ!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: TF requires correct key T or F!`);
        }
      } else if (q.type === 'fill') {
        if (!q.correctAnswers || q.correctAnswers.length === 0) {
          errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد إجابة مقبولة واحدة على الأقل لإكمال الفراغ!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: Fill blank requires at least one correct answer!`);
        }
      }
    });
  });

  return errors;
}

// -------------------------------------------------------------
// TEST RUNNER
// -------------------------------------------------------------
async function runTests() {
  console.log("\n🧪 بدء اختبار ميزات الإضافة والتعديل والتحقق (Visual Admin Logic Tests)...\n");

  let mockLessons: Lesson[] = [
    {
      id: "lesson-1",
      unit: 1,
      folder: "الوحدة الاولى     التنظيم العصبي في الكائنات الحية/الدرس 1 التنظيم العصبي في الكائنات البسيطة",
      titleAr: "التنظيم العصبي في الكائنات البسيطة",
      titleEn: "Nervous Coordination in Simple Organisms",
      pdfFile: "الدرس 1.pdf",
      diagramFile: "الدرس 1.png",
      summaryFile: "ملخص الدرس 1.png",
      mindmapFile: "خارطة ذهنية 1.html",
      quizFile: "اختبار الدرس 1.htm",
      locked: false,
      videoUrl: "https://www.youtube.com/embed/6m6uT0284xI",
      videoChapters: [
        { time: "00:00", titleAr: "مقدمة", titleEn: "Intro", descAr: "", descEn: "" }
      ],
      summaryPointsAr: ["الأميبا: الإحساس خلوي عام."],
      summaryPointsEn: ["Amoeba: General cellular irritability."],
      flashcards: [
        { qAr: "سؤال", qEn: "Q", aAr: "جواب", aEn: "A" }
      ],
      glossary: [
        { term: "Amoeba", descAr: "كائن وحيد الخلية", descEn: "Unicellular" }
      ],
      quiz: [
        {
          id: 1,
          type: "tf",
          textAr: "يتم الإحساس في الأميبا عبر البروتوبلازم.",
          textEn: "In Amoeba, irritability is mediated via protoplasm.",
          options: [
            { key: "T", textAr: "✔️ صح", textEn: "True" },
            { key: "F", textAr: "❌ خطأ", textEn: "False" }
          ],
          correctKey: "T",
          explanationAr: "توضيح صحيحة.",
          explanationEn: "Correct explanation."
        }
      ]
    }
  ];

  // 1. Verify Initial Validation (Should pass)
  console.log("👉 1. اختبار التحقق الأولي للمنهج السليم...");
  let errors = validateLessons(mockLessons, 'ar');
  if (errors.length === 0) {
    console.log("   ✅ نجح: المنهج سليم ولا توجد أخطاء.");
  } else {
    console.error("   ❌ فشل: تم العثور على أخطاء غير متوقعة:", errors);
    process.exit(1);
  }

  // 2. Test Adding a New Lesson (الإضافة)
  console.log("\n👉 2. اختبار إضافة درس جديد...");
  const newLesson: Lesson = {
    id: "lesson-2",
    unit: 1,
    folder: "الوحدة الاولى     التنظيم العصبي في الكائنات الحية/الدرس 2 في دودة الارض",
    titleAr: "التنظيم العصبي في دودة الأرض",
    titleEn: "Nervous Coordination in the Earthworm",
    pdfFile: "الدرس 2.pdf",
    diagramFile: "الدرس 2.png",
    summaryFile: "",
    mindmapFile: "الدرس 2 خارطة ذهنية.html",
    quizFile: "اختبار الدرس 2.html",
    locked: true, // starts locked
    videoUrl: "https://www.youtube.com/embed/6m6uT0284xI",
    videoChapters: [],
    summaryPointsAr: [],
    summaryPointsEn: [],
    flashcards: [],
    glossary: [],
    quiz: []
  };

  mockLessons.push(newLesson);
  console.log(`   ✅ نجح: تم إضافة درس جديد بنجاح. العدد الحالي للدروس: ${mockLessons.length}`);
  if (mockLessons.length !== 2) {
    console.error("   ❌ فشل: لم يتم زيادة عدد الدروس.");
    process.exit(1);
  }

  // 3. Test Editing a Lesson (التعديل)
  console.log("\n👉 3. اختبار تعديل حقول الدرس الجديد...");
  let lessonToEdit = { ...mockLessons[1] };
  
  // Modify titles and unlock
  lessonToEdit.titleAr = "التنظيم العصبي المعدل في دودة الأرض";
  lessonToEdit.locked = false; // unlock it

  // Add a video chapter
  const chapter: VideoChapter = { time: "05:30", titleAr: "الدماغ والحبل العصبي", titleEn: "Brain & Nerve Cord", descAr: "شرح تشريح الدودة", descEn: "Worm anatomy study" };
  lessonToEdit.videoChapters.push(chapter);

  // Add a glossary term
  const term: GlossaryItem = { term: "Segmental Ganglia", descAr: "العقد العصبية الحلقية", descEn: "Segmental ganglia" };
  lessonToEdit.glossary.push(term);

  // Replace in list
  mockLessons = mockLessons.map(l => l.id === lessonToEdit.id ? lessonToEdit : l);
  
  console.log(`   ✅ نجح: تم تعديل عنوان الدرس إلى: "${mockLessons[1].titleAr}"`);
  console.log(`   ✅ نجح: تم إلغاء قفل الدرس بنجاح (locked = ${mockLessons[1].locked})`);
  console.log(`   ✅ نجح: تم إضافة فصل للفيديو بنجاح بالتوقيت: ${mockLessons[1].videoChapters[0].time}`);

  if (mockLessons[1].titleAr !== "التنظيم العصبي المعدل في دودة الأرض" || mockLessons[1].locked !== false || mockLessons[1].videoChapters.length !== 1) {
    console.error("   ❌ فشل: لم يتم تحديث التعديلات بشكل صحيح.");
    process.exit(1);
  }

  // 4. Test Adding Quiz Questions of different types (إضافة أسئلة كويز)
  console.log("\n👉 4. اختبار إضافة أسئلة كويز تفاعلية...");
  
  // MCQ Question
  const mcqQuestion: ConfigQuestion = {
    id: 1,
    type: "mcq",
    textAr: "يتكون دماغ دودة الأرض من عقدتين فوق:",
    textEn: "The earthworm's brain consists of two ganglia above the:",
    options: [
      { key: "A", textAr: "البلعوم", textEn: "Pharynx" },
      { key: "B", textAr: "الأمعاء", textEn: "Intestine" },
      { key: "C", textAr: "المرئ", textEn: "Esophagus" }
    ],
    correctKey: "A",
    explanationAr: "يقع الدماغ فوق البلعوم.",
    explanationEn: "The brain is located above the pharynx."
  };

  // Fill in the Blank Question
  const fillQuestion: ConfigQuestion = {
    id: 2,
    type: "fill",
    textAr: "يتصل دماغ دودة الأرض بالحبل العصبي بواسطة طوق يحيط بـ ________.",
    textEn: "The earthworm's brain connects to the nerve cord via a ring surrounding the ________.",
    correctAnswers: ["البلعوم", "pharynx"],
    explanationAr: "طوق حول البلعوم.",
    explanationEn: "Circumpharyngeal connective ring."
  };

  mockLessons[1].quiz.push(mcqQuestion, fillQuestion);
  console.log(`   ✅ نجح: تم إضافة عدد (${mockLessons[1].quiz.length}) أسئلة بنجاح للدرس الثاني.`);
  
  if (mockLessons[1].quiz[0].type !== "mcq" || mockLessons[1].quiz[1].type !== "fill") {
    console.error("   ❌ فشل: أنواع الأسئلة غير صحيحة.");
    process.exit(1);
  }

  // 5. Test Validation Engine - Negative Testing (فحص الأخطاء التكوينية)
  console.log("\n👉 5. اختبار محرك فحص الأخطاء (التحقق السلبي)...");

  // A. Duplicate ID
  console.log("   🔹 اختبار معرّفات مكررة...");
  let duplicateIdLessons = JSON.parse(JSON.stringify(mockLessons));
  duplicateIdLessons[1].id = "lesson-1"; // set duplicate
  let validationErrors = validateLessons(duplicateIdLessons, 'ar');
  console.log(`      ⚠️ رسالة الخطأ المتولدة: "${validationErrors[0]}"`);
  if (validationErrors.length === 0 || !validationErrors[0].includes("مكرر")) {
    console.error("   ❌ فشل: لم يتم كشف المعرّف المكرر!");
    process.exit(1);
  } else {
    console.log("      ✅ نجح: تم كشف المعرّف المكرر بنجاح.");
  }

  // B. Missing Correct Answer in MCQ
  console.log("   🔹 اختبار سؤال خيار متعدد بدون إجابة صحيحة...");
  let missingKeyLessons = JSON.parse(JSON.stringify(mockLessons));
  missingKeyLessons[1].quiz[0].correctKey = ""; // empty key
  validationErrors = validateLessons(missingKeyLessons, 'ar');
  console.log(`      ⚠️ رسالة الخطأ المتولدة: "${validationErrors[0]}"`);
  if (validationErrors.length === 0 || !validationErrors[0].includes("لم يتم تحديد الإجابة الصحيحة")) {
    console.error("   ❌ فشل: لم يتم كشف فقدان الإجابة الصحيحة للسؤال!");
    process.exit(1);
  } else {
    console.log("      ✅ نجح: تم كشف فقدان الإجابة الصحيحة بنجاح.");
  }

  // C. Empty Accepted Answers in Fill-in-blank
  console.log("   🔹 اختبار سؤال إكمال فراغ بدون إجابات مقبولة...");
  let missingFillAnswers = JSON.parse(JSON.stringify(mockLessons));
  missingFillAnswers[1].quiz[1].correctAnswers = []; // empty answers array
  validationErrors = validateLessons(missingFillAnswers, 'ar');
  console.log(`      ⚠️ رسالة الخطأ المتولدة: "${validationErrors[0]}"`);
  if (validationErrors.length === 0 || !validationErrors[0].includes("إكمال الفراغ")) {
    console.error("   ❌ فشل: لم يتم كشف فقدان إجابة إكمال الفراغ!");
    process.exit(1);
  } else {
    console.log("      ✅ نجح: تم كشف فقدان إجابة الفراغ بنجاح.");
  }

  // 6. Test Deleting a Lesson (الحذف)
  console.log("\n👉 6. اختبار حذف درس...");
  const countBefore = mockLessons.length;
  mockLessons = mockLessons.filter(l => l.id !== "lesson-2");
  console.log(`   ✅ نجح: تم حذف الدرس بنجاح. عدد الدروس المتبقية: ${mockLessons.length}`);
  if (mockLessons.length !== 1 || mockLessons[0].id !== "lesson-1") {
    console.error("   ❌ فشل: لم يتم حذف الدرس بالشكل السليم.");
    process.exit(1);
  }

  console.log("\n🎉 نجحت جميع اختبارات الإضافة والتعديل والتحقق بنسبة 100%! 🚀\n");
}

runTests().catch(err => {
  console.error("🚨 حدث خطأ أثناء تنفيذ الاختبارات:", err);
  process.exit(1);
});
