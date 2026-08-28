import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Lock, Unlock, Edit, Eye, Trash2, Plus,
  Save, FolderOpen, RefreshCw, CheckCircle, PlusCircle, Sparkles,
  Info, Check, ChevronLeft, ChevronRight, Loader2, Search, Copy
} from 'lucide-react';

import { translations } from '../../utils/translations';
import { getAbsoluteUrl } from '../../utils/urlHelper';
import { getAdminAuthHeaders } from '../../utils/supabaseClient';
import { Lesson, VideoChapter, Flashcard, ConfigQuestion, MindmapNode } from '../../types';
import DOMPurify from 'dompurify';
import { supabase } from '../../utils/supabaseClient';

type EditorSubTab = 'basic' | 'chapters' | 'summary-flash' | 'quiz' | 'ministry-quiz' | 'files';

interface LessonsTabProps {
  activeTab: 'lessons-list' | 'lesson-editor' | 'preview';
  setActiveTab: (tab: 'lessons-list' | 'lesson-editor' | 'preview' | 'export' | 'keys' | 'helper' | 'students') => void;
  lang: 'ar' | 'en';
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  saveAllToServer: (lessonsToSave: Lesson[]) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  editingLesson: Lesson | null;
  setEditingLesson: React.Dispatch<React.SetStateAction<Lesson | null>>;
  editingLessonIndex: number | null;
  setEditingLessonIndex: React.Dispatch<React.SetStateAction<number | null>>;
  editorSubTab: EditorSubTab;
  setEditorSubTab: React.Dispatch<React.SetStateAction<EditorSubTab>>;
}

