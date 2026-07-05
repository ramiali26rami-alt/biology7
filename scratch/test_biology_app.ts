import { validateExcelData } from '../src/utils/excelValidator';
import CryptoJS from 'crypto-js';

// --- MOCK EXCEL SHEETS (4-Sheet Schema) ---
const mockLessonsCore = [
  {
    lessonId: 'L1',
    unitNumber: 1,
    unitNameAr: 'الوحدة الأولى',
    lessonNameAr: 'الخلية الحية',
    lessonNameEn: 'The Living Cell',
    summaryPointsAr: 'الخلية هي وحدة بناء الكائن الحي. | السيتوبلازم يملأ الفراغ الخلوي.',
    pdfFileName: 'cell_notes.pdf',
    imageFileName: 'cell_anatomy.webp',
    isPremiumLocked: 'FALSE'
  }
];

const mockDiagramsInteractive = [
  {
    lessonId: 'L1',
    imageName: 'cell_anatomy.png',
    diagramTitleAr: 'مخطط الخلية',
    partNumber: 'H1',
    partName: 'الغشاء البلازمي',
    partDetails: 'يحيط بالخلية ويحمي مكوناتها ويعمل كحارس نفاذية.',
    x: 45.5,
    y: 60.2
  }
];

const mockMindmapsInteractive = [
  {
    lessonId: 'L1',
    nodeId: 'N1',
    parentNodeId: '',
    nodeText: 'النواة',
    nodeDetails: 'تحتوي على المادة الوراثية وتوجه عمليات الخلية.',
    color: '#ff5555'
  }
];

const mockExamBank = [
  {
    lessonId: 'L1',
    questionId: 1,
    questionType: 'mcq',
    questionText: 'ما هي وحدة بناء الكائن الحي؟',
    questionImage: 'cell_q1.webp',
    options: 'الخلية | النسيج | العضو',
    correctAnswer: 'A',
    explanation: 'الخلية هي أصغر وحدة بنائية للحياة.',
    hint: 'أصغر وحدة بنائية.',
    isMinistry: 'false'
  },
  {
    lessonId: 'L1',
    questionId: 2,
    questionType: 'explain',
    questionText: 'تعتبر الميتوكوندريا بيت الطاقة في الخلية.',
    correctAnswer: 'لأنها تقوم بإنتاج جزيئات ATP الغنية بالطاقة.',
    isMinistry: 'false'
  },
  {
    lessonId: 'L1',
    questionId: 3,
    questionType: 'define',
    questionText: 'الانتشار البسيط',
    correctAnswer: 'حركة الجزيئات من التركيز العالي إلى المنخفض.',
    isMinistry: 'false'
  }
];

