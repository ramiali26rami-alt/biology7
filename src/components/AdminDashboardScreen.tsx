import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Download, 
  Eye, 
  Code, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  PlusCircle, 
  Play, 
  FileText, 
  BookOpen, 
  HelpCircle,
  X,
  Sparkles,
  Info,
  Sliders,
  CheckCircle,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Key,
  Target,
  Loader2
} from 'lucide-react';
import { ScreenId, Lesson, VideoChapter, Flashcard, GlossaryItem, ConfigQuestion } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { validateExcelData } from '../utils/excelValidator';
import * as XLSX from 'xlsx';
import { SecureStorage } from '../utils/security';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '../utils/supabaseClient';

interface AdminDashboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
}

type TabType = 'lessons-list' | 'lesson-editor' | 'preview' | 'export' | 'keys' | 'helper' | 'students';
type EditorSubTab = 'basic' | 'chapters' | 'summary-flash' | 'quiz' | 'files';

export default function AdminDashboardScreen({ onNavigate, lang, lessons, setLessons }: AdminDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lessons-list');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('basic');
  const [copied, setCopied] = useState(false);
  const [exportSearchQuery, setExportSearchQuery] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewQuizIdx, setPreviewQuizIdx] = useState(0);
  const [previewSelectedAns, setPreviewSelectedAns] = useState<string | null>(null);
  const [previewShowExpl, setPreviewShowExpl] = useState(false);
  const [activeQuizIdx, setActiveQuizIdx] = useState(0);
  const [findText, setFindText] = useState('');

  // Supabase Students Management States
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [dbStudentsLoading, setDbStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [activationCodes, setActivationCodes] = useState<any[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
      fetchActivationCodes();
    }
  }, [activeTab]);

  const fetchStudents = async () => {
    setDbStudentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDbStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setDbStudentsLoading(false);
    }
  };

  const fetchActivationCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setActivationCodes(data || []);
    } catch (err) {
      console.error('Error fetching activation codes:', err);
    }
  };

  const handleToggleStudentPremium = async (phone: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_premium: !currentStatus })
        .eq('phone', phone);
      if (error) throw error;
      
      // Update local state
      setDbStudents(prev => prev.map(s => s.phone === phone ? { ...s, is_premium: !currentStatus } : s));
    } catch (err) {
      console.error('Error toggling student premium status:', err);
      alert('فشل تعديل تفعيل الحساب');
    }
  };

  const handleResetStudentDevice = async (phone: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من إعادة ضبط هاتف هذا الطالب؟ سيتيح له هذا التسجيل من هاتف جديد.' : 'Are you sure you want to reset this student\'s device? This lets them register on a new phone.')) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ device_id: 'reset' })
        .eq('phone', phone);
      if (error) throw error;
      alert(lang === 'ar' ? 'تم إعادة ضبط الهاتف بنجاح! يمكن للطالب الآن التسجيل من هاتف جديد.' : 'Device reset successfully! The student can now register from a new phone.');
      fetchStudents();
    } catch (err) {
      console.error('Error resetting device:', err);
      alert('فشل إعادة ضبط جهاز الطالب');
    }
  };

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment1 = '';
    let segment2 = '';
    for (let i = 0; i < 4; i++) {
      segment1 += chars.charAt(Math.floor(Math.random() * chars.length));
      segment2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newCode = `BIO-${segment1}-${segment2}`;

    try {
      const { error } = await supabase
        .from('activation_codes')
        .insert([{ code: newCode }]);
      if (error) throw error;
      setGeneratedCode(newCode);
      fetchActivationCodes();
    } catch (err) {
      console.error('Error generating activation code:', err);
      alert('فشل إنشاء كود التفعيل');
    } finally {
      setCodeLoading(false);
    }
  };
  const [replaceText, setReplaceText] = useState('');
  const [replaceSuccess, setReplaceSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [detectedFolders, setDetectedFolders] = useState<{ path: string, name: string, files: string[] }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fileEditorTab, setFileEditorTab] = useState<'easy' | 'code'>('easy');
  const [mindmapNodes, setMindmapNodes] = useState<{ index: number; type: string; text: string }[]>([]);
  const [nodesSearchQuery, setNodesSearchQuery] = useState('');
  const [backups, setBackups] = useState<string[]>([]);

  // ── Server-save state ──────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // ── In-browser HTML file editor state ─────────────────────────────────────
  const [fileEditorContent, setFileEditorContent] = useState('');
  const fileEditorContentRef = useRef(fileEditorContent);
  useEffect(() => {
    fileEditorContentRef.current = fileEditorContent;
  }, [fileEditorContent]);
  const [fileEditorPath, setFileEditorPath] = useState('');
  const [fileEditorLoading, setFileEditorLoading] = useState(false);
  const [fileEditorSaving, setFileEditorSaving] = useState(false);
  const [fileEditorSaved, setFileEditorSaved] = useState(false);

  // ── File-upload state ──────────────────────────────────────────────────────
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Activation keys states
  interface ActivationKey {
    key: string;
    status: 'unused' | 'used';
    usedBy?: string;
    activatedAt?: string;
    deviceUuid?: string;
  }
  const [keysList, setKeysList] = useState<ActivationKey[]>([]);
  const [keysGenerateCount, setKeysGenerateCount] = useState<number>(10);
  const [keysLoading, setKeysLoading] = useState<boolean>(false);
  const [keysStatusMsg, setKeysStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Excel Import Validation States
  interface ExcelValidationState {
    type: 'success' | 'warning' | 'error';
    errors: string[];
    warnings: string[];
    summary: any;
    message?: string;
  }
  const [excelValidationResult, setExcelValidationResult] = useState<ExcelValidationState | null>(null);

  const fetchKeys = async () => {
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const res = await fetch('/api/activation-keys', {
        headers: {
          'x-admin-passcode': '2026'
        }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.keys)) {
        setKeysList(data.keys);
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل في تحميل الأكواد.' : 'Failed to load keys.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    setKeysLoading(true);
    setKeysStatusMsg(null);
    try {
      const res = await fetch('/api/generate-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': '2026'
        },
        body: JSON.stringify({ count: keysGenerateCount })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.keys)) {
        setKeysList(data.keys);
        setKeysStatusMsg({
          type: 'success',
          text: lang === 'ar' ? `تم توليد ${keysGenerateCount} كود جديد بنجاح!` : `Successfully generated ${keysGenerateCount} new keys!`
        });
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل في توليد الأكواد.' : 'Failed to generate keys.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    } finally {
      setKeysLoading(false);
    }
  };

  const handleExportKeys = () => {
    if (keysList.length === 0) return;
    const txtContent = keysList.map(k => `${k.key}\t[${k.status === 'unused' ? (lang === 'ar' ? 'غير مستخدم' : 'Unused') : (lang === 'ar' ? 'مستخدم' : 'Used')}]${k.usedBy ? `\tUsed by: ${k.usedBy}` : ''}${k.activatedAt ? `\tAt: ${k.activatedAt}` : ''}`).join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `biotech_activation_keys_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();
    } else if (activeTab === 'export') {
      fetch('/api/backups')
        .then(r => r.json())
        .then(d => setBackups(d.backups ?? []))
        .catch(() => {});
    }
  }, [activeTab]);

  // AI Quiz Generator states
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiType, setAiType] = useState<'all' | 'mcq' | 'tf' | 'fill'>('all');
  const [localApiKey, setLocalApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleApiKeyChange = (val: string) => {
    setLocalApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleGenerateAIQuiz = async () => {
    if (!editingLesson) return;
    setAiLoading(true);
    setAiStatusMsg(null);

    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': localApiKey
        },
        body: JSON.stringify({
          lessonTitleAr: editingLesson.titleAr,
          lessonTitleEn: editingLesson.titleEn,
          lessonSummaryAr: editingLesson.summaryPointsAr,
          lessonSummaryEn: editingLesson.summaryPointsEn,
          questionCount: aiCount,
          questionType: aiType
        })
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.quiz)) {
        const existingQuiz = editingLesson.quiz || [];
        const startIndex = existingQuiz.length;
        const newQuestions = data.quiz.map((q: any, i: number) => ({
          ...q,
          id: startIndex + i + 1
        }));

        const updatedQuiz = [...existingQuiz, ...newQuestions];
        const updatedLesson = { ...editingLesson, quiz: updatedQuiz };
        
        setEditingLesson(updatedLesson);
        const updatedLessons = lessons.map((l, idx) => idx === editingLessonIndex ? updatedLesson : l);
        setLessons(updatedLessons);
        
        await saveAllToServer(updatedLessons);

        setAiStatusMsg({
          type: 'success',
          text: lang === 'ar' ? translations.ar.generateSuccess : translations.en.generateSuccess
        });
        
        setActiveQuizIdx(startIndex);
      } else {
        setAiStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? translations.ar.generateError : translations.en.generateError)
        });
      }
    } catch (err) {
      setAiStatusMsg({
        type: 'error',
        text: String(err) || (lang === 'ar' ? translations.ar.generateError : translations.en.generateError)
      });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetch('/detected_assets.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.folders) {
          setDetectedFolders(data.folders);
        }
      })
      .catch(err => console.error("Error loading detected assets:", err));

  }, []);

  const t = translations[lang];

  // Helper for layout direction
  const isRtl = lang === 'ar';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const backIcon = isRtl ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  // Run validation whenever lessons change
  useEffect(() => {
    validateSyllabus();
  }, [lessons]);

  // Reset active quiz index when editing lesson changes
  useEffect(() => {
    setActiveQuizIdx(0);
  }, [editingLesson?.id]);

  const validateSyllabus = () => {
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
          if (!q.correctKey || (q.correctKey !== 'T' && q.correctKey !== 'F' && q.correctKey !== 'A' && q.correctKey !== 'B')) {
            errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد صح (A) أو خطأ (B)!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: TF requires correct key A or B!`);
          }
        } else if (q.type === 'fill') {
          if (!q.correctAnswers || q.correctAnswers.length === 0) {
            errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد إجابة مقبولة واحدة على الأقل لإكمال الفراغ!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: Fill blank requires at least one correct answer!`);
          }
        }
      });
    });

    setValidationErrors(errors);
  };

  const handleCreateNewLesson = () => {
    const newId = `lesson-${Date.now()}`;
    const newLesson: Lesson = {
      id: newId,
      unit: 1,
      folder: "الوحدة الاولى     التنظيم العصبي في الكائنات الحية/الدرس الجديد",
      titleAr: "مفهوم بيولوجي جديد",
      titleEn: "New Biological Concept",
      pdfFile: "الدرس الجديد.pdf",
      diagramFile: "الدرس الجديد.png",
      summaryFile: "",
      mindmapFile: "",
      quizFile: "",
      ministryExamFile: "",
      locked: false,
      videoUrl: "https://www.youtube.com/embed/6m6uT0284xI",
      videoChapters: [
        { time: "00:00", titleAr: "مقدمة", titleEn: "Introduction", descAr: "بداية الشرح", descEn: "Start of chapter" }
      ],
      summaryPointsAr: ["البروتوبلازم هو أساس الحياة وعلينا دراسة تطور الأجهزة."],
      summaryPointsEn: ["Protoplasm is the base of life, coordination evolves in complexity."],
      flashcards: [
        { qAr: "أين تقع الغدة؟", qEn: "Where is the gland located?", aAr: "فوق الأعضاء المستهدفة.", aEn: "Above the target organs." }
      ],
      glossary: [
        { term: "Biotech", descAr: "التكنولوجيا الحيوية وتطبيقاتها.", descEn: "Biotechnological integrations." }
      ],
      quiz: [
        {
          id: 1,
          type: "tf",
          textAr: "الإحساس في الكائنات البسيطة خلوي عام.",
          textEn: "Irritability in simple organisms is general cellular.",
          options: [
            { key: "T", textAr: "✔️ صح", textEn: "True" },
            { key: "F", textAr: "❌ خطأ", textEn: "False" }
          ],
          correctKey: "T",
          explanationAr: "صح. لعدم وجود خلايا عصبية متخصصة في الأميبا.",
          explanationEn: "True. Due to lack of specialized neurones in Amoeba."
        }
      ]
    };

    const newIdx = lessons.length;
    setLessons(prev => [...prev, newLesson]);
    setEditingLesson(newLesson);
    setEditingLessonIndex(newIdx);
    setEditorSubTab('basic');
    setActiveTab('lesson-editor');
  };

  const handleSaveLessonEdit = () => {
    if (!editingLesson || editingLessonIndex === null) return;
    const updatedLessons = lessons.map((l, idx) => idx === editingLessonIndex ? editingLesson : l);
    setLessons(updatedLessons);
    validateSyllabus();
    saveAllToServer(updatedLessons);
    setActiveTab('lessons-list');
  };

  const handleDeleteLesson = (id: string) => {
    const msg = lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الدرس نهائياً؟' : 'Are you sure you want to delete this lesson permanently?';
    if (window.confirm(msg)) {
      const updatedLessons = lessons.filter(l => l.id !== id);
      setLessons(updatedLessons);
      setEditingLesson(null);
      setEditingLessonIndex(null);
      saveAllToServer(updatedLessons);
    }
  };

  const handleTriggerDownload = () => {
    validateSyllabus();
    if (validationErrors.length > 0) {
      const msg = lang === 'ar' 
        ? 'تحذير: يحتوي المنهج على بعض الأخطاء التكوينية. هل تريد المتابعة وتنزيل الملف على أي حال؟' 
        : 'Warning: Syllabus contains configuration errors. Do you want to download anyway?';
      if (!window.confirm(msg)) return;
    }
    
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

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelValidationResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so selecting the same file again triggers onChange
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // Case-insensitive, space and underscore flexible sheet finder
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

        // Legacy sheets
        const diagramsMindMapsSheet = findSheet(['diagrams_&_mindmaps', 'diagrams & mindmaps', 'diagrams_mindmaps', 'diagrams mindmaps']);
        const quizzesSheet = findSheet(['quizzes']);
        const flashcardsSheet = findSheet(['flashcards']);
        const glossarySheet = findSheet(['glossary']);
        const mindmapsSheet = findSheet(['mindmaps']);
        const interactiveDiagramsSheet = findSheet(['interactivediagrams', 'interactive diagrams']);
        const ministryExamsSheet = findSheet(['ministryexams', 'ministry exams']);

        const lessonsRaw = lessonsCoreSheet ? XLSX.utils.sheet_to_json(lessonsCoreSheet) : [];
        const diagramsInteractiveRaw = diagramsInteractiveSheet ? XLSX.utils.sheet_to_json(diagramsInteractiveSheet) : [];
        const mindmapsInteractiveRaw = mindmapsInteractiveSheet ? XLSX.utils.sheet_to_json(mindmapsInteractiveSheet) : [];
        const examBankRaw = examBankSheet ? XLSX.utils.sheet_to_json(examBankSheet) : [];

        const diagramsMindMapsRaw = diagramsMindMapsSheet ? XLSX.utils.sheet_to_json(diagramsMindMapsSheet) : [];
        const quizzesRaw = quizzesSheet ? XLSX.utils.sheet_to_json(quizzesSheet) : [];
        const flashcardsRaw = flashcardsSheet ? XLSX.utils.sheet_to_json(flashcardsSheet) : [];
        const glossaryRaw = glossarySheet ? XLSX.utils.sheet_to_json(glossarySheet) : [];
        const mindmapsRaw = mindmapsSheet ? XLSX.utils.sheet_to_json(mindmapsSheet) : [];
        const interactiveDiagramsRaw = interactiveDiagramsSheet ? XLSX.utils.sheet_to_json(interactiveDiagramsSheet) : [];
        const ministryExamsRaw = ministryExamsSheet ? XLSX.utils.sheet_to_json(ministryExamsSheet) : [];

        // Validate excel
        const validation = validateExcelData({
          lessons_core: lessonsCoreSheet ? lessonsRaw : undefined,
          exam_bank: examBankSheet ? examBankRaw : undefined,
          diagrams_interactive: diagramsInteractiveSheet ? diagramsInteractiveRaw : undefined,
          mindmaps_interactive: mindmapsInteractiveSheet ? mindmapsInteractiveRaw : undefined,

          diagrams_mindmaps: diagramsMindMapsSheet ? diagramsMindMapsRaw : undefined,
          lessons: lessonsCoreSheet ? undefined : lessonsRaw,
          quizzes: quizzesRaw,
          flashcards: flashcardsRaw,
          glossary: glossaryRaw,
          mindmaps: mindmapsRaw,
          interactiveDiagrams: interactiveDiagramsRaw,
          ministryExams: ministryExamsRaw
        });

        if (!validation.isValid) {
          setExcelValidationResult({
            type: 'error',
            errors: validation.errors,
            warnings: validation.warnings,
            summary: validation.summary as any
          });
          return;
        }

        setExcelValidationResult({
          type: validation.warnings.length > 0 ? 'warning' : 'success',
          errors: [],
          warnings: validation.warnings,
          summary: validation.summary as any,
          message: lang === 'ar'
            ? `✅ تم الاستيراد بنجاح: ${validation.summary.lessonsCount} درس | ${validation.summary.quizzesCount} سؤال | ${validation.summary.flashcardsCount} بطاقة | ${validation.summary.glossaryCount} مصطلح | ${validation.summary.mindmapsCount} عقدة خارطة | ${validation.summary.interactiveDiagramsCount} رسم تفاعلي | ${validation.summary.ministryExamsCount} سؤال وزاري`
            : `✅ Successfully imported: ${validation.summary.lessonsCount} lessons | ${validation.summary.quizzesCount} quizzes | ${validation.summary.flashcardsCount} flashcards | ${validation.summary.glossaryCount} glossary terms | ${validation.summary.mindmapsCount} mindmap nodes | ${validation.summary.interactiveDiagramsCount} interactive diagrams | ${validation.summary.ministryExamsCount} ministry exam questions`
        });

        // Map excel data to nested Lesson[] format
        const nestedLessons: Lesson[] = lessonsRaw.map((less: any) => {
          const uVal = Number(less.U !== undefined ? less.U : less.unitNumber !== undefined ? less.unitNumber : less.unit) || 1;
          const lVal = Number(less.L !== undefined ? less.L : less.lessonNumber !== undefined ? less.lessonNumber : less.lessonId) || 1;
          const lessonId = (less.U !== undefined && less.L !== undefined) ? `u${uVal}-l${lVal}` : String(less.lessonId !== undefined ? less.lessonId : less.id).trim();

          const summaryPointsAr = less.summaryPointsAr 
            ? String(less.summaryPointsAr).split(/[|\n]/).map((s: string) => s.trim()).filter(Boolean)
            : less.summaryText
            ? String(less.summaryText).split('\n').map((s: string) => s.trim().replace(/^•\s*/, '')).filter(Boolean)
            : [];
          const summaryPointsEn = less.summaryPointsEn
            ? String(less.summaryPointsEn).split(/[|\n]/).map((s: string) => s.trim()).filter(Boolean)
            : less.summaryTextEn
            ? String(less.summaryTextEn).split('\n').map((s: string) => s.trim().replace(/^•\s*/, '')).filter(Boolean)
            : [];

          const demoSlides = less.demoSlides
            ? String(less.demoSlides).split(/[|\n]/).map((s: string) => s.trim()).filter(Boolean)
            : [];

          const lessonExamBank = examBankRaw.filter((q: any) => {
            const qU = Number(q.U !== undefined ? q.U : q.unit);
            const qL = Number(q.L !== undefined ? q.L : q.lesson);
            if (q.U === undefined && q.L === undefined) {
              return String(q.lessonId).trim() === lessonId;
            }
            return qU === uVal && qL === lVal;
          });
          
          const mapExamQuestion = (q: any) => {
            let optionsArray = undefined;
            if (q.options) {
              const optStr = String(q.options);
              if (optStr.includes('|')) {
                const rawOptions = optStr.split('|').map(s => s.trim()).filter(Boolean);
                const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
                optionsArray = rawOptions.map((opt, idx) => ({
                  key: keys[idx] || String(idx + 1),
                  textAr: opt,
                  textEn: opt
                }));
              } else {
                optionsArray = optStr.split(',').map((optStr: string) => {
                  const parts = optStr.split(':');
                  const key = parts[0]?.trim() || '';
                  const text = parts.slice(1).join(':')?.trim() || '';
                  return { key, textAr: text, textEn: text };
                }).filter(o => o.key);
              }
            }

            const rawType = String(q.questionType || q.type || '').trim().toLowerCase();
            let mappedType: 'mcq' | 'tf' | 'fill' | 'fill_blank' | 'explain' | 'what_if' | 'define' = 'mcq';
            if (rawType === 'mcq') mappedType = 'mcq';
            else if (rawType === 'tf') mappedType = 'tf';
            else if (rawType === 'fill_blank' || rawType === 'fill') mappedType = 'fill_blank';
            else if (rawType === 'explain') mappedType = 'explain';
            else if (rawType === 'what_if') mappedType = 'what_if';
            else if (rawType === 'define') mappedType = 'define';

            const correctAnswersArray = q.correctAnswers 
              ? String(q.correctAnswers).split(/[|,,،\/]/).map((s: string) => s.trim()).filter(Boolean)
              : q.correctAnswer && mappedType === 'fill_blank'
              ? String(q.correctAnswer).split(/[|,,،\/]/).map((s: string) => s.trim()).filter(Boolean)
              : q.correctKey && mappedType === 'fill_blank'
              ? String(q.correctKey).split(/[|,,،\/]/).map((s: string) => s.trim()).filter(Boolean)
              : undefined;

            let finalCorrectKey = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.correctKey || '')).trim();

            if (mappedType === 'tf') {
              const cleanAns = finalCorrectKey.toLowerCase();
              const isTrueAns = cleanAns === 't' || cleanAns === 'true' || cleanAns === 'صح' || cleanAns === 'صواب' || cleanAns === 'a' || cleanAns.includes('صح');
              const isFalseAns = cleanAns === 'f' || cleanAns === 'false' || cleanAns === 'خطأ' || cleanAns === 'b' || cleanAns.includes('خطأ');

              if (optionsArray) {
                if (isTrueAns) {
                  const foundTrueOpt = optionsArray.find(o => o.textAr.includes('صح') || o.textAr.includes('صواب') || o.textEn.toLowerCase().includes('true'));
                  if (foundTrueOpt) {
                    finalCorrectKey = foundTrueOpt.key;
                  } else {
                    finalCorrectKey = 'A';
                  }
                } else if (isFalseAns) {
                  const foundFalseOpt = optionsArray.find(o => o.textAr.includes('خطأ') || o.textEn.toLowerCase().includes('false'));
                  if (foundFalseOpt) {
                    finalCorrectKey = foundFalseOpt.key;
                  } else {
                    finalCorrectKey = 'B';
                  }
                }
              } else {
                finalCorrectKey = isTrueAns ? 'A' : 'B';
              }
            } else if (mappedType === 'mcq') {
              const cleanAns = finalCorrectKey.toLowerCase();
              if (optionsArray) {
                const matchedOption = optionsArray.find(o => 
                  o.textAr.toLowerCase() === cleanAns || 
                  o.key.toLowerCase() === cleanAns
                );
                if (matchedOption) {
                  finalCorrectKey = matchedOption.key;
                }
              }
            }

            return {
              id: Number(q.questionId || q.id) || 0,
              type: mappedType as any,
              textAr: q.questionText || q.textAr || q.text || '',
              textEn: q.textEn || '',
              options: optionsArray,
              correctKey: finalCorrectKey,
              correctAnswers: correctAnswersArray,
              explanationAr: q.explanation || q.explanationAr || '',
              explanationEn: q.explanationEn || '',
              hintAr: q.hint || q.hintAr || '',
              hintEn: q.hintEn || '',
              questionImage: q.questionImage || undefined
            };
          };

          const isMinQuestion = (q: any) => q.isMinistry === true || q.isMinistry === 'true' || String(q.isMinistry).toLowerCase() === 'true';
          const isObjective = (q: any) => {
            const rawType = String(q.questionType || q.type || '').trim().toLowerCase();
            return ['mcq', 'tf', 'fill', 'fill_blank'].includes(rawType);
          };

          let lessonQuizzes: ConfigQuestion[] = lessonExamBank.filter(q => isObjective(q) && !isMinQuestion(q)).map(mapExamQuestion);
          let lessonMinistryExams: ConfigQuestion[] = lessonExamBank.filter(q => isObjective(q) && isMinQuestion(q)).map(mapExamQuestion);

          // Fallback to legacy quizzes
          if (lessonExamBank.length === 0) {
            if (quizzesRaw.length > 0) {
              lessonQuizzes = quizzesRaw.filter((q: any) => String(q.lessonId).trim() === lessonId).map((q: any) => {
                const optionsArray = q.options 
                  ? String(q.options).split(',').map((optStr: string) => {
                      const parts = optStr.split(':');
                      const key = parts[0]?.trim() || '';
                      const text = parts.slice(1).join(':')?.trim() || '';
                      return { key, textAr: text, textEn: text };
                    }).filter(o => o.key)
                  : undefined;
                
                const rawType = String(q.type || '').trim().toLowerCase();
                let mappedType: 'mcq' | 'tf' | 'fill' = 'mcq';
                if (rawType === 'fill' || rawType.includes('إكمال') || rawType.includes('أكمل') || rawType.includes('فراغ') || rawType.includes('فراغات')) {
                  mappedType = 'fill';
                } else if (rawType === 'tf' || rawType === 't/f' || rawType.includes('صح') || rawType.includes('خطأ') || rawType.includes('صواب')) {
                  mappedType = 'tf';
                } else if (rawType === 'mcq' || rawType.includes('اختيار') || rawType.includes('متعدد')) {
                  mappedType = 'mcq';
                }

                return {
                  id: Number(q.questionId) || 0,
                  type: mappedType,
                  textAr: q.textAr || '',
                  textEn: q.textEn || '',
                  options: optionsArray,
                  correctKey: q.correctKey || '',
                  correctAnswers: q.correctAnswers ? String(q.correctAnswers).split(',').map((s: string) => s.trim()) : undefined,
                  explanationAr: q.explanationAr || '',
                  explanationEn: q.explanationEn || '',
                  hintAr: q.hintAr || '',
                  hintEn: q.hintEn || '',
                  definitionAr: q.definitionAr || '',
                  definitionEn: q.definitionEn || ''
                };
              });
            }
            if (ministryExamsRaw.length > 0) {
              lessonMinistryExams = ministryExamsRaw.filter((q: any) => String(q.lessonId).trim() === lessonId).map((q: any) => {
                const optionsArray = q.options 
                  ? String(q.options).split(',').map((optStr: string) => {
                      const parts = optStr.split(':');
                      const key = parts[0]?.trim() || '';
                      const text = parts.slice(1).join(':')?.trim() || '';
                      return { key, textAr: text, textEn: text };
                    }).filter(o => o.key)
                  : undefined;

                const rawType = String(q.type || '').trim().toLowerCase();
                let mappedType: 'mcq' | 'tf' | 'fill' = 'mcq';
                if (rawType === 'fill' || rawType.includes('إكمال') || rawType.includes('أكمل') || rawType.includes('فراغ') || rawType.includes('فراغات')) {
                  mappedType = 'fill';
                } else if (rawType === 'tf' || rawType === 't/f' || rawType.includes('صح') || rawType.includes('خطأ') || rawType.includes('صواب')) {
                  mappedType = 'tf';
                } else if (rawType === 'mcq' || rawType.includes('اختيار') || rawType.includes('متعدد')) {
                  mappedType = 'mcq';
                }

                return {
                  id: Number(q.questionId) || 0,
                  type: mappedType,
                  textAr: q.textAr || '',
                  textEn: q.textEn || '',
                  options: optionsArray,
                  correctKey: q.correctKey || '',
                  correctAnswers: q.correctAnswers ? String(q.correctAnswers).split(',').map((s: string) => s.trim()) : undefined,
                  explanationAr: q.explanationAr || '',
                  explanationEn: q.explanationEn || '',
                  hintAr: q.hintAr || '',
                  hintEn: q.hintEn || '',
                  definitionAr: q.definitionAr || '',
                  definitionEn: q.definitionEn || ''
                };
              });
            }
          }

          const subjectiveRows = lessonExamBank.filter((q: any) => {
            const rawType = String(q.questionType || q.type || '').trim().toLowerCase();
            return !rawType || ['explain', 'what_if', 'define', 'subjective', 'flashcard'].includes(rawType);
          });
          const lessonFlashcards = subjectiveRows.map((q: any) => {
            let prefix = '';
            const rawType = String(q.questionType || q.type || '').trim().toLowerCase();
            const text = q.questionText || q.textAr || q.text || '';
            const textEn = q.textEn || '';

            if (rawType === 'explain' && !text.startsWith('علل') && !text.startsWith('Explain')) prefix = lang === 'ar' ? 'علل: ' : 'Explain: ';
            else if (rawType === 'what_if' && !text.startsWith('ماذا يحدث') && !textEn.startsWith('What happens')) prefix = lang === 'ar' ? 'ماذا يحدث لو: ' : 'What happens if: ';
            else if (rawType === 'define' && !text.startsWith('عرف') && !text.startsWith('Define')) prefix = lang === 'ar' ? 'عرّف: ' : 'Define: ';

            return {
              qAr: prefix + text,
              qEn: prefix + textEn,
              aAr: q.correctAnswer || q.correctAnswers || q.correctKey || '',
              aEn: q.correctAnswersEn || ''
            };
          });

          const lessonGlossary: any[] = [];

          // Diagrams
          const newDiagRows = diagramsInteractiveRaw.filter((d: any) => {
            const dU = Number(d.U !== undefined ? d.U : d.unit);
            const dL = Number(d.L !== undefined ? d.L : d.lesson);
            if (d.U === undefined && d.L === undefined) {
              return String(d.lessonId).trim() === lessonId;
            }
            return dU === uVal && dL === lVal;
          });
          const lessonDiagramsMindMaps = diagramsMindMapsRaw.filter((d: any) => {
            const dU = Number(d.U !== undefined ? d.U : d.unit);
            const dL = Number(d.L !== undefined ? d.L : d.lesson);
            if (d.U === undefined && d.L === undefined) {
              return String(d.lessonId).trim() === lessonId;
            }
            return dU === uVal && dL === lVal;
          });
          const diagramRows = lessonDiagramsMindMaps.filter((d: any) => String(d.type).trim().toLowerCase() === 'diagram');

          const diagramMap = new Map<string, { imageFile: string; titleAr: string; titleEn?: string; hotspots: any[] }>();

          const processDiagramRow = (d: any, isNewSchema: boolean) => {
            const imgFile = String(isNewSchema ? (d.imageName || d.imageFile || d.imageUrl) : (d.imageUrl || d.imageFile)).trim();
            if (!imgFile) return;
            if (!diagramMap.has(imgFile)) {
              diagramMap.set(imgFile, {
                imageFile: imgFile,
                titleAr: d.diagramTitleAr || d.titleAr || d.partNameAr || d.partName || '',
                titleEn: d.diagramTitleEn || d.titleEn || d.partNameEn || '',
                hotspots: []
              });
            }
            diagramMap.get(imgFile)!.hotspots.push({
              id: String(d.partNumber || d.id || Math.random()).trim(),
              x: Number(d.x) || 0,
              y: Number(d.y) || 0,
              arrowX: d.arrowX !== undefined && d.arrowX !== null && d.arrowX !== '' ? Number(d.arrowX) : undefined,
              arrowY: d.arrowY !== undefined && d.arrowY !== null && d.arrowY !== '' ? Number(d.arrowY) : undefined,
              labelAr: d.partName || d.partNameAr || '',
              labelEn: d.partNameEn || '',
              descAr: d.partDetails || d.partDetailsAr || '',
              descEn: d.partDetailsEn || ''
            });
          };

          if (newDiagRows.length > 0) {
            newDiagRows.forEach(d => processDiagramRow(d, true));
          } else {
            diagramRows.forEach(d => processDiagramRow(d, false));
          }

          let lessonInteractiveDiagrams = Array.from(diagramMap.values());
          if (lessonInteractiveDiagrams.length === 0 && interactiveDiagramsRaw.length > 0) {
            const legacyDiags = interactiveDiagramsRaw.filter((d: any) => {
              const dU = Number(d.U !== undefined ? d.U : d.unit);
              const dL = Number(d.L !== undefined ? d.L : d.lesson);
              if (d.U === undefined && d.L === undefined) {
                return String(d.lessonId).trim() === lessonId;
              }
              return dU === uVal && dL === lVal;
            });
            const legacyMap = new Map<string, any>();
            legacyDiags.forEach((d: any) => {
              const img = String(d.imageFile).trim();
              if (!legacyMap.has(img)) {
                legacyMap.set(img, { imageFile: img, titleAr: d.titleAr || '', titleEn: d.titleEn || '', hotspots: [] });
              }
              legacyMap.get(img)!.hotspots.push({
                id: String(d.hotspotId || d.id || Math.random()).trim(),
                x: Number(d.x) || 0,
                y: Number(d.y) || 0,
                arrowX: d.arrowX !== undefined && d.arrowX !== null && d.arrowX !== '' ? Number(d.arrowX) : undefined,
                arrowY: d.arrowY !== undefined && d.arrowY !== null && d.arrowY !== '' ? Number(d.arrowY) : undefined,
                labelAr: d.labelAr || '',
                labelEn: d.labelEn || '',
                descAr: d.descAr || '',
                descEn: d.descEn || ''
              });
            });
            lessonInteractiveDiagrams = Array.from(legacyMap.values());
          }

          // Mindmaps
          const newMindmapRows = mindmapsInteractiveRaw.filter((d: any) => {
            const mU = Number(d.U !== undefined ? d.U : d.unit);
            const mL = Number(d.L !== undefined ? d.L : d.lesson);
            if (d.U === undefined && d.L === undefined) {
              return String(d.lessonId).trim() === lessonId;
            }
            return mU === uVal && mL === lVal;
          });
          const mindmapRows = lessonDiagramsMindMaps.filter((d: any) => String(d.type).trim().toLowerCase() === 'mindmap');
          
          let lessonMindmap: any[] = [];
          if (newMindmapRows.length > 0) {
            lessonMindmap = newMindmapRows.map((d: any) => ({
              id: String(d.nodeId || d.id).trim(),
              parentId: d.parentNodeId || d.parentId ? String(d.parentNodeId || d.parentId).trim() : undefined,
              textAr: d.nodeText || d.textAr || '',
              textEn: d.nodeTextEn || d.textEn || '',
              color: d.color || undefined,
              details: d.nodeDetails || d.details || undefined
            }));
          } else {
            lessonMindmap = mindmapRows.map((d: any) => ({
              id: String(d.partNumber || d.id).trim(),
              parentId: d.parentId ? String(d.parentId).trim() : undefined,
              textAr: d.partNameAr || d.partName || '',
              textEn: d.partNameEn || '',
              color: d.color || undefined,
              details: d.partDetails || d.partDetailsAr || undefined
            }));
          }

          if (lessonMindmap.length === 0 && mindmapsRaw.length > 0) {
            lessonMindmap = mindmapsRaw
              .filter((m: any) => {
                const mU = Number(m.U !== undefined ? m.U : m.unit);
                const mL = Number(m.L !== undefined ? m.L : m.lesson);
                if (m.U === undefined && m.L === undefined) {
                  return String(m.lessonId).trim() === lessonId;
                }
                return mU === uVal && mL === lVal;
              })
              .map((m: any) => ({
                id: String(m.id).trim(),
                parentId: m.parentId ? String(m.parentId).trim() : undefined,
                textAr: m.textAr || '',
                textEn: m.textEn || '',
                color: m.color || undefined,
                details: m.details || undefined
              }));
          }

          const unitVal = Number(less.unitNumber !== undefined ? less.unitNumber : less.unit) || 1;

          return {
            id: lessonId,
            unit: unitVal,
            unitNameAr: less.unitNameAr || '',
            unitNameEn: less.unitNameEn || '',
            folder: less.folder || `U${unitVal}`,
            titleAr: less.lessonNameAr !== undefined ? less.lessonNameAr : (less.titleAr || less.title || ''),
            titleEn: less.lessonNameEn !== undefined ? less.lessonNameEn : (less.titleEn || ''),
            pdfFile: less.pdfFileName !== undefined ? (String(less.pdfFileName).includes('/') ? String(less.pdfFileName).split('/').pop()! : less.pdfFileName) : (less.pdfFile || ''),
            diagramFile: less.imageFileName !== undefined ? (String(less.imageFileName).includes('/') ? String(less.imageFileName).split('/').pop()! : less.imageFileName) : (less.diagramFile || ''),
            summaryFile: less.summaryFile || '',
            mindmapFile: less.mindmapFile || '',
            quizFile: less.quizFile || '',
            ministryExamFile: less.ministryExamFile || '',
            locked: (() => {
              const val = less.isPremiumLocked !== undefined ? less.isPremiumLocked : less.locked;
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
      } catch (err) {
        alert(lang === 'ar' ? `خطأ أثناء قراءة ملف إكسل: ${err}` : `Error parsing Excel file: ${err}`);
      }
    };
    reader.readAsBinaryString(file);
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
      const res = await fetch('/api/publish-update', {
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
        isPremiumLocked: l.locked ? 'TRUE' : 'FALSE'
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
            examYear: 'General',
            questionType: q.type,
            questionText: q.textAr,
            questionImage: q.questionImage || '',
            options: optionsStr,
            correctAnswer: q.type === 'fill_blank' ? correctAnswersStr : (q.correctKey || ''),
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
            examYear: '2026',
            questionType: q.type,
            questionText: q.textAr,
            questionImage: q.questionImage || '',
            options: optionsStr,
            correctAnswer: q.type === 'fill_blank' ? correctAnswersStr : (q.correctKey || ''),
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

  const handleResetDevice = async (key: string) => {
    const confirmMsg = lang === 'ar' 
      ? `هل أنت متأكد من رغبتك في إلغاء قفل الجهاز لهذا الكود (${key})؟ سيمكن هذا الطالب من التفعيل على هاتف آخر.`
      : `Are you sure you want to reset the device lock for this key (${key})? This allows activation on a different device.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/reset-key-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': '2026'
        },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeysList(data.keys);
        setKeysStatusMsg({
          type: 'success',
          text: lang === 'ar' ? 'تم إلغاء قفل الجهاز للكود بنجاح!' : 'Successfully reset device lock for key!'
        });
      } else {
        setKeysStatusMsg({
          type: 'error',
          text: data.error || (lang === 'ar' ? 'فشل إلغاء القفل.' : 'Failed to reset lock.')
        });
      }
    } catch (err) {
      setKeysStatusMsg({
        type: 'error',
        text: String(err)
      });
    }
  };

  const handleCopyClipboard = () => {
    const jsonStr = JSON.stringify(lessons, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // State mutation helpers for editing fields
  const updateEditingLessonField = (field: keyof Lesson, value: any) => {
    if (!editingLesson || editingLessonIndex === null) return;
    const updated = {
      ...editingLesson,
      [field]: value
    };
    setEditingLesson(updated);
    setLessons(prev => prev.map((l, idx) => idx === editingLessonIndex ? updated : l));
  };

  // ── Save all lessons directly to server disk ───────────────────────────────
  const saveAllToServer = async (lessonsToSave: Lesson[]) => {
    setSaveStatus('saving');
    // Always save to browser cache first so changes are preserved locally in the browser immediately!
    try {
      SecureStorage.setItem('curriculum_data', lessonsToSave);
    } catch (e) {
      console.warn("Failed to write local secure storage cache:", e);
    }

    try {
      const res = await fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonsToSave)
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } else {
        // Even if server post fails (e.g. read-only filesystem on Vercel),
        // we set saved state because we already successfully saved it in the browser cache!
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    } catch {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  // ── Load an HTML/text file from the server for editing ────────────────────
  const loadFileForEditing = async (filePath: string) => {
    setFileEditorPath(filePath);
    setFileEditorContent('');
    setFileEditorLoading(true);
    setFileEditorSaved(false);
    setFindText('');
    setReplaceText('');
    setNodesSearchQuery('');
    try {
      const res = await fetch(`/api/read-file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      const content = data.content ?? '';
      setFileEditorContent(content);
      
      // Parse mindmap nodes
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
        const nodes = Array.from(elements).map((el: any, idx) => {
          let type = 'leaf';
          if (el.classList.contains('root-btn')) type = 'root';
          else if (el.classList.contains('branch-btn')) type = 'branch';
          else if (el.classList.contains('sub-btn')) type = 'sub-branch';
          
          let text = (el.innerText || el.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          return { index: idx, type, text };
        });
        setMindmapNodes(nodes);
      } catch (err) {
        console.error("Error parsing mindmap nodes on load:", err);
        setMindmapNodes([]);
      }
    } catch {
      setFileEditorContent('<!-- خطأ في تحميل الملف -->');
      setMindmapNodes([]);
    } finally {
      setFileEditorLoading(false);
    }
  };

  // ── Helper to save updated file content to the server and reload preview ──
  const saveUpdatedContent = async (contentToSave: string) => {
    if (!fileEditorPath) return;
    setFileEditorSaving(true);
    setFileEditorSaved(false);
    try {
      const res = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileEditorPath, content: contentToSave })
      });
      if (res.ok) {
        setFileEditorSaved(true);
        setIframeKey(prev => prev + 1);
        setTimeout(() => setFileEditorSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save content:", err);
    } finally {
      setFileEditorSaving(false);
    }
  };

  // ── Sync mindmapNodes array from raw HTML content ─────────────────────────
  const syncNodesFromHtml = (htmlContent: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
      const nodes = Array.from(elements).map((el: any, idx) => {
        let type = 'leaf';
        if (el.classList.contains('root-btn')) type = 'root';
        else if (el.classList.contains('branch-btn')) type = 'branch';
        else if (el.classList.contains('sub-btn')) type = 'sub-branch';
        let text = (el.innerText || el.textContent || "").trim();
        text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
        return { index: idx, type, text };
      });
      setMindmapNodes(nodes);
    } catch (err) {
      console.error("Failed to sync nodes from HTML:", err);
    }
  };

  // ── Handle text changes in the Easy Editor inputs ─────────────────────────
  const handleNodeTextChange = (idx: number, newText: string) => {
    setMindmapNodes(prev => prev.map(node => node.index === idx ? { ...node, text: newText } : node));
  };

  // ── Handle node deletion in the Easy Editor inputs ────────────────────────
  const handleNodeDelete = (idx: number) => {
    setMindmapNodes(prev => prev.filter(node => node.index !== idx));
  };

  // ── Save all Easy Editor node modifications back to HTML on disk ──────────
  const saveAllVisualEdits = async (customNodes = mindmapNodes) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileEditorContent, 'text/html');
    const elements = doc.querySelectorAll('.root-btn, .branch-btn, .sub-btn, .leaf-item');
    
    Array.from(elements).forEach((el: any, idx) => {
      const nodeData = customNodes.find(n => n.index === idx);
      if (!nodeData) {
        // Node was deleted! Remove it from DOM.
        el.remove();
      } else {
        // Node text was updated!
        const newText = nodeData.text;
        const chevron = el.querySelector('.chevron');
        if (chevron) {
          el.innerHTML = '';
          el.appendChild(chevron);
          el.appendChild(doc.createTextNode(' ' + newText));
        } else {
          el.textContent = newText;
        }
      }
    });
    
    const updatedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    setFileEditorContent(updatedHtml);
    await saveUpdatedContent(updatedHtml);
    syncNodesFromHtml(updatedHtml);
  };

  // ── Quick Find & Replace inside HTML/text file ────────────────────────────
  const executeQuickReplace = async () => {
    if (!findText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = findText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    const flexibleRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    const updated = fileEditorContent.replace(flexibleRegex, replaceText);
    
    if (updated === fileEditorContent) {
      alert(lang === 'ar' ? '⚠️ النص المطلوب غير موجود في الملف!' : '⚠️ Requested text not found in file!');
      return;
    }
    
    setFileEditorContent(updated);
    setReplaceSuccess(true);
    setTimeout(() => setReplaceSuccess(false), 2000);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Quick Delete inside HTML/text file ────────────────────────────────────
  const executeQuickDelete = async () => {
    if (!findText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = findText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    
    // Regex patterns to match element tags completely to avoid leaving empty boxes on screen
    const leafRegex = new RegExp('<div\\s+class=["\']leaf-item["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</div>', 'gi');
    const subBtnRegex = new RegExp('<(?:button|div)\\s+class=["\']sub-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</(?:button|div)>', 'gi');
    const branchBtnRegex = new RegExp('<button\\s+class=["\']branch-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const genericRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    let updated = fileEditorContent;
    let matched = false;
    
    let temp = updated.replace(leafRegex, '');
    if (temp.length < updated.length) {
      updated = temp;
      matched = true;
    } else {
      temp = updated.replace(subBtnRegex, '');
      if (temp.length < updated.length) {
        updated = temp;
        matched = true;
      } else {
        temp = updated.replace(branchBtnRegex, '');
        if (temp.length < updated.length) {
          updated = temp;
          matched = true;
        } else {
          temp = updated.replace(genericRegex, '');
          if (temp.length < updated.length) {
            updated = temp;
            matched = true;
          }
        }
      }
    }
    
    if (!matched) {
      alert(lang === 'ar' ? '⚠️ النص المطلوب غير موجود في الملف!' : '⚠️ Requested text not found in file!');
      return;
    }
    
    setFileEditorContent(updated);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 2000);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Visual WYSIWYG Replace (Triggered from double click) ──────────────────
  const executeVisualReplace = async (originalText: string, newText: string) => {
    const currentContent = fileEditorContentRef.current;
    if (!originalText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = originalText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    const flexibleRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    if (!flexibleRegex.test(currentContent)) return;
    
    const updated = currentContent.replace(flexibleRegex, newText);
    setFileEditorContent(updated);
    
    // Auto-save updated content to disk for instant preview update
    await saveUpdatedContent(updated);
    syncNodesFromHtml(updated);
  };

  // ── Visual WYSIWYG Delete (Triggered from double click clear) ─────────────
  const executeVisualDelete = async (originalText: string) => {
    const currentContent = fileEditorContentRef.current;
    if (!originalText) return;
    
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = originalText.trim().split(/\s+/).map(w => escapeRegExp(w));
    const flexibleRegexPattern = words.join('[\\s\\n\\r]*(?:<[^>]+>)*[\\s\\n\\r]*');
    
    // Regex patterns to match element tags completely to avoid leaving empty boxes on screen
    const leafRegex = new RegExp('<div\\s+class=["\']leaf-item["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</div>', 'gi');
    const subBtnRegex = new RegExp('<(?:button|div)\\s+class=["\']sub-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</(?:button|div)>', 'gi');
    const branchBtnRegex = new RegExp('<button\\s+class=["\']branch-btn["\'][^>]*>\\s*(?:<i[^>]*>[^<]*</i>\\s*)*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const rootBtnRegex = new RegExp('<button\\s+class=["\']root-btn["\'][^>]*>\\s*' + flexibleRegexPattern + '\\s*</button>', 'gi');
    const genericRegex = new RegExp(flexibleRegexPattern, 'gi');
    
    let updated = currentContent;
    let temp = updated.replace(leafRegex, '');
    if (temp.length < updated.length) {
      updated = temp;
    } else {
      temp = updated.replace(subBtnRegex, '');
      if (temp.length < updated.length) {
        updated = temp;
      } else {
        temp = updated.replace(branchBtnRegex, '');
        if (temp.length < updated.length) {
          updated = temp;
        } else {
          temp = updated.replace(rootBtnRegex, '');
          if (temp.length < updated.length) {
            updated = temp;
          } else {
            temp = updated.replace(genericRegex, '');
            if (temp.length < updated.length) {
              updated = temp;
            }
          }
        }
      }
    }
    
    if (updated !== currentContent) {
      setFileEditorContent(updated);
      // Auto-save updated content to disk for instant preview update
      await saveUpdatedContent(updated);
      syncNodesFromHtml(updated);
    }
  };

  // ── Handle interactive clicks and double-click editing on the mindmap iframe ──
  const onIframeLoad = () => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      
      // 1. Single click to copy to search field
      doc.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const match = target.closest('.leaf-item, .branch-btn, .sub-btn, .root-btn') as HTMLElement;
        if (match) {
          let text = (match.innerText || match.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          setFindText(text);
        }
      });

      // 2. Double click to start WYSIWYG text edit directly inside mindmap
      const editables = doc.querySelectorAll('.leaf-item, .branch-btn, .sub-btn, .root-btn');
      editables.forEach((el: any) => {
        el.addEventListener('dblclick', (e: MouseEvent) => {
          e.stopPropagation();
          
          let text = (el.innerText || el.textContent || "").trim();
          text = text.replace(/^[›\s\u203a»\s]+/, "").trim();
          
          // Check if element is a button (branch-btn, sub-btn, root-btn) to bypass Chrome contentEditable limitation
          if (el.tagName.toLowerCase() === 'button') {
            const promptTitle = lang === 'ar' 
              ? `تعديل عنوان العقدة:\n(اترك الحقل فارغاً لحذف هذا العنوان ومحتوياته بالكامل)`
              : `Edit Node Title:\n(Leave empty to delete this node and its contents completely)`;
            const newText = prompt(promptTitle, text);
            
            if (newText === null) return; // Cancelled
            
            const trimmedNewText = newText.trim().replace(/^[›\s\u203a»\s]+/, "").trim();
            if (trimmedNewText === "") {
              const confirmTitle = lang === 'ar'
                ? `⚠️ هل أنت متأكد من رغبتك في حذف هذا العنوان بالكامل؟`
                : `⚠️ Are you sure you want to delete this title completely?`;
              if (confirm(confirmTitle)) {
                executeVisualDelete(text);
              }
            } else if (trimmedNewText !== text) {
              executeVisualReplace(text, trimmedNewText);
            }
          } else {
            // For div elements (like leaf-item), keep the premium inline editing experience
            el.dataset.originalText = text;
            el.contentEditable = "true";
            el.focus();
            el.style.outline = "2px solid #10b981";
            el.style.borderRadius = "8px";
            el.style.padding = "4px 8px";
            el.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
          }
        });

        el.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
          }
        });

        el.addEventListener('blur', () => {
          el.contentEditable = "false";
          el.style.outline = "";
          el.style.padding = "";
          el.style.backgroundColor = "";
          
          const originalText = el.dataset.originalText;
          if (!originalText) return;
          
          let newText = (el.innerText || el.textContent || "").trim();
          newText = newText.replace(/^[›\s\u203a»\s]+/, "").trim();
          
          if (newText === "") {
            // Delete node completely if cleared
            executeVisualDelete(originalText);
          } else if (newText !== originalText) {
            // Replace node text if modified
            executeVisualReplace(originalText, newText);
          }
        });
      });
    } catch (err) {
      console.error("Failed to set up interactive listeners on iframe:", err);
    }
  };

  // ── Save edited HTML/text file back to server ─────────────────────────────
  const saveFileContent = async () => {
    await saveUpdatedContent(fileEditorContent);
  };

  // ── Upload a binary file (image, PDF) directly to server ──────────────────
  const handleFileUpload = (fieldName: keyof Lesson, accept: string) => {
    if (!editingLesson) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingField(fieldName as string);
      setUploadSuccess(null);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const filePath = `${editingLesson.folder}/${file.name}`;
        try {
          const res = await fetch('/api/upload-binary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, contentBase64: base64 })
          });
          if (res.ok) {
            // Update the field with the new filename and persist
            const newLesson = { ...editingLesson, [fieldName]: file.name };
            setEditingLesson(newLesson);
            const updatedLessons = lessons.map((l, idx) => idx === editingLessonIndex ? newLesson : l);
            setLessons(updatedLessons);
            await saveAllToServer(updatedLessons);
            setUploadSuccess(fieldName as string);
            setTimeout(() => setUploadSuccess(null), 4000);
          }
        } catch { /* no-op */ }
        setUploadingField(null);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-20 font-sans transition-colors duration-250" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Admin Header */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('student-profile', 'push_back')} 
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {backIcon}
          </button>
          <div>
            <h1 className="font-black text-base md:text-lg text-emerald-600 dark:text-emerald-400">
              {lang === 'ar' ? 'لوحة المالك والإدارة' : 'Owner Content Panel'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {lang === 'ar' ? 'سمارت بايو - اليمن' : 'Smart Bio - Yemen'}
            </p>
          </div>
        </div>

        {/* Global Action Header Buttons */}
        <div className="flex items-center gap-2">
          {/* Save Status Badge */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تم الحفظ تلقائياً ✓' : 'Auto-Saved ✓'}</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800">
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'خطأ في الحفظ' : 'Save Error'}</span>
            </span>
          )}
          <button
            onClick={handleTriggerDownload}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير المنهج' : 'Download JSON'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-20 px-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar (Vertical on Desktop, Horizontal on Mobile) */}
        <section className="lg:col-span-1 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 shadow-xl shadow-slate-100/30 dark:shadow-none flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
            
            <button
              onClick={() => setActiveTab('lessons-list')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'lessons-list'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'ar' ? 'قائمة المنهج' : 'Syllabus List'}</span>
              <span className="ml-auto bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-sans">
                {lessons.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (editingLesson && editingLessonIndex !== null) {
                  setActiveTab('lesson-editor');
                } else if (lessons.length > 0) {
                  setEditingLesson(lessons[0]);
                  setEditingLessonIndex(0);
                  setActiveTab('lesson-editor');
                } else {
                  handleCreateNewLesson();
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'lesson-editor'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Edit className="w-4 h-4" />
              <span>{lang === 'ar' ? 'محرر الدرس الحالي' : 'Lesson Editor'}</span>
            </button>

            <button
              onClick={() => {
                if (editingLesson && editingLessonIndex !== null) {
                  setPreviewQuizIdx(0);
                  setPreviewSelectedAns(null);
                  setPreviewShowExpl(false);
                  setActiveTab('preview');
                } else if (lessons.length > 0) {
                  setEditingLesson(lessons[0]);
                  setEditingLessonIndex(0);
                  setPreviewQuizIdx(0);
                  setPreviewSelectedAns(null);
                  setPreviewShowExpl(false);
                  setActiveTab('preview');
                } else {
                  alert(lang === 'ar' ? 'الرجاء إضافة درس أولاً لمعاينته!' : 'Please add a lesson first to preview!');
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'preview'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{lang === 'ar' ? 'معاينة شاشة الطالب' : 'Student Preview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'export'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تصدير JSON' : 'Export & Build'}</span>
            </button>

            <button
              onClick={() => setActiveTab('keys')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'keys'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>{t.activationKeysTab}</span>
            </button>

            <button
              onClick={() => setActiveTab('helper')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'helper'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>{lang === 'ar' ? 'مساعد الإحداثيات' : 'Coords Helper'}</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === 'students'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الطلاب والاشتراكات' : 'Students & Subscriptions'}</span>
            </button>

          </div>

          {/* Validation Status Widget */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-5 shadow-xl shadow-slate-100/30 dark:shadow-none space-y-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {lang === 'ar' ? 'حالة أمان المنهج' : 'Syllabus Integrity'}
              </h4>
            </div>
            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs font-bold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'جميع البيانات سليمة وجاهزة!' : 'All configurations verified!'}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 p-3 rounded-xl border border-rose-100 dark:border-rose-900 text-xs font-bold">
                  {lang === 'ar' ? `يوجد ${validationErrors.length} ملاحظات تكوين:` : `Found ${validationErrors.length} validation warnings:`}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-[10px] text-rose-500 font-bold font-sans">
                  {validationErrors.map((err, i) => (
                    <p key={i} className="border-b border-slate-50 dark:border-slate-800 pb-1">• {err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Visual debugger showing current IDs in state */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'ar' ? 'معرّفات الدروس النشطة بالذاكرة:' : 'Active Lesson IDs in Memory:'}
              </span>
              <div className="flex flex-wrap gap-1">
                {lessons.map((l, i) => (
                  <span key={i} className="text-[9px] font-bold font-sans bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-750">
                    {i + 1}: {l.id || '❔'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Editor / Dashboard Panel */}
        <section className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: Lessons List Management */}
            {activeTab === 'lessons-list' && (
              <motion.div
                key="lessons-list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {lang === 'ar' ? 'هيكل الوحدات والدروس' : 'Syllabus Structure'}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold">
                      {lang === 'ar' ? 'عرض الدروس المتاحة وقفلها وإدارتها' : 'Manage access status, lock premium lessons'}
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewLesson}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'درس جديد' : 'New Lesson'}</span>
                  </button>
                </div>

                {/* Lessons Accordion List */}
                <div className="space-y-3">
                  {lessons.map((lesson, idx) => {
                    const unitName = lesson.folder.split('/')[0] || `الوحدة ${lesson.unit}`;
                    const lessonName = lesson.folder.split('/')[1] || lesson.titleAr;

                    return (
                      <div 
                        key={lesson.id} 
                        className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full font-black text-slate-500 dark:text-slate-400">
                                {unitName}
                              </span>
                              <button
                                onClick={() => {
                                  const updated = lessons.map(l => l.id === lesson.id ? { ...l, locked: !l.locked } : l);
                                  setLessons(updated);
                                }}
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 border transition-colors ${
                                  lesson.locked 
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-250 dark:border-amber-900' 
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-250 dark:border-emerald-900'
                                }`}
                              >
                                {lesson.locked ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>{lang === 'ar' ? 'مقفل باقة ذهبية' : 'Premium Locked'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-2.5 h-2.5" />
                                    <span>{lang === 'ar' ? 'مجاني للجميع' : 'Free Access'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <h4 className="font-black text-slate-850 dark:text-slate-100 text-sm mt-1">
                              {lessonName}
                            </h4>
                            <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold mt-0.5 font-sans">
                              ID: {lesson.id} • {lesson.quiz.length} أسئلة • {lesson.videoChapters.length} فصول فيديو
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingLesson(lesson);
                              setEditingLessonIndex(idx);
                              setEditorSubTab('basic');
                              setActiveTab('lesson-editor');
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-xl transition-colors active:scale-95 flex items-center gap-1.5 text-xs font-black"
                            title={lang === 'ar' ? 'تعديل المحتوى والأسئلة' : 'Edit content'}
                          >
                            <Edit className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingLesson(lesson);
                              setEditingLessonIndex(idx);
                              setPreviewQuizIdx(0);
                              setPreviewSelectedAns(null);
                              setPreviewShowExpl(false);
                              setActiveTab('preview');
                            }}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl transition-colors active:scale-95"
                            title={lang === 'ar' ? 'معاينة الطالب' : 'Preview student view'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-450 p-2.5 rounded-xl transition-colors active:scale-95"
                            title={lang === 'ar' ? 'حذف الدرس نهائياً' : 'Delete lesson'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TAB 2: Main Lesson Content Editor */}
            {activeTab === 'lesson-editor' && editingLesson && (
              <motion.div
                key="lesson-editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Editor Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div>
                    <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full uppercase">
                      {lang === 'ar' ? 'تحرير نشط' : 'Active Editor'}
                    </span>
                    <h3 className="font-black text-slate-850 dark:text-slate-100 text-sm mt-1.5">
                      {editingLesson.titleAr}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('lessons-list')}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-transform"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSaveLessonEdit}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs active:scale-95 transition-transform flex items-center gap-1.5 shadow-md shadow-emerald-550/20"
                    >
                      <Save className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حفظ المنهج' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tabs for Editor Category */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[20px] p-2 gap-1 overflow-x-auto shadow-sm">
                  {(['basic', 'chapters', 'summary-flash', 'quiz', 'files'] as EditorSubTab[]).map(sub => {
                    const labels: Record<EditorSubTab, string> = {
                      'basic': lang === 'ar' ? '📖 الأساسيات' : 'Basics',
                      'chapters': lang === 'ar' ? '🎬 فصول الفيديو' : 'Chapters',
                      'summary-flash': lang === 'ar' ? '📝 التلخيص والبطاقات' : 'Summary/Cards',
                      'quiz': lang === 'ar' ? '❓ بنك الاختبار' : 'Quiz Editor',
                      'files': lang === 'ar' ? '📁 تحرير الملفات' : 'File Editor'
                    };
                    return (
                      <button
                        key={sub}
                        onClick={() => setEditorSubTab(sub)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                          editorSubTab === sub
                            ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {labels[sub]}
                      </button>
                    );
                  })}
                </div>

                {/* SUB-TAB: Basics */}
                {editorSubTab === 'basic' && (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                    <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400 border-b border-slate-50 dark:border-slate-800 pb-2">
                      {lang === 'ar' ? 'المعلومات الأساسية والملفات' : 'Basic Specifications & Attachments'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'معرّف الدرس (ID فريد)' : 'Unique Lesson ID'}</label>
                        <input 
                          type="text" 
                          value={editingLesson.id} 
                          onChange={(e) => updateEditingLessonField('id', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'رقم الوحدة (Unit)' : 'Unit Number'}</label>
                        <input 
                          type="number" 
                          value={editingLesson.unit} 
                          onChange={(e) => updateEditingLessonField('unit', parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'مسار مجلد الدرس على السيرفر (Folder Path)' : 'Folder Directory Path'}</label>
                      <input 
                        type="text" 
                        value={editingLesson.folder} 
                        onChange={(e) => updateEditingLessonField('folder', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                        required
                      />
                      
                      {detectedFolders.length > 0 && (
                        <div className="mt-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850 space-y-2">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block uppercase tracking-wider">
                            {lang === 'ar' ? '📂 مجلدات تم اكتشافها على السيرفر (انقر للربط التلقائي والذكي بالملفات):' : '📂 Detected folders on server (click to auto-link and match files):'}
                          </span>
                          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                            {detectedFolders.map((fd, i) => {
                              const isLinked = editingLesson.folder === fd.path;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    // Auto link folder and guess files
                                    const pdf = fd.files.find(f => f.toLowerCase().endsWith('.pdf')) || '';
                                    
                                    // Look for diagram: png/jpg/jpeg, but exclude summary and infograph and html
                                    const diagram = fd.files.find(f => 
                                      (f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')) &&
                                      !f.includes('ملخص') && !f.includes('summary') && !f.includes('infograph')
                                    ) || '';
                                    
                                    // Look for summary: png/jpg/jpeg containing "ملخص" or "summary"
                                    const summary = fd.files.find(f => 
                                      (f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')) &&
                                      (f.includes('ملخص') || f.includes('summary') || f.includes('infograph'))
                                    ) || '';
                                    
                                    // Look for mindmap: html/htm containing "خارطة" or "خريطة" or "mindmap" or just ending in .html (if not quiz)
                                    const mindmap = fd.files.find(f => 
                                      (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                      (f.includes('خارطة') || f.includes('خريطة') || f.includes('mindmap') || f.includes('الدرس')) &&
                                      !f.includes('اختبار') && !f.includes('quiz')
                                    ) || '';
                                    
                                    // Look for quiz: html/htm containing "اختبار" or "quiz"
                                    const quiz = fd.files.find(f => 
                                      (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                      (f.includes('اختبار') || f.includes('quiz'))
                                    ) || '';
                                    
                                    // Look for ministry exam file: pdf/html/htm containing "وزار" or "ministry"
                                    const ministry = fd.files.find(f => 
                                      (f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                      (f.includes('وزار') || f.includes('ministry'))
                                    ) || '';

                                    // Update multiple fields at once
                                    const updated = {
                                      ...editingLesson,
                                      folder: fd.path,
                                      pdfFile: pdf,
                                      diagramFile: diagram,
                                      summaryFile: summary,
                                      mindmapFile: mindmap,
                                      quizFile: quiz,
                                      ministryExamFile: ministry
                                    };
                                    setEditingLesson(updated);
                                    setLessons(prev => prev.map((l, idx) => idx === editingLessonIndex ? updated : l));
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-black border transition-all text-right ${
                                    isLinked
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-350'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span>📁</span>
                                    <span>{fd.name}</span>
                                  </span>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-500 font-sans">
                                    {fd.files.length} {lang === 'ar' ? 'ملفات' : 'files'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'العنوان باللغة العربية' : 'Arabic Title'}</label>
                        <input 
                          type="text" 
                          value={editingLesson.titleAr} 
                          onChange={(e) => updateEditingLessonField('titleAr', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'العنوان باللغة الإنجليزية' : 'English Title'}</label>
                        <input 
                          type="text" 
                          value={editingLesson.titleEn} 
                          onChange={(e) => updateEditingLessonField('titleEn', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'رابط فيديو يوتيوب (Embed URL)' : 'YouTube Video Embed URL'}</label>
                      <input 
                        type="text" 
                        value={editingLesson.videoUrl} 
                        onChange={(e) => updateEditingLessonField('videoUrl', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <h5 className="font-extrabold text-xs text-slate-450 dark:text-slate-400 pt-2">{lang === 'ar' ? 'أسماء ملفات الملحقات (داخل مجلد الدرس)' : 'Attachment Filenames (Inside Lesson Directory)'}</h5>
                    
                    {/* ─── File Attachments with Upload Buttons ─────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* PDF */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الـ PDF للدرس' : 'Lesson PDF File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.pdfFile || ''} 
                            onChange={(e) => updateEditingLessonField('pdfFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('pdfFile', '.pdf')}
                            disabled={uploadingField === 'pdfFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع ملف PDF جديد' : 'Upload new PDF'}
                          >
                            {uploadingField === 'pdfFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'pdfFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Diagram Image */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الرسم التخطيطي (PNG)' : 'Diagram Image File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.diagramFile || ''} 
                            onChange={(e) => updateEditingLessonField('diagramFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('diagramFile', 'image/*')}
                            disabled={uploadingField === 'diagramFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع صورة جديدة' : 'Upload new image'}
                          >
                            {uploadingField === 'diagramFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'diagramFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Mindmap HTML */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف خريطة ذهنية (HTML)' : 'Mindmap HTML File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.mindmapFile || ''} 
                            onChange={(e) => updateEditingLessonField('mindmapFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('mindmapFile', '.html,.htm')}
                            disabled={uploadingField === 'mindmapFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع ملف HTML جديد' : 'Upload new HTML'}
                          >
                            {uploadingField === 'mindmapFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'mindmapFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Summary Infographic */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف إنفوجرافيك ملخص (PNG)' : 'Summary Infographic File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.summaryFile || ''} 
                            onChange={(e) => updateEditingLessonField('summaryFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('summaryFile', 'image/*')}
                            disabled={uploadingField === 'summaryFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع صورة جديدة' : 'Upload new image'}
                          >
                            {uploadingField === 'summaryFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'summaryFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Quiz HTML */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف كود اختبار HTML خارجي' : 'External Quiz HTML File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.quizFile || ''} 
                            onChange={(e) => updateEditingLessonField('quizFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('quizFile', '.html,.htm')}
                            disabled={uploadingField === 'quizFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع ملف HTML جديد' : 'Upload new HTML'}
                          >
                            {uploadingField === 'quizFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'quizFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                      {/* Ministry Exam File */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الأسئلة الوزارية (PDF/HTML)' : 'Ministry Questions File'}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={editingLesson.ministryExamFile || ''} 
                            onChange={(e) => updateEditingLessonField('ministryExamFile', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleFileUpload('ministryExamFile', '.pdf,.html,.htm')}
                            disabled={uploadingField === 'ministryExamFile'}
                            className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-xl transition-colors text-[10px] font-black flex items-center gap-1"
                            title={lang === 'ar' ? 'رفع ملف جديد' : 'Upload new file'}
                          >
                            {uploadingField === 'ministryExamFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                            {uploadSuccess === 'ministryExamFile' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* SUB-TAB: Video Chapters */}
                {editorSubTab === 'chapters' && (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                      <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {lang === 'ar' ? 'أجزاء وفصول الفيديو التعليمي' : 'Lesson Video Chapter Timings'}
                      </h4>
                      <button
                        onClick={() => {
                          const newChap: VideoChapter = { time: "00:00", titleAr: "عنوان جديد", titleEn: "New Chapter", descAr: "", descEn: "" };
                          updateEditingLessonField('videoChapters', [...editingLesson.videoChapters, newChap]);
                        }}
                        className="text-emerald-500 hover:text-emerald-600 font-black text-xs flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'إضافة جزء' : 'Add Chapter'}</span>
                      </button>
                    </div>

                    {editingLesson.videoChapters.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 font-bold text-xs">
                        {lang === 'ar' ? 'لم يتم إضافة فصول لهذا الفيديو بعد.' : 'No chapters added to this video yet.'}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {editingLesson.videoChapters.map((chap, idx) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3 relative group">
                            
                            {/* Delete chapter button */}
                            <button
                              onClick={() => {
                                const list = editingLesson.videoChapters.filter((_, i) => i !== idx);
                                updateEditingLessonField('videoChapters', list);
                              }}
                              className="absolute top-3 right-3 text-rose-500 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'التوقيت (MM:SS)' : 'Start Time'}</label>
                                <input 
                                  type="text" 
                                  value={chap.time} 
                                  onChange={(e) => {
                                    const list = [...editingLesson.videoChapters];
                                    list[idx].time = e.target.value;
                                    updateEditingLessonField('videoChapters', list);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-center"
                                  placeholder="00:00"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'العنوان بالعربي' : 'Arabic Title'}</label>
                                <input 
                                  type="text" 
                                  value={chap.titleAr} 
                                  onChange={(e) => {
                                    const list = [...editingLesson.videoChapters];
                                    list[idx].titleAr = e.target.value;
                                    updateEditingLessonField('videoChapters', list);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'العنوان بالإنجليزي' : 'English Title'}</label>
                                <input 
                                  type="text" 
                                  value={chap.titleEn} 
                                  onChange={(e) => {
                                    const list = [...editingLesson.videoChapters];
                                    list[idx].titleEn = e.target.value;
                                    updateEditingLessonField('videoChapters', list);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'وصف مبسط (عربي)' : 'Short Description (AR)'}</label>
                                <input 
                                  type="text" 
                                  value={chap.descAr} 
                                  onChange={(e) => {
                                    const list = [...editingLesson.videoChapters];
                                    list[idx].descAr = e.target.value;
                                    updateEditingLessonField('videoChapters', list);
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB: Summary & Flashcards */}
                {editorSubTab === 'summary-flash' && (
                  <div className="space-y-4">
                    {/* Summary Points Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                        <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {lang === 'ar' ? 'نقاط التلخيص الأساسية للدرس' : 'Key Takeaways / Summary Points'}
                        </h4>
                        <button
                          onClick={() => {
                            updateEditingLessonField('summaryPointsAr', [...editingLesson.summaryPointsAr, "نقطة تلخيص جديدة"]);
                            updateEditingLessonField('summaryPointsEn', [...editingLesson.summaryPointsEn, "New summary point"]);
                          }}
                          className="text-emerald-500 hover:text-emerald-600 font-black text-xs flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'إضافة نقطة' : 'Add Point'}</span>
                        </button>
                      </div>

                      {editingLesson.summaryPointsAr.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 font-bold text-xs">
                          {lang === 'ar' ? 'لا توجد نقاط تلخيص.' : 'No summary points yet.'}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {editingLesson.summaryPointsAr.map((pt, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <span className="text-xs font-black text-slate-400 shrink-0">#{idx + 1}</span>
                              <input 
                                type="text" 
                                value={pt} 
                                onChange={(e) => {
                                  const list = [...editingLesson.summaryPointsAr];
                                  list[idx] = e.target.value;
                                  updateEditingLessonField('summaryPointsAr', list);
                                }}
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                placeholder="النص العربي"
                              />
                              <input 
                                type="text" 
                                value={editingLesson.summaryPointsEn[idx] || ''} 
                                onChange={(e) => {
                                    const list = [...editingLesson.summaryPointsEn];
                                    list[idx] = e.target.value;
                                    updateEditingLessonField('summaryPointsEn', list);
                                }}
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold font-sans text-left"
                                placeholder="English text"
                              />
                              <button
                                onClick={() => {
                                  const listAr = editingLesson.summaryPointsAr.filter((_, i) => i !== idx);
                                  const listEn = editingLesson.summaryPointsEn.filter((_, i) => i !== idx);
                                  updateEditingLessonField('summaryPointsAr', listAr);
                                  updateEditingLessonField('summaryPointsEn', listEn);
                                }}
                                className="text-rose-500 hover:text-rose-600 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Flashcards Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                        <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {lang === 'ar' ? 'بطاقات الأسئلة والأجوبة السريعة (Flashcards)' : 'Interactive Q&A Flashcards'}
                        </h4>
                        <button
                          onClick={() => {
                            const newCard: Flashcard = { qAr: "سؤال بطاقة جديد؟", qEn: "New flashcard question?", aAr: "جواب بطاقة جديد.", aEn: "New flashcard answer." };
                            updateEditingLessonField('flashcards', [...editingLesson.flashcards, newCard]);
                          }}
                          className="text-emerald-500 hover:text-emerald-600 font-black text-xs flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'إضافة بطاقة' : 'Add Flashcard'}</span>
                        </button>
                      </div>

                      {editingLesson.flashcards.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 font-bold text-xs">
                          {lang === 'ar' ? 'لا توجد بطاقات مضافة.' : 'No flashcards added.'}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {editingLesson.flashcards.map((card, idx) => (
                            <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3 relative group">
                              <button
                                onClick={() => {
                                  const list = editingLesson.flashcards.filter((_, i) => i !== idx);
                                  updateEditingLessonField('flashcards', list);
                                }}
                                className="absolute top-3 right-3 text-rose-500 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'السؤال بالعربي' : 'Question (AR)'}</label>
                                  <input 
                                    type="text" 
                                    value={card.qAr} 
                                    onChange={(e) => {
                                      const list = [...editingLesson.flashcards];
                                      list[idx].qAr = e.target.value;
                                      updateEditingLessonField('flashcards', list);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'السؤال بالإنجليزي' : 'Question (EN)'}</label>
                                  <input 
                                    type="text" 
                                    value={card.qEn} 
                                    onChange={(e) => {
                                      const list = [...editingLesson.flashcards];
                                      list[idx].qEn = e.target.value;
                                      updateEditingLessonField('flashcards', list);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'الجواب بالعربي' : 'Answer (AR)'}</label>
                                  <input 
                                    type="text" 
                                    value={card.aAr} 
                                    onChange={(e) => {
                                      const list = [...editingLesson.flashcards];
                                      list[idx].aAr = e.target.value;
                                      updateEditingLessonField('flashcards', list);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'الجواب بالإنجليزي' : 'Answer (EN)'}</label>
                                  <input 
                                    type="text" 
                                    value={card.aEn} 
                                    onChange={(e) => {
                                      const list = [...editingLesson.flashcards];
                                      list[idx].aEn = e.target.value;
                                      updateEditingLessonField('flashcards', list);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {editorSubTab === 'quiz' && (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 mb-6">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 border-b border-slate-50 dark:border-slate-800 pb-2">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                      <h4 className="font-black text-sm">{t.aiQuizGenerator}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      {/* API Key */}
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                          {t.apiKeyLabel}
                        </label>
                        <input
                          type="password"
                          value={localApiKey}
                          onChange={(e) => handleApiKeyChange(e.target.value)}
                          placeholder={t.apiKeyPlaceholder}
                          className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                        />
                      </div>

                      {/* Question Count */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                          {t.generateQuestionsCount}
                        </label>
                        <select
                          value={aiCount}
                          onChange={(e) => setAiCount(Number(e.target.value))}
                          className="w-full text-xs font-black px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        >
                          {[3, 5, 8, 10, 15, 20].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>

                      {/* Question Type */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                          {t.questionType}
                        </label>
                        <select
                          value={aiType}
                          onChange={(e) => setAiType(e.target.value as any)}
                          className="w-full text-xs font-black px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        >
                          <option value="all">{t.allTypes}</option>
                          <option value="mcq">{t.mcqOnly}</option>
                          <option value="tf">{t.tfOnly}</option>
                          <option value="fill">{t.fillOnly}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleGenerateAIQuiz}
                        disabled={aiLoading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {aiLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{t.generatingQuiz}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{t.generateQuizBtn}</span>
                          </>
                        )}
                      </button>

                      {aiStatusMsg && (
                        <div className={`text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 ${
                          aiStatusMsg.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450'
                        }`}>
                          {aiStatusMsg.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 shrink-0" />
                          )}
                          <span>{aiStatusMsg.text}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editorSubTab === 'quiz' && (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                      <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {lang === 'ar' ? 'أسئلة اختبار كويز الدرس' : 'Quiz Questions Bank'}
                      </h4>
                    </div>

                    {editingLesson.quiz.length === 0 ? (
                      <div className="text-center py-8 space-y-4">
                        <p className="text-slate-405 dark:text-slate-400 font-bold text-xs">
                          {lang === 'ar' ? 'لا توجد أسئلة مضافة لهذا الدرس بعد.' : 'No questions in this quiz yet.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const newQ: ConfigQuestion = {
                              id: 1,
                              type: "tf",
                              textAr: "نص سؤال صح/خطأ جديد؟",
                              textEn: "New True/False question text?",
                              options: [
                                { key: "T", textAr: "✔️ صح", textEn: "True" },
                                { key: "F", textAr: "❌ خطأ", textEn: "False" }
                              ],
                              correctKey: "T",
                              explanationAr: "تفسير الإجابة هنا.",
                              explanationEn: "Explanation text here."
                            };
                            updateEditingLessonField('quiz', [newQ]);
                            setActiveQuizIdx(0);
                          }}
                          className="mx-auto flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'إضافة السؤال الأول' : 'Add First Question'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Questions sidebar */}
                        <div className="md:col-span-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-[20px] border border-slate-150 dark:border-slate-850 space-y-3 h-fit">
                          <div className="flex items-center justify-between border-b border-slate-205 dark:border-slate-800 pb-2">
                            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                              {lang === 'ar' ? 'قائمة الأسئلة' : 'Questions List'}
                            </span>
                            <span className="text-[10px] font-sans font-bold bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-400 px-2 py-0.5 rounded-full">
                              {editingLesson.quiz.length}
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                            {editingLesson.quiz.map((q, idx) => {
                              const isActive = activeQuizIdx === idx;
                              const typeLabels = {
                                'mcq': lang === 'ar' ? 'اختيار متعدد' : 'MCQ',
                                'tf': lang === 'ar' ? 'صح/خطأ' : 'T/F',
                                'fill': lang === 'ar' ? 'إكمال فراغ' : 'Fill'
                              };
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setActiveQuizIdx(idx)}
                                  className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                                    isActive
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-800'
                                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 overflow-hidden text-right">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                                      isActive
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-150 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <div className="overflow-hidden">
                                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[110px]" title={q.textAr}>
                                        {q.textAr || (lang === 'ar' ? '(سؤال فارغ)' : '(Empty)')}
                                      </p>
                                      <span className="text-[8px] font-extrabold text-slate-400 block mt-0.5">
                                        {typeLabels[q.type]}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const list = editingLesson.quiz.filter((_, i) => i !== idx);
                                      const reindexed = list.map((item, index) => ({ ...item, id: index + 1 }));
                                      updateEditingLessonField('quiz', reindexed);
                                      if (activeQuizIdx >= reindexed.length) {
                                        setActiveQuizIdx(Math.max(0, reindexed.length - 1));
                                      }
                                    }}
                                    className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors shrink-0"
                                    title={lang === 'ar' ? 'حذف السؤال' : 'Delete Question'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const newQ: ConfigQuestion = {
                                id: editingLesson.quiz.length + 1,
                                type: "tf",
                                textAr: "نص سؤال صح/خطأ جديد؟",
                                textEn: "New True/False question text?",
                                options: [
                                  { key: "T", textAr: "✔️ صح", textEn: "True" },
                                  { key: "F", textAr: "❌ خطأ", textEn: "False" }
                                ],
                                correctKey: "T",
                                explanationAr: "تفسير الإجابة هنا.",
                                explanationEn: "Explanation text here."
                              };
                              const newList = [...editingLesson.quiz, newQ];
                              updateEditingLessonField('quiz', newList);
                              setActiveQuizIdx(newList.length - 1);
                            }}
                            className="w-full flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2 rounded-xl transition-all active:scale-95 shadow-sm shadow-emerald-500/10 mt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'إضافة سؤال جديد' : 'Add Question'}</span>
                          </button>
                        </div>

                        {/* Main editor area for selected question */}
                        <div className="md:col-span-3 bg-slate-50 dark:bg-slate-950/20 p-5 rounded-[20px] border border-slate-150 dark:border-slate-850 space-y-4 relative">
                          {editingLesson.quiz[activeQuizIdx] && (() => {
                            const q = editingLesson.quiz[activeQuizIdx];
                            const qIdx = activeQuizIdx;
                            return (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black font-sans">
                                      {qIdx + 1}
                                    </span>
                                    <span className="text-xs font-black text-slate-650 dark:text-slate-300">
                                      {lang === 'ar' ? 'تعديل السؤال المختار' : 'Edit Selected Question'}
                                    </span>
                                  </div>
                                </div>

                                {/* Question Type Selector */}
                                <div>
                                  <label className="block text-[10px] font-extrabold text-slate-450 mb-1.5">{lang === 'ar' ? 'نوع السؤال' : 'Question Type'}</label>
                                  <div className="flex gap-2">
                                    {(['mcq', 'tf', 'fill'] as const).map(tType => {
                                      const labels = { 'mcq': 'اختيار متعدد', 'tf': 'صح / خطأ', 'fill': 'إكمال الفراغ' };
                                      const isSelected = q.type === tType;
                                      return (
                                        <button
                                          key={tType}
                                          type="button"
                                          onClick={() => {
                                            const list = [...editingLesson.quiz];
                                            list[qIdx].type = tType;
                                            if (tType === 'tf') {
                                              list[qIdx].options = [
                                                { key: "T", textAr: "✔️ صح", textEn: "True" },
                                                { key: "F", textAr: "❌ خطأ", textEn: "False" }
                                              ];
                                              list[qIdx].correctKey = "T";
                                            } else if (tType === 'mcq') {
                                              list[qIdx].options = [
                                                { key: "A", textAr: "الخيار أ", textEn: "Option A" },
                                                { key: "B", textAr: "الخيار ب", textEn: "Option B" },
                                                { key: "C", textAr: "الخيار ج", textEn: "Option C" }
                                              ];
                                              list[qIdx].correctKey = "A";
                                            } else {
                                              list[qIdx].options = undefined;
                                              list[qIdx].correctAnswers = ["الإجابة المقبولة"];
                                            }
                                            updateEditingLessonField('quiz', list);
                                          }}
                                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                                            isSelected 
                                              ? 'bg-slate-900 text-white dark:bg-emerald-500 border-transparent shadow-sm' 
                                              : 'bg-white dark:bg-slate-900 text-slate-655 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                                          }`}
                                        >
                                          {labels[tType]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Question Texts */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-455 mb-1">{lang === 'ar' ? 'السؤال بالعربي' : 'Question (AR)'}</label>
                                    <textarea 
                                      value={q.textAr} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].textAr = e.target.value;
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-16 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-455 mb-1">{lang === 'ar' ? 'السؤال بالإنجليزي' : 'Question (EN)'}</label>
                                    <textarea 
                                      value={q.textEn} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].textEn = e.target.value;
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-16 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Options for MCQ / TF */}
                                {q.type !== 'fill' && q.options && (
                                  <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                                    <label className="block text-[9px] font-extrabold text-slate-450">{lang === 'ar' ? 'الخيارات المتاحة (وحدد الإجابة الصحيحة)' : 'Available Options (Select correct answer)'}</label>
                                    <div className="space-y-2">
                                      {q.options.map((opt, oIdx) => {
                                        const isCorrect = q.correctKey === opt.key;
                                        return (
                                          <div key={opt.key} className="flex gap-2 items-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const list = [...editingLesson.quiz];
                                                list[qIdx].correctKey = opt.key;
                                                updateEditingLessonField('quiz', list);
                                              }}
                                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border text-[10px] font-black ${
                                                isCorrect 
                                                  ? 'bg-emerald-500 border-transparent text-white' 
                                                  : 'bg-slate-100 dark:bg-slate-850 text-slate-450 border-slate-200 dark:border-slate-800'
                                              }`}
                                              title="Set correct answer"
                                            >
                                              {opt.key}
                                            </button>
                                            <input 
                                              type="text" 
                                              value={opt.textAr}
                                              onChange={(e) => {
                                                const list = [...editingLesson.quiz];
                                                if (list[qIdx].options) {
                                                  list[qIdx].options![oIdx].textAr = e.target.value;
                                                  updateEditingLessonField('quiz', list);
                                                }
                                              }}
                                              placeholder="الخيار بالعربي"
                                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                            />
                                            <input 
                                              type="text" 
                                              value={opt.textEn}
                                              onChange={(e) => {
                                                const list = [...editingLesson.quiz];
                                                if (list[qIdx].options) {
                                                  list[qIdx].options![oIdx].textEn = e.target.value;
                                                  updateEditingLessonField('quiz', list);
                                                }
                                              }}
                                              placeholder="Option (EN)"
                                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Correct Answers for Fill in the Blank */}
                                {q.type === 'fill' && (
                                  <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[9px] font-extrabold text-slate-450">{lang === 'ar' ? 'الإجابات المقبولة للفراغ (يفصل بينها بفاصلة ,)' : 'Accepted Answers (comma separated)'}</label>
                                    </div>
                                    <input
                                      type="text"
                                      value={q.correctAnswers ? q.correctAnswers.join(', ') : ''}
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].correctAnswers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold font-mono"
                                      placeholder="مثال: شبكة, شبكه, net"
                                    />
                                  </div>
                                )}

                                {/* Explanation Section */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-450 mb-1">{lang === 'ar' ? 'التفسير العلمي بالعربي (يظهر بعد الحل)' : 'Scientific Explanation (AR)'}</label>
                                    <textarea 
                                      value={q.explanationAr} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].explanationAr = e.target.value;
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-12 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-450 mb-1">{lang === 'ar' ? 'التفسير العلمي بالإنجليزي (يظهر بعد الحل)' : 'Scientific Explanation (EN)'}</label>
                                    <textarea 
                                      value={q.explanationEn} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].explanationEn = e.target.value;
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-12 focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-800 pt-4 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveQuizIdx(prev => Math.max(0, prev - 1))}
                                    disabled={activeQuizIdx === 0}
                                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                                  >
                                    {lang === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                                    <span>{lang === 'ar' ? 'السؤال السابق' : 'Previous'}</span>
                                  </button>

                                  <span className="text-[10px] font-black text-slate-400 font-sans">
                                    {lang === 'ar' ? `السؤال ${activeQuizIdx + 1} من ${editingLesson.quiz.length}` : `Question ${activeQuizIdx + 1} of ${editingLesson.quiz.length}`}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setActiveQuizIdx(prev => Math.min(editingLesson.quiz.length - 1, prev + 1))}
                                    disabled={activeQuizIdx === editingLesson.quiz.length - 1}
                                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                                  >
                                    <span>{lang === 'ar' ? 'السؤال التالي' : 'Next'}</span>
                                    {lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* ── SUB-TAB: File Editor (HTML & Binary Uploads) ──────────────────────── */}
                {editorSubTab === 'files' && (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-5">
                    <div className="border-b border-slate-50 dark:border-slate-800 pb-3">
                      <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {lang === 'ar' ? '📁 ملفات ومرفقات الدرس' : '📁 Lesson Files & Attachments'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                        {lang === 'ar' 
                          ? 'قم برفع واستبدال ملفات الدرس مباشرة. يتم تخزين الملفات تلقائياً في مجلد الدرس وتحديث التكوين.' 
                          : 'Upload and replace lesson files directly. Files are stored in the lesson folder and matched automatically.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                      {/* 1. PDF */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">📄</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'ملف PDF الدرس' : 'Lesson PDF File'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.pdfFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('pdfFile', '.pdf')}
                          disabled={uploadingField === 'pdfFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'pdfFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'pdfFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'pdfFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع PDF جديد' : 'Upload PDF')}
                        </button>
                      </div>

                      {/* 2. Diagram */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">🖼️</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'رسم الدرس التخطيطي' : 'Lesson Diagram'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.diagramFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('diagramFile', 'image/*')}
                          disabled={uploadingField === 'diagramFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'diagramFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'diagramFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'diagramFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع صورة جديدة' : 'Upload Image')}
                        </button>
                      </div>

                      {/* 3. Summary */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">📊</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'إنفوجرافيك ملخص الدرس' : 'Summary Infographic'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.summaryFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('summaryFile', 'image/*')}
                          disabled={uploadingField === 'summaryFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'summaryFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'summaryFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'summaryFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع ملخص جديد' : 'Upload Summary')}
                        </button>
                      </div>

                      {/* 4. Mindmap HTML */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">🧠</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'ملف خريطة ذهنية HTML' : 'Mindmap HTML File'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.mindmapFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('mindmapFile', '.html,.htm')}
                          disabled={uploadingField === 'mindmapFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'mindmapFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'mindmapFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'mindmapFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع خريطة HTML' : 'Upload Mindmap')}
                        </button>
                      </div>

                      {/* 5. Quiz HTML */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">❓</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'ملف اختبار HTML خارجي' : 'External Quiz HTML File'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.quizFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('quizFile', '.html,.htm')}
                          disabled={uploadingField === 'quizFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'quizFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'quizFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'quizFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع اختبار HTML' : 'Upload HTML Quiz')}
                        </button>
                      </div>

                      {/* 6. Ministry Exam File */}
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-xl">🎓</span>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{lang === 'ar' ? 'ملف الأسئلة الوزارية للدرس' : 'Lesson Ministry Exam File'}</p>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{editingLesson.ministryExamFile || '—'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileUpload('ministryExamFile', '.pdf,.html,.htm')}
                          disabled={uploadingField === 'ministryExamFile'}
                          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-black text-xs py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
                        >
                          {uploadingField === 'ministryExamFile' ? <RefreshCw className="w-4 h-4 animate-spin" /> : uploadSuccess === 'ministryExamFile' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <FolderOpen className="w-4 h-4" />}
                          {uploadSuccess === 'ministryExamFile' ? (lang === 'ar' ? 'تم الرفع ✓' : 'Uploaded ✓') : (lang === 'ar' ? 'رفع أسئلة وزارية' : 'Upload Ministry File')}
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: Interactive Student-View Preview */}
            {activeTab === 'preview' && editingLesson && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Control Guide Panel */}
                <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2">
                    <Eye className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-black text-slate-850 dark:text-slate-100 text-sm">
                      {lang === 'ar' ? 'أداة المعاينة الحية' : 'Live Mockup Preview'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 font-bold leading-relaxed">
                    {lang === 'ar'
                      ? 'هنا تشاهد كيف ستظهر الأسئلة والمعلومات للطالب فوراً على هاتفه. يمكنك تجربة اختيار الأجوبة ورؤية التفسيرات للتأكد من تنسيق النصوص.'
                      : 'Simulate how students interact with the content. Select options and view feedback in real-time.'}
                  </p>
                  
                  {editingLesson.quiz.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-[10px] font-black text-slate-400">{lang === 'ar' ? 'اختر السؤال للمعاينة' : 'Select Question'}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {editingLesson.quiz.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setPreviewQuizIdx(i);
                              setPreviewSelectedAns(null);
                              setPreviewShowExpl(false);
                            }}
                            className={`w-7 h-7 rounded-lg text-xs font-black font-sans transition-all flex items-center justify-center border ${
                              previewQuizIdx === i
                                ? 'bg-emerald-500 text-white border-transparent shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-50 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black text-emerald-500 block">💡 {lang === 'ar' ? 'نصيحة التنسيق' : 'Formatting Tip'}</span>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold leading-relaxed">
                      {lang === 'ar'
                        ? 'استخدم <sub>2</sub> للأسفل و <sup>2</sup> للأعلى في نصوص الأسئلة لتظهر منسقة كيميائياً وبيولوجياً للطالب.'
                        : 'Use HTML tags like sub and sup in question texts for beautiful molecular and index layouts.'}
                    </p>
                  </div>
                </div>


                {/* Smartphone Mockup */}
                <div className="md:col-span-2 flex justify-center">
                  <div className="w-full max-w-[340px] border-[10px] border-slate-900 dark:border-slate-800 rounded-[44px] overflow-hidden bg-[#f7f9fb] dark:bg-slate-950 shadow-2xl relative min-h-[580px] flex flex-col font-sans select-none">
                    
                    {/* Phone Notch/Speaker */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center">
                      <div className="w-10 h-1 bg-slate-850 rounded-full"></div>
                    </div>

                    {/* Fake StatusBar */}
                    <div className="h-6 w-full bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-850 px-6 pt-1 flex items-center justify-between text-[8px] font-black font-sans text-slate-400 z-10 shrink-0">
                      <span>06:11 PM</span>
                      <span>5G 📶 100% 🔋</span>
                    </div>

                    {/* Simulated Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-4 pb-12">
                      
                      {/* Topic Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-3xl shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full">
                            {editingLesson.folder.split('/')[0] || `الوحدة ${editingLesson.unit}`}
                          </span>
                          <span className="text-[8px] font-extrabold text-slate-400">
                            {editingLesson.id}
                          </span>
                        </div>
                        <h3 className="text-xs font-black text-slate-800 dark:text-white leading-snug">
                          {editingLesson.folder.split('/')[1] || (lang === 'ar' ? editingLesson.titleAr : editingLesson.titleEn)}
                        </h3>
                      </div>

                      {/* Quiz Section inside phone */}
                      {editingLesson.quiz.length > 0 && editingLesson.quiz[previewQuizIdx] ? (() => {
                        const curQ = editingLesson.quiz[previewQuizIdx];
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-3xl shadow-sm space-y-3">
                            <div className="flex items-center justify-between text-[8px] font-black text-slate-400">
                              <span>{lang === 'ar' ? `السؤال ${previewQuizIdx + 1} من ${editingLesson.quiz.length}` : `Question ${previewQuizIdx + 1} of ${editingLesson.quiz.length}`}</span>
                              <span className="text-emerald-500 uppercase">{curQ.type}</span>
                            </div>
                            
                            {/* Question text parsing simple tags */}
                            <p 
                              className="text-[11px] font-black text-slate-800 dark:text-white leading-relaxed text-right"
                              dangerouslySetInnerHTML={{ __html: lang === 'ar' ? curQ.textAr : curQ.textEn }}
                            />

                            {/* Render options for MCQ/TF */}
                            {curQ.options && (
                              <div className="space-y-2 pt-1">
                                {curQ.options.map((opt) => {
                                  const isSelected = previewSelectedAns === opt.key;
                                  const isCorrectOption = curQ.correctKey === opt.key;
                                  
                                  let btnClass = "border-slate-100 dark:border-slate-800 hover:bg-slate-50";
                                  if (previewShowExpl) {
                                    if (isCorrectOption) {
                                      btnClass = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
                                    } else if (isSelected) {
                                      btnClass = "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
                                    }
                                  } else if (isSelected) {
                                    btnClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50";
                                  }

                                  return (
                                    <button
                                      key={opt.key}
                                      onClick={() => {
                                        if (previewShowExpl) return;
                                        setPreviewSelectedAns(opt.key);
                                      }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 border rounded-xl text-[10px] font-extrabold transition-all text-right ${btnClass}`}
                                    >
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black border ${
                                        isSelected 
                                          ? 'bg-emerald-500 border-transparent text-white' 
                                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                                      }`}>
                                        {opt.key}
                                      </span>
                                      <span className="flex-1">{lang === 'ar' ? opt.textAr : opt.textEn}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Render Fill in the Blank Input */}
                            {curQ.type === 'fill' && (
                              <div className="space-y-2 pt-1">
                                <input
                                  type="text"
                                  disabled={previewShowExpl}
                                  placeholder={lang === 'ar' ? 'اكتب إجابتك هنا...' : 'Type response here...'}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-[10px] font-bold text-center focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setPreviewSelectedAns('done');
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {/* Action check button */}
                            {!previewShowExpl ? (
                              <button
                                onClick={() => {
                                  if (!previewSelectedAns) return;
                                  setPreviewShowExpl(true);
                                }}
                                disabled={!previewSelectedAns}
                                className={`w-full font-black text-[10px] py-2 rounded-xl active:scale-95 transition-all text-center ${
                                  previewSelectedAns
                                    ? 'bg-emerald-500 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                {lang === 'ar' ? 'التحقق من الإجابة' : 'Submit Answer'}
                              </button>
                            ) : (
                              <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-2 animate-fadeIn">
                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{lang === 'ar' ? 'التفسير العلمي:' : 'Scientific Explanation:'}</span>
                                </div>
                                <p 
                                  className="text-[9px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed text-right"
                                  dangerouslySetInnerHTML={{ __html: lang === 'ar' ? curQ.explanationAr : curQ.explanationEn }}
                                />
                                <button
                                  onClick={() => {
                                    setPreviewSelectedAns(null);
                                    setPreviewShowExpl(false);
                                  }}
                                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[9px] py-1.5 rounded-lg text-center"
                                >
                                  {lang === 'ar' ? 'حاول مجدداً' : 'Try Again'}
                                </button>
                              </div>
                            )}

                          </div>
                        );
                      })() : (
                        <div className="text-center py-6 text-slate-400 text-[9px] font-bold">
                          {lang === 'ar' ? 'لا توجد أسئلة للاختبار' : 'No quiz questions'}
                        </div>
                      )}

                    </div>

                    {/* Fake Home Indicator */}
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-400 dark:bg-slate-800 rounded-full z-50"></div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: Copy/Export JSON Configuration */}
            {activeTab === 'export' && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6"
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

                {/* Big Action Box */}
                <div className="bg-emerald-500 text-white p-6 rounded-[32px] shadow-xl shadow-emerald-500/20 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                    className="relative z-10 bg-white hover:bg-slate-50 text-emerald-600 font-black text-xs px-6 py-3.5 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'ar' ? 'تنزيل ملف المنهج المحدث' : 'Download Config File'}</span>
                  </button>
                </div>

                {/* Excel Curriculum Manager Card */}
                <div className="bg-slate-50 dark:bg-slate-955 p-6 rounded-[32px] border border-slate-150 dark:border-slate-850 space-y-6">
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
                    {/* Export button */}
                    <button
                      onClick={handleExportExcel}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs px-5 py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/15"
                    >
                      <Download className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تصدير المنهج الحالي إلى إكسل 📊' : 'Export Syllabus to Excel 📊'}</span>
                    </button>

                    {/* Import button */}
                    <label className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer text-center">
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
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'نشر وإرسال التحديث لجميع الهواتف 📢' : 'Publish & Broadcast Update to All Phones 📢'}</span>
                  </button>

                  <button
                    onClick={handleSyncCurriculum}
                    className="w-full bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-black text-xs px-5 py-3.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تحديث وتنزيل المنهج الجديد من السيرفر 🔄' : 'Force Sync & Reload Syllabus from Server 🔄'}</span>
                  </button>

                  {/* Validation results view */}
                  {excelValidationResult && (
                    <div className={`p-5 rounded-2xl border text-xs leading-relaxed ${
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

                {/* Instructions Accordion */}
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-[24px] border border-slate-150 dark:border-slate-850 space-y-3">
                  <h4 className="font-black text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-500" />
                    <span>{lang === 'ar' ? 'خطوات التحديث البسيطة للموقع' : 'Syllabus Deployment Checklist'}</span>
                  </h4>
                  <div className="text-[11px] text-slate-450 dark:text-slate-400 font-bold space-y-2 leading-relaxed">
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">1</span>
                      <p>{lang === 'ar' ? 'انقر على زر "تنزيل ملف المنهج المحدث" لحفظ الملف على جهاز الكمبيوتر الخاص بك.' : 'Click the "Download Config File" button to download lessons_config.json locally.'}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">2</span>
                      <p>{lang === 'ar' ? 'افتح مجلد المشروع الخاص بك وانتقل للمجلد الفرعي public/ واستبدل الملف القديم بالملف الجديد.' : 'Open your project root directory and locate the public/ subdirectory.'}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0 text-[10px] font-sans">3</span>
                      <p>{lang === 'ar' ? 'انتهى! ستنعكس التعديلات على الويب تلقائياً وتفتح الوحدات أو الأسئلة الجديدة لجميع طلابك.' : 'Overwrite the old lessons_config.json with the new file. Re-deploy the code to web.'}</p>
                    </div>
                  </div>
                </div>

                {/* JSON Code Copy Panel */}
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
                  
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 text-[10px] font-mono overflow-auto max-h-80 select-text leading-relaxed">
                    <pre>{JSON.stringify(lessons, null, 2)}</pre>
                  </div>
                </div>

                {/* Backups List UI */}
                <div 
                  className="bg-slate-50 dark:bg-slate-950 p-6 rounded-[32px] border border-slate-150 dark:border-slate-850 space-y-4"
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
                          className="flex justify-between items-center py-2 px-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs"
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
            )}

            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6 lg:col-span-3 text-right"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 dark:border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Key className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span>{t.activationKeysTab}</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 font-bold mt-1">
                      {lang === 'ar' 
                        ? 'توليد وإدارة كروت تفعيل الباقة المميزة للطلاب. تصديرها للطباعة والتوزيع.' 
                        : 'Generate, manage and export student activation keys for Premium Access.'}
                    </p>
                  </div>

                  <button
                    onClick={handleExportKeys}
                    disabled={keysList.length === 0}
                    className="bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white font-black text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.exportKeysBtn}</span>
                  </button>
                </div>

                {/* Generator Section */}
                <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-[22px] border border-slate-100 dark:border-slate-850/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">
                      {t.keysCount}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={keysGenerateCount}
                      onChange={(e) => setKeysGenerateCount(Math.min(200, Math.max(1, Number(e.target.value))))}
                      className="w-full text-xs font-black px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateKeys}
                    disabled={keysLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs px-4 py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/15"
                  >
                    {keysLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>{t.generateKeysBtn}</span>
                  </button>
                </div>

                {keysStatusMsg && (
                  <div className={`text-xs font-black px-4 py-3 rounded-xl flex items-center gap-1.5 ${
                    keysStatusMsg.type === 'success' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900' 
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900'
                  }`}>
                    {keysStatusMsg.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 shrink-0" />
                    )}
                    <span>{keysStatusMsg.text}</span>
                  </div>
                )}

                {/* Keys Table / List */}
                <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  {keysList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs">
                      {t.noKeysAvailable}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80">
                            <th className="px-4 py-3">{t.keyLabel}</th>
                            <th className="px-4 py-3">{t.statusLabel}</th>
                            <th className="px-4 py-3">{t.usedByLabel}</th>
                            <th className="px-4 py-3">{t.activatedAtLabel}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'رقم الجهاز' : 'Device ID'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-350">
                          {keysList.slice().reverse().map((k, idx) => (
                            <tr key={idx} className="hover:bg-slate-55/50 dark:hover:bg-slate-950/30 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold select-all tracking-wider text-slate-900 dark:text-white">
                                {k.key}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                                  k.status === 'unused'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 border-slate-200 dark:bg-slate-850 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                                }`}>
                                  {k.status === 'unused' ? t.statusUnused : t.statusUsed}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold">
                                {k.usedBy || '-'}
                              </td>
                              <td className="px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                                {k.activatedAt ? new Date(k.activatedAt).toLocaleString(lang === 'ar' ? 'ar-YE' : 'en-US') : '-'}
                              </td>
                              <td className="px-4 py-3 font-mono text-[9px] text-slate-400 dark:text-slate-500 select-all">
                                {k.deviceUuid ? k.deviceUuid.substring(0, 12) + '...' : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {k.status === 'used' && (
                                  <button
                                    onClick={() => handleResetDevice(k.key)}
                                    className="text-rose-500 hover:text-rose-600 font-black text-[10px] active:scale-95 transition-all"
                                  >
                                    {lang === 'ar' ? 'إلغاء قفل الجهاز' : 'Reset Device'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'helper' && (
              <motion.div
                key="helper"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <CoordsHelperTab 
                  lessons={lessons} 
                  setLessons={setLessons} 
                  saveAllToServer={saveAllToServer} 
                  lang={lang} 
                />
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div
                key="students"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                {/* Supabase Dashboard Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}</span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1 block">{dbStudents.length}</span>
                    </div>
                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center font-black">👥</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'الطلاب المشتركين (Premium)' : 'Premium Students'}</span>
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-450 mt-1 block">{dbStudents.filter(s => s.is_premium).length}</span>
                    </div>
                    <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center font-black">🌟</div>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'أكواد التفعيل المتاحة' : 'Available Codes'}</span>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-450 mt-1 block">{activationCodes.filter(c => !c.is_used).length}</span>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center font-black">🔑</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Students List (takes 2 cols) */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'إدارة الطلاب وتفعيل الاشتراكات' : 'Student Subscriptions'}</h2>
                        <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'ابحث عن اسم الطالب وقم بتفعيل حسابه بضغطة زر' : 'Activate or reset student accounts with one click'}</p>
                      </div>
                      <button
                        onClick={fetchStudents}
                        className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black text-xs px-3.5 py-2 rounded-xl border border-slate-150 dark:border-slate-700 active:scale-95 transition-all shrink-0 flex items-center gap-1.5 justify-center"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${dbStudentsLoading ? 'animate-spin' : ''}`} />
                        {lang === 'ar' ? 'تحديث البيانات' : 'Refresh'}
                      </button>
                    </div>

                    {/* Search Input */}
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'ابحث باسم الطالب أو رقم الهاتف...' : 'Search by name or phone...'}
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl px-4 py-3 text-sm font-bold text-slate-850 dark:text-white focus:outline-none focus:border-emerald-500"
                    />

                    {/* Students List Table */}
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-2xl">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-black border-b border-slate-100 dark:border-slate-850">
                            <th className="p-4">{lang === 'ar' ? 'اسم الطالب' : 'Student Name'}</th>
                            <th className="p-4">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                            <th className="p-4">{lang === 'ar' ? 'المحافظة' : 'Gov'}</th>
                            <th className="p-4">{lang === 'ar' ? 'حالة الهاتف' : 'Device'}</th>
                            <th className="p-4">{lang === 'ar' ? 'الاشتراك' : 'Access'}</th>
                            <th className="p-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {dbStudentsLoading ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-450">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                                {lang === 'ar' ? 'جاري تحميل قائمة الطلاب...' : 'Loading students...'}
                              </td>
                            </tr>
                          ) : dbStudents.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-450">
                                👥 {lang === 'ar' ? 'لا يوجد طلاب مسجلين بعد في قاعدة البيانات.' : 'No registered students yet.'}
                              </td>
                            </tr>
                          ) : dbStudents.filter(s => 
                              s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                              s.phone.includes(studentSearch)
                            ).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-450">
                                🔍 {lang === 'ar' ? 'لم يتم العثور على نتائج تطابق بحثك.' : 'No matching results found.'}
                              </td>
                            </tr>
                          ) : (
                            dbStudents
                              .filter(s => 
                                s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                s.phone.includes(studentSearch)
                              )
                              .map(s => (
                                <tr key={s.phone} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                                  <td className="p-4">
                                    <span className="font-extrabold block text-slate-900 dark:text-white">{s.name}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                      {lang === 'ar' ? 'سجل في: ' : 'Reg: '} {new Date(s.created_at).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US')}
                                    </span>
                                  </td>
                                  <td className="p-4 font-mono select-all">{s.phone}</td>
                                  <td className="p-4">{s.governorate || '—'}</td>
                                  <td className="p-4">
                                    {s.device_id === 'reset' ? (
                                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                        {lang === 'ar' ? 'بانتظار هاتف جديد' : 'Reset Pending'}
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                        {lang === 'ar' ? 'نشط' : 'Active'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    <button
                                      onClick={() => handleToggleStudentPremium(s.phone, s.is_premium)}
                                      className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-sm ${
                                        s.is_premium
                                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 border border-slate-200/40 dark:border-slate-700'
                                      }`}
                                    >
                                      {s.is_premium 
                                        ? (lang === 'ar' ? '⭐ تفعيل كامل' : '⭐ Premium') 
                                        : (lang === 'ar' ? 'تفعيل الحساب 🟢' : 'Activate 🟢')}
                                    </button>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={() => handleResetStudentDevice(s.phone)}
                                      title={lang === 'ar' ? 'إعادة ضبط الهاتف' : 'Reset Device ID'}
                                      className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-450 text-[10px] font-black px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                                    >
                                      {lang === 'ar' ? 'نقل الهاتف 🔄' : 'Transfer 🔄'}
                                    </button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Code Generator (takes 1 col) */}
                  <div className="space-y-6">
                    {/* Generator Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'توليد أكواد التفعيل' : 'Code Generator'}</h2>
                        <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'أنشئ أكواد فريدة صالحة للتنشيط لمرة واحدة' : 'Generate single-use premium keys'}</p>
                      </div>

                      <button
                        onClick={handleGenerateCode}
                        disabled={codeLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3.5 rounded-2xl active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                      >
                        {codeLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {lang === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
                          </>
                        ) : (
                          <>
                            <span>🔑 {lang === 'ar' ? 'توليد كود تفعيل جديد' : 'Generate New Key'}</span>
                          </>
                        )}
                      </button>

                      {generatedCode && (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-2 text-center">
                          <span className="text-[10px] text-slate-400 font-black block">{lang === 'ar' ? 'الكود الجديد المنشأ:' : 'NEW KEY GENERATED:'}</span>
                          <span className="text-md font-extrabold text-blue-600 dark:text-blue-450 block tracking-wider select-all">{generatedCode}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedCode);
                              alert(lang === 'ar' ? 'تم نسخ كود التفعيل!' : 'Code copied!');
                            }}
                            className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all inline-flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {lang === 'ar' ? 'نسخ كود التفعيل' : 'Copy Key'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Codes List Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-sm font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'الأكواد المنشأة سابقاً' : 'Recent Keys'}</h2>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2.5 py-1 rounded-full font-black">
                          {activationCodes.length}
                        </span>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-850 rounded-2xl p-2">
                        {activationCodes.length === 0 ? (
                          <div className="text-center p-8 text-slate-400 font-bold text-xs">
                            🗝️ {lang === 'ar' ? 'لا يوجد أكواد منشأة بعد.' : 'No codes generated yet.'}
                          </div>
                        ) : (
                          activationCodes.map(c => (
                            <div
                              key={c.code}
                              className={`p-3 rounded-xl border flex flex-col gap-1 ${
                                c.is_used
                                  ? 'bg-rose-50/20 border-rose-100 dark:bg-rose-950/10 dark:border-rose-950/20'
                                  : 'bg-emerald-50/20 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-950/20'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold tracking-wider text-xs select-all text-slate-800 dark:text-white">{c.code}</span>
                                {c.is_used ? (
                                  <span className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-455 text-[9px] px-2 py-0.5 rounded-full font-black">
                                    {lang === 'ar' ? 'مستعمل' : 'Used'}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-455 text-[9px] px-2 py-0.5 rounded-full font-black">
                                    {lang === 'ar' ? 'متاح' : 'Available'}
                                  </span>
                                )}
                              </div>
                              {c.is_used && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                                  {lang === 'ar' ? 'المستخدم: ' : 'User: '} {c.used_by_phone}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}

// ── Visual Coordinates Finder Component for Admin ────────────────────────────
interface CoordsHelperTabProps {
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  saveAllToServer: (lessonsToSave: Lesson[]) => Promise<void>;
  lang: Language;
}

function CoordsHelperTab({ lessons, setLessons, saveAllToServer, lang }: CoordsHelperTabProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessons[0]?.id || '');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [detectedFolders, setDetectedFolders] = useState<{ path: string; name: string; files: string[] }[]>([]);

  // Selected hotspot state for editing
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [editLabelAr, setEditLabelAr] = useState('');
  const [editDescAr, setEditDescAr] = useState('');

  // Drag-and-drop state and refs
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [draggingArrowId, setDraggingArrowId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  // Find active diagram inside the selected lesson config
  const activeDiagram = selectedLesson?.interactiveDiagrams?.find(d => d.imageFile === selectedImage);

  const [saveLoading, setSaveLoading] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSave = async () => {
    setSaveLoading(true);
    setLocalSaveStatus(null);
    try {
      await saveAllToServer(lessons);
      setLocalSaveStatus({
        type: 'success',
        text: lang === 'ar' ? 'تم حفظ تعديلات الرسم وقاعدة البيانات بنجاح! 💾 ✓' : 'Diagram edits & DB saved successfully! 💾 ✓'
      });
      setTimeout(() => setLocalSaveStatus(null), 4000);
    } catch (err) {
      setLocalSaveStatus({
        type: 'error',
        text: lang === 'ar' ? 'فشل حفظ التغييرات في قاعدة البيانات.' : 'Failed to save changes to DB.'
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDrag = (clientX: number, clientY: number, hotspotId: string, isDraggingArrow: boolean) => {
    if (!imageContainerRef.current || !selectedLesson || !selectedImage) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    // Round to 1 decimal place for neatness
    x = Math.round(x * 10) / 10;
    y = Math.round(y * 10) / 10;

    const updatedDiagrams = selectedLesson.interactiveDiagrams.map(diag => {
      if (diag.imageFile === selectedImage) {
        return {
          ...diag,
          hotspots: diag.hotspots.map(h => {
            if (h.id === hotspotId) {
              if (isDraggingArrow) {
                return { ...h, arrowX: x, arrowY: y };
              } else {
                return { ...h, x, y };
              }
            }
            return h;
          })
        };
      }
      return diag;
    });

    setLessons(prev => prev.map(l => l.id === selectedLessonId ? { ...l, interactiveDiagrams: updatedDiagrams } : l));
  };

  useEffect(() => {
    const activeId = draggingHotspotId || draggingArrowId;
    if (!activeId) return;
    const isArrow = !!draggingArrowId;

    const onMouseMove = (e: MouseEvent) => {
      handleDrag(e.clientX, e.clientY, activeId, isArrow);
    };

    const onMouseUp = () => {
      setDraggingHotspotId(null);
      setDraggingArrowId(null);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        // Prevent scroll when dragging on mobile
        e.preventDefault();
        handleDrag(e.touches[0].clientX, e.touches[0].clientY, activeId, isArrow);
      }
    };

    const onTouchEnd = () => {
      setDraggingHotspotId(null);
      setDraggingArrowId(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [draggingHotspotId, draggingArrowId, selectedLesson, selectedImage]);

  // AI analyzer states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');

  useEffect(() => {
    fetch('/detected_assets.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.folders) {
          setDetectedFolders(data.folders);
        }
      })
      .catch(err => console.error("Error loading detected assets in helper:", err));
  }, []);

  useEffect(() => {
    setSelectedImage('');
    setClickedCoords(null);
    setCopied(false);
    setActiveHotspotId(null);
    setAiStatusMsg(null);
  }, [selectedLessonId]);

  useEffect(() => {
    setClickedCoords(null);
    setCopied(false);
    setActiveHotspotId(null);
    setAiStatusMsg(null);
  }, [selectedImage]);

  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 font-bold">
        {lang === 'ar' ? 'الرجاء استيراد أو إضافة بعض الدروس أولاً!' : 'Please add some lessons first!'}
      </div>
    );
  }

  const getAssetUrl = (lesson: Lesson, file: string) => {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('//')) {
      return file;
    }
    const folderPath = lesson.folder;
    if (folderPath === '.' || folderPath === '/' || !folderPath) {
      return `/${file}`;
    }
    return `/${folderPath}/${file}`;
  };

  const allImages: { value: string; label: string }[] = [];
  if (selectedLesson) {
    const folderPath = selectedLesson.folder.replace(/\\/g, '/');
    const folderAsset = detectedFolders.find(f => f.path.replace(/\\/g, '/').toLowerCase() === folderPath.toLowerCase());
    
    if (folderAsset && folderAsset.files) {
      const imgExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
      folderAsset.files.forEach(fileName => {
        const ext = '.' + fileName.split('.').pop()?.toLowerCase();
        if (imgExtensions.includes(ext)) {
          if (!allImages.some(img => img.value === fileName)) {
            allImages.push({ value: fileName, label: fileName });
          }
        }
      });
    }

    if (selectedLesson.diagramFile && !allImages.some(img => img.value === selectedLesson.diagramFile)) {
      allImages.push({ value: selectedLesson.diagramFile, label: `${selectedLesson.diagramFile} (الرسم الأساسي)` });
    }
    if (selectedLesson.interactiveDiagrams) {
      selectedLesson.interactiveDiagrams.forEach(diag => {
        if (diag.imageFile && !allImages.some(img => img.value === diag.imageFile)) {
          allImages.push({ value: diag.imageFile, label: `${diag.imageFile} (رسم تفاعلي)` });
        }
      });
    }
  }

  // Handle click on canvas image
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    if (activeHotspotId && activeDiagram) {
      // Move existing hotspot to this spot
      const updatedHotspots = activeDiagram.hotspots.map(h => 
        h.id === activeHotspotId ? { ...h, x, y } : h
      );
      const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
      updateLessonDiagram(updatedDiag);
      setAiStatusMsg({ type: 'success', text: lang === 'ar' ? 'تم نقل موضع النقطة بنجاح.' : 'Hotspot moved successfully.' });
    } else {
      // Preparing to add new hotspot
      setClickedCoords({ x, y });
      setCopied(false);
      setEditLabelAr('');
      setEditDescAr('');
    }
  };

  const handleCopy = () => {
    if (!clickedCoords) return;
    const textToCopy = `${clickedCoords.x.toFixed(1)}, ${clickedCoords.y.toFixed(1)}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateLessonDiagram = (updatedDiagram: any) => {
    const updatedLessons = lessons.map(l => {
      if (l.id === selectedLessonId) {
        const diags = l.interactiveDiagrams || [];
        const exists = diags.some(d => d.imageFile === selectedImage);
        const newDiags = exists
          ? diags.map(d => d.imageFile === selectedImage ? updatedDiagram : d)
          : [...diags, updatedDiagram];
        return { ...l, interactiveDiagrams: newDiags };
      }
      return l;
    });
    setLessons(updatedLessons);
  };

  const handleCreateDiagram = () => {
    if (!selectedLesson || !selectedImage) return;
    const newDiag = {
      imageFile: selectedImage,
      titleAr: selectedLesson.titleAr,
      hotspots: []
    };
    updateLessonDiagram(newDiag);
  };

  const handleAddHotspot = () => {
    if (!clickedCoords || !activeDiagram) return;
    const newId = `H${activeDiagram.hotspots.length + 1}`;
    const newHotspot = {
      id: newId,
      x: clickedCoords.x,
      y: clickedCoords.y,
      arrowX: Math.round(Math.min(100, clickedCoords.x + 8) * 10) / 10,
      arrowY: Math.round(Math.min(100, clickedCoords.y + 8) * 10) / 10,
      labelAr: editLabelAr.trim() || `عنصر ${newId}`,
      descAr: editDescAr.trim() || 'لا يوجد شرح مضاف.'
    };
    const updatedDiag = {
      ...activeDiagram,
      hotspots: [...activeDiagram.hotspots, newHotspot]
    };
    updateLessonDiagram(updatedDiag);
    setClickedCoords(null);
    setEditLabelAr('');
    setEditDescAr('');
  };

  const handleUpdateHotspot = () => {
    if (!activeHotspotId || !activeDiagram) return;
    const updatedHotspots = activeDiagram.hotspots.map(h => 
      h.id === activeHotspotId 
        ? { ...h, labelAr: editLabelAr.trim(), descAr: editDescAr.trim() } 
        : h
    );
    const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
    updateLessonDiagram(updatedDiag);
    setActiveHotspotId(null);
    setEditLabelAr('');
    setEditDescAr('');
  };

  const handleDeleteHotspot = (id: string) => {
    if (!activeDiagram) return;
    const updatedHotspots = activeDiagram.hotspots.filter(h => h.id !== id);
    const updatedDiag = { ...activeDiagram, hotspots: updatedHotspots };
    updateLessonDiagram(updatedDiag);
    if (activeHotspotId === id) {
      setActiveHotspotId(null);
      setEditLabelAr('');
      setEditDescAr('');
    }
  };

  // Convert image URL to Base64 and run Gemini Vision Analysis
  const handleAnalyzeDiagram = async () => {
    if (!selectedLesson || !selectedImage) return;
    const imageUrl = getAssetUrl(selectedLesson, selectedImage);
    if (!imageUrl) return;

    setAiLoading(true);
    setAiStatusMsg(null);

    try {
      // 1. Fetch image locally to convert to base64
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to load image file from public assets.');
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const mimeType = blob.type || 'image/png';

          // 2. Call backend analyze diagram
          const apiRes = await fetch('/api/analyze-diagram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-gemini-key': localApiKey
            },
            body: JSON.stringify({ imageBase64: base64data, mimeType })
          });

          const data = await apiRes.json();
          if (!apiRes.ok || !data.success) {
            throw new Error(data.error || 'Gemini API failed to analyze the image.');
          }

          // 3. Map hotspots
          const generatedHotspots = data.hotspots.map((h: any) => ({
            id: h.partNumber || `H${Math.random().toString(36).substr(2, 4)}`,
            x: h.x,
            y: h.y,
            arrowX: Math.round(Math.min(100, h.x + 8) * 10) / 10,
            arrowY: Math.round(Math.min(100, h.y + 8) * 10) / 10,
            labelAr: h.partName,
            descAr: h.partDetails
          }));

          const updatedDiag = {
            imageFile: selectedImage,
            titleAr: activeDiagram?.titleAr || selectedLesson.titleAr,
            hotspots: generatedHotspots
          };

          updateLessonDiagram(updatedDiag);
          setAiStatusMsg({
            type: 'success',
            text: lang === 'ar' 
              ? `نجح التوليد! تم استكشاف ${generatedHotspots.length} نقاط تشريحية تفاعلية.`
              : `Success! Detected ${generatedHotspots.length} interactive anatomical hotspots.`
          });
        } catch (innerErr: any) {
          setAiStatusMsg({ type: 'error', text: innerErr.message });
        } finally {
          setAiLoading(false);
        }
      };

      reader.onerror = () => {
        throw new Error('Error reading image file conversion.');
      };
      
      reader.readAsDataURL(blob);

    } catch (err: any) {
      setAiStatusMsg({ type: 'error', text: err.message });
      setAiLoading(false);
    }
  };

  const imageUrl = selectedLesson && selectedImage ? getAssetUrl(selectedLesson, selectedImage) : '';

  return (
    <div className="space-y-6">
      {/* 1. Header Configurations Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {lang === 'ar' ? 'محرر ومساعد الرسوم التفاعلية' : 'Interactive Diagrams Visual Editor'}
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            {lang === 'ar'
              ? 'اختر الدرس والصورة لإنشاء المخططات والتحكم بالنقاط البارزة يدوياً أو توليدها تلقائياً بالذكاء الاصطناعي.'
              : 'Choose lesson and image to manage hotspots manually or generate them using Gemini Vision.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'اختر الدرس:' : 'Select Lesson:'}
            </label>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
            >
              {lessons.map(l => (
                <option key={l.id} value={l.id}>
                  {l.id} - {lang === 'ar' ? l.titleAr : l.titleEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              {lang === 'ar' ? 'اختر صورة من المجلد:' : 'Select Image from Folder:'}
            </label>
            <select
              value={selectedImage}
              onChange={(e) => setSelectedImage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
            >
              <option value="">{lang === 'ar' ? '-- اختر صورة للرسومات --' : '-- Select drawing image --'}</option>
              {allImages.map(img => (
                <option key={img.value} value={img.value}>
                  {img.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {imageUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Column A & B: Image Visual Canvas (takes 2/3 space) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center gap-6 animate-fadeIn relative">
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/60 w-full">
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {lang === 'ar' ? 'إحداثيات النقطة النشطة:' : 'Selected Coordinates:'}
                </span>
                <span className="text-xs font-mono font-black text-slate-800 dark:text-white mt-1 block">
                  {clickedCoords 
                    ? `x: ${clickedCoords.x}% , y: ${clickedCoords.y}%` 
                    : activeHotspotId 
                      ? `${lang === 'ar' ? 'نقل النقطة النشطة' : 'Moving active hotspot'}: ${activeHotspotId} (${lang === 'ar' ? 'انقر على مكان جديد للنقل' : 'Click on new position to move'})`
                      : (lang === 'ar' ? 'انقر فوق أي مكان بالصورة لتحديد موضع جديد' : 'Click anywhere on image to pick a point')}
                </span>
              </div>
              
              {clickedCoords && (
                <div className="flex gap-2">
                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-350 flex items-center justify-center">
                    {clickedCoords.x}, {clickedCoords.y}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {copied ? (lang === 'ar' ? 'تم النسخ! ✓' : 'Copied! ✓') : (lang === 'ar' ? 'نسخ الإحداثيات' : 'Copy Coords')}
                  </button>
                </div>
              )}
            </div>

            {/* Visual Canvas Element */}
            <div
              className={`relative border border-slate-200 dark:border-slate-800 rounded-[20px] overflow-hidden max-w-full bg-slate-950/5 select-none flex items-center justify-center ${
                draggingHotspotId ? 'cursor-grabbing' : 'cursor-crosshair'
              }`}
              style={{ maxHeight: '70vh', minHeight: '300px' }}
            >
              {/* Image wrapper that aligns coordinates directly with image dimensions */}
              <div
                ref={imageContainerRef}
                onClick={handleImageClick}
                className="relative inline-block max-w-full max-h-full cursor-crosshair"
              >
                <img
                  src={imageUrl}
                  alt="Interactive Diagram Preview"
                  className="max-h-[70vh] w-auto object-contain block"
                  draggable={false}
                  onError={() => alert(lang === 'ar' ? 'خطأ في تحميل ملف الصورة، تأكد من مطابقة الاسم والمسار في مجلد المنهج.' : 'Failed to load image. Verify filename and path in the curriculum directory.')}
                />
                
                {/* SVG arrows preview overlay in Admin editor */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
                  <defs>
                    <marker
                      id="admin-arrow-head-default"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
                    </marker>
                    <marker
                      id="admin-arrow-head-active"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
                    </marker>
                  </defs>

                  {activeDiagram?.hotspots?.map((hotspot) => {
                    const hasArrow = hotspot.arrowX !== undefined && hotspot.arrowY !== undefined && hotspot.arrowX !== null && hotspot.arrowY !== null;
                    const isActive = activeHotspotId === hotspot.id;
                    const startX = hotspot.x;
                    const startY = hotspot.y;
                    const endX = hasArrow ? hotspot.arrowX! : startX + 10;
                    const endY = hasArrow ? hotspot.arrowY! : startY + 10;

                    if (!hasArrow && !isActive) return null;

                    return (
                      <line
                        key={`admin-arrow-${hotspot.id}`}
                        x1={`${startX}%`}
                        y1={`${startY}%`}
                        x2={`${endX}%`}
                        y2={`${endY}%`}
                        stroke={isActive ? '#f59e0b' : '#3b82f6'}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        strokeDasharray={isActive ? 'none' : '3 3'}
                        markerEnd={`url(#admin-arrow-head-${isActive ? 'active' : 'default'})`}
                        className="transition-all duration-150"
                        style={{
                          opacity: activeHotspotId ? (isActive ? 1 : 0.4) : 0.8
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Render Existing Hotspots */}
                {activeDiagram?.hotspots?.map((hotspot) => {
                  const isActive = activeHotspotId === hotspot.id;
                  const isDragging = draggingHotspotId === hotspot.id;
                  return (
                    <button
                      key={hotspot.id}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveHotspotId(hotspot.id);
                        setClickedCoords(null);
                        setEditLabelAr(hotspot.labelAr);
                        setEditDescAr(hotspot.descAr);
                        setDraggingHotspotId(hotspot.id);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setActiveHotspotId(hotspot.id);
                        setClickedCoords(null);
                        setEditLabelAr(hotspot.labelAr);
                        setEditDescAr(hotspot.descAr);
                        setDraggingHotspotId(hotspot.id);
                      }}
                      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                      className={`absolute w-6 h-6 -mt-3 -ml-3 flex items-center justify-center z-20 group focus:outline-none ${
                        isDragging ? 'cursor-grabbing' : 'cursor-grab'
                      }`}
                      title={hotspot.labelAr}
                    >
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isActive ? 'bg-amber-400' : 'bg-emerald-400'
                      } ${isDragging ? '' : 'animate-ping'}`}></span>
                      <span className={`relative inline-flex rounded-full h-3.5 w-3.5 shadow-md border border-white text-[8px] font-black text-white items-center justify-center transition-transform ${
                        isActive ? 'bg-amber-500 scale-110' : 'bg-emerald-500'
                      } ${isDragging ? 'scale-125 ring-2 ring-white/50 bg-amber-500' : 'group-hover:scale-110'}`}>
                        {hotspot.id.replace('H', '')}
                      </span>
                    </button>
                  );
                })}

                {/* Render Arrow Head drag handle for the active hotspot */}
                {activeDiagram?.hotspots?.map((hotspot) => {
                  const isActive = activeHotspotId === hotspot.id;
                  if (!isActive) return null;

                  const hasArrow = hotspot.arrowX !== undefined && hotspot.arrowY !== undefined && hotspot.arrowX !== null && hotspot.arrowY !== null;
                  const arrowX = hasArrow ? hotspot.arrowX! : hotspot.x + 10;
                  const arrowY = hasArrow ? hotspot.arrowY! : hotspot.y + 10;
                  const isDraggingArrow = draggingArrowId === hotspot.id;

                  return (
                    <button
                      key={`arrow-handle-${hotspot.id}`}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDraggingArrowId(hotspot.id);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setDraggingArrowId(hotspot.id);
                      }}
                      style={{ left: `${arrowX}%`, top: `${arrowY}%` }}
                      className={`absolute w-5 h-5 -mt-2.5 -ml-2.5 flex items-center justify-center z-30 focus:outline-none border border-amber-400 bg-amber-500 rounded-full shadow-lg cursor-pointer ${
                        isDraggingArrow ? 'bg-amber-600 scale-125 cursor-grabbing' : 'hover:scale-110 cursor-grab'
                      }`}
                      title={lang === 'ar' ? 'سهم التوجيه (اسحب للإشارة للعضو)' : 'Arrow tip (Drag to point to structure)'}
                    >
                      <span className="text-[8.5px] font-black text-white select-none">🡥</span>
                    </button>
                  );
                })}

                {/* Render Temporary Clicked Coordinate */}
                {clickedCoords && (
                  <div
                    className="absolute w-5 h-5 -mt-2.5 -ml-2.5 bg-red-500 border-2 border-white rounded-full shadow-lg shadow-red-500/50 animate-pulse pointer-events-none z-30"
                    style={{ left: `${clickedCoords.x}%`, top: `${clickedCoords.y}%` }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Column C: AI generation and Editing panel (takes 1/3 space) */}
          <div className="space-y-6">
            
            {/* Save Diagram Changes Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
              <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-500" />
                {lang === 'ar' ? 'حفظ تعديلات الرسوم التفاعلية' : 'Save Interactive Diagram Edits'}
              </h3>
              
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {lang === 'ar'
                  ? 'عندما تنتهي من سحب وتعديل النقاط، اضغط هنا لحفظ كافة الإحداثيات والبيانات مباشرة لقاعدة بيانات الخادم.'
                  : 'After dragging and modifying hotspots, click below to save coordinates and data to the server DB.'}
              </p>

              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs py-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10"
              >
                {saveLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{lang === 'ar' ? 'حفظ التعديلات بصورة نهائية 💾' : 'Save Edits Permanently 💾'}</span>
              </button>

              {localSaveStatus && (
                <div className={`p-3 rounded-xl text-xs font-bold text-center border leading-relaxed ${
                  localSaveStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-150 dark:border-emerald-900'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-150 dark:border-rose-900'
                }`}>
                  {localSaveStatus.text}
                </div>
              )}
            </div>

            {/* AI Control Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                {lang === 'ar' ? 'التحليل التلقائي بالذكاء البصري' : 'AI Multimodal Vision'}
              </h3>
              
              {!activeDiagram ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {lang === 'ar'
                      ? 'هذه الصورة غير مجهزة بعد كمخطط تفاعلي في قاعدة البيانات. اضغط أدناه لتهيئتها.'
                      : 'This image is not registered as an interactive diagram. Initialize it below.'}
                  </p>
                  <button
                    onClick={handleCreateDiagram}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                  >
                    {lang === 'ar' ? 'إنشاء مخطط تفاعلي جديد' : 'Initialize Interactive Diagram'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {lang === 'ar'
                      ? 'سيقوم نموذج Gemini Vision بفحص صورة درس الأحياء، واستخراج النصوص التشريحية وإحداثياتها الدقيقة فوراً.'
                      : 'Gemini Vision will scan the diagram image, extracting labels and coordinate values.'}
                  </p>

                  <button
                    onClick={handleAnalyzeDiagram}
                    disabled={aiLoading || !localApiKey}
                    className={`w-full font-black text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                      aiLoading 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-650 hover:bg-violet-755 text-white shadow-md shadow-violet-500/10'
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {lang === 'ar' ? 'جاري تحليل الصورة التشريحية...' : 'Analyzing diagram...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'تحليل الرسم بالذكاء الاصطناعي 🤖' : 'Analyze Diagram with AI 🤖'}
                      </>
                    )}
                  </button>
                  
                  {!localApiKey && (
                    <p className="text-[10px] text-red-500 font-bold">
                      {lang === 'ar' 
                        ? '⚠️ يرجى إدخال مفتاح Gemini API في شاشة الإعدادات لتفعيل هذه الميزة.' 
                        : '⚠️ Please provide a Gemini API key in settings to enable this feature.'}
                    </p>
                  )}

                  {aiStatusMsg && (
                    <div className={`p-3 rounded-xl text-xs font-bold leading-relaxed ${
                      aiStatusMsg.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-800' 
                        : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-150 dark:border-red-800'
                    }`}>
                      {aiStatusMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hotspots Edit Panel */}
            {activeDiagram && (
              <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-fadeIn">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  {lang === 'ar' ? 'محرر النقاط التفاعلية' : 'Hotspots Editor'}
                </h3>

                {/* Case 1: Editing Existing Hotspot */}
                {activeHotspotId ? (
                  <div className="space-y-3 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">
                        {lang === 'ar' ? `تعديل النقطة النشطة: ${activeHotspotId}` : `Editing Hotspot: ${activeHotspotId}`}
                      </span>
                      <button 
                        onClick={() => {
                          setActiveHotspotId(null);
                          setEditLabelAr('');
                          setEditDescAr('');
                        }}
                        className="text-slate-400 hover:text-slate-650 text-xs font-bold"
                      >
                        {lang === 'ar' ? 'إلغاء التحديد' : 'Cancel'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'اسم العضو/التركيب:' : 'Structure Name (Ar):'}</label>
                      <input 
                        type="text"
                        value={editLabelAr}
                        onChange={(e) => setEditLabelAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'الوظيفة أو الشرح التفصيلي:' : 'Details / Function (Ar):'}</label>
                      <textarea 
                        rows={3}
                        value={editDescAr}
                        onChange={(e) => setEditDescAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateHotspot}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs py-2 rounded-xl transition-all"
                      >
                        {lang === 'ar' ? 'تحديث النقطة' : 'Update Hotspot'}
                      </button>
                      <button
                        onClick={() => handleDeleteHotspot(activeHotspotId)}
                        className="bg-red-500 hover:bg-red-600 text-white font-black text-xs px-3 py-2 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : clickedCoords ? (
                  // Case 2: Adding New Hotspot
                  <div className="space-y-3 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                        {lang === 'ar' ? 'إضافة نقطة جديدة' : 'Add New Hotspot'}
                      </span>
                      <button 
                        onClick={() => setClickedCoords(null)}
                        className="text-slate-400 hover:text-slate-655 text-xs font-bold"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>

                    <div className="text-[10px] font-mono font-bold text-slate-500">
                      Coordinates: x: {clickedCoords.x}%, y: {clickedCoords.y}%
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'اسم العضو/التركيب:' : 'Structure Name (Ar):'}</label>
                      <input 
                        type="text"
                        placeholder="مثال: القشرة المخية"
                        value={editLabelAr}
                        onChange={(e) => setEditLabelAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{lang === 'ar' ? 'الوظيفة أو الشرح التفصيلي:' : 'Details / Function (Ar):'}</label>
                      <textarea 
                        rows={3}
                        placeholder="اكتب وظيفته أو شرح مبسط عنه هنا..."
                        value={editDescAr}
                        onChange={(e) => setEditDescAr(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-white focus:outline-none leading-relaxed"
                      />
                    </div>

                    <button
                      onClick={handleAddHotspot}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2 rounded-xl transition-all"
                    >
                      {lang === 'ar' ? 'إدراج النقطة التفاعلية' : 'Insert Hotspot'}
                    </button>
                  </div>
                ) : (
                  // Case 3: Prompt instructions
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl text-center text-xs text-slate-400 font-bold leading-relaxed">
                    {lang === 'ar'
                      ? 'حدد نقطة بالنقر على الرسم لإضافتها، أو اضغط على أي علامة تفاعلية لتعديلها أو نقلها.'
                      : 'Click the image to insert a new hotspot, or select a marker to edit details or reposition.'}
                  </div>
                )}

                {/* Hotspots List Summary */}
                {activeDiagram.hotspots && activeDiagram.hotspots.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      {lang === 'ar' ? `النقاط التفاعلية الحالية (${activeDiagram.hotspots.length}):` : `Anatomy Hotspots (${activeDiagram.hotspots.length}):`}
                    </span>
                    <div className="max-h-[30vh] overflow-y-auto space-y-1.5 scrollbar-none pr-1">
                      {activeDiagram.hotspots.map((h) => {
                        const isSelected = activeHotspotId === h.id;
                        return (
                          <div 
                            key={h.id}
                            onClick={() => {
                              setActiveHotspotId(h.id);
                              setClickedCoords(null);
                              setEditLabelAr(h.labelAr);
                              setEditDescAr(h.descAr);
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-bold flex justify-between items-center ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-150 dark:border-slate-800/80 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 text-white ${
                                isSelected ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}>
                                {h.id.replace('H', '')}
                              </span>
                              <span className="truncate">{h.labelAr}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium ml-2">
                              x: {h.x}%, y: {h.y}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      ) : selectedLesson ? (
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-12 shadow-sm text-center text-slate-400 font-bold">
          {lang === 'ar' 
            ? 'الرجاء اختيار صورة من القائمة المنسدلة أعلاه لبدء التعديل البصري.' 
            : 'Please select an image from the dropdown above to start visual editing.'}
        </div>
      ) : null}
    </div>
  );
}