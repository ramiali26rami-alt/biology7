/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExcelValidatorResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    lessonsCount: number;
    quizzesCount: number;
    flashcardsCount: number;
    glossaryCount: number;
    mindmapsCount: number;
    interactiveDiagramsCount: number;
    ministryExamsCount: number;
  };
}

export function validateExcelData(data: {
  // New 4-Sheet Schema Support
  lessons_core?: any[];
  exam_bank?: any[];
  diagrams_interactive?: any[];
  mindmaps_interactive?: any[];

  // Legacy/Intermediate Schema Support
  diagrams_mindmaps?: any[];
  lessons?: any[];
  quizzes?: any[];
  flashcards?: any[];
  glossary?: any[];
  mindmaps?: any[];
  interactiveDiagrams?: any[];
  ministryExams?: any[];
}): ExcelValidatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lessonIds = new Set<string>();

  const isEmpty = (val: any) => val === undefined || val === null || String(val).trim() === '';

  // Helper to extract lesson ID from row data under the new U/L convention or legacy options
  const getRowLessonId = (row: any) => {
    const u = row.U !== undefined ? row.U : row.unitNumber !== undefined ? row.unitNumber : row.unit;
    const l = row.L !== undefined ? row.L : row.lessonNumber !== undefined ? row.lessonNumber : row.lesson;
    if (u !== undefined && l !== undefined && !isEmpty(u) && !isEmpty(l)) {
      return `u${String(u).trim()}-l${String(l).trim()}`;
    }
    return row.lessonId !== undefined ? String(row.lessonId).trim() : row.id !== undefined ? String(row.id).trim() : '';
  };

  // ── 1. Normalize Inputs ──────────────────────────────────────────────────────────
  const lessons = data.lessons_core || data.lessons || [];
  const examBank = data.exam_bank || [];
  
  const diagramsInteractive = data.diagrams_interactive || [];
  const mindmapsInteractive = data.mindmaps_interactive || [];

  const diagramsMindmaps = data.diagrams_mindmaps || [];
  const quizzes = data.quizzes || [];
  const flashcards = data.flashcards || [];
  const glossary = data.glossary || [];
  const mindmaps = data.mindmaps || [];
  const interactiveDiagrams = data.interactiveDiagrams || [];
  const ministryExams = data.ministryExams || [];

  // ── 2. Validate Lessons_Core / Lessons ──────────────────────────────────────────
  lessons.forEach((lesson, index) => {
    const rowNum = index + 2;
    const sheetName = data.lessons_core ? 'Lessons_Core' : 'Lessons';
    const lid = getRowLessonId(lesson);
    
    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sheetName}): حقول الدرس (L أو lessonId) والوحدة (U أو unit) مطلوبة.`);
    } else {
      if (lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sheetName}): المعرف (${lid}) مكرر، يجب أن يكون معرف الدرس فريداً.`);
      } else {
        lessonIds.add(lid);
      }
    }

    const titleVal = lesson.lessonNameAr !== undefined ? lesson.lessonNameAr : (lesson.titleAr || lesson.title);
    if (isEmpty(titleVal)) {
      errors.push(`السطر ${rowNum} (${sheetName}): العنوان العربي (lessonNameAr/titleAr) مطلوب.`);
    }
  });

  // ── 3. Validate Diagrams_Interactive ─────────────────────────────────────────────
  diagramsInteractive.forEach((diag, index) => {
    const rowNum = index + 2;
    const sheetName = 'Diagrams_Interactive';
    const lid = getRowLessonId(diag);

    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sheetName}): معرف الدرس (U و L أو lessonId) مطلوب.`);
    } else {
      if (!lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sheetName}): الدرس (${lid}) غير موجود في قائمة الدروس.`);
      }
    }

    const imgFile = diag.imageName || diag.imageUrl || diag.imageFile;
    if (isEmpty(imgFile)) {
      errors.push(`السطر ${rowNum} (${sheetName}): اسم ملف الصورة (imageName) مطلوب للرسومات التفاعلية.`);
    }

    if (isEmpty(diag.partNumber)) {
      errors.push(`السطر ${rowNum} (${sheetName}): رقم الجزء (partNumber) مطلوب.`);
    }

    const pName = diag.partName || diag.partNameAr;
    if (isEmpty(pName)) {
      errors.push(`السطر ${rowNum} (${sheetName}): اسم الجزء بالعربية (partName) مطلوب.`);
    }

    if (!isEmpty(diag.x)) {
      const xVal = Number(diag.x);
      if (isNaN(xVal) || xVal < 0 || xVal > 100) {
        errors.push(`السطر ${rowNum} (${sheetName}): الإحداثي الأفقي (x) يجب أن يكون رقماً بين 0 و 100.`);
      }
    } else {
      warnings.push(`السطر ${rowNum} (${sheetName}): الإحداثي الأفقي (x) غير محدد، سيتم تعيينه افتراضياً إلى 0.`);
    }

    if (!isEmpty(diag.y)) {
      const yVal = Number(diag.y);
      if (isNaN(yVal) || yVal < 0 || yVal > 100) {
        errors.push(`السطر ${rowNum} (${sheetName}): الإحداثي الرأسي (y) يجب أن يكون رقماً بين 0 و 100.`);
      }
    } else {
      warnings.push(`السطر ${rowNum} (${sheetName}): الإحداثي الرأسي (y) غير محدد، سيتم تعيينه افتراضياً إلى 0.`);
    }
  });

  // ── 4. Validate MindMaps_Interactive ─────────────────────────────────────────────
  mindmapsInteractive.forEach((node, index) => {
    const rowNum = index + 2;
    const sheetName = 'MindMaps_Interactive';
    const lid = getRowLessonId(node);

    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sheetName}): معرف الدرس (U و L أو lessonId) مطلوب.`);
    } else {
      if (!lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sheetName}): الدرس (${lid}) غير موجود في قائمة الدروس.`);
      }
    }

    const nodeIdVal = node.nodeId || node.id;
    if (isEmpty(nodeIdVal)) {
      errors.push(`السطر ${rowNum} (${sheetName}): معرف العقدة (nodeId) مطلوب.`);
    }

    const nodeTextVal = node.nodeText || node.textAr;
    if (isEmpty(nodeTextVal)) {
      errors.push(`السطر ${rowNum} (${sheetName}): عنوان العقدة (nodeText) مطلوب.`);
    }
  });

  // ── 5. Validate Diagrams_&_MindMaps (3-Sheet Schema) ───────────────────────────
  diagramsMindmaps.forEach((diag, index) => {
    const rowNum = index + 2;
    const sheetName = 'Diagrams_&_MindMaps';
    const lid = getRowLessonId(diag);

    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sheetName}): حقل معرف الدرس مطلوب.`);
    } else {
      if (!lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sheetName}): المعرف (${lid}) غير موجود في قائمة الدروس.`);
      }
    }

    const type = String(diag.type || '').trim().toLowerCase();
    if (type !== 'diagram' && type !== 'mindmap') {
      errors.push(`السطر ${rowNum} (${sheetName}): حقل النوع (type) يجب أن يكون 'diagram' أو 'mindmap'.`);
    }

    if (isEmpty(diag.partNumber)) {
      errors.push(`السطر ${rowNum} (${sheetName}): رقم الجزء أو العقدة (partNumber) مطلوب.`);
    }

    if (isEmpty(diag.partNameAr || diag.partName)) {
      errors.push(`السطر ${rowNum} (${sheetName}): اسم الجزء/العقدة بالعربية (partNameAr/partName) مطلوب.`);
    }

    if (type === 'diagram') {
      if (isEmpty(diag.imageUrl || diag.imageFile)) {
        errors.push(`السطر ${rowNum} (${sheetName}): اسم ملف الصورة (imageUrl) مطلوب للرسومات التفاعلية.`);
      }
      if (!isEmpty(diag.x)) {
        const xVal = Number(diag.x);
        if (isNaN(xVal) || xVal < 0 || xVal > 100) {
          errors.push(`السطر ${rowNum} (${sheetName}): الإحداثي الأفقي (x) يجب أن يكون رقماً بين 0 و 100.`);
        }
      }
      if (!isEmpty(diag.y)) {
        const yVal = Number(diag.y);
        if (isNaN(yVal) || yVal < 0 || yVal > 100) {
          errors.push(`السطر ${rowNum} (${sheetName}): الإحداثي الرأسي (y) يجب أن يكون رقماً بين 0 و 100.`);
        }
      }
    }
  });

  // ── 6. Validate Exam_Bank ──────────────────────────────────────────────────────────
  examBank.forEach((q, index) => {
    const rowNum = index + 2;
    const sheetName = 'Exam_Bank';
    const lid = getRowLessonId(q);

    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sheetName}): حقل معرف الدرس (U و L أو lessonId) مطلوب.`);
    } else {
      // 'ministry' is allowed as special lessonId for general exams
      if (lid !== 'ministry' && !lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sheetName}): المعرف (${lid}) غير موجود في قائمة الدروس.`);
      }
    }

    if (isEmpty(q.questionId || q.id)) {
      errors.push(`السطر ${rowNum} (${sheetName}): معرف السؤال (questionId) مطلوب.`);
    }

    const qtype = String(q.questionType || q.type || '').trim().toLowerCase();
    const validTypes = ['mcq', 'tf', 'fill', 'fill_blank', 'explain', 'what_if', 'define', ''];
    if (!validTypes.includes(qtype)) {
      errors.push(`السطر ${rowNum} (${sheetName}): نوع السؤال (${qtype}) غير صالح. الأنواع المقبولة: mcq, tf, fill, fill_blank, explain, what_if, define أو تركه فارغاً للبطاقات.`);
    }

    if (isEmpty(q.questionText || q.textAr || q.text)) {
      errors.push(`السطر ${rowNum} (${sheetName}): نص السؤال بالعربية (questionText) مطلوب.`);
    }

    const answerVal = q.correctAnswer !== undefined ? q.correctAnswer : q.correctKey;
    const answersArrayVal = q.correctAnswers;

    // Objective questions validation
    if (qtype === 'mcq' || qtype === 'tf') {
      if (isEmpty(answerVal)) {
        errors.push(`السطر ${rowNum} (${sheetName}): الإجابة الصحيحة (correctAnswer) مطلوبة لأسئلة الاختيار والصح/الخطأ.`);
      }
    } else if (qtype === 'fill_blank' || qtype === 'fill') {
      if (isEmpty(answerVal) && isEmpty(answersArrayVal)) {
        errors.push(`السطر ${rowNum} (${sheetName}): الإجابات النصية المقبولة (correctAnswer) مطلوبة لأسئلة إكمال الفراغ.`);
      }
    }
  });

  // ── 7. Validate Legacy Schemas ──────────────────────────────────────────────────
  const validateQuestion = (q: any, rowNum: number, sName: string) => {
    const lid = getRowLessonId(q);
    if (isEmpty(lid)) {
      errors.push(`السطر ${rowNum} (${sName}): حقل معرف الدرس مطلوب.`);
    } else {
      if (!lessonIds.has(lid)) {
        errors.push(`السطر ${rowNum} (${sName}): المعرف (${lid}) غير موجود في قائمة الدروس.`);
      }
    }
    if (isEmpty(q.textAr)) {
      errors.push(`السطر ${rowNum} (${sName}): نص السؤال بالعربية (textAr) مطلوب.`);
    }
  };

  quizzes.forEach((q, index) => validateQuestion(q, index + 2, 'Quizzes'));
  ministryExams.forEach((q, index) => validateQuestion(q, index + 2, 'MinistryExams'));

  flashcards.forEach((card, index) => {
    const rowNum = index + 2;
    const lid = getRowLessonId(card);
    if (isEmpty(lid) || !lessonIds.has(lid)) {
      errors.push(`السطر ${rowNum} (Flashcards): معرف الدرس غير صالح.`);
    }
  });

  glossary.forEach((item, index) => {
    const rowNum = index + 2;
    const lid = getRowLessonId(item);
    if (isEmpty(lid) || !lessonIds.has(lid)) {
      errors.push(`السطر ${rowNum} (Glossary): معرف الدرس غير صالح.`);
    }
    if (isEmpty(item.term) || isEmpty(item.descAr)) {
      errors.push(`السطر ${rowNum} (Glossary): المصطلح والتعريف بالعربية مطلوبان.`);
    }
  });

  mindmaps.forEach((node, index) => {
    const rowNum = index + 2;
    if (isEmpty(node.lessonId) || !lessonIds.has(String(node.lessonId).trim())) {
      errors.push(`السطر ${rowNum} (Mindmaps): معرف الدرس غير صالح.`);
    }
    if (isEmpty(node.id) || isEmpty(node.textAr)) {
      errors.push(`السطر ${rowNum} (Mindmaps): معرف العقدة ونصها مطلوبان.`);
    }
  });

  interactiveDiagrams.forEach((diag, index) => {
    const rowNum = index + 2;
    if (isEmpty(diag.lessonId) || !lessonIds.has(String(diag.lessonId).trim())) {
      errors.push(`السطر ${rowNum} (InteractiveDiagrams): معرف الدرس غير صالح.`);
    }
    if (isEmpty(diag.imageFile) || isEmpty(diag.labelAr) || isEmpty(diag.descAr)) {
      errors.push(`السطر ${rowNum} (InteractiveDiagrams): ملف الصورة والاسم والشرح مطلوبين.`);
    }
  });

  // Calculate final item counts for summary
  const summaryLessonsCount = lessons.length;
  
  const summaryQuizzesCount = 
    examBank.filter(q => ['mcq', 'tf', 'fill', 'fill_blank'].includes(q.questionType || q.type)).length + 
    quizzes.length + 
    ministryExams.length;

  const summaryFlashcardsCount = 
    examBank.filter(q => {
      const type = String(q.questionType || q.type || '').trim().toLowerCase();
      return !type || ['explain', 'what_if', 'define'].includes(type);
    }).length + 
    flashcards.length;

  const summaryGlossaryCount = 
    examBank.filter(q => (q.questionType || q.type) === 'define').length + 
    glossary.length;

  const summaryMindmapsCount = 
    diagramsMindmaps.filter(d => (d.type || '').trim().toLowerCase() === 'mindmap').length + 
    mindmapsInteractive.length + 
    mindmaps.length;

  const summaryInteractiveDiagramsCount = 
    diagramsMindmaps.filter(d => (d.type || '').trim().toLowerCase() === 'diagram').length + 
    diagramsInteractive.length + 
    interactiveDiagrams.length;

  const summaryMinistryExamsCount = 
    examBank.filter(q => q.isMinistry === true || q.isMinistry === 'true' || String(q.isMinistry).toLowerCase() === 'true').length;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      lessonsCount: summaryLessonsCount,
      quizzesCount: summaryQuizzesCount,
      flashcardsCount: summaryFlashcardsCount,
      glossaryCount: summaryGlossaryCount,
      mindmapsCount: summaryMindmapsCount,
      interactiveDiagramsCount: summaryInteractiveDiagramsCount,
      ministryExamsCount: summaryMinistryExamsCount
    }
  };
}

export default validateExcelData;
