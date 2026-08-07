import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Download, PlusCircle, Sparkles, RefreshCw, Info, Copy, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

import { getAbsoluteUrl } from '../../utils/urlHelper';
import { Lesson, ConfigQuestion } from '../../types';
import { SecureStorage } from '../../utils/security';

interface ExamBankTabProps {
  lang: 'ar' | 'en';
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  saveAllToServer: (lessonsToSave: Lesson[]) => Promise<void>;
}

export default function ExamBankTab({
  lang,
  lessons,
  setLessons,
  saveAllToServer
}: ExamBankTabProps) {
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState<string[]>([]);
  const [excelValidationResult, setExcelValidationResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Fetch backups on tab load
  useEffect(() => {
    fetch(getAbsoluteUrl('/api/backups'))
      .then(r => r.json())
      .then(d => setBackups(d.backups ?? []))
      .catch(() => {});
  }, []);

  const handleCopyClipboard = () => {
    const jsonStr = JSON.stringify(lessons, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTriggerDownload = () => {
    const jsonStr = JSON.stringify(lessons, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lessons_config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSyncCurriculum = async () => {
    try {
      SecureStorage.removeItem('curriculum_data');
      SecureStorage.removeItem('curriculum_version');
      window.location.reload();
    } catch (e) {
      alert(lang === 'ar' ? 'فشل إعادة المزامنة' : 'Re-sync failed');
    }
  };

  const handlePublishUpdate = async () => {
    try {
      const res = await fetch(getAbsoluteUrl('/api/publish-update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const resData = await res.json();
        alert(lang === 'ar' 
          ? `📢 تم نشر التحديث بنجاح لجميع هواتف الطلاب! (رقم الإصدار الجديد: ${resData.version || 'محدث'})` 
          : `📢 Update published successfully to all students! (New Version: ${resData.version || 'updated'})`
        );
      } else {
        throw new Error('Server returned non-200');
      }
    } catch (e) {
      alert(lang === 'ar' ? 'فشل نشر التحديث' : 'Publishing update failed');
    }
  };

  const handleExportExcel = async () => {
    const getUL = (lessonId: string, fallbackUnit = 1) => {
      if (lessonId.startsWith('u') && lessonId.includes('-l')) {
        const parts = lessonId.substring(1).split('-l');
        return {
          U: Number(parts[0]) || fallbackUnit,
          L: Number(parts[1]) || 1
        };
      }
      if (lessonId.includes('-')) {
        const num = Number(lessonId.split('-').pop());
        if (!isNaN(num)) return { U: fallbackUnit, L: num };
      }
      const parsedL = Number(lessonId);
      return { U: fallbackUnit, L: isNaN(parsedL) ? lessonId : parsedL };
    };

    // 1. Lessons_Core Sheet Data
    const lessonsCoreData = lessons.map(l => {
      const { U, L } = getUL(l.id, l.unit);
      return {
        U,
        L,
        unitNameAr: l.unitNameAr || '',
        unitNameEn: l.unitNameEn || '',
        lessonNameAr: l.titleAr,
        lessonNameEn: l.titleEn,
        summaryPointsAr: l.summaryPointsAr ? l.summaryPointsAr.join(' | ') : '',
        pdfFileName: l.pdfFile,
        imageFileName: l.folder ? `${l.folder}.webp` : '',
        isPremiumLocked: l.locked ? 'TRUE' : 'FALSE',
        pdfLocked: l.pdfLocked ? 'TRUE' : 'FALSE',
        mindmapLocked: l.mindmapLocked ? 'TRUE' : 'FALSE',
        diagramLocked: l.diagramLocked ? 'TRUE' : 'FALSE',
        quizLocked: l.quizLocked ? 'TRUE' : 'FALSE',
        ministryExamLocked: l.ministryExamLocked ? 'TRUE' : 'FALSE'
      };
    });

    // Helper to strip prefix for subjective questions
    const stripPrefix = (str: string) => {
      if (!str) return '';
      return str.replace(/^(علل|Explain|ماذا يحدث لو|What happens if|عرّف|عرف|Define)\s*:\s*/i, '');
    };

    // Helper to detect subjective question type
    const getSubjectiveType = (qAr: string): 'explain' | 'what_if' | 'define' => {
      const clean = qAr.trim();
      if (/^(علل|Explain)/i.test(clean)) return 'explain';
      if (/^(ماذا يحدث لو|What happens if)/i.test(clean)) return 'what_if';
      if (/^(عرّف|عرف|Define)/i.test(clean)) return 'define';
      return 'explain';
    };

    // 2. Exam_Bank Sheet Data
    const examBankData: any[] = [];
    let questionCounter = 1;

    lessons.forEach(l => {
      const { U, L } = getUL(l.id, l.unit);

      // Export Quizzes (Objective questions only)
      if (l.quiz) {
        l.quiz.forEach(q => {
          const type = String(q.type || '').trim().toLowerCase();
          if (!['mcq', 'tf', 'fill', 'fill_blank'].includes(type)) {
            return;
          }

          const optionsStr = q.options 
            ? q.options.map(o => o.textAr).join(' | ')
            : '';
          const correctAnswersStr = q.correctAnswers
            ? q.correctAnswers.join(' | ')
            : q.correctKey || '';

          examBankData.push({
            U,
            L,
            questionId: q.id || questionCounter++,
            isMinistry: 'FALSE',
            examYear: q.examYear || 'General',
            questionType: q.type,
            questionText: q.textAr,
            questionImage: q.questionImage || '',
            options: optionsStr,
            correctAnswer: (q.type === 'fill' || q.type === 'fill_blank') ? correctAnswersStr : (q.correctKey || ''),
            hint: q.hintAr || '',
            explanation: q.explanationAr || ''
          });
        });
      }

      // Export Ministry Exams (Objective questions only)
      if (l.ministryExams) {
        l.ministryExams.forEach(q => {
          const type = String(q.type || '').trim().toLowerCase();
          if (!['mcq', 'tf', 'fill', 'fill_blank'].includes(type)) {
            return;
          }

          const optionsStr = q.options 
            ? q.options.map(o => o.textAr).join(' | ')
            : '';
          const correctAnswersStr = q.correctAnswers
            ? q.correctAnswers.join(' | ')
            : q.correctKey || '';

          examBankData.push({
            U,
            L,
            questionId: q.id || questionCounter++,
            isMinistry: 'TRUE',
            examYear: q.examYear || '2026',
            questionType: q.type,
            questionText: q.textAr,
            questionImage: q.questionImage || '',
            options: optionsStr,
            correctAnswer: (q.type === 'fill' || q.type === 'fill_blank') ? correctAnswersStr : (q.correctKey || ''),
            hint: q.hintAr || '',
            explanation: q.explanationAr || ''
          });
        });
      }

      // Export Glossary items as 'define' questions
      const exportedGlossaryTerms = new Set<string>();
      if (l.glossary) {
        l.glossary.forEach((g, idx) => {
          exportedGlossaryTerms.add(g.term.trim().toLowerCase());
          examBankData.push({
            U,
            L,
            questionId: 3000 + idx,
            isMinistry: 'FALSE',
            examYear: 'General',
            questionType: 'define',
            questionText: g.term,
            questionImage: '',
            options: '',
            correctAnswer: g.descAr,
            hint: '',
            explanation: ''
          });
        });
      }

      // Export Flashcards that are NOT define/glossary terms
      if (l.flashcards) {
        l.flashcards.forEach((f, idx) => {
          const subType = getSubjectiveType(f.qAr);
          const cleanText = stripPrefix(f.qAr);

          if (subType === 'define' && exportedGlossaryTerms.has(cleanText.trim().toLowerCase())) {
            return; // Skip duplicate
          }

          examBankData.push({
            U,
            L,
            questionId: 4000 + idx,
            isMinistry: 'FALSE',
            examYear: 'General',
            questionType: '',
            questionText: f.qAr,
            questionImage: '',
            options: '',
            correctAnswer: f.aAr,
            hint: '',
            explanation: ''
          });
        });
      }
    });

    // 3. Diagrams_Interactive Sheet Data
    const diagramsInteractiveData: any[] = [];
    lessons.forEach(l => {
      const { U, L } = getUL(l.id, l.unit);
      if (l.interactiveDiagrams) {
        l.interactiveDiagrams.forEach(diag => {
          if (diag.hotspots) {
            diag.hotspots.forEach(hs => {
              diagramsInteractiveData.push({
                U,
                L,
                imageName: diag.imageFile,
                diagramTitleAr: diag.titleAr,
                partNumber: hs.id,
                partName: hs.labelAr,
                partDetails: hs.descAr,
                x: hs.x,
                y: hs.y,
                arrowX: hs.arrowX !== undefined && hs.arrowX !== null ? hs.arrowX : '',
                arrowY: hs.arrowY !== undefined && hs.arrowY !== null ? hs.arrowY : ''
              });
            });
          }
        });
      }
    });

    // 4. MindMaps_Interactive Sheet Data
    const mindmapsInteractiveData: any[] = [];
    lessons.forEach(l => {
      const { U, L } = getUL(l.id, l.unit);
      if (l.mindmap) {
        l.mindmap.forEach(m => {
          mindmapsInteractiveData.push({
            U,
            L,
            nodeId: m.id,
            parentNodeId: m.parentId || '',
            nodeText: m.textAr,
            nodeDetails: m.details || '',
            color: m.color || ''
          });
        });
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lessonsCoreData), "Lessons_Core");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(examBankData), "Exam_Bank");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diagramsInteractiveData), "Diagrams_Interactive");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mindmapsInteractiveData), "MindMaps_Interactive");

    const fileName = `biology_curriculum_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        alert(lang === 'ar'
          ? `تم تصدير المنهج وحفظ الملف بنجاح في مجلد المستندات بجهازك باسم: \n${fileName}`
          : `Curriculum exported and saved successfully to your Documents folder as: \n${fileName}`
        );
      } catch (err: any) {
        console.error('Excel Export/Save Error:', err);
        alert(lang === 'ar'
          ? `عذراً، فشل حفظ الملف على الهاتف: ${err.message || err}`
          : `Sorry, failed to save file on mobile: ${err.message || err}`
        );
      }
    } else {
      XLSX.writeFile(wb, fileName);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelValidationResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const findSheet = (names: string[]) => {
          for (const name of names) {
            const foundKey = wb.SheetNames.find(n => {
              const cleanN = n.trim().toLowerCase().replace(/[\s_-]+/g, '');
              const cleanTarget = name.trim().toLowerCase().replace(/[\s_-]+/g, '');
              return cleanN === cleanTarget;
            });
            if (foundKey) return wb.Sheets[foundKey];
          }
          return null;
        };

        const lessonsCoreSheet = findSheet(['lessons_core', 'lessons', 'lessons core']);
        const diagramsInteractiveSheet = findSheet(['diagrams_interactive', 'diagrams interactive']);
        const mindmapsInteractiveSheet = findSheet(['mindmaps_interactive', 'mindmaps interactive', 'mindmaps']);
        const examBankSheet = findSheet(['exam_bank', 'exam bank', 'exambank']);

        const lessonsRaw: any[] = lessonsCoreSheet ? XLSX.utils.sheet_to_json(lessonsCoreSheet) : [];
        const diagramsInteractiveRaw: any[] = diagramsInteractiveSheet ? XLSX.utils.sheet_to_json(diagramsInteractiveSheet) : [];
        const mindmapsInteractiveRaw: any[] = mindmapsInteractiveSheet ? XLSX.utils.sheet_to_json(mindmapsInteractiveSheet) : [];
        const examBankRaw: any[] = examBankSheet ? XLSX.utils.sheet_to_json(examBankSheet) : [];

        // Validation errors and warnings lists
        const errorsList: string[] = [];
        const warningsList: string[] = [];

        // 1. Validate sheet structure
        if (lessonsRaw.length === 0) {
          errorsList.push(lang === 'ar' ? "صفحة Lessons_Core فارغة أو غير موجودة." : "Lessons_Core sheet is empty or missing.");
        }

        const validLessonsList = lessonsRaw.filter(less => {
          if (!less.U || !less.L) {
            errorsList.push(lang === 'ar' 
              ? `السطر المحتوي على العنوان (${less.lessonNameAr || 'غير معروف'}) يفتقر لرقم الوحدة U أو الدرس L.`
              : `Row with title (${less.lessonNameAr || 'unknown'}) lacks Unit U or Lesson L.`
            );
            return false;
          }
          return true;
        });

        if (errorsList.length > 0) {
          setExcelValidationResult({
            type: 'error',
            message: lang === 'ar' ? 'فشل التحقق من صحة جدول إكسل. تم إلغاء الاستيراد.' : 'Excel sheet validation failed. Import aborted.',
            errors: errorsList,
            warnings: warningsList
          });
          return;
        }

        // Map and parse the Excel lessons data
        const nestedLessons: Lesson[] = validLessonsList.map(less => {
          const lessonId = `u${less.U}-l${less.L}`;
          const existingLesson = lessons.find(l => l.id === lessonId);
          
          const summaryPointsAr = less.summaryPointsAr
            ? String(less.summaryPointsAr).split('|').map(s => s.trim()).filter(Boolean)
            : [];
          const summaryPointsEn = less.summaryPointsEn
            ? String(less.summaryPointsEn).split('|').map(s => s.trim()).filter(Boolean)
            : [];

          // Parse flashcards (preserve if not found in Excel)
          const hasFlashcardsInExcel = examBankRaw.some(q => q.U === less.U && q.L === less.L && String(q.questionType).trim().toLowerCase() === '');
          const lessonFlashcards = (examBankRaw.length > 0 && hasFlashcardsInExcel)
            ? examBankRaw
              .filter(q => q.U === less.U && q.L === less.L && String(q.questionType).trim().toLowerCase() === '')
              .map(q => ({
                qAr: q.questionText || '',
                qEn: q.questionTextEn || '',
                aAr: q.correctAnswer || '',
                aEn: q.correctAnswerEn || ''
              }))
            : (existingLesson?.flashcards || []);

          // Parse glossary glossary terms (preserve if not found in Excel)
          const hasGlossaryInExcel = examBankRaw.some(q => q.U === less.U && q.L === less.L && String(q.questionType).trim().toLowerCase() === 'define');
          const lessonGlossary = (examBankRaw.length > 0 && hasGlossaryInExcel)
            ? examBankRaw
              .filter(q => q.U === less.U && q.L === less.L && String(q.questionType).trim().toLowerCase() === 'define')
              .map(q => ({
                term: q.questionText || '',
                descAr: q.correctAnswer || '',
                descEn: q.correctAnswerEn || ''
              }))
            : (existingLesson?.glossary || []);

          // Parse quizzes (preserve if not found in Excel)
          const hasQuizzesInExcel = examBankRaw.some(q => q.U === less.U && q.L === less.L && ['mcq', 'tf', 'fill', 'fill_blank', 'unspecified'].includes(String(q.questionType).trim().toLowerCase()) && String(q.isMinistry).trim().toLowerCase() !== 'true');
          const lessonQuizzes = (examBankRaw.length > 0 && hasQuizzesInExcel)
            ? examBankRaw
              .filter(q => q.U === less.U && q.L === less.L && ['mcq', 'tf', 'fill', 'fill_blank', 'unspecified'].includes(String(q.questionType).trim().toLowerCase()) && String(q.isMinistry).trim().toLowerCase() !== 'true')
              .map(q => {
                const type = String(q.questionType).trim().toLowerCase();
                let options: { key: string; textAr: string; textEn: string }[] | undefined = undefined;

                if (type === 'mcq' && q.options) {
                  options = String(q.options).split('|').map((o, idx) => {
                    const key = String.fromCharCode(65 + idx); // A, B, C, D
                    return { key, textAr: o.trim(), textEn: o.trim() };
                  });
                } else if (type === 'tf') {
                  options = [
                    { key: 'T', textAr: '✔️ صح', textEn: 'True' },
                    { key: 'F', textAr: '❌ خطأ', textEn: 'False' }
                  ];
                }

                return {
                  id: q.questionId || 1,
                  type: (type === 'fill_blank' ? 'fill' : type) as any,
                  textAr: q.questionText || '',
                  textEn: q.questionTextEn || '',
                  options,
                  correctKey: type === 'mcq' || type === 'tf' ? String(q.correctAnswer).trim() : undefined,
                  correctAnswers: type === 'fill_blank' || type === 'fill' ? String(q.correctAnswer).split('|').map(s => s.trim()) : undefined,
                  explanationAr: q.explanation || '',
                  explanationEn: q.explanationEn || '',
                  questionImage: q.questionImage || '',
                  examYear: q.examYear ? String(q.examYear).trim() : ''
                };
              })
            : (existingLesson?.quiz || []);

          // Parse ministry exams (preserve if not found in Excel)
          const hasMinistryExamsInExcel = examBankRaw.some(q => q.U === less.U && q.L === less.L && ['mcq', 'tf', 'fill', 'fill_blank', 'unspecified'].includes(String(q.questionType).trim().toLowerCase()) && String(q.isMinistry).trim().toLowerCase() === 'true');
          const lessonMinistryExams = (examBankRaw.length > 0 && hasMinistryExamsInExcel)
            ? examBankRaw
              .filter(q => q.U === less.U && q.L === less.L && ['mcq', 'tf', 'fill', 'fill_blank', 'unspecified'].includes(String(q.questionType).trim().toLowerCase()) && String(q.isMinistry).trim().toLowerCase() === 'true')
              .map(q => {
                const type = String(q.questionType).trim().toLowerCase();
                let options: { key: string; textAr: string; textEn: string }[] | undefined = undefined;

                if (type === 'mcq' && q.options) {
                  options = String(q.options).split('|').map((o, idx) => {
                    const key = String.fromCharCode(65 + idx); // A, B, C, D
                    return { key, textAr: o.trim(), textEn: o.trim() };
                  });
                } else if (type === 'tf') {
                  options = [
                    { key: 'T', textAr: '✔️ صح', textEn: 'True' },
                    { key: 'F', textAr: '❌ خطأ', textEn: 'False' }
                  ];
                }

                return {
                  id: q.questionId || 1,
                  type: (type === 'fill_blank' ? 'fill' : type) as any,
                  textAr: q.questionText || '',
                  textEn: q.questionTextEn || '',
                  options,
                  correctKey: type === 'mcq' || type === 'tf' ? String(q.correctAnswer).trim() : undefined,
                  correctAnswers: type === 'fill_blank' || type === 'fill' ? String(q.correctAnswer).split('|').map(s => s.trim()) : undefined,
                  explanationAr: q.explanation || '',
                  explanationEn: q.explanationEn || '',
                  questionImage: q.questionImage || '',
                  examYear: q.examYear ? String(q.examYear).trim() : ''
                };
              })
            : (existingLesson?.ministryExams || []);

          // Parse interactive diagrams hotspots (preserve if Diagrams_Interactive sheet has no data)
          const lessonInteractiveDiagramsMap: Record<string, { imageFile: string; titleAr: string; hotspots: any[] }> = {};
          let lessonInteractiveDiagrams = existingLesson?.interactiveDiagrams || [];
          
          if (diagramsInteractiveRaw.length > 0) {
            diagramsInteractiveRaw
              .filter(d => d.U === less.U && d.L === less.L)
              .forEach(d => {
                const key = d.imageName;
                if (!lessonInteractiveDiagramsMap[key]) {
                  lessonInteractiveDiagramsMap[key] = {
                    imageFile: d.imageName,
                    titleAr: d.diagramTitleAr || '',
                    hotspots: []
                  };
                }
                lessonInteractiveDiagramsMap[key].hotspots.push({
                  id: String(d.partNumber),
                  x: Number(d.x),
                  y: Number(d.y),
                  arrowX: d.arrowX !== undefined && d.arrowX !== '' ? Number(d.arrowX) : undefined,
                  arrowY: d.arrowY !== undefined && d.arrowY !== '' ? Number(d.arrowY) : undefined,
                  labelAr: d.partName || '',
                  descAr: d.partDetails || ''
                });
              });
            if (Object.keys(lessonInteractiveDiagramsMap).length > 0) {
              lessonInteractiveDiagrams = Object.values(lessonInteractiveDiagramsMap);
            }
          }

          // Parse mindmap nodes (preserve if MindMaps_Interactive sheet has no data)
          let lessonMindmap = existingLesson?.mindmap || [];
          if (mindmapsInteractiveRaw.length > 0) {
            const parsedMindmap = mindmapsInteractiveRaw
              .filter(m => m.U === less.U && m.L === less.L)
              .map(m => ({
                id: String(m.nodeId),
                parentId: m.parentNodeId ? String(m.parentNodeId) : undefined,
                textAr: m.nodeText || '',
                details: m.nodeDetails || '',
                color: m.color || ''
              }));
            if (parsedMindmap.length > 0) {
              lessonMindmap = parsedMindmap;
            }
          }

          // Demo slides filenames array
          const demoSlides = less.demoSlides
            ? String(less.demoSlides).split('|').map(s => s.trim()).filter(Boolean)
            : [];

          return {
            id: lessonId,
            unit: less.U,
            unitNameAr: less.unitNameAr || '',
            unitNameEn: less.unitNameEn || '',
            folder: less.folderName ? String(less.folderName).trim() : `U${less.U}`,
            titleAr: less.lessonNameAr || '',
            titleEn: less.lessonNameEn || '',
            pdfFile: less.pdfFileName || '',
            diagramFile: less.imageFileName || '',
            summaryFile: less.summaryFileName || '',
            mindmapFile: less.mindmapFileName || '',
            quizFile: less.quizFileName || '',
            ministryExamFile: less.ministryExamFileName || '',
            locked: (() => {
              const val = less.isPremiumLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            pdfLocked: (() => {
              const val = less.pdfLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            mindmapLocked: (() => {
              const val = less.mindmapLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            diagramLocked: (() => {
              const val = less.diagramLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            quizLocked: (() => {
              const val = less.quizLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            ministryExamLocked: (() => {
              const val = less.ministryExamLocked;
              if (val === undefined || val === null) return false;
              const str = String(val).trim().toLowerCase();
              return str === 'true' || str === 'yes' || str === 'locked' || str === '1' || str === 'نعم' || str === 'مغلق' || str === 'مفعل';
            })(),
            videoUrl: less.videoUrl || '',
            videoChapters: [],
            summaryPointsAr,
            summaryPointsEn,
            flashcards: lessonFlashcards,
            glossary: lessonGlossary,
            quiz: lessonQuizzes,
            mindmap: lessonMindmap,
            interactiveDiagrams: lessonInteractiveDiagrams,
            ministryExams: lessonMinistryExams,
            demoSlides
          };
        });

        setLessons(nestedLessons);
        await saveAllToServer(nestedLessons);

        setExcelValidationResult({
          type: 'success',
          message: lang === 'ar' ? '✅ تم استيراد المنهج الدراسي بنجاح وتحديث قاعدة البيانات!' : '✅ Syllabus imported successfully and database updated!',
          errors: [],
          warnings: warningsList
        });
      } catch (err) {
        alert(lang === 'ar' ? `خطأ أثناء قراءة ملف إكسل: ${err}` : `Error parsing Excel file: ${err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <motion.div
      key="export"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6"
    >
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {lang === 'ar' ? 'تصدير وحفظ المنهج الجديد' : 'Export & Build Database'}
        </h2>
        <p className="text-xs text-slate-400 font-bold">
          {lang === 'ar'
            ? 'بعد مراجعة أخطاء التكوين، قم بتحميل ملف التكوين أو نسخه لحفظ كل عملك بأمان.'
            : 'Download or copy configuration JSON after ensuring validation checks pass.'}
        </p>
      </div>

      {/* Action Download Box */}
      <div className="bg-emerald-500 text-white p-6 rounded-app-dialog shadow-xl shadow-emerald-500/20 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 space-y-2">
          <h3 className="font-black text-lg">{lang === 'ar' ? 'تحميل ملف lessons_config.json' : 'Download lessons_config.json'}</h3>
          <p className="text-xs text-emerald-100 font-semibold max-w-lg leading-relaxed">
            {lang === 'ar'
              ? 'قم بتحميل الملف المحدث واستبدله مباشرة بالملف الموجود في مجلد public في مشروعك ثم أعد رفع الموقع.'
              : 'Replace the existing public/lessons_config.json file in your project folders, then deploy.'}
          </p>
        </div>
        <button
          onClick={handleTriggerDownload}
          className="relative z-10 bg-white hover:bg-slate-50 text-emerald-600 font-black text-xs px-6 py-3.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>{lang === 'ar' ? 'تنزيل ملف المنهج المحدث' : 'Download Config File'}</span>
        </button>
      </div>

      {/* Excel Curriculum Manager */}
      <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-app-dialog border border-slate-150 dark:border-slate-800 space-y-6">
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white">
            {lang === 'ar' ? 'إدارة المنهج عبر ملفات إكسل (Excel Manager)' : 'Excel Curriculum Manager'}
          </h3>
          <p className="text-[11px] text-slate-450 dark:text-slate-400 font-bold mt-1">
            {lang === 'ar'
              ? 'تصدير المنهج الحالي بالكامل كملف إكسل منسق، أو استيراد وتحديث المنهج الدراسي من جدول إكسل معدل مع الفحص التلقائي للمدخلات.'
              : 'Export the current syllabus as formatted Excel, or import and update database from modified Excel.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleExportExcel}
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs px-5 py-3.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/15"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تصدير المنهج الحالي إلى إكسل 📊' : 'Export Syllabus to Excel 📊'}</span>
          </button>

          <label className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-3.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer text-center">
            <PlusCircle className="w-4 h-4" />
            <span>{lang === 'ar' ? 'استيراد المنهج من إكسل 📥' : 'Import Syllabus from Excel 📥'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>
        </div>

        <button
          onClick={handlePublishUpdate}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
        >
          <Sparkles className="w-4 h-4" />
          <span>{lang === 'ar' ? 'نشر وإرسال التحديث لجميع الهواتف 📢' : 'Publish & Broadcast Update to All Phones 📢'}</span>
        </button>

        <button
          onClick={handleSyncCurriculum}
          className="w-full bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-black text-xs px-5 py-3.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{lang === 'ar' ? 'تحديث وتنزيل المنهج الجديد من السيرفر 🔄' : 'Force Sync & Reload Syllabus from Server 🔄'}</span>
        </button>

        {excelValidationResult && (
          <div className={`p-5 rounded-app-card border text-xs leading-relaxed ${
            excelValidationResult.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400'
              : excelValidationResult.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
          }`} dir="rtl">
            {excelValidationResult.message && <p className="font-black text-sm mb-2 text-right">{excelValidationResult.message}</p>}
            {excelValidationResult.errors.length > 0 && (
              <div className="space-y-1 text-right">
                <p className="font-black text-rose-600 dark:text-rose-450">❌ أخطاء تمنع الاستيراد:</p>
                {excelValidationResult.errors.map((e, idx) => (
                  <p key={idx}>• {e}</p>
                ))}
              </div>
            )}
            {excelValidationResult.warnings.length > 0 && (
              <div className="space-y-1 mt-2 text-right">
                <p className="font-black text-amber-600 dark:text-amber-450">⚠️ تنبيهات (تم الاستيراد بنجاح ولكن يرجى التحقق):</p>
                {excelValidationResult.warnings.map((w, idx) => (
                  <p key={idx}>• {w}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checklist instructions */}
      <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-app-card border border-slate-150 dark:border-slate-800 space-y-3">
        <h4 className="font-black text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
          <Info className="w-4 h-4 text-indigo-500" />
          <span>{lang === 'ar' ? 'خطوات التحديث البسيطة للموقع' : 'Syllabus Deployment Checklist'}</span>
        </h4>
        <div className="text-[11px] text-slate-455 dark:text-slate-405 font-bold space-y-2 leading-relaxed">
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-app-btn bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">1</span>
            <p>{lang === 'ar' ? 'انقر على زر "تنزيل ملف المنهج المحدث" لحفظ الملف على جهاز الكمبيوتر الخاص بك.' : 'Click the "Download Config File" button to download lessons_config.json locally.'}</p>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-app-btn bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">2</span>
            <p>{lang === 'ar' ? 'افتح مجلد المشروع الخاص بك وانتقل للمجلد الفرعي public/ واستبدل الملف القديم بالملف الجديد.' : 'Open your project root directory and locate the public/ subdirectory.'}</p>
          </div>
          <div className="flex gap-2">
            <span className="w-5 h-5 rounded-app-btn bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">3</span>
            <p>{lang === 'ar' ? 'انتهى! ستنعكس التعديلات على الويب تلقائياً وتفتح الوحدات أو الأسئلة الجديدة لجميع طلابك.' : 'Overwrite the old lessons_config.json with the new file. Re-deploy the code to web.'}</p>
          </div>
        </div>
      </div>

      {/* Output Raw copy card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-500 dark:text-slate-450">{lang === 'ar' ? 'معاينة ونسخ نص الكود (JSON Code)' : 'JSON Schema Raw Output'}</label>
          <button
            onClick={handleCopyClipboard}
            className="text-emerald-500 hover:text-emerald-600 font-black text-xs flex items-center gap-1 active:scale-95 transition-transform"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نسخ الكود' : 'Copy Code'}</span>
              </>
            )}
          </button>
        </div>
        
        <div className="bg-slate-900 text-slate-100 p-4 rounded-app-card border border-slate-800 text-[10px] font-mono overflow-auto max-h-80 select-text leading-relaxed">
          <pre>{JSON.stringify(lessons, null, 2)}</pre>
        </div>
      </div>

      {/* Backups Snapshot list */}
      <div 
        className="bg-slate-50 dark:bg-slate-950 p-6 rounded-app-dialog border border-slate-150 dark:border-slate-800 space-y-4"
        dir="rtl"
      >
        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
          <span>🗄️</span>
          <span>{lang === 'ar' ? 'النسخ الاحتياطية للمنهج والأكواد (آخر 10 نسخ)' : 'System Backups (Last 10)'}</span>
        </h3>
        {backups.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold">
            {lang === 'ar' ? 'لا توجد نسخ احتياطية محفوظة بعد.' : 'No backup snapshots found yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {backups.map(date => (
              <div
                key={date}
                className="flex justify-between items-center py-2 px-4 bg-white dark:bg-slate-900 rounded-app-btn border border-slate-100 dark:border-slate-800/80 text-xs"
              >
                <span className="text-slate-600 dark:text-slate-350 font-mono font-bold">{date}</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <span>✅</span>
                  <span>{lang === 'ar' ? 'محفوظة بأمان' : 'Safely Saved'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