export default function LessonsTab({
  activeTab,
  setActiveTab,
  lang,
  lessons,
  setLessons,
  saveAllToServer,
  saveStatus,
  editingLesson,
  setEditingLesson,
  editingLessonIndex,
  setEditingLessonIndex,
  editorSubTab,
  setEditorSubTab
}: LessonsTabProps) {
  const t = translations[lang];

  // Local state for validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // AI Quiz Generator states
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiType, setAiType] = useState<'all' | 'mcq' | 'tf' | 'fill'>('all');
  const [localApiKey, setLocalApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // File upload state
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [lessonSearch, setLessonSearch] = useState('');
  const [recentlyAddedItem, setRecentlyAddedItem] = useState<string | null>(null);
  const recentlyAddedItemRef = useRef<HTMLDivElement | null>(null);

  // Detected server folders for auto-linking
  const [detectedFolders, setDetectedFolders] = useState<{ path: string, name: string, files: string[] }[]>([]);

  // Preview States
  const [previewQuizIdx, setPreviewQuizIdx] = useState<number>(0);
  const [previewSelectedAns, setPreviewSelectedAns] = useState<string | null>(null);
  const [previewShowExpl, setPreviewShowExpl] = useState<boolean>(false);
  const [activeQuizIdx, setActiveQuizIdx] = useState<number>(0);

  // Fetch detected assets on mount
  useEffect(() => {
    fetch(getAbsoluteUrl('/detected_assets.json'))
      .then(res => res.json())
      .then(data => {
        if (data && data.folders) {
          setDetectedFolders(data.folders);
        }
      })
      .catch(err => console.error("Error loading detected assets:", err));
  }, []);

  // Run validation whenever lessons change
  useEffect(() => {
    validateSyllabus();
  }, [lessons, lang]);

  // Reset active quiz index when editing lesson changes
  useEffect(() => {
    setActiveQuizIdx(0);
  }, [editingLesson?.id]);

  useEffect(() => {
    if (!recentlyAddedItem) return;

    const frameId = window.requestAnimationFrame(() => {
      recentlyAddedItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstEditableField = recentlyAddedItemRef.current?.querySelector<HTMLElement>('input:not([readonly]), textarea, select');
      firstEditableField?.focus();
    });
    const timerId = window.setTimeout(() => setRecentlyAddedItem(null), 2500);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, [recentlyAddedItem]);

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
            errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد صح (T) أو خطأ (F)!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: TF requires correct key T or F!`);
          }
        } else if (q.type === 'fill' || q.type === 'fill_blank') {
          if (!q.correctAnswers || q.correctAnswers.length === 0) {
            errors.push(lang === 'ar' ? `الدرس (${lesson.id}) - السؤال #${qIdx + 1}: يجب تحديد إجابة مقبولة واحدة على الأقل لإكمال الفراغ!` : `Lesson (${lesson.id}) - Question #${qIdx + 1}: Fill blank requires at least one correct answer!`);
          }
        }
      });
    });

    setValidationErrors(errors);
  };

  const handleApiKeyChange = (val: string) => {
    setLocalApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleGenerateAIQuiz = async () => {
    if (!editingLesson) return;
    setAiLoading(true);
    setAiStatusMsg(null);

    try {
      const adminHeaders = await getAdminAuthHeaders();
      const res = await fetch(getAbsoluteUrl('/api/generate-quiz'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': localApiKey,
          ...adminHeaders
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

  const getUnitTitleByNum = (num: number) => {
    if (num === 1) return 'الجهاز العصبي';
    if (num === 2) return 'التنظيم الهرموني';
    if (num === 3) return 'التكاثر في الكائنات الحية';
    if (num === 4) return 'أساسيات علم الوراثة';
    if (num === 5) return 'الوراثة الجزيئية';
    if (num === 6) return 'التقانة الحيوية';
    if (num === 7) return 'البيئة ومشكلاتها';
    if (num === 8) return 'تاريخ الأرض';
    return `الوحدة ${num}`;
  };

  const getUnitSubtitleByNum = (num: number) => {
    const labels = [
      'الوحدة الأولى', 
      'الوحدة الثانية', 
      'الوحدة الثالثة', 
      'الوحدة الرابعة', 
      'الوحدة الخامسة', 
      'الوحدة السادسة', 
      'الوحدة السابعة', 
      'الوحدة الثامنة'
    ];
    return labels[num - 1] || `الوحدة ${num}`;
  };

  const getNextLessonId = (targetUnit: number) => {
    const lessonNumbers = lessons
      .map(lesson => lesson.id.match(new RegExp(`^u${targetUnit}-l(\\d+)$`)))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map(match => Number(match[1]));
    const nextLessonNumber = lessonNumbers.length > 0 ? Math.max(...lessonNumbers) + 1 : 1;
    return `u${targetUnit}-l${nextLessonNumber}`;
  };

  const handleCreateNewLesson = (unitNum: any = 1) => {
    const targetUnit = typeof unitNum === 'number' ? unitNum : 1;
    const newId = getNextLessonId(targetUnit);

    const newLesson: Lesson = {
      id: newId,
      unit: targetUnit,
      folder: `u${targetUnit}/${newId}`,
      titleAr: "",
      titleEn: "",
      pdfFile: "",
      diagramFile: "",
      summaryFile: "",
      mindmapFile: "",
      quizFile: "",
      ministryExamFile: "",
      locked: false,
      pdfLocked: false,
      videoUrl: "",
      videoChapters: [],
      summaryPointsAr: [],
      summaryPointsEn: [],
      flashcards: [],
      glossary: [],
      quiz: []
    };

    const newIdx = lessons.length;
    setLessons(prev => [...prev, newLesson]);
    setEditingLesson(newLesson);
    setEditingLessonIndex(newIdx);
    setEditorSubTab('basic');
    setActiveTab('lesson-editor');
  };

  const handleDuplicateLesson = (lesson: Lesson) => {
    const newId = getNextLessonId(Number(lesson.unit) || 1);
    const duplicatedLesson: Lesson = {
      ...JSON.parse(JSON.stringify(lesson)),
      id: newId,
      folder: `u${lesson.unit}/${newId}`,
      titleAr: `${lesson.titleAr} - نسخة`,
      titleEn: lesson.titleEn ? `${lesson.titleEn} - Copy` : ''
    };
    const newIndex = lessons.length;
    setLessons(previous => [...previous, duplicatedLesson]);
    setEditingLesson(duplicatedLesson);
    setEditingLessonIndex(newIndex);
    setEditorSubTab('basic');
    setActiveTab('lesson-editor');
  };

  const handleSaveLessonEdit = async () => {
    if (!editingLesson || editingLessonIndex === null) return;
    const updatedLessons = lessons.map((l, idx) => idx === editingLessonIndex ? editingLesson : l);
    setLessons(updatedLessons);
    validateSyllabus();
    try {
      await saveAllToServer(updatedLessons);
      setActiveTab('lessons-list');
    } catch {
      // Keep the editor open so the owner can retry without losing work.
    }
  };

  const handleDeleteLesson = (id: string) => {
    const msg = lang === 'ar'
      ? 'هل تريد حذف هذا الدرس من المسودة؟ لن يتغير تطبيق الطلاب حتى تنشر المسودة.'
      : 'Delete this lesson from the draft? Students are unaffected until you publish.';
    if (window.confirm(msg)) {
      const updatedLessons = lessons.filter(l => l.id !== id);
      setLessons(updatedLessons);
      setEditingLesson(null);
      setEditingLessonIndex(null);
      void saveAllToServer(updatedLessons).catch(() => undefined);
    }
  };

  const updateEditingLessonField = (field: keyof Lesson, value: any) => {
    if (!editingLesson || editingLessonIndex === null) return;
    const updated = {
      ...editingLesson,
      [field]: value
    };
    setEditingLesson(updated);
    setLessons(prev => prev.map((l, idx) => idx === editingLessonIndex ? updated : l));
  };

  // Video Chapters Mutators
  // Video Chapters Mutators
  const addVideoChapter = () => {
    if (!editingLesson) return;
    const chapters = [...(editingLesson.videoChapters || [])];
    chapters.push({
      time: '00:00',
      titleAr: '',
      titleEn: '',
      descAr: '',
      descEn: ''
    });
    updateEditingLessonField('videoChapters', chapters);
  };

  const updateVideoChapter = (index: number, key: string, value: any) => {
    if (!editingLesson) return;
    const chapters = [...(editingLesson.videoChapters || [])];
    if (key === 'titleAr') {
      chapters[index] = { ...chapters[index], titleAr: value, titleEn: value };
    } else if (key === 'descAr') {
      chapters[index] = { ...chapters[index], descAr: value, descEn: value };
    } else {
      chapters[index] = { ...chapters[index], [key]: value };
    }
    updateEditingLessonField('videoChapters', chapters);
  };

  const deleteVideoChapter = (index: number) => {
    if (!editingLesson) return;
    const chapters = (editingLesson.videoChapters || []).filter((_, i) => i !== index);
    updateEditingLessonField('videoChapters', chapters);
  };

  const createEditorItemId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const getNextQuestionId = (questions: ConfigQuestion[]) =>
    questions.reduce((highestId, question) => Math.max(highestId, Number(question.id) || 0), 0) + 1;

  const insertAfter = <T,>(items: T[], item: T, afterIndex?: number): T[] => {
    if (typeof afterIndex !== 'number' || afterIndex < 0 || afterIndex >= items.length) {
      return [...items, item];
    }
    const updatedItems = [...items];
    updatedItems.splice(afterIndex + 1, 0, item);
    return updatedItems;
  };

  // Flashcards Mutators
  const addFlashcard = (afterIndex?: number) => {
    if (!editingLesson) return;
    const cards = [...(editingLesson.flashcards || [])];
    const card: Flashcard = {
      id: createEditorItemId('card'),
      qAr: '',
      qEn: '',
      aAr: '',
      aEn: ''
    };
    updateEditingLessonField('flashcards', insertAfter(cards, card, afterIndex));
    setRecentlyAddedItem(`flashcard:${card.id}`);
  };

  const updateFlashcard = (index: number, key: keyof Flashcard, value: any) => {
    if (!editingLesson) return;
    const cards = [...(editingLesson.flashcards || [])];
    if (key === 'qAr') {
      cards[index] = { ...cards[index], qAr: value, qEn: value };
    } else if (key === 'aAr') {
      cards[index] = { ...cards[index], aAr: value, aEn: value };
    } else {
      cards[index] = { ...cards[index], [key]: value };
    }
    updateEditingLessonField('flashcards', cards);
  };

  const deleteFlashcard = (index: number) => {
    if (!editingLesson) return;
    const cards = (editingLesson.flashcards || []).filter((_, i) => i !== index);
    updateEditingLessonField('flashcards', cards);
  };

  // Mindmap Nodes Mutators
  const getMindmapDescendantIds = (nodes: MindmapNode[], nodeId: string) => {
    const descendantIds = new Set<string>();
    let foundNewDescendant = true;
    while (foundNewDescendant) {
      foundNewDescendant = false;
      nodes.forEach(node => {
        if (node.parentId === nodeId || (node.parentId && descendantIds.has(node.parentId))) {
          if (!descendantIds.has(node.id)) {
            descendantIds.add(node.id);
            foundNewDescendant = true;
          }
        }
      });
    }
    return descendantIds;
  };

  const getMindmapPath = (nodes: MindmapNode[], node: MindmapNode) => {
    const nodeById = new Map(nodes.map(item => [item.id, item]));
    const path: MindmapNode[] = [node];
    const visited = new Set([node.id]);
    let parentId = node.parentId;

    while (parentId && !visited.has(parentId)) {
      const parent = nodeById.get(parentId);
      if (!parent) break;
      path.unshift(parent);
      visited.add(parent.id);
      parentId = parent.parentId;
    }
    return path;
  };

  const addMindmapNode = (parentId?: string, afterIndex?: number) => {
    if (!editingLesson) return;
    const nodes = [...(editingLesson.mindmap || [])];
    const node: MindmapNode = {
      id: createEditorItemId('node'),
      textAr: '',
      textEn: '',
      details: '',
      parentId: parentId || undefined
    };
    updateEditingLessonField('mindmap', insertAfter(nodes, node, afterIndex));
    setRecentlyAddedItem(`mindmap:${node.id}`);
  };

  const updateMindmapNode = (index: number, key: string, value: any) => {
    if (!editingLesson) return;
    const nodes = [...(editingLesson.mindmap || [])];
    if (key === 'parentId' && value) {
      const currentNode = nodes[index];
      const descendantIds = getMindmapDescendantIds(nodes, currentNode.id);
      if (value === currentNode.id || descendantIds.has(value)) {
        alert(lang === 'ar'
          ? 'لا يمكن جعل العنصر تابعاً لنفسه أو لأحد فروعه الفرعية.'
          : 'A node cannot be moved under itself or one of its descendants.');
        return;
      }
    }
    if (key === 'textAr') {
      nodes[index] = { ...nodes[index], textAr: value, textEn: value };
    } else if (key === 'details') {
      nodes[index] = { ...nodes[index], details: value };
    } else {
      nodes[index] = { ...nodes[index], [key]: value };
    }
    updateEditingLessonField('mindmap', nodes);
  };

  const deleteMindmapNode = (index: number) => {
    if (!editingLesson) return;
    const nodeToDelete = (editingLesson.mindmap || [])[index];
    const hasChildren = (editingLesson.mindmap || []).some(node => node.parentId === nodeToDelete?.id);
    if (hasChildren) {
      alert(lang === 'ar'
        ? 'هذا الفرع يحتوي فروعاً فرعية. انقلها أو احذفها أولاً قبل حذف الفرع الأب.'
        : 'This branch has child nodes. Move or delete them before deleting the parent branch.');
      return;
    }
    const nodes = (editingLesson.mindmap || []).filter((_, i) => i !== index);
    updateEditingLessonField('mindmap', nodes);
  };

  // Summary Points Mutators
  const addSummaryPoint = () => {
    if (!editingLesson) return;
    const points = [...(editingLesson.summaryPointsAr || [])];
    points.push('');
    updateEditingLessonField('summaryPointsAr', points);
  };

  const updateSummaryPoint = (index: number, text: string) => {
    if (!editingLesson) return;
    const points = [...(editingLesson.summaryPointsAr || [])];
    points[index] = text;
    updateEditingLessonField('summaryPointsAr', points);
  };

  const deleteSummaryPoint = (index: number) => {
    if (!editingLesson) return;
    const points = (editingLesson.summaryPointsAr || []).filter((_, i) => i !== index);
    updateEditingLessonField('summaryPointsAr', points);
  };

  // Quiz Question Mutators
  const addQuizQuestion = (afterIndex?: number) => {
    if (!editingLesson) return;
    const quiz = [...(editingLesson.quiz || [])];
    const question: ConfigQuestion = {
      id: getNextQuestionId(quiz),
      type: 'tf',
      textAr: '',
      textEn: '',
      options: [
        { key: 'T', textAr: '✔️ صح', textEn: '✔️ صح' },
        { key: 'F', textAr: '❌ خطأ', textEn: '❌ خطأ' }
      ],
      correctKey: 'T',
      explanationAr: '',
      explanationEn: ''
    };
    updateEditingLessonField('quiz', insertAfter(quiz, question, afterIndex));
    setRecentlyAddedItem(`quiz:${question.id}`);
  };

  // Ministry Question Mutators
  const addMinistryQuestion = (afterIndex?: number) => {
    if (!editingLesson) return;
    const ministryExams = [...(editingLesson.ministryExams || [])];
    const question: ConfigQuestion = {
      id: getNextQuestionId(ministryExams),
      type: 'tf',
      textAr: '',
      textEn: '',
      options: [
        { key: 'T', textAr: '✔️ صح', textEn: '✔️ صح' },
        { key: 'F', textAr: '❌ خطأ', textEn: '❌ خطأ' }
      ],
      correctKey: 'T',
      explanationAr: '',
      explanationEn: ''
    };
    updateEditingLessonField('ministryExams', insertAfter(ministryExams, question, afterIndex));
    setRecentlyAddedItem(`ministry:${question.id}`);
  };

  const updateMinistryQuestion = (index: number, key: string, value: any) => {
    if (!editingLesson) return;
    const ministryExams = [...(editingLesson.ministryExams || [])];
    if (key === 'textAr') {
      ministryExams[index] = { ...ministryExams[index], textAr: value, textEn: value };
    } else if (key === 'explanationAr') {
      ministryExams[index] = { ...ministryExams[index], explanationAr: value, explanationEn: value };
    } else {
      ministryExams[index] = { ...ministryExams[index], [key]: value };
    }
    updateEditingLessonField('ministryExams', ministryExams);
  };

  const updateMinistryOption = (qIdx: number, optIdx: number, value: string) => {
    if (!editingLesson) return;
    const ministryExams = [...(editingLesson.ministryExams || [])];
    const question = { ...ministryExams[qIdx] };
    const opts = [...(question.options || [])];
    const keys = ['A', 'B', 'C', 'D'];
    if (opts[optIdx]) {
      opts[optIdx] = { ...opts[optIdx], textAr: value, textEn: value };
    } else {
      opts[optIdx] = { key: keys[optIdx], textAr: value, textEn: value };
    }
    question.options = opts;
    ministryExams[qIdx] = question;
    updateEditingLessonField('ministryExams', ministryExams);
  };

  const deleteMinistryQuestion = (index: number) => {
    if (!editingLesson) return;
    const ministryExams = (editingLesson.ministryExams || []).filter((_, i) => i !== index);
    updateEditingLessonField('ministryExams', ministryExams);
  };

  const updateQuizQuestion = (index: number, key: string, value: any) => {
    if (!editingLesson) return;
    const quiz = [...(editingLesson.quiz || [])];
    if (key === 'textAr') {
      quiz[index] = { ...quiz[index], textAr: value, textEn: value };
    } else if (key === 'explanationAr') {
      quiz[index] = { ...quiz[index], explanationAr: value, explanationEn: value };
    } else {
      quiz[index] = { ...quiz[index], [key]: value };
    }
    updateEditingLessonField('quiz', quiz);
  };

  const updateQuizOption = (qIdx: number, optIdx: number, value: string) => {
    if (!editingLesson) return;
    const quiz = [...(editingLesson.quiz || [])];
    const question = { ...quiz[qIdx] };
    const opts = [...(question.options || [])];
    const keys = ['A', 'B', 'C', 'D'];
    if (opts[optIdx]) {
      opts[optIdx] = { ...opts[optIdx], textAr: value, textEn: value };
    } else {
      opts[optIdx] = { key: keys[optIdx], textAr: value, textEn: value };
    }
    question.options = opts;
    quiz[qIdx] = question;
    updateEditingLessonField('quiz', quiz);
  };

  const deleteQuizQuestion = (index: number) => {
    if (!editingLesson) return;
    const quiz = (editingLesson.quiz || []).filter((_, i) => i !== index);
    updateEditingLessonField('quiz', quiz);
  };

  const handleFileUpload = (fieldName: keyof Lesson, accept: string) => {
    if (!editingLesson) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const extension = `.${file.name.split('.').pop()?.toLocaleLowerCase() || ''}`;
        const isPdf = extension === '.pdf' || file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        const isHtml = extension === '.html' || extension === '.htm';
        const maxFileSize = isPdf ? 50 * 1024 * 1024 : 15 * 1024 * 1024;

        if (isHtml) {
          alert(lang === 'ar'
            ? 'رفع ملفات HTML غير مفعّل في التخزين السحابي لأسباب أمنية. استخدم رابط الملف أو اربطه من مجلد الدرس الموجود.'
            : 'HTML uploads are disabled in cloud storage for security. Paste the file URL or link an existing lesson folder.');
          return;
        }

        if (!isPdf && !isImage) {
          alert(lang === 'ar'
            ? 'نوع الملف غير مدعوم. المسموح حاليًا: PDF أو صورة PNG/JPG/WEBP/GIF.'
            : 'Unsupported file type. Current uploads accept PDF or PNG/JPG/WEBP/GIF images.');
          return;
        }

        if (file.size > maxFileSize) {
          const maxSizeMb = maxFileSize / (1024 * 1024);
          alert(lang === 'ar'
            ? `حجم الملف كبير. الحد الأقصى ${maxSizeMb} ميجابايت.`
            : `File is too large. Maximum size is ${maxSizeMb} MB.`);
          return;
        }

        setUploadingField(fieldName as string);
        setUploadSuccess(null);
        
        // Directly upload to Supabase Storage
        (async () => {
          try {
            // 1. Sanitize folder & file name to strictly valid ASCII/S3 keys
            const rawFolder = editingLesson.folder || `U${editingLesson.unit || 1}`;
            const cleanFolder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'U1';
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${cleanFolder}/${Date.now()}_${cleanFileName}`;

            // 2. Upload directly to the configured curriculum asset bucket.
            const targetBucket = 'biology-assets';
            const uploadRes = await supabase.storage
              .from(targetBucket)
              .upload(storagePath, file, { cacheControl: '3600', upsert: true });

            if (uploadRes.error) {
              throw new Error(uploadRes.error.message);
            }

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage.from(targetBucket).getPublicUrl(storagePath);
            const fileUrl = publicUrlData.publicUrl;

            const newLesson = { ...editingLesson, [fieldName]: fileUrl };
            setEditingLesson(newLesson);
            const updatedLessons = lessons.map((l, idx) => idx === editingLessonIndex ? newLesson : l);
            setLessons(updatedLessons);
            await saveAllToServer(updatedLessons);
            setUploadSuccess(fieldName as string);
            setTimeout(() => setUploadSuccess(null), 4000);
          } catch (err: any) {
            console.error("Failed uploading file to Supabase Storage:", err);
            alert(lang === 'ar' 
              ? `فشل تحميل الملف على السحابة: ${err.message || ''}` 
              : `Failed to upload file to cloud storage: ${err.message || ''}`
            );
          } finally {
            setUploadingField(null);
          }
        })();
      }
    };
    input.click();
  };

  const isRtl = lang === 'ar';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const normalizedLessonSearch = lessonSearch.trim().toLocaleLowerCase('ar');
  const visibleLessons = lessons.filter(lesson => {
    if (!normalizedLessonSearch) return true;
    return lesson.titleAr.toLocaleLowerCase('ar').includes(normalizedLessonSearch)
      || lesson.titleEn.toLocaleLowerCase().includes(normalizedLessonSearch)
      || lesson.id.toLocaleLowerCase().includes(normalizedLessonSearch);
  });
  const editingChecklist = editingLesson ? [
    { label: lang === 'ar' ? 'العنوان' : 'Title', complete: Boolean(editingLesson.titleAr.trim()) },
    { label: 'PDF', complete: Boolean(editingLesson.pdfFile.trim()) },
    { label: lang === 'ar' ? 'الملخص' : 'Summary', complete: editingLesson.summaryPointsAr.length > 0 },
    { label: lang === 'ar' ? 'التدريب' : 'Practice', complete: editingLesson.quiz.length > 0 }
  ] : [];

  return (
    <AnimatePresence mode="wait">
      {/* View 1: Lessons List */}
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
                {lang === 'ar' ? 'إدارة مسودات الدروس ومعاينتها قبل النشر' : 'Manage and preview lesson drafts before publishing'}
              </p>
            </div>
            <button
              onClick={handleCreateNewLesson}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'درس جديد' : 'New Lesson'}</span>
            </button>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={lessonSearch}
              onChange={event => setLessonSearch(event.target.value)}
              placeholder={lang === 'ar' ? 'ابحث بعنوان الدرس أو المعرّف...' : 'Search by title or lesson ID...'}
              className="w-full rounded-app-btn border border-slate-200 bg-white py-3 pe-10 ps-4 text-xs font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </label>

          {normalizedLessonSearch && visibleLessons.length === 0 && (
            <div className="rounded-app-card border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              {lang === 'ar' ? 'لا توجد دروس مطابقة لعبارة البحث.' : 'No lessons match your search.'}
            </div>
          )}

          <div className="space-y-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(unitNum => {
              const unitLessons = visibleLessons.filter(lesson => Number(lesson.unit) === unitNum);
              const unitTitle = getUnitTitleByNum(unitNum);
              const unitSubtitle = getUnitSubtitleByNum(unitNum);

              if (normalizedLessonSearch && unitLessons.length === 0) return null;

              return (
                <div key={unitNum} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] rounded-full">
                        {unitSubtitle}
                      </span>
                      <h3 className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                        {unitTitle}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleCreateNewLesson(unitNum)}
                      className="text-emerald-500 hover:text-emerald-600 font-black text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إضافة درس' : 'Add Lesson'}</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {unitLessons.length === 0 ? (
                      <p className="text-center py-4 text-xs font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        {lang === 'ar' ? 'لا توجد دروس مضافة حالياً في هذه الوحدة.' : 'No lessons added in this unit yet.'}
                      </p>
                    ) : (
                      unitLessons.map((lesson) => {
                        const originalIndex = lessons.findIndex(l => l.id === lesson.id);
                        const lessonName = lesson.titleAr || lesson.folder.split('/')[1] || lesson.id;
                        const completedFields = [
                          Boolean(lesson.titleAr?.trim()),
                          Boolean(lesson.pdfFile?.trim()),
                          lesson.summaryPointsAr.length > 0,
                          lesson.quiz.length > 0
                        ].filter(Boolean).length;
                        const completionPercentage = completedFields * 25;

                        return (
                          <div 
                            key={lesson.id} 
                            className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-emerald-500/50 transition-colors"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-app-btn bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
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
                                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                    completionPercentage === 100
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                  }`}>
                                    {completionPercentage}% {lang === 'ar' ? 'مكتمل' : 'complete'}
                                  </span>
                                </div>
                                <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm mt-1">
                                  {lessonName}
                                </h4>
                                <p className="text-[10px] text-slate-455 dark:text-slate-500 font-bold mt-0.5 font-sans">
                                  ID: {lesson.id} • {lesson.quiz.length} أسئلة • {lesson.pdfFile ? 'PDF مرفوع' : 'PDF مطلوب'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                              <button
                                onClick={() => handleDuplicateLesson(lesson)}
                                className="bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 p-2.5 rounded-app-btn transition-colors active:scale-95 cursor-pointer"
                                title={lang === 'ar' ? 'نسخ الدرس كمسودة جديدة' : 'Duplicate as a new draft'}
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLesson(lesson);
                                  setEditingLessonIndex(originalIndex);
                                  setEditorSubTab('basic');
                                  setActiveTab('lesson-editor');
                                }}
                                className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-app-btn transition-colors active:scale-95 flex items-center gap-1.5 text-xs font-black cursor-pointer"
                                title={lang === 'ar' ? 'تعديل المحتوى والأسئلة' : 'Edit content'}
                              >
                                <Edit className="w-4 h-4" />
                                <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLesson(lesson);
                                  setEditingLessonIndex(originalIndex);
                                  setPreviewQuizIdx(0);
                                  setPreviewSelectedAns(null);
                                  setPreviewShowExpl(false);
                                  setActiveTab('preview');
                                }}
                                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 p-2.5 rounded-app-btn transition-colors active:scale-95 cursor-pointer"
                                title={lang === 'ar' ? 'معاينة الطالب' : 'Preview student view'}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-455 p-2.5 rounded-app-btn transition-colors active:scale-95 cursor-pointer"
                                title={lang === 'ar' ? 'حذف من المسودة' : 'Delete from draft'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* View 2: Lesson Editor */}
      {activeTab === 'lesson-editor' && editingLesson && (
        <motion.div
          key="lesson-editor"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-app-card border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="min-w-0">
              <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full uppercase">
                {lang === 'ar' ? 'تحرير نشط' : 'Active Editor'}
              </span>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm mt-1.5">
                {editingLesson.titleAr || editingLesson.id}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {editingChecklist.map(item => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${
                      item.complete
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}
                  >
                    {item.complete ? <Check className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('lessons-list')}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-app-btn font-bold text-xs active:scale-95 transition-transform"
              >
                {lang === 'ar' ? 'رجوع للقائمة' : 'Back to list'}
              </button>
              <button
                onClick={() => void handleSaveLessonEdit()}
                disabled={saveStatus === 'saving'}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-app-btn font-black text-xs active:scale-95 transition-transform flex items-center gap-1.5 shadow-md shadow-emerald-550/20 disabled:shadow-none"
              >
                {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saveStatus === 'saving'
                  ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                  : (lang === 'ar' ? 'حفظ المسودة' : 'Save Draft')}</span>
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-app-card p-2 gap-1 overflow-x-auto shadow-sm">
            {(['basic', 'summary-flash', 'quiz', 'ministry-quiz', 'files'] as EditorSubTab[]).map(sub => {
              const labels: Record<EditorSubTab, string> = {
                'basic': lang === 'ar' ? '1. الأساسيات وPDF' : '1. Basics & PDF',
                'chapters': lang === 'ar' ? '🎬 فصول الفيديو' : 'Chapters',
                'summary-flash': lang === 'ar' ? '2. الملخص والبطاقات' : '2. Summary & Cards',
                'quiz': lang === 'ar' ? '3. التدريب' : '3. Practice',
                'ministry-quiz': lang === 'ar' ? '4. الوزاري' : '4. Ministry',
                'files': lang === 'ar' ? '5. الملفات والصلاحيات' : '5. Files & Access'
              };
              return (
                <button
                  key={sub}
                  onClick={() => setEditorSubTab(sub)}
                  className={`px-4 py-2.5 rounded-app-btn text-xs font-black transition-all shrink-0 ${
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

          {/* Editor Sub-Tab: Basics */}
          {editorSubTab === 'basic' && (
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400 border-b border-slate-50 dark:border-slate-800 pb-2">
                {lang === 'ar' ? 'المعلومات الأساسية والملفات' : 'Basic Specifications & Attachments'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'معرّف الدرس (ID فريد)' : 'Unique Lesson ID'}</label>
                  <input 
                    type="text" 
                    value={editingLesson.id} 
                    readOnly
                    aria-readonly="true"
                    className="w-full cursor-not-allowed bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-xs font-bold text-slate-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                    {lang === 'ar' ? 'يُنشأ تلقائياً ولا يمكن تغييره لحماية نتائج الطلاب.' : 'Generated automatically and locked to protect student results.'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'رقم الوحدة (Unit)' : 'Unit Number'}</label>
                  <input 
                    type="number" 
                    value={editingLesson.unit} 
                    readOnly
                    aria-readonly="true"
                    className="w-full cursor-not-allowed bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-xs font-bold text-slate-500 focus:outline-none"
                    required
                  />
                  <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                    {lang === 'ar' ? 'لنقل درس إلى وحدة أخرى أنشئ نسخة جديدة حفاظاً على سجلاته.' : 'Create a new copy to move a lesson without breaking its records.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'مسار مجلد الدرس على السيرفر (Folder Path)' : 'Folder Directory Path'}</label>
                <input 
                  type="text" 
                  value={editingLesson.folder} 
                  onChange={(e) => updateEditingLessonField('folder', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
                
                {detectedFolders.length > 0 && (
                  <div className="mt-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-app-btn border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block uppercase tracking-wider">
                      {lang === 'ar' ? '📂 مجلدات تم اكتشافها على السيرفر (انقر للربط التلقائي والذكي بالملفات):' : '📂 Detected folders on server (click to auto-link and match files):'}
                    </span>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pe-1">
                      {detectedFolders.map((fd, i) => {
                        const isLinked = editingLesson.folder === fd.path;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const pdf = fd.files.find(f => f.toLowerCase().endsWith('.pdf')) || '';
                              const diagram = fd.files.find(f => 
                                (f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')) &&
                                !f.includes('ملخص') && !f.includes('summary') && !f.includes('infograph')
                              ) || '';
                              const summary = fd.files.find(f => 
                                (f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')) &&
                                (f.includes('ملخص') || f.includes('summary') || f.includes('infograph'))
                              ) || '';
                              const mindmap = fd.files.find(f => 
                                (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                (f.includes('خارطة') || f.includes('خريطة') || f.includes('mindmap') || f.includes('الدرس')) &&
                                !f.includes('اختبار') && !f.includes('quiz')
                              ) || '';
                              const quiz = fd.files.find(f => 
                                (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                (f.includes('اختبار') || f.includes('quiz'))
                              ) || '';
                              const ministry = fd.files.find(f => 
                                (f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) &&
                                (f.includes('وزار') || f.includes('ministry'))
                              ) || '';

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
                            className={`flex items-center justify-between p-2.5 rounded-app-btn text-xs font-black border transition-all text-right ${
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

              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'عنوان الدرس:' : 'Lesson Title:'}</label>
                <input 
                  type="text" 
                  value={editingLesson.titleAr} 
                  onChange={(e) => {
                    if (!editingLesson || editingLessonIndex === null) return;
                    const updated = {
                      ...editingLesson,
                      titleAr: e.target.value,
                      titleEn: e.target.value
                    };
                    setEditingLesson(updated);
                    setLessons(prev => prev.map((l, idx) => idx === editingLessonIndex ? updated : l));
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1.5">{lang === 'ar' ? 'رابط شرح YouTube (اختياري)' : 'YouTube explanation link (optional)'}</label>
                <input 
                  type="text" 
                  value={editingLesson.videoUrl} 
                  onChange={(e) => updateEditingLessonField('videoUrl', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                  {lang === 'ar' ? 'اتركه فارغاً إذا لم يكن للدرس شرح فيديو.' : 'Leave empty when the lesson has no video explanation.'}
                </p>
              </div>

              <h5 className="font-extrabold text-xs text-slate-450 dark:text-slate-400 pt-2">{lang === 'ar' ? 'أسماء ملفات الملحقات (داخل مجلد الدرس)' : 'Attachment Filenames (Inside Lesson Directory)'}</h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PDF */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الـ PDF للدرس' : 'Lesson PDF File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.pdfFile || ''} 
                      onChange={(e) => updateEditingLessonField('pdfFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('pdfFile', '.pdf')}
                      disabled={uploadingField === 'pdfFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع ملف PDF جديد' : 'Upload new PDF'}
                    >
                      {uploadingField === 'pdfFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'pdfFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                {/* Diagram */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الرسم التخطيطي (PNG)' : 'Diagram Image File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.diagramFile || ''} 
                      onChange={(e) => updateEditingLessonField('diagramFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('diagramFile', 'image/*')}
                      disabled={uploadingField === 'diagramFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع صورة جديدة' : 'Upload new image'}
                    >
                      {uploadingField === 'diagramFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'diagramFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                {/* Mindmap */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف خريطة ذهنية (HTML)' : 'Mindmap HTML File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.mindmapFile || ''} 
                      onChange={(e) => updateEditingLessonField('mindmapFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('mindmapFile', '.html,.htm')}
                      disabled={uploadingField === 'mindmapFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع ملف HTML جديد' : 'Upload new HTML'}
                    >
                      {uploadingField === 'mindmapFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'mindmapFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف إنفوجرافيك ملخص (PNG)' : 'Summary Infographic File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.summaryFile || ''} 
                      onChange={(e) => updateEditingLessonField('summaryFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('summaryFile', 'image/*')}
                      disabled={uploadingField === 'summaryFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع صورة جديدة' : 'Upload new image'}
                    >
                      {uploadingField === 'summaryFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'summaryFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                {/* Quiz */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف كود اختبار HTML خارجي' : 'External Quiz HTML File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.quizFile || ''} 
                      onChange={(e) => updateEditingLessonField('quizFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('quizFile', '.html,.htm')}
                      disabled={uploadingField === 'quizFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع ملف HTML جديد' : 'Upload new HTML'}
                    >
                      {uploadingField === 'quizFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'quizFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>

                {/* Ministry Exam */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'ملف الأسئلة الوزارية (PDF/HTML)' : 'Ministry Questions File'}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingLesson.ministryExamFile || ''} 
                      onChange={(e) => updateEditingLessonField('ministryExamFile', e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleFileUpload('ministryExamFile', '.pdf,.html,.htm')}
                      disabled={uploadingField === 'ministryExamFile'}
                      className="shrink-0 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 px-2.5 py-2 rounded-app-btn transition-colors text-[10px] font-black flex items-center gap-1"
                      title={lang === 'ar' ? 'رفع ملف جديد' : 'Upload new file'}
                    >
                      {uploadingField === 'ministryExamFile' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {uploadSuccess === 'ministryExamFile' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editor Sub-Tab: Video Chapters */}
          {editorSubTab === 'chapters' && (
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={addVideoChapter}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة فصل فيديو' : 'Add Chapter'}</span>
                </button>
                <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {lang === 'ar' ? 'فصول ومحطات الفيديو التعليمي' : 'Video Study Chapters'}
                </h4>
              </div>

              {(!editingLesson.videoChapters || editingLesson.videoChapters.length === 0) ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs">
                  {lang === 'ar' ? 'لا توجد فصول فيديو مضافة حالياً لهذا الدرس.' : 'No video chapters added for this lesson.'}
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {editingLesson.videoChapters.map((ch, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border border-slate-150 dark:border-slate-800/80 space-y-3 relative">
                      <button
                        type="button"
                        onClick={() => deleteVideoChapter(idx)}
                        className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title={lang === 'ar' ? 'حذف الفصل' : 'Delete Chapter'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'توقيت البدء (مثال: 02:45):' : 'Start Time (e.g. 02:45):'}</label>
                          <input
                            type="text"
                            value={ch.time}
                            onChange={(e) => updateVideoChapter(idx, 'time', e.target.value)}
                            placeholder="00:00"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-center text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'عنوان الفصل:' : 'Chapter Title:'}</label>
                          <input
                            type="text"
                            value={ch.titleAr}
                            onChange={(e) => updateVideoChapter(idx, 'titleAr', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="text-right">
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'شرح ووصف الفصل:' : 'Description:'}</label>
                        <textarea
                          value={ch.descAr}
                          onChange={(e) => updateVideoChapter(idx, 'descAr', e.target.value)}
                          rows={2}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editor Sub-Tab: Summary & Cards & Mindmap */}
          {editorSubTab === 'summary-flash' && (
            <div className="space-y-6">
              {/* Part 0: Summary Points (نقاط وخلاصة أفكار الدرس) */}
              <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={addSummaryPoint}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة فكرة / نقطة ملخص' : 'Add Summary Point'}</span>
                  </button>
                  <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>{lang === 'ar' ? 'نقاط وخلاصة أفكار الدرس الرئيسية' : 'Key Lesson Summary Points'}</span>
                  </h4>
                </div>

                {(!editingLesson.summaryPointsAr || editingLesson.summaryPointsAr.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 font-bold text-xs">
                    {lang === 'ar' ? 'لا توجد نقاط ملخص مضافة حالياً. اضغط على زر الإضافة أعلاه لكتابة أفكار الدرس.' : 'No summary points added yet.'}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {editingLesson.summaryPointsAr.map((point, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-app-card border border-slate-150 dark:border-slate-800/80 flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-[11px] shrink-0 mt-1">
                          {idx + 1}
                        </span>
                        <textarea
                          value={point || ''}
                          onChange={(e) => updateSummaryPoint(idx, e.target.value)}
                          placeholder={lang === 'ar' ? `اكتب النقطة / الفكرة رقم ${idx + 1}...` : `Summary point ${idx + 1}...`}
                          rows={2}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500 leading-relaxed text-right"
                        />
                        <button
                          type="button"
                          onClick={() => deleteSummaryPoint(idx)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 shrink-0 mt-1 cursor-pointer"
                          title={lang === 'ar' ? 'حذف النقطة' : 'Delete Point'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Part A: Flashcards */}
              <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => addFlashcard()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة بطاقة تعليمية' : 'Add Flashcard'}</span>
                  </button>
                  <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {lang === 'ar' ? 'البطاقات التعليمية والأسئلة السريعة' : 'Flashcards & Q&A'}
                  </h4>
                </div>

                {(!editingLesson.flashcards || editingLesson.flashcards.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 font-bold text-xs">
                    {lang === 'ar' ? 'لا توجد بطاقات مضافة حالياً.' : 'No flashcards added.'}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {editingLesson.flashcards.map((card, idx) => (
                      <div
                        key={card.id || idx}
                        ref={recentlyAddedItem === `flashcard:${card.id}` ? recentlyAddedItemRef : undefined}
                        className={`bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border space-y-3 relative transition-all ${
                          recentlyAddedItem === `flashcard:${card.id}`
                            ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-lg'
                            : 'border-slate-150 dark:border-slate-800/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => deleteFlashcard(idx)}
                          className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                          title={lang === 'ar' ? 'حذف البطاقة' : 'Delete Card'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center justify-between border-b border-slate-200/70 pb-2 pe-8 dark:border-slate-800">
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                            {lang === 'ar' ? `البطاقة رقم ${idx + 1}` : `Card #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => addFlashcard(idx)}
                            className="inline-flex items-center gap-1 rounded-app-btn px-2.5 py-1.5 text-[10px] font-black text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            {lang === 'ar' ? 'إضافة بطاقة بعدها' : 'Add after'}
                          </button>
                        </div>

                        <div className="text-right">
                          <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'السؤال:' : 'Question:'}</label>
                          <input
                            type="text"
                            value={card.qAr || ''}
                            onChange={(e) => updateFlashcard(idx, 'qAr', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="text-right">
                          <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'الإجابة:' : 'Answer:'}</label>
                          <textarea
                            value={card.aAr || ''}
                            onChange={(e) => updateFlashcard(idx, 'aAr', e.target.value)}
                            rows={2}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Part B: Mindmap Node List Editor */}
              <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => addMindmapNode()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة فرع رئيسي' : 'Add Root Branch'}</span>
                  </button>
                  <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {lang === 'ar' ? 'تحرير نقاط وهيكل الخارطة الذهنية التفاعلية' : 'Mindmap Hierarchical Editor'}
                  </h4>
                </div>

                {(!editingLesson.mindmap || editingLesson.mindmap.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 font-bold text-xs">
                    {lang === 'ar' ? 'لا توجد نقاط في الخارطة الذهنية حالياً.' : 'No mindmap nodes added.'}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {editingLesson.mindmap.map((node, idx) => (
                      <div
                        key={node.id || idx}
                        ref={recentlyAddedItem === `mindmap:${node.id}` ? recentlyAddedItemRef : undefined}
                        style={{ marginInlineStart: `${Math.min(getMindmapPath(editingLesson.mindmap || [], node).length - 1, 3) * 16}px` }}
                        className={`bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border space-y-3 relative transition-all ${
                          recentlyAddedItem === `mindmap:${node.id}`
                            ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-lg'
                            : 'border-slate-150 dark:border-slate-800/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => deleteMindmapNode(idx)}
                          className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                          title={lang === 'ar' ? 'حذف العنصر' : 'Delete Node'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 pe-8 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                              {getMindmapPath(editingLesson.mindmap || [], node).length === 1
                                ? (lang === 'ar' ? 'فرع رئيسي' : 'Root')
                                : (lang === 'ar'
                                  ? `فرع فرعي — المستوى ${getMindmapPath(editingLesson.mindmap || [], node).length}`
                                  : `Child — level ${getMindmapPath(editingLesson.mindmap || [], node).length}`)}
                            </span>
                            <span>
                              {getMindmapPath(editingLesson.mindmap || [], node)
                                .map(pathNode => pathNode.textAr || pathNode.textEn || (lang === 'ar' ? 'بدون عنوان' : 'Untitled'))
                                .join(' ← ')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addMindmapNode(node.id, idx)}
                            className="inline-flex items-center gap-1 rounded-app-btn px-2.5 py-1.5 text-[10px] font-black text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            {lang === 'ar' ? 'إضافة فرع تابع' : 'Add child'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'معرّف الفرع (Node ID):' : 'Node ID:'}</label>
                            <input
                              type="text"
                              value={node.id}
                              readOnly
                              aria-readonly="true"
                              className="w-full cursor-not-allowed bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-mono font-bold text-slate-500 focus:outline-none"
                            />
                          </div>
                          
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'العنصر الأب (Parent):' : 'Parent Node:'}</label>
                            <select
                              value={node.parentId || ''}
                              onChange={(e) => updateMindmapNode(idx, 'parentId', e.target.value || undefined)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500 font-sans"
                            >
                              <option value="">{lang === 'ar' ? '-- العنصر الرئيسي (Root) --' : '-- Root Node --'}</option>
                              {editingLesson.mindmap
                                .filter((candidate, nIdx) => nIdx !== idx && !getMindmapDescendantIds(editingLesson.mindmap || [], node.id).has(candidate.id))
                                .map(n => (
                                  <option key={n.id} value={n.id}>
                                    {n.id} ({n.textAr || n.textEn})
                                  </option>
                                ))
                              }
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'العنوان:' : 'Label:'}</label>
                            <input
                              type="text"
                              value={node.textAr || ''}
                              onChange={(e) => updateMindmapNode(idx, 'textAr', e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'الوصف والتفسير:' : 'Description:'}</label>
                          <textarea
                            value={node.details || ''}
                            onChange={(e) => updateMindmapNode(idx, 'details', e.target.value)}
                            rows={2}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editor Sub-Tab: Quiz Editor */}
          {editorSubTab === 'quiz' && (
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => addQuizQuestion()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة سؤال كويز' : 'Add Question'}</span>
                </button>
                <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {lang === 'ar' ? 'تحرير أسئلة كويز الدرس التفاعلي' : 'Lesson Quiz Bank Editor'}
                </h4>
              </div>

              {/* صندوق توليد الأسئلة بالذكاء الاصطناعي */}
              <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-950/10 dark:to-slate-950 p-4 rounded-app-card border border-emerald-500/10 dark:border-emerald-950/40 space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <h5 className="font-black text-xs text-slate-800 dark:text-white">
                    {lang === 'ar' ? 'توليد الأسئلة تلقائياً بالذكاء الاصطناعي (Gemini)' : 'Auto-Generate Quiz with AI (Gemini)'}
                  </h5>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                      {lang === 'ar' ? 'مفتاح Gemini API (اختياري، يقرأ من السيرفر):' : 'Gemini API Key (Optional):'}
                    </label>
                    <input
                      type="password"
                      placeholder="AI Studio API Key"
                      value={localApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-app-btn text-xs font-semibold focus:outline-none focus:border-emerald-500 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                      {lang === 'ar' ? 'عدد الأسئلة المطلوب توليدها:' : 'Number of Questions:'}
                    </label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-app-btn text-xs font-semibold focus:outline-none focus:border-emerald-500 dark:text-white"
                    >
                      <option value={3}>3 {lang === 'ar' ? 'أسئلة' : 'Questions'}</option>
                      <option value={5}>5 {lang === 'ar' ? 'أسئلة' : 'Questions'}</option>
                      <option value={10}>10 {lang === 'ar' ? 'أسئلة' : 'Questions'}</option>
                      <option value={15}>15 {lang === 'ar' ? 'أسئلة' : 'Questions'}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                      {lang === 'ar' ? 'نوع الأسئلة:' : 'Question Type:'}
                    </label>
                    <select
                      value={aiType}
                      onChange={(e) => setAiType(e.target.value as any)}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-app-btn text-xs font-semibold focus:outline-none focus:border-emerald-500 dark:text-white"
                    >
                      <option value="all">{lang === 'ar' ? 'مزيج (كل الأنواع)' : 'Mixed (All Types)'}</option>
                      <option value="mcq">{lang === 'ar' ? 'اختيار من متعدد' : 'Multiple Choice'}</option>
                      <option value="tf">{lang === 'ar' ? 'صح وخطأ' : 'True / False'}</option>
                      <option value="fill">{lang === 'ar' ? 'أكمل الفراغ' : 'Fill in the Blank'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100/50 dark:border-slate-800/40">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-md text-center sm:text-right">
                    {lang === 'ar' 
                      ? '💡 سيقوم الذكاء الاصطناعي بتحليل ملخص الدرس الحالي وتوليد أسئلة مطابقة لمنهج الأحياء بدقة مع كتابة الشرح النموذجي تلقائياً.'
                      : '💡 The AI will analyze the current lesson summary and generate matching questions along with model explanations.'}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAIQuiz}
                    disabled={aiLoading}
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-black text-xs px-4 py-2.5 rounded-app-btn active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-sm shrink-0"
                  >
                    {aiLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>{lang === 'ar' ? 'جاري التوليد...' : 'Generating...' }</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>{lang === 'ar' ? 'توليد الأسئلة تلقائياً' : 'Generate Questions'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* رسالة حالة التوليد */}
                {aiStatusMsg && (
                  <div className={`p-3 rounded-app-btn text-xs font-bold text-center border animate-fadeIn ${
                    aiStatusMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}>
                    {aiStatusMsg.text}
                  </div>
                )}
              </div>

              {(!editingLesson.quiz || editingLesson.quiz.length === 0) ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs">
                  {lang === 'ar' ? 'لا توجد أسئلة اختبار مضافة لهذا الدرس.' : 'No quiz questions added.'}
                </div>
              ) : (
                <div className="space-y-6 max-h-[550px] overflow-y-auto pr-1">
                  {editingLesson.quiz.map((q, qIdx) => (
                    <div
                      key={`quiz-${q.id}-${qIdx}`}
                      ref={recentlyAddedItem === `quiz:${q.id}` ? recentlyAddedItemRef : undefined}
                      className={`bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border space-y-4 relative transition-all ${
                        recentlyAddedItem === `quiz:${q.id}`
                          ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-lg'
                          : 'border-slate-150 dark:border-slate-800/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => deleteQuizQuestion(qIdx)}
                        className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title={lang === 'ar' ? 'حذف السؤال' : 'Delete Question'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Question Type Selection & Question Index */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {lang === 'ar' ? `السؤال رقم ${qIdx + 1}` : `Question #${qIdx + 1}`}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">ID: {q.id}</span>
                          <button
                            type="button"
                            onClick={() => addQuizQuestion(qIdx)}
                            className="inline-flex items-center gap-1 rounded-app-btn px-2 py-1 text-[9px] font-black text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                          >
                            <PlusCircle className="h-3 w-3" />
                            {lang === 'ar' ? 'إضافة بعده' : 'Add after'}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'نوع السؤال:' : 'Question Type:'}
                          </label>
                          <select
                            value={q.type || 'mcq'}
                            onChange={(e) => {
                              const newType = e.target.value;
                              let updatedOpts = q.options;
                              if (newType === 'tf') {
                                updatedOpts = [
                                  { key: 'T', textAr: '✔️ صح', textEn: '✔️ صح' },
                                  { key: 'F', textAr: '❌ خطأ', textEn: '❌ خطأ' }
                                ];
                              } else if (newType === 'mcq') {
                                const isComingFromTF = q.type === 'tf';
                                updatedOpts = [
                                  { key: 'A', textAr: isComingFromTF ? '' : (q.options?.[0]?.textAr || ''), textEn: isComingFromTF ? '' : (q.options?.[0]?.textEn || '') },
                                  { key: 'B', textAr: isComingFromTF ? '' : (q.options?.[1]?.textAr || ''), textEn: isComingFromTF ? '' : (q.options?.[1]?.textEn || '') },
                                  { key: 'C', textAr: q.options?.[2]?.textAr || '', textEn: q.options?.[2]?.textEn || '' },
                                  { key: 'D', textAr: q.options?.[3]?.textAr || '', textEn: q.options?.[3]?.textEn || '' }
                                ];
                              }
                              
                              const quiz = [...(editingLesson.quiz || [])];
                              quiz[qIdx] = { 
                                ...quiz[qIdx], 
                                type: newType as any,
                                options: updatedOpts,
                                correctKey: newType === 'tf' && (q.correctKey !== 'T' && q.correctKey !== 'F') ? 'T' : q.correctKey
                              };
                              updateEditingLessonField('quiz', quiz);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-250 focus:outline-none"
                          >
                            <option value="tf">{lang === 'ar' ? 'صح أم خطأ (T/F)' : 'True / False (T/F)'}</option>
                            <option value="mcq">{lang === 'ar' ? 'اختيار من متعدد (MCQ)' : 'Multiple Choice (MCQ)'}</option>
                            <option value="fill">{lang === 'ar' ? 'كتابة الإجابة / أكمل الفراغ' : 'Fill in the Blank'}</option>
                          </select>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="text-right">
                        <label className="block text-[10px] font-black text-slate-400 mb-1">
                          {lang === 'ar' ? 'نص السؤال:' : 'Question Text:'}
                        </label>
                        <input
                          type="text"
                          value={q.textAr || ''}
                          onChange={(e) => updateQuizQuestion(qIdx, 'textAr', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Optional diagram linked to this lesson quiz question */}
                      <div className="text-right">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'اسم ملف أو رابط رسم السؤال (اختياري):' : 'Question diagram file or URL (optional):'}
                          </label>
                          {editingLesson.diagramFile && !q.questionImage && (
                            <button
                              type="button"
                              onClick={() => updateQuizQuestion(qIdx, 'questionImage', editingLesson.diagramFile)}
                              className="rounded-app-btn bg-sky-50 px-2.5 py-1 text-[9px] font-black text-sky-600 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400"
                            >
                              {lang === 'ar' ? 'استخدام رسم الدرس' : 'Use lesson diagram'}
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder={editingLesson.diagramFile || (lang === 'ar' ? 'مثال: q-u1-l1.webp' : 'e.g. q-u1-l1.webp')}
                          value={q.questionImage || ''}
                          onChange={(e) => updateQuizQuestion(qIdx, 'questionImage', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <span className="mt-1 block text-[9px] font-semibold text-slate-400">
                          {lang === 'ar'
                            ? 'يمكن كتابة اسم ملف داخل مجلد الدرس أو لصق رابط صورة مباشر.'
                            : 'Enter a filename from the lesson folder or paste a direct image URL.'}
                        </span>
                      </div>

                      {/* Options / Answer Input based on Type */}
                      {q.type === 'tf' ? (
                        <div className="space-y-2 text-right">
                          <span className="text-[10px] font-black text-slate-400 block">{lang === 'ar' ? 'التحقق من صحة العبارة:' : 'True/False Verification:'}</span>
                          <div className="grid grid-cols-2 gap-3">
                            {['T', 'F'].map((keyChar, optIdx) => {
                              const labelText = optIdx === 0 ? (lang === 'ar' ? '✔️ صح' : '✔️ True') : (lang === 'ar' ? '❌ خطأ' : '❌ False');
                              return (
                                <div key={optIdx} className="bg-white dark:bg-slate-900 p-3 rounded-app-card border border-slate-150 dark:border-slate-800 flex items-center justify-between">
                                  <label className="flex items-center gap-2 cursor-pointer w-full">
                                    <input
                                      type="radio"
                                      name={`correct-${qIdx}`}
                                      checked={q.correctKey === keyChar || (keyChar === 'T' && q.correctKey === 'A') || (keyChar === 'F' && q.correctKey === 'B')}
                                      onChange={() => updateQuizQuestion(qIdx, 'correctKey', keyChar)}
                                      className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-black text-slate-800 dark:text-white">
                                      {labelText}
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (q.type === 'fill' || q.type === 'fill_blank') ? (
                        <div className="text-right space-y-1">
                          <label className="block text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'الإجابات الصحيحة المقبولة (افصل بينها بفاصلة لعدة خيارات مرادفة):' : 'Acceptable Correct Answers (comma-separated for multiple synonyms):'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'مثال: الأميبا، اميبا' : 'e.g. Amoeba, amoeba'}
                            value={q.correctAnswers?.join(', ') || q.correctKey || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const arr = val.split(/[،,]/).map(s => s.trim()).filter(Boolean);
                              const quiz = [...(editingLesson.quiz || [])];
                              quiz[qIdx] = {
                                ...quiz[qIdx],
                                correctAnswers: arr,
                                correctKey: arr[0] || ''
                              };
                              updateEditingLessonField('quiz', quiz);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      ) : (
                        // Default Multiple Choice (MCQ) - 4 Options
                        <div className="space-y-2 text-right">
                          <span className="text-[10px] font-black text-slate-400 block">{lang === 'ar' ? 'خيارات الإجابة المتعددة:' : 'Multiple Choice Options:'}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[0, 1, 2, 3].map((optIdx) => {
                              const keys = ['A', 'B', 'C', 'D'];
                              const keyChar = keys[optIdx];
                              return (
                                <div key={optIdx} className="bg-white dark:bg-slate-900 p-3 rounded-app-card border border-slate-150 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`correct-${qIdx}`}
                                        checked={q.correctKey === keyChar}
                                        onChange={() => updateQuizQuestion(qIdx, 'correctKey', keyChar)}
                                        className="w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500"
                                      />
                                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                        {lang === 'ar' ? `الخيار الصحيح ${keyChar}` : `Correct Option ${keyChar}`}
                                      </span>
                                    </label>
                                    <span className="text-[10px] font-black text-slate-400 font-sans">#{optIdx + 1}</span>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder={lang === 'ar' ? 'اكتب الخيار هنا' : 'Enter option here'}
                                    value={q.options?.[optIdx]?.textAr || ''}
                                    onChange={(e) => updateQuizOption(qIdx, optIdx, e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-app-btn px-3 py-1.5 text-xs font-bold focus:outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      <div className="text-right">
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'تفسير وشرح الحل:' : 'Explanation:'}</label>
                        <textarea
                          value={q.explanationAr || ''}
                          onChange={(e) => updateQuizQuestion(qIdx, 'explanationAr', e.target.value)}
                          rows={2}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editor Sub-Tab: Ministry Quiz Editor */}
          {editorSubTab === 'ministry-quiz' && (
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => addMinistryQuestion()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3.5 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1 cursor-pointer border-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة سؤال وزاري' : 'Add Ministry Question'}</span>
                </button>
                <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {lang === 'ar' ? 'تحرير الأسئلة والامتحانات الوزارية' : 'Lesson Ministry Exams Editor'}
                </h4>
              </div>

              {(!editingLesson.ministryExams || editingLesson.ministryExams.length === 0) ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs">
                  {lang === 'ar' ? 'لا توجد أسئلة وزارية مضافة لهذا الدرس.' : 'No ministry questions added.'}
                </div>
              ) : (
                <div className="space-y-6 max-h-[550px] overflow-y-auto pr-1">
                  {editingLesson.ministryExams.map((q, qIdx) => (
                    <div
                      key={`ministry-${q.id}-${qIdx}`}
                      ref={recentlyAddedItem === `ministry:${q.id}` ? recentlyAddedItemRef : undefined}
                      className={`bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border space-y-4 relative transition-all ${
                        recentlyAddedItem === `ministry:${q.id}`
                          ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-lg'
                          : 'border-slate-150 dark:border-slate-800/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => deleteMinistryQuestion(qIdx)}
                        className="absolute left-4 top-4 text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title={lang === 'ar' ? 'حذف السؤال' : 'Delete Question'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Question Type Selection & Question Index */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {lang === 'ar' ? `السؤال الوزاري رقم ${qIdx + 1}` : `Ministry Question #${qIdx + 1}`}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">ID: {q.id}</span>
                          <button
                            type="button"
                            onClick={() => addMinistryQuestion(qIdx)}
                            className="inline-flex items-center gap-1 rounded-app-btn px-2 py-1 text-[9px] font-black text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/30"
                          >
                            <PlusCircle className="h-3 w-3" />
                            {lang === 'ar' ? 'إضافة بعده' : 'Add after'}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'نوع السؤال:' : 'Question Type:'}
                          </label>
                          <select
                            value={q.type || 'mcq'}
                            onChange={(e) => {
                              const newType = e.target.value;
                              let updatedOpts = q.options;
                              if (newType === 'tf') {
                                updatedOpts = [
                                  { key: 'T', textAr: '✔️ صح', textEn: '✔️ صح' },
                                  { key: 'F', textAr: '❌ خطأ', textEn: '❌ خطأ' }
                                ];
                              } else if (newType === 'mcq') {
                                const isComingFromTF = q.type === 'tf';
                                updatedOpts = [
                                  { key: 'A', textAr: isComingFromTF ? '' : (q.options?.[0]?.textAr || ''), textEn: isComingFromTF ? '' : (q.options?.[0]?.textEn || '') },
                                  { key: 'B', textAr: isComingFromTF ? '' : (q.options?.[1]?.textAr || ''), textEn: isComingFromTF ? '' : (q.options?.[1]?.textEn || '') },
                                  { key: 'C', textAr: q.options?.[2]?.textAr || '', textEn: q.options?.[2]?.textEn || '' },
                                  { key: 'D', textAr: q.options?.[3]?.textAr || '', textEn: q.options?.[3]?.textEn || '' }
                                ];
                              }
                              
                              const ministryExams = [...(editingLesson.ministryExams || [])];
                              ministryExams[qIdx] = { 
                                ...ministryExams[qIdx], 
                                type: newType as any,
                                options: updatedOpts,
                                correctKey: newType === 'tf' && (q.correctKey !== 'T' && q.correctKey !== 'F') ? 'T' : q.correctKey
                              };
                              updateEditingLessonField('ministryExams', ministryExams);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-250 focus:outline-none"
                          >
                            <option value="tf">{lang === 'ar' ? 'صح أم خطأ (T/F)' : 'True / False (T/F)'}</option>
                            <option value="mcq">{lang === 'ar' ? 'اختيار من متعدد (MCQ)' : 'Multiple Choice (MCQ)'}</option>
                            <option value="fill">{lang === 'ar' ? 'كتابة الإجابة / أكمل الفراغ' : 'Fill in the Blank'}</option>
                            <option value="unspecified">{lang === 'ar' ? 'سؤال مفتوح / غير محدد' : 'Open-ended / Unspecified'}</option>
                          </select>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="text-right">
                        <label className="block text-[10px] font-black text-slate-400 mb-1">
                          {lang === 'ar' ? 'نص السؤال الوزاري:' : 'Question Text:'}
                        </label>
                        <input
                          type="text"
                          value={q.textAr || ''}
                          onChange={(e) => updateMinistryQuestion(qIdx, 'textAr', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Question Image & Exam Year (Side-by-Side) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1">
                            {lang === 'ar' ? 'اسم ملف الرسم التوضيحي للسؤال (اختياري - H):' : 'Question Image File (Optional - H):'}
                          </label>
                          <input
                            type="text"
                            placeholder={editingLesson.diagramFile ? `مثال: q-${editingLesson.diagramFile}` : "e.g. q-u1-l1.webp"}
                            value={q.questionImage || ''}
                            onChange={(e) => updateMinistryQuestion(qIdx, 'questionImage', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                          {editingLesson.diagramFile && !q.questionImage && (
                            <span className="text-[9px] font-semibold text-slate-400 mt-1 block">
                              {lang === 'ar' ? `💡 الاسم المقترح: q-${editingLesson.diagramFile}` : `💡 Suggested name: q-${editingLesson.diagramFile}`}
                            </span>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 mb-1">
                            {lang === 'ar' ? 'سنة الامتحان الوزاري (اختياري - E):' : 'Exam Year (Optional - E):'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? "مثال: 2024" : "e.g. 2024"}
                            value={q.examYear || ''}
                            onChange={(e) => updateMinistryQuestion(qIdx, 'examYear', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Options / Answer Input based on Type */}
                      {q.type === 'tf' ? (
                        <div className="space-y-2 text-right">
                          <span className="text-[10px] font-black text-slate-400 block">{lang === 'ar' ? 'التحقق من صحة العبارة:' : 'True/False Verification:'}</span>
                          <div className="grid grid-cols-2 gap-3">
                            {['T', 'F'].map((keyChar, optIdx) => {
                              const labelText = optIdx === 0 ? (lang === 'ar' ? '✔️ صح' : '✔️ True') : (lang === 'ar' ? '❌ خطأ' : '❌ False');
                              return (
                                <div key={optIdx} className="bg-white dark:bg-slate-900 p-3 rounded-app-card border border-slate-150 dark:border-slate-800 flex items-center justify-between">
                                  <label className="flex items-center gap-2 cursor-pointer w-full">
                                    <input
                                      type="radio"
                                      name={`correct-ministry-${qIdx}`}
                                      checked={q.correctKey === keyChar || (keyChar === 'T' && q.correctKey === 'A') || (keyChar === 'F' && q.correctKey === 'B')}
                                      onChange={() => updateMinistryQuestion(qIdx, 'correctKey', keyChar)}
                                      className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-black text-slate-800 dark:text-white">
                                      {labelText}
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (q.type === 'fill' || q.type === 'fill_blank') ? (
                        <div className="text-right space-y-1">
                          <label className="block text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'الإجابات الصحيحة المقبولة (افصل بينها بفاصلة لعدة خيارات مرادفة):' : 'Acceptable Correct Answers (comma-separated for multiple synonyms):'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'مثال: الأميبا، اميبا' : 'e.g. Amoeba, amoeba'}
                            value={q.correctAnswers?.join(', ') || q.correctKey || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const arr = val.split(/[،,]/).map(s => s.trim()).filter(Boolean);
                              const ministryExams = [...(editingLesson.ministryExams || [])];
                              ministryExams[qIdx] = {
                                ...ministryExams[qIdx],
                                correctAnswers: arr,
                                correctKey: arr[0] || ''
                              };
                              updateEditingLessonField('ministryExams', ministryExams);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      ) : (q.type as any) === 'unspecified' ? (
                        <div className="text-right space-y-1">
                          <label className="block text-[10px] font-black text-slate-400">
                            {lang === 'ar' ? 'الإجابة النموذجية الصحيحة (ستظهر للطالب بعد تسليم الاختبار):' : 'Model Correct Answer (will appear to student after exam submission):'}
                          </label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'اكتب الإجابة النموذجية هنا...' : 'Enter model correct answer here...'}
                            value={q.correctKey || ''}
                            onChange={(e) => updateMinistryQuestion(qIdx, 'correctKey', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      ) : (
                        // Default Multiple Choice (MCQ) - 4 Options
                        <div className="space-y-2 text-right">
                          <span className="text-[10px] font-black text-slate-400 block">{lang === 'ar' ? 'خيارات الإجابة المتعددة:' : 'Multiple Choice Options:'}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[0, 1, 2, 3].map((optIdx) => {
                              const keys = ['A', 'B', 'C', 'D'];
                              const keyChar = keys[optIdx];
                              return (
                                <div key={optIdx} className="bg-white dark:bg-slate-900 p-3 rounded-app-card border border-slate-150 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`correct-ministry-${qIdx}`}
                                        checked={q.correctKey === keyChar}
                                        onChange={() => updateMinistryQuestion(qIdx, 'correctKey', keyChar)}
                                        className="w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500"
                                      />
                                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                        {lang === 'ar' ? `الخيار الصحيح ${keyChar}` : `Correct Option ${keyChar}`}
                                      </span>
                                    </label>
                                    <span className="text-[10px] font-black text-slate-400 font-sans">#{optIdx + 1}</span>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder={lang === 'ar' ? 'اكتب الخيار هنا' : 'Enter option here'}
                                    value={q.options?.[optIdx]?.textAr || ''}
                                    onChange={(e) => updateMinistryOption(qIdx, optIdx, e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-app-btn px-3 py-1.5 text-xs font-bold focus:outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      <div className="text-right">
                        <label className="block text-[10px] font-black text-slate-400 mb-1">{lang === 'ar' ? 'تفسير وشرح الحل الوزاري:' : 'Explanation:'}</label>
                        <textarea
                          value={q.explanationAr || ''}
                          onChange={(e) => updateMinistryQuestion(qIdx, 'explanationAr', e.target.value)}
                          rows={2}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editor Sub-Tab: Files / Locks */}
          {editorSubTab === 'files' && (
            <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4 text-right">
              <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400 border-b border-slate-50 dark:border-slate-800 pb-2">
                {lang === 'ar' ? 'حالة وحماية ملفات المنهج' : 'Curriculum Files & Security'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'pdfLocked', labelAr: 'حماية ملف PDF', labelEn: 'Protect PDF' },
                  { key: 'mindmapLocked', labelAr: 'قفل الخارطة الذهنية', labelEn: 'Lock Mindmap' },
                  { key: 'diagramLocked', labelAr: 'قفل الرسم التوضيحي', labelEn: 'Lock Diagram' },
                  { key: 'quizLocked', labelAr: 'قفل الكويز التفاعلي', labelEn: 'Lock Quiz' },
                  { key: 'ministryExamLocked', labelAr: 'قفل الامتحانات الوزارية', labelEn: 'Lock Ministry Exam' },
                ].map((item) => {
                  const isLocked = !!(editingLesson as any)[item.key];
                  return (
                    <div key={item.key} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-app-card border border-slate-150 dark:border-slate-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => updateEditingLessonField(item.key as any, !isLocked)}
                        aria-pressed={isLocked}
                        aria-label={lang === 'ar'
                          ? `${isLocked ? 'فتح' : 'حماية'} ${item.labelAr}`
                          : `${isLocked ? 'Unlock' : 'Protect'} ${item.labelEn}`}
                        title={lang === 'ar'
                          ? `${isLocked ? 'اجعلها مجانية' : 'اجعلها للمشتركين فقط'}`
                          : `${isLocked ? 'Make free' : 'Premium only'}`}
                        className={`p-2 rounded-full transition-all active:scale-95 cursor-pointer border-0 ${
                          isLocked 
                            ? 'bg-rose-500/10 text-rose-500' 
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </button>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-800 dark:text-white block">
                          {lang === 'ar' ? item.labelAr : item.labelEn}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                          {isLocked 
                            ? (lang === 'ar' ? '🔒 مغلق (للباقة المدفوعة)' : '🔒 Locked (Premium)')
                            : (lang === 'ar' ? '🔓 مفتوح مجاناً' : '🔓 Open Free')
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 rounded-app-btn border border-sky-100 bg-sky-50/70 p-3 text-[10px] font-bold leading-relaxed text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {lang === 'ar'
                    ? 'جميع ملفات PDF الحالية تبقى مفتوحة. لن يصبح أي ملف للمشتركين إلا عندما تفعّل حمايته هنا ثم تحفظ المسودة وتنشرها.'
                    : 'All current PDFs remain free. A PDF becomes premium only after you enable protection here, save the draft, and publish it.'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* View 3: Interactive Student Preview */}
      {activeTab === 'preview' && editingLesson && (
        <motion.div
          key="preview"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Controller */}
          <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2">
              <Eye className="w-5 h-5 text-emerald-500" />
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                {lang === 'ar' ? 'أداة المعاينة الحية' : 'Live Mockup Preview'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-455 dark:text-slate-400 font-bold leading-relaxed">
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
                      className={`w-7 h-7 rounded-app-btn text-xs font-black font-sans transition-all flex items-center justify-center border ${
                        previewQuizIdx === i
                          ? 'bg-emerald-500 text-white border-transparent shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-655 dark:text-slate-400 border-slate-200 dark:border-slate-800'
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
              <p className="text-[10px] text-slate-455 dark:text-slate-500 font-semibold leading-relaxed">
                {lang === 'ar'
                  ? 'استخدم <sub>2</sub> للأسفل و <sup>2</sup> للأعلى في نصوص الأسئلة لتظهر منسقة كيميائياً وبيولوجياً للطالب.'
                  : 'Use HTML tags like sub and sup in question texts for beautiful molecular and index layouts.'}
              </p>
            </div>
          </div>

          {/* Smartphone mockup */}
          <div className="md:col-span-2 flex justify-center">
            <div className="w-full max-w-[340px] border-[10px] border-slate-900 dark:border-slate-800 rounded-[44px] overflow-hidden bg-[#f7f9fb] dark:bg-slate-950 shadow-2xl relative min-h-[580px] flex flex-col font-sans select-none">
              
              {/* Speaker notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center">
                <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
              </div>

              {/* Statusbar */}
              <div className="h-6 w-full bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 px-6 pt-1 flex items-center justify-between text-[8px] font-black font-sans text-slate-400 z-10 shrink-0">
                <span>06:11 PM</span>
                <span>5G 📶 100% 🔋</span>
              </div>

              {/* simulated phone screen content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-4 pb-12">
                {/* Topic card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full">
                      {editingLesson.folder.split('/')[0] || `الوحدة ${editingLesson.unit}`}
                    </span>
                    <span className="text-[8px] font-extrabold text-slate-450">
                      {editingLesson.id}
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white leading-snug">
                    {editingLesson.folder.split('/')[1] || (lang === 'ar' ? editingLesson.titleAr : editingLesson.titleEn)}
                  </h3>
                </div>

                {/* Quiz card */}
                {editingLesson.quiz.length > 0 && editingLesson.quiz[previewQuizIdx] ? (() => {
                  const curQ = editingLesson.quiz[previewQuizIdx];
                  return (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-3">
                      <div className="flex items-center justify-between text-[8px] font-black text-slate-400">
                        <span>{lang === 'ar' ? `السؤال ${previewQuizIdx + 1} من ${editingLesson.quiz.length}` : `Question ${previewQuizIdx + 1} of ${editingLesson.quiz.length}`}</span>
                        <span className="text-emerald-500 uppercase">{curQ.type}</span>
                      </div>
                      
                      <p 
                        className="text-[11px] font-black text-slate-800 dark:text-white leading-relaxed text-right"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(lang === 'ar' ? curQ.textAr : curQ.textEn, {
                            ALLOWED_TAGS: ['b', 'strong', 'em', 'i', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div'],
                            ALLOWED_ATTR: ['class', 'dir']
                          })
                        }}
                      />

                      {/* Options for MCQ / TF */}
                      {curQ.options && (
                        <div className="space-y-2 pt-1">
                          {curQ.options.map((opt) => {
                            const isSelected = previewSelectedAns === opt.key;
                            const isCorrectOption = curQ.correctKey === opt.key;
                            
                            let btnClass = "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40";
                            if (previewShowExpl) {
                              if (isCorrectOption) {
                                btnClass = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-305";
                              } else if (isSelected) {
                                btnClass = "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-305";
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
                                className={`w-full flex items-center gap-2.5 px-3 py-2 border rounded-app-btn text-[10px] font-extrabold transition-all text-right ${btnClass}`}
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

                      {/* Input for Fill Blank */}
                      {(curQ.type === 'fill' || curQ.type === 'fill_blank') && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            disabled={previewShowExpl}
                            placeholder={lang === 'ar' ? 'اكتب إجابتك هنا...' : 'Type response here...'}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-[10px] font-bold text-center focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setPreviewSelectedAns('done');
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* check response buttons */}
                      {!previewShowExpl ? (
                        <button
                          onClick={() => {
                            if (!previewSelectedAns) return;
                            setPreviewShowExpl(true);
                          }}
                          disabled={!previewSelectedAns}
                          className={`w-full font-black text-[10px] py-2 rounded-app-btn active:scale-95 transition-all text-center ${
                            previewSelectedAns
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {lang === 'ar' ? 'التحقق من الإجابة' : 'Submit Answer'}
                        </button>
                      ) : (
                        <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500">
                            <Check className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'التفسير العلمي:' : 'Scientific Explanation:'}</span>
                          </div>
                          <p 
                            className="text-[9px] text-slate-500 dark:text-slate-450 font-bold leading-relaxed text-right"
                            dangerouslySetInnerHTML={{ 
                              __html: DOMPurify.sanitize(lang === 'ar' ? curQ.explanationAr : curQ.explanationEn, {
                                ALLOWED_TAGS: ['b', 'strong', 'em', 'i', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div'],
                                ALLOWED_ATTR: ['class', 'dir']
                              })
                            }}
                          />
                          <button
                            onClick={() => {
                              setPreviewSelectedAns(null);
                              setPreviewShowExpl(false);
                            }}
                            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 font-black text-[9px] py-1.5 rounded-app-btn text-center"
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

              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-400 dark:bg-slate-850 rounded-full z-50"></div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