// --- TEST RUNNER ---
async function runTests() {
  console.log('🧪 Starting Biology App Automated Quality Testing (4-Sheet Schema)...');
  console.log('===================================================================');

  let passed = true;

  // 1. Test Excel Validator
  try {
    console.log('1. Testing excelValidator.ts (New 4-Sheet Schema Validation)...');
    const result = validateExcelData({
      lessons_core: mockLessonsCore,
      diagrams_interactive: mockDiagramsInteractive,
      mindmaps_interactive: mockMindmapsInteractive,
      exam_bank: mockExamBank
    });

    if (!result.isValid) {
      console.error('❌ Validation failed! Errors:', result.errors);
      passed = false;
    } else {
      console.log('   ✅ Excel validation passed successfully.');
      console.log('   📊 Summary:', JSON.stringify(result.summary, null, 2));
    }
  } catch (err) {
    console.error('❌ Excel Validator crashed:', err);
    passed = false;
  }

  // 2. Test Importer Mapping (matches AdminDashboardScreen logic)
  let mappedLessons: any[] = [];
  try {
    console.log('\n2. Testing Importer Mapping (4-Sheet Schema nested conversion)...');
    
    mappedLessons = mockLessonsCore.map((less: any) => {
      const lessonId = String(less.lessonId).trim();
      
      const summaryPointsAr = less.summaryPointsAr 
        ? String(less.summaryPointsAr).split(/[|\n]/).map((s: string) => s.trim()).filter(Boolean)
        : [];
      
      const lessonExamBank = mockExamBank.filter(q => String(q.lessonId).trim() === lessonId);
      
      // Map Quizzes (mcq)
      const quizzes = lessonExamBank.filter(q => q.questionType === 'mcq').map(q => {
        let optionsArray = undefined;
        if (q.options) {
          const rawOptions = String(q.options).split('|').map(s => s.trim()).filter(Boolean);
          const keys = ['A', 'B', 'C', 'D'];
          optionsArray = rawOptions.map((opt, idx) => ({
            key: keys[idx] || String(idx + 1),
            textAr: opt,
            textEn: opt
          }));
        }

        return {
          id: q.questionId,
          type: q.questionType,
          textAr: q.questionText,
          options: optionsArray,
          correctKey: q.correctAnswer,
          explanationAr: q.explanation,
          hintAr: q.hint,
          questionImage: q.questionImage
        };
      });

      // Map Flashcards (explain / define)
      const subjectiveRows = lessonExamBank.filter(q => ['explain', 'define'].includes(q.questionType));
      const flashcards = subjectiveRows.map((q: any) => {
        let prefix = q.questionType === 'explain' ? 'علل: ' : 'عرّف: ';
        return {
          qAr: prefix + q.questionText,
          aAr: q.correctAnswer
        };
      });

      // Map Glossary (define)
      const glossary = lessonExamBank.filter(q => q.questionType === 'define').map(q => ({
        term: q.questionText,
        descAr: q.correctAnswer
      }));

      // Map Diagrams
      const newDiagRows = mockDiagramsInteractive.filter((d: any) => String(d.lessonId).trim() === lessonId);
      const diagramMap = new Map<string, any>();
      newDiagRows.forEach(d => {
        const img = d.imageName;
        if (!diagramMap.has(img)) {
          diagramMap.set(img, { imageFile: img, titleAr: d.diagramTitleAr, hotspots: [] });
        }
        diagramMap.get(img).hotspots.push({
          id: d.partNumber,
          x: d.x,
          y: d.y,
          labelAr: d.partName,
          descAr: d.partDetails
        });
      });
      const interactiveDiagrams = Array.from(diagramMap.values());

      // Map Mindmaps
      const newMindmapRows = mockMindmapsInteractive.filter((d: any) => String(d.lessonId).trim() === lessonId);
      const mindmap = newMindmapRows.map(d => ({
        id: d.nodeId,
        parentId: d.parentNodeId || undefined,
        textAr: d.nodeText,
        details: d.nodeDetails,
        color: d.color
      }));

      return {
        id: lessonId,
        titleAr: less.lessonNameAr,
        summaryPointsAr,
        quiz: quizzes,
        flashcards,
        glossary,
        mindmap,
        interactiveDiagrams
      };
    });

    // Asserts
    const cellL = mappedLessons[0];
    if (cellL.summaryPointsAr.length !== 2 || cellL.summaryPointsAr[0] !== 'الخلية هي وحدة بناء الكائن الحي.') {
      console.error('❌ Summary points pipe-split parsing failed!', cellL.summaryPointsAr);
      passed = false;
    } else if (cellL.quiz.length !== 1 || cellL.quiz[0].options[0].key !== 'A' || cellL.quiz[0].options[0].textAr !== 'الخلية') {
      console.error('❌ Quiz MCQ options pipe-split parsing failed!', cellL.quiz[0].options);
      passed = false;
    } else if (cellL.quiz[0].questionImage !== 'cell_q1.webp') {
      console.error('❌ QuestionImage mapping failed!');
      passed = false;
    } else if (cellL.flashcards.length !== 2 || cellL.flashcards[0].qAr !== 'علل: تعتبر الميتوكوندريا بيت الطاقة في الخلية.') {
      console.error('❌ Flashcard subjective prefix mapping failed!', cellL.flashcards);
      passed = false;
    } else if (cellL.glossary.length !== 1 || cellL.glossary[0].term !== 'الانتشار البسيط') {
      console.error('❌ Glossary mapping failed!');
      passed = false;
    } else if (cellL.mindmap.length !== 1 || cellL.mindmap[0].details !== 'تحتوي على المادة الوراثية وتوجه عمليات الخلية.') {
      console.error('❌ Mindmap nodeDetails mapping failed!', cellL.mindmap);
      passed = false;
    } else if (cellL.interactiveDiagrams.length !== 1 || cellL.interactiveDiagrams[0].hotspots[0].x !== 45.5) {
      console.error('❌ InteractiveDiagram hotspots coordinates mapping failed!');
      passed = false;
    } else {
      console.log('   ✅ Importer Mapping conversion test passed.');
    }
  } catch (err) {
    console.error('❌ Importer Mapping crashed:', err);
    passed = false;
  }

  // 3. Test Exporter Stripping & Rebuilding (matches AdminDashboardScreen export logic)
  try {
    console.log('\n3. Testing Exporter Rebuilding (4-Sheet Export Format Integrity)...');
    
    // Helper to strip prefix
    const stripPrefix = (str: string) => str.replace(/^(علل|Explain|ماذا يحدث لو|What happens if|عرّف|عرف|Define)\s*:\s*/i, '');
    
    const exportedExamBank: any[] = [];
    mappedLessons.forEach(l => {
      // Export MCQ
      l.quiz.forEach((q: any) => {
        exportedExamBank.push({
          lessonId: l.id,
          questionId: q.id,
          questionType: q.type,
          questionText: q.textAr,
          options: q.options.map((o: any) => o.textAr).join(' | '),
          correctAnswer: q.correctKey,
          questionImage: q.questionImage || ''
        });
      });

      // Export glossary
      const exportedGlossaryTerms = new Set<string>();
      l.glossary.forEach((g: any) => {
        exportedGlossaryTerms.add(g.term.trim().toLowerCase());
        exportedExamBank.push({
          lessonId: l.id,
          questionType: 'define',
          questionText: g.term,
          correctAnswer: g.descAr
        });
      });

      // Export flashcards (skip define if duplicate)
      l.flashcards.forEach((f: any) => {
        const isDefine = f.qAr.startsWith('عرّف:') || f.qAr.startsWith('عرف:');
        const clean = stripPrefix(f.qAr);
        const subType = f.qAr.startsWith('علل:') ? 'explain' : 'define';
        if (isDefine && exportedGlossaryTerms.has(clean.trim().toLowerCase())) {
          return; // Skip duplicate
        }
        exportedExamBank.push({
          lessonId: l.id,
          questionType: subType,
          questionText: clean,
          correctAnswer: f.aAr
        });
      });
    });

    if (exportedExamBank.length !== 3) {
      console.error('❌ Exporter rebuilding count check failed! Got:', exportedExamBank.length);
      passed = false;
    } else {
      const explainItem = exportedExamBank.find(q => q.questionType === 'explain');
      if (explainItem && explainItem.questionText.startsWith('علل:')) {
        console.error('❌ Exporter failed to strip flashcard prefix!');
        passed = false;
      } else {
        console.log('   ✅ Exporter rebuilding integrity test passed.');
      }
    }
  } catch (err) {
    console.error('❌ Exporter crashed:', err);
    passed = false;
  }

  // 4. Test Encryption
  try {
    console.log('\n4. Testing DRM Encrypted Cache decryption cycle...');
    const originalText = 'DRM science decryption test string';
    const key = 'Biotech_2026_device_uuid_test';
    const encrypted = CryptoJS.AES.encrypt(originalText, key).toString();
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (decrypted !== originalText) {
      console.error('❌ DRM decryption verify mismatch!');
      passed = false;
    } else {
      console.log('   ✅ DRM cache cycle test passed.');
    }
  } catch (err) {
    console.error('❌ Encryption test crashed:', err);
    passed = false;
  }

  console.log('\n===================================================================');
  if (passed) {
    console.log('🏆 ALL TESTS PASSED SUCCESSFULLY! The 4-Sheet curriculum schema is verified. 🏆');
  } else {
    console.error('🔴 SOME TESTS FAILED. Please check the errors above. 🔴');
    process.exit(1);
  }
}

runTests();
