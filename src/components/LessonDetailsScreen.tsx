/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  BookOpen, 
  Compass, 
  PenTool, 
  User, 
  Bookmark,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Award,
  CircleDot,
  FileText,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  RotateCw,
  Trophy,
  HelpCircle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Play
} from 'lucide-react';

import { ScreenId, Lesson, ConfigQuestion } from '../types';
import { translations, Language } from '../utils/translations';
import { markVisited } from '../utils/progress';
import { VirtualizedList } from './VirtualizedList';
import { MindMapVisualizer } from './MindMapVisualizer';
import { InteractiveDiagramVisualizer } from './InteractiveDiagramVisualizer';
import { SecureStorage } from '../utils/security';
import { isAssetCached, cacheAsset, getCachedAssetUrl } from '../utils/cacheManager';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';

interface LockedOverlayProps {
  messageAr: string;
  messageEn: string;
  onUnlockClick: () => void;
}

export function LockedOverlay({ messageAr, messageEn, onUnlockClick }: LockedOverlayProps) {
  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fadeIn rounded-3xl">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-3xl flex items-center justify-center text-red-500 mb-4 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <h3 className="text-white font-black text-sm mb-2">
        {messageAr}
      </h3>
      <p className="text-slate-300 text-xs font-semibold max-w-sm mb-4 leading-relaxed">
        {messageEn}
      </p>
      <button
        onClick={onUnlockClick}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
      >
        تفعيل النسخة الكاملة الآن 🔑
      </button>
    </div>
  );
}

interface SubjectiveQuestionItemProps {
  q: any;
  lang: Language;
  addQuestionToErrors: (q: any) => void;
}

function SubjectiveQuestionItem({ q, lang, addQuestionToErrors }: SubjectiveQuestionItemProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start gap-2">
        <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 rounded-md shrink-0">
          {q.category}
        </span>
      </div>
      <p className="text-xs font-black text-slate-800 dark:text-white leading-relaxed">
        {lang === 'ar' ? q.textAr : q.textEn}
      </p>
      
      {expanded && (
        <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950 p-4 rounded-xl text-right animate-fadeIn">
          <span className="text-[10px] font-black text-emerald-500 block mb-1">
            {lang === 'ar' ? 'الإجابة النموذجية المعتمدة:' : 'Model Textbook Answer:'}
          </span>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-350 leading-relaxed">
            {lang === 'ar' ? q.explanationAr : q.explanationEn}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center pt-1 border-t border-slate-50 dark:border-slate-850">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-extrabold text-emerald-500 hover:text-emerald-600 flex items-center gap-1 active:scale-95 cursor-pointer bg-transparent border-0"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{expanded ? (lang === 'ar' ? 'إخفاء الإجابة' : 'Hide Answer') : (lang === 'ar' ? 'عرض الإجابة النموذجية' : 'Show Answer')}</span>
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              addQuestionToErrors(q);
              alert(lang === 'ar' ? 'تم إضافة السؤال إلى صندوق الأخطاء للمراجعة لاحقاً.' : 'Added to Error Box for retry later.');
            }}
            className="text-[10px] font-black text-amber-500 hover:text-amber-600 border border-amber-200 dark:border-amber-900 bg-amber-500/5 px-2.5 py-1 rounded-md active:scale-95 transition-all cursor-pointer"
          >
            {lang === 'ar' ? 'أحتاج لمراجعته ⚠️' : 'Need review ⚠️'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Flashcard3DProps {
  card: { qAr: string; qEn: string; aAr: string; aEn: string };
  lang: Language;
}

function Flashcard3D({ card, lang }: Flashcard3DProps) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div 
      onClick={() => setFlipped(!flipped)}
      className="w-full h-64 perspective-1000 cursor-pointer select-none group"
    >
      <div className={`relative w-full h-full duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
        {/* Front */}
        <div className="absolute inset-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-md backface-hidden">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">
              {lang === 'ar' ? 'بطاقة مراجعة - سؤال' : 'Flashcard - Question'}
            </span>
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          </div>
          <div className="text-center py-2 flex-1 flex flex-col justify-center items-center">
            <h4 className="text-base md:text-lg font-black text-slate-900 dark:text-white leading-relaxed">
              {card.qAr}
            </h4>
            {card.qEn && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                {card.qEn}
              </p>
            )}
          </div>
          <div className="text-[10px] text-slate-400 text-center font-bold">
            {lang === 'ar' ? 'اضغط لقلب البطاقة ورؤية الإجابة 🔄' : 'Click to flip and reveal answer 🔄'}
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-150 dark:border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-md backface-hidden rotate-y-180">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              {lang === 'ar' ? 'الإجابة النموذجية' : 'Model Answer'}
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-center py-2 flex-1 flex flex-col justify-center items-center">
            <h4 className="text-sm md:text-base font-extrabold text-slate-850 dark:text-white leading-relaxed">
              {card.aAr}
            </h4>
            {card.aEn && (
              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold mt-1">
                {card.aEn}
              </p>
            )}
          </div>
          <div className="text-[10px] text-emerald-500 text-center font-bold">
            {lang === 'ar' ? 'اضغط للعودة للسؤال 🔄' : 'Click to flip back 🔄'}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LessonDetailsScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lesson: Lesson | null;
  lessons?: Lesson[];
  onSelectLesson?: (lesson: Lesson) => void;
}

export default function LessonDetailsScreen({ onNavigate, lang, lesson, lessons = [], onSelectLesson }: LessonDetailsScreenProps) {
  const [activeTab, setActiveTab] = useState<'explore' | 'review' | 'test'>('explore');
  const [exploreSubTab, setExploreSubTab] = useState<'mindmap' | 'diagrams' | 'pdf'>('mindmap');
  const [bookmarked, setBookmarked] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState(false);

  // Offline caching states
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // PDF decryption state
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Quiz states
  const [quizMode, setQuizMode] = useState<'select' | 'quiz' | 'ministry' | 'subjective' | 'errors'>('select');
  const [activeQuestions, setActiveQuestions] = useState<ConfigQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillInput, setFillInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<Set<number>>(new Set());
  const [showHintMsg, setShowHintMsg] = useState(false);
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Error bank state
  const [errorQuestions, setErrorQuestions] = useState<ConfigQuestion[]>([]);



  // Flashcards carousel state
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);

  // AI Tutor States
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<Array<{ role: 'user' | 'model', content: string }>>([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Initialize tutor chat when lesson changes or when tutor drawer is first opened
  useEffect(() => {
    if (lesson && isTutorOpen && tutorMessages.length === 0) {
      setTutorMessages([
        {
          role: 'model',
          content: `أهلاً بك يا بطل! أنا مساعد الأحياء الذكي الخاص بك 🤖. أنا مستعد لمساعدتك في استيعاب درس **"${lesson.titleAr}"**. ما الذي يصعب عليك فهمه أو ترغب في الاستفسار عنه؟`
        }
      ]);
    }
  }, [lesson?.id, isTutorOpen, tutorMessages.length]);

  // Scroll chat to bottom
  useEffect(() => {
    if (isTutorOpen) {
      setTimeout(() => {
        const anchor = document.getElementById('tutor-bottom-anchor');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth' });
        }
      }, 80);
    }
  }, [tutorMessages.length, tutorLoading, isTutorOpen]);

  const handleSendTutorMessage = async (customText?: string) => {
    const textToSend = customText || tutorInput.trim();
    if (!textToSend || tutorLoading) return;

    const newMessages: Array<{ role: 'user' | 'model', content: string }> = [
      ...tutorMessages,
      { role: 'user' as const, content: textToSend }
    ];
    setTutorMessages(newMessages);
    setTutorInput('');
    setTutorLoading(true);
    setTutorError(null);

    try {
      const storedKey = localStorage.getItem('gemini_api_key') || '';
      
      const serverUrl = (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const response = await fetch(`${serverUrl}/api/tutor-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': storedKey
        },
        body: JSON.stringify({
          messages: newMessages,
          lessonTitle: lesson?.titleAr,
          lessonSummary: lesson?.summaryPointsAr
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTutorMessages(prev => [...prev, { role: 'model', content: data.reply }]);
      } else {
        setTutorError(data.error || t.aiTutorError || 'حدث خطأ أثناء الاتصال بالمعلم الافتراضي.');
      }
    } catch (e: any) {
      setTutorError(lang === 'ar' 
        ? `⚠️ فشل الاتصال بالخادم (${serverUrl || 'المحلي'}): ${e.message || 'يرجى التأكد من تشغيل السيرفر وعنوانه.'}` 
        : `⚠️ Connection failed to (${serverUrl || 'local'}): ${e.message || 'Please check your connection and server URL.'}`
      );
    } finally {
      setTutorLoading(false);
    }
  };

  // Automatically switch activeTab to the first available tab when lesson changes
  useEffect(() => {
    if (lesson) {
      const tabs = [
        { id: 'explore', show: !!(lesson.mindmap?.length || lesson.mindmapFile || lesson.interactiveDiagrams?.length || lesson.diagramFile || lesson.pdfFile) },
        { id: 'review', show: !!(lesson.summaryPointsAr?.length || lesson.flashcards?.length) },
        { id: 'test', show: !!(lesson.quiz?.length || lesson.quizFile || lesson.ministryExamFile) }
      ].filter(t => t.show);
      
      if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
        setActiveTab(tabs[0].id as any);
      }
    }
  }, [lesson?.id]);

  const t = translations[lang];
  const lessonFolderTitle = lesson ? (lesson.folder.split('/')[1] || (lang === 'ar' ? lesson.titleAr : lesson.titleEn)) : '';

  const getAssetUrl = (file: string) => {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('//')) {
      return file;
    }
    const folderPath = lesson ? lesson.folder : '';
    if (folderPath === '.' || folderPath === '/' || !folderPath) {
      return `/${file}`;
    }
    return `/${folderPath}/${file}`;
  };

  // Check caching status
  const checkIfDownloaded = async () => {
    if (!lesson) return;
    try {
      let cached = true;
      if (lesson.pdfFile) {
        const ok = await isAssetCached(lesson.id, lesson.pdfFile);
        if (!ok) cached = false;
      }
      if (lesson.diagramFile) {
        const ok = await isAssetCached(lesson.id, lesson.diagramFile);
        if (!ok) cached = false;
      }
      if (lesson.mindmapFile) {
        const ok = await isAssetCached(lesson.id, lesson.mindmapFile);
        if (!ok) cached = false;
      }
      setIsDownloaded(cached);
    } catch {
      setIsDownloaded(false);
    }
  };

  // Load errors and check cache on lesson change
  useEffect(() => {
    if (lesson) {
      markVisited(lesson.id);
      setMapLoading(true);
      setMapError(false);
      checkIfDownloaded();
      
      const savedErrors = SecureStorage.getItem(`lesson_errors_${lesson.id}`) || [];
      setErrorQuestions(savedErrors);

      // Reset quiz and states
      setQuizMode('select');
      setQuizFinished(false);
      setCurrentQuestionIndex(0);
      setScore(0);
      setTimerActive(false);
      setTimeLeft(600);
      setHintsUsed(new Set());
      setShowHintMsg(false);
      setSelectedOption(null);
      setFillInput('');
      setShowFeedback(false);
      setCurrentFlashcardIndex(0);
    }
  }, [lesson?.id]);

  // Quiz Timer implementation
  useEffect(() => {
    if (timerActive && timeLeft > 0 && !quizFinished) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !quizFinished) {
      handleQuizFinish();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timerActive, timeLeft, quizFinished]);

  const handleDownloadOffline = async () => {
    if (!lesson) return;
    setDownloading(true);
    try {
      if (lesson.pdfFile) {
        await cacheAsset(lesson.id, lesson.pdfFile, getAssetUrl(lesson.pdfFile));
      }
      if (lesson.diagramFile) {
        await cacheAsset(lesson.id, lesson.diagramFile, getAssetUrl(lesson.diagramFile));
      }
      if (lesson.mindmapFile) {
        await cacheAsset(lesson.id, lesson.mindmapFile, getAssetUrl(lesson.mindmapFile));
      }
      setIsDownloaded(true);
      alert(lang === 'ar' ? 'تم تنزيل وتأمين ملفات الدرس بنجاح للعمل أوفلاين! 🛡️' : 'Lesson files downloaded and secured successfully for offline use! 🛡️');
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'تعذر تحميل بعض الملفات للتخزين المحلي.' : 'Failed to download some files for local cache.');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewPdf = async () => {
    if (!lesson || !lesson.pdfFile) return;
    if (lesson.pdfLocked) {
      alert(lang === 'ar' ? 'عذراً، هذه المذكرة مغلقة من قبل المعلم.' : 'Sorry, this lecture note is locked by the teacher.');
      onNavigate('student-profile', 'push');
      return;
    }
    setLoadingPdf(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://your-production-app.railway.app').replace(/\/$/, '');
        const folderPath = lesson.folder || '';
        const absolutePdfUrl = `${serverUrl}/${folderPath}/${lesson.pdfFile}`;
        window.open(absolutePdfUrl, '_system');
      } else {
        const fallbackUrl = getAssetUrl(lesson.pdfFile);
        const url = await getCachedAssetUrl(lesson.id, lesson.pdfFile, fallbackUrl);
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'فشل فك تشفير مذكرة الـ PDF في الذاكرة.' : 'Failed to decrypt PDF notes in memory.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Clean Arabic for quiz filling validation
  const cleanArabic = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ');
  };

  const validateFillAnswer = (input: string, correctAnswers: string[]) => {
    const cleanInput = cleanArabic(input);
    return correctAnswers.some(ans => cleanArabic(ans) === cleanInput);
  };

  // Start quiz logic
  const startQuiz = (type: 'quiz' | 'ministry' | 'errors') => {
    if (!lesson) return;
    let questionsList: ConfigQuestion[] = [];
    const isInteractive = (q: ConfigQuestion) => 
      q.type === 'mcq' || q.type === 'tf' || q.type === 'fill' || q.type === 'fill_blank';

    if (type === 'quiz') {
      questionsList = (lesson.quiz || []).filter(isInteractive);
    } else if (type === 'ministry') {
      questionsList = (lesson.ministryExams || []).filter(isInteractive);
    } else if (type === 'errors') {
      questionsList = errorQuestions.filter(isInteractive);
    }

    if (questionsList.length === 0) {
      alert(lang === 'ar' ? 'لا توجد أسئلة متوفرة حالياً في هذا القسم.' : 'No questions available in this section.');
      return;
    }

    setActiveQuestions(questionsList);
    setQuizMode(type);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizFinished(false);
    setTimeLeft(600); // 10 minutes
    setTimerActive(true);
    setHintsUsed(new Set());
    setShowHintMsg(false);
    setSelectedOption(null);
    setFillInput('');
    setShowFeedback(false);
  };

  const handleOptionClick = (key: string) => {
    if (showFeedback) return;
    setSelectedOption(key);
    const currentQ = activeQuestions[currentQuestionIndex];
    const correct = key === currentQ.correctKey;
    setIsAnswerCorrect(correct);
    
    const isHintUsed = hintsUsed.has(currentQ.id);
    if (correct) {
      const earned = isHintUsed ? 0.75 : 1.0;
      setScore((prev) => prev + earned);
      // Remove from errors if solved correctly in Error Box retry mode
      if (quizMode === 'errors') {
        removeQuestionFromErrors(currentQ.id);
      }
    } else {
      // Add to errors if incorrect
      addQuestionToErrors(currentQ);
    }
    setShowFeedback(true);
  };

  const handleFillSubmit = () => {
    if (showFeedback || !fillInput.trim()) return;
    const currentQ = activeQuestions[currentQuestionIndex];
    const correct = validateFillAnswer(fillInput, currentQ.correctAnswers || []);
    setIsAnswerCorrect(correct);
    
    const isHintUsed = hintsUsed.has(currentQ.id);
    if (correct) {
      const earned = isHintUsed ? 0.75 : 1.0;
      setScore((prev) => prev + earned);
      if (quizMode === 'errors') {
        removeQuestionFromErrors(currentQ.id);
      }
    } else {
      addQuestionToErrors(currentQ);
    }
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setFillInput('');
    setShowFeedback(false);
    setShowHintMsg(false);
    
    if (currentQuestionIndex < activeQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleQuizFinish();
    }
  };

  const handleQuizFinish = () => {
    setTimerActive(false);
    setQuizFinished(true);
  };

  // Add/Remove from Errors helper
  const addQuestionToErrors = (q: ConfigQuestion) => {
    if (errorQuestions.some(errQ => errQ.id === q.id)) return;
    const nextErrors = [...errorQuestions, q];
    setErrorQuestions(nextErrors);
    SecureStorage.setItem(`lesson_errors_${lesson.id}`, nextErrors);
  };

  const removeQuestionFromErrors = (qId: number) => {
    const nextErrors = errorQuestions.filter(errQ => errQ.id !== qId);
    setErrorQuestions(nextErrors);
    SecureStorage.setItem(`lesson_errors_${lesson.id}`, nextErrors);
  };

  // format timer output
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;



  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* CSS For 3D Flashcard flip */}
      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('lessons-list', 'push_back')} 
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
          >
            {backIcon}
          </button>
          <h1 className="font-black text-sm md:text-base text-slate-800 dark:text-white transition-opacity duration-200">
            {lang === 'ar' ? 'تفاصيل الدرس' : 'Lesson Details'}
          </h1>
        </div>
        
        {/* DRM / PWA Offline download status button */}
        <div className="flex items-center gap-2">
          {lesson.videoUrl && (
            <button
              onClick={() => onNavigate('lesson-video', 'none')}
              className="p-2 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 active:scale-95 transition-transform"
              title={lang === 'ar' ? 'فيديو الشرح' : 'Lesson Video'}
            >
              <Play className="w-5 h-5 fill-red-500/20" />
            </button>
          )}
          <button 
            onClick={handleDownloadOffline}
            disabled={downloading || isDownloaded}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all border active:scale-95 ${
              isDownloaded 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : downloading 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-450 border-slate-200 dark:border-slate-700 animate-pulse'
                : 'bg-white dark:bg-slate-950 hover:bg-slate-50 text-slate-650 dark:text-slate-350 border-slate-200 dark:border-slate-800'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{lang === 'ar' ? 'جاري التحميل...' : 'Downloading...'}</span>
              </>
            ) : isDownloaded ? (
              <span>{lang === 'ar' ? 'محفوظ أوفلاين ✓' : 'Offline Saved ✓'}</span>
            ) : (
              <>
                <Download className="w-3 h-3" />
                <span>{lang === 'ar' ? 'تنزيل أوفلاين' : 'Save Offline'}</span>
              </>
            )}
          </button>
          
          <button 
            onClick={() => setIsTutorOpen(true)}
            className="active:scale-95 p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 transition-colors"
            title={lang === 'ar' ? 'مساعد الدراسة' : 'Study Assistant'}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </button>
          
          <button 
            onClick={() => setBookmarked(!bookmarked)}
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Bookmark className={`w-5 h-5 transition-colors ${bookmarked ? 'text-emerald-500 fill-emerald-500' : 'text-slate-450'}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={`pt-20 max-w-2xl mx-auto ${
        (activeTab === 'explore' && exploreSubTab === 'mindmap') 
          ? 'px-4 h-[calc(100vh-80px)] pb-0 overflow-hidden' 
          : 'px-6 pb-24 space-y-6'
      }`}>
        
        {/* Lesson Heading Info */}
        {activeTab !== 'explore' && (
          <div className="mt-4">
            <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full mb-2">
              {lang === 'ar' ? 'الوحدة والموضوع المنهجي' : 'Academic Unit Course'}
            </span>
            <h2 className="text-xl font-black text-slate-850 dark:text-white leading-tight">
              {lessonFolderTitle}
            </h2>
          </div>
        )}

        {/* Dynamic Study Tabs based on content availability */}
        <nav className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          {[
            { id: 'explore', labelAr: 'استكشف', labelEn: 'Explore', show: !!(lesson.mindmap?.length || lesson.mindmapFile || lesson.interactiveDiagrams?.length || lesson.diagramFile || lesson.pdfFile) },
            { id: 'review', labelAr: 'البطاقات والملخص', labelEn: 'Review & Cards', show: !!(lesson.summaryPointsAr?.length || lesson.flashcards?.length) },
            { id: 'test', labelAr: 'تحدّى نفسك', labelEn: 'Test', show: !!(lesson.quiz?.length || lesson.quizFile || lesson.ministryExamFile) }
          ].filter(tab => tab.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 text-center py-2 text-xs font-black transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-emerald-500 border-emerald-500 scale-105'
                  : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-350'
              }`}
            >
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </nav>

        {/* TAB CONTENTS */}

        {/* 1. Explore Tab */}
        {activeTab === 'explore' && (
          <div className="flex flex-col h-full animate-fadeIn">
            {/* Explore Sub-Tabs Navigation */}
            <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl gap-1.5 self-center w-full max-w-sm mx-auto mb-4 border border-slate-200/50 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setExploreSubTab('mindmap')}
                className={`flex-1 text-center py-1.5 px-3 text-[11px] font-black rounded-lg transition-all ${
                  exploreSubTab === 'mindmap'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'ar' ? 'الخارطة الذهنية' : 'Mind Map'}
              </button>
              <button
                onClick={() => setExploreSubTab('diagrams')}
                className={`flex-1 text-center py-1.5 px-3 text-[11px] font-black rounded-lg transition-all ${
                  exploreSubTab === 'diagrams'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'ar' ? 'الرسومات التفاعلية' : 'Diagrams'}
              </button>
              <button
                onClick={() => setExploreSubTab('pdf')}
                className={`flex-1 text-center py-1.5 px-3 text-[11px] font-black rounded-lg transition-all ${
                  exploreSubTab === 'pdf'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'ar' ? 'مذكرة الدرس' : 'Notes'}
              </button>
            </div>

            {/* Sub-tab content area */}
            <div className="flex-1 min-h-0 relative">
              {exploreSubTab === 'mindmap' && (lesson.mindmap?.length > 0 || lesson.mindmapFile) && (
                <div className="relative w-full h-[calc(100vh-170px)] bg-white dark:bg-[#0a0e1a] border border-slate-100 dark:border-slate-850 rounded-2xl overflow-y-auto p-4 shadow-sm scrollbar-none">
                  {lesson.mindmapLocked && (
                    <LockedOverlay 
                      messageAr="تم قفل الخارطة الذهنية التفاعلية لهذه الحصة من قبل المعلم"
                      messageEn="This interactive mind map is locked by the teacher."
                      onUnlockClick={() => onNavigate('student-profile', 'push')}
                    />
                  )}
                  {lesson.mindmap && lesson.mindmap.length > 0 ? (
                    <MindMapVisualizer mindmap={lesson.mindmap} lang={lang} />
                  ) : lesson.mindmapFile ? (
                    <>
                      {mapLoading && !mapError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0e1a] z-10">
                          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                          <span className="text-slate-400 text-xs font-bold">
                            {lang === 'ar' ? 'جاري تحميل الخارطة...' : 'Loading mind map...'}
                          </span>
                        </div>
                      )}
                      {mapError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0e1a] z-10 p-6 text-center">
                          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-white font-black text-sm mb-1">
                              {lang === 'ar' ? 'تعذّر تحميل الخارطة هنا' : 'Could not load the map here'}
                            </p>
                            <p className="text-slate-455 text-xs font-semibold">
                              {lang === 'ar' ? 'يمكنك فتحها في نافذة مستقلة' : 'Open it in a separate window'}
                            </p>
                          </div>
                        </div>
                      )}
                      {!mapError && (
                        <iframe
                          key={lesson.mindmapFile}
                          src={getAssetUrl(lesson.mindmapFile)}
                          title="Interactive Mind Map"
                          className="w-full h-full border-0"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
                          onLoad={() => setMapLoading(false)}
                          onError={() => { setMapError(true); setMapLoading(false); }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0e1a] z-10 p-6 text-center animate-fadeIn">
                      <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                        <BookOpen className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-white font-black text-sm mb-1">
                          {lang === 'ar' ? 'لا توجد خارطة ذهنية مضافة' : 'No Mind Map Added'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {exploreSubTab === 'diagrams' && (
                <div className="relative w-full animate-fadeIn">
                  {lesson.diagramLocked && (
                    <LockedOverlay 
                      messageAr="تم قفل الرسومات التفاعلية لهذه الحصة من قبل المعلم"
                      messageEn="These interactive diagrams are locked by the teacher."
                      onUnlockClick={() => onNavigate('student-profile', 'push')}
                    />
                  )}
                  <InteractiveDiagramVisualizer
                    diagrams={
                      lesson.interactiveDiagrams && lesson.interactiveDiagrams.length > 0
                        ? lesson.interactiveDiagrams
                        : lesson.diagramFile
                        ? [{ imageFile: lesson.diagramFile, titleAr: lang === 'ar' ? 'الرسم التوضيحي المنهجي' : 'Standard Lesson Diagram', hotspots: [] }]
                        : []
                    }
                    lang={lang}
                    lessonFolder={lesson.folder}
                  />
                </div>
              )}

              {exploreSubTab === 'pdf' && lesson.pdfFile && (
                <section className="bg-gradient-to-tr from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900 p-6 rounded-[28px] shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="p-2 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-xs">
                        PDF
                      </span>
                      <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                        <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-xs">
                          {lang === 'ar' ? `مذكرة الدرس الأكاديمية` : `Academic Lecture Notes`}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                          {lesson.pdfLocked 
                            ? (lang === 'ar' ? 'تطلب تفعيل الحساب لفتح الملف 🔒' : 'Requires account activation 🔒')
                            : (lang === 'ar' ? 'تفتح مباشرة في الذاكرة المؤمنة' : 'Decrypted in-memory on the fly')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleViewPdf}
                      disabled={loadingPdf}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      {loadingPdf ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{lang === 'ar' ? 'جاري التحضير...' : 'Decrypting...'}</span>
                        </>
                      ) : lesson.pdfLocked ? (
                        <span>{lang === 'ar' ? 'فتح الملف 🔒' : 'Open File 🔒'}</span>
                      ) : (
                        <span>{lang === 'ar' ? 'عرض المذكرة 👁️' : 'View Notes 👁️'}</span>
                      )}
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* 2. Review Tab */}
        {activeTab === 'review' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Visual Academy Summary */}
            {lesson.summaryPointsAr && lesson.summaryPointsAr.length > 0 && (
              <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-3">
                  <span className="p-2 bg-purple-50 dark:bg-purple-950 rounded-xl text-purple-600 shrink-0">
                    <Award className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-slate-850 dark:text-white text-[15px]">
                    {lang === 'ar' ? 'خلاصة الأفكار والنقاط الأساسية للدرس' : 'Key Lecture Summary Points'}
                  </h3>
                </div>
                
                <ul className="space-y-3">
                  {(lang === 'ar' ? lesson.summaryPointsAr : lesson.summaryPointsEn).map((point, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs text-slate-850 dark:text-slate-200 leading-relaxed">
                      <CircleDot className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 3D Flip Flashcards Carousel */}
            {lesson.flashcards && lesson.flashcards.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-black text-slate-850 dark:text-white text-sm">
                    {lang === 'ar' ? 'بطاقات التذكر التفاعلية ثلاثية الأبعاد' : 'Interactive 3D Flip Cards'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-black">
                    {currentFlashcardIndex + 1} / {lesson.flashcards.length}
                  </span>
                </div>

                <Flashcard3D 
                  card={lesson.flashcards[currentFlashcardIndex]} 
                  lang={lang} 
                />

                <div className="flex justify-between items-center gap-4 px-4 pt-2">
                  <button
                    onClick={() => setCurrentFlashcardIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentFlashcardIndex === 0}
                    className="flex items-center gap-1 text-xs font-black text-slate-700 dark:text-slate-300 disabled:opacity-30 active:scale-90 transition-transform"
                  >
                    <ChevronRight className={`w-5 h-5 ${lang === 'ar' ? '' : 'rotate-180'}`} />
                    <span>{lang === 'ar' ? 'السابق' : 'Prev'}</span>
                  </button>

                  <div className="flex gap-1.5">
                    {lesson.flashcards.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentFlashcardIndex === idx ? 'w-5 bg-purple-500' : 'w-1.5 bg-slate-200 dark:bg-slate-800'
                        }`} 
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentFlashcardIndex((prev) => Math.min(lesson.flashcards.length - 1, prev + 1))}
                    disabled={currentFlashcardIndex === lesson.flashcards.length - 1}
                    className="flex items-center gap-1 text-xs font-black text-slate-700 dark:text-slate-300 disabled:opacity-30 active:scale-90 transition-transform"
                  >
                    <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                    <ChevronLeft className={`w-5 h-5 ${lang === 'ar' ? '' : 'rotate-180'}`} />
                  </button>
                </div>
              </section>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl text-center text-slate-400 font-bold">
                {lang === 'ar' ? 'لا توجد بطاقات ذاكرة مسجلة للدرس.' : 'No study flashcards registered for this lesson.'}
              </div>
            )}
          </div>
        )}

        {/* 3. Test Tab */}
        {activeTab === 'test' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Locked check */}
            {lesson.quizLocked && (
              <div className="relative min-h-[300px]">
                <LockedOverlay 
                  messageAr="تم قفل جميع الاختبارات والامتحانات لهذه الحصة من قبل المعلم"
                  messageEn="All practice quizzes and exams are locked by the teacher."
                  onUnlockClick={() => onNavigate('student-profile', 'push')}
                />
              </div>
            )}

            {!lesson.quizLocked && (
              <>
                {/* A. Select Quiz Type Mode */}
                {quizMode === 'select' && (
                  <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                    <button 
                      onClick={() => startQuiz('quiz')}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex items-center justify-between hover:border-emerald-500 transition-all text-right w-full active:scale-98 group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <PenTool className="w-6 h-6" />
                        </span>
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-white text-sm">
                            {lang === 'ar' ? 'الاختبار التجريبي التفاعلي' : 'Interactive Practice Quiz'}
                          </h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                            {lang === 'ar' ? `${lesson.quiz?.length || 0} أسئلة - خيارات متعددة وإكمال فراغات` : `${lesson.quiz?.length || 0} tasks - MCQs, True/False & gaps`}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-slate-350 group-hover:translate-x-[-4px] duration-150" />
                    </button>

                    <button 
                      onClick={() => startQuiz('ministry')}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex items-center justify-between hover:border-red-500 transition-all text-right w-full active:scale-98 group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <span className="p-3 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                          <Award className="w-6 h-6" />
                        </span>
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-white text-sm">
                            {lang === 'ar' ? 'النماذج والامتحانات الوزارية' : 'Ministry & Official Exams'}
                          </h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                            {lang === 'ar' ? `${lesson.ministryExams?.length || 0} أسئلة من لجان القياس الرسمية` : `${lesson.ministryExams?.length || 0} official questions`}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-slate-350 group-hover:translate-x-[-4px] duration-150" />
                    </button>


                    {/* Local Error Box Trigger */}
                    {errorQuestions.length > 0 && (
                      <button 
                        onClick={() => startQuiz('errors')}
                        className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-250 dark:border-amber-900 p-6 rounded-[28px] shadow-sm flex items-center justify-between hover:bg-amber-500/10 transition-all text-right w-full active:scale-98 group cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <span className="p-3 bg-amber-500 text-white rounded-2xl">
                            <AlertTriangle className="w-6 h-6" />
                          </span>
                          <div>
                            <h4 className="font-black text-amber-700 dark:text-amber-400 text-sm">
                              {lang === 'ar' ? 'صندوق الأخطاء المحلي (Error Box)' : 'Local Error Box Retry'}
                            </h4>
                            <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 font-bold mt-1">
                              {lang === 'ar' ? `لديك ${errorQuestions.length} أسئلة أخطأت بها سابقاً. تدرب عليها للتصحيح!` : `You have ${errorQuestions.length} unresolved errors. Retry to correct!`}
                            </p>
                          </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-amber-500 group-hover:translate-x-[-4px] duration-150" />
                      </button>
                    )}
                  </div>
                )}

                {/* B. Active Quiz View */}
                {(quizMode === 'quiz' || quizMode === 'ministry' || quizMode === 'errors') && (
                  <div className="space-y-4 animate-fadeIn">
                    
                    {/* Active Quiz Header / Timer */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex justify-between items-center">
                      <button 
                        onClick={() => {
                          setTimerActive(false);
                          setQuizMode('select');
                        }}
                        className="text-xs font-black text-slate-400 hover:text-slate-650 flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        {lang === 'ar' ? '← خروج' : '← Exit'}
                      </button>

                      <div className="flex items-center gap-2 text-slate-650 dark:text-slate-350">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-mono font-black">{formatTime(timeLeft)}</span>
                      </div>

                      <span className="text-xs text-emerald-500 font-black">
                        {score} / {activeQuestions.length}
                      </span>
                    </div>

                    {!quizFinished ? (
                      <div className="space-y-4">
                        {/* Question body */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-emerald-500 tracking-wider">
                              {lang === 'ar' ? `سؤال ${currentQuestionIndex + 1} من ${activeQuestions.length}` : `Question ${currentQuestionIndex + 1} of ${activeQuestions.length}`}
                            </span>
                            <span className="text-[9px] font-black uppercase bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-md text-slate-450">
                              {activeQuestions[currentQuestionIndex].type}
                            </span>
                          </div>
                          <p className="text-slate-850 dark:text-slate-100 text-sm font-extrabold leading-relaxed">
                            {lang === 'ar' ? activeQuestions[currentQuestionIndex].textAr : activeQuestions[currentQuestionIndex].textEn}
                          </p>
                        </div>

                        {/* Hint System with Points Deduction */}
                        {(activeQuestions[currentQuestionIndex].hintAr || activeQuestions[currentQuestionIndex].definitionAr) && !showFeedback && (
                          <div className="flex flex-col items-end">
                            {showHintMsg ? (
                              <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl text-right animate-fadeIn">
                                <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mb-1">
                                  💡 {lang === 'ar' ? 'التلميح المنهجي المتاح:' : 'Available Study Hint:'}
                                </span>
                                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                  {lang === 'ar' ? activeQuestions[currentQuestionIndex].hintAr || activeQuestions[currentQuestionIndex].definitionAr : activeQuestions[currentQuestionIndex].hintEn || activeQuestions[currentQuestionIndex].definitionEn}
                                </p>
                                <span className="text-[9px] font-bold text-amber-500 mt-2 block">
                                  {lang === 'ar' ? '* تم خصم 0.25 درجة من إمكانية هذا السؤال لتفعيل التلميح.' : '* 0.25 pts deducted for using hint.'}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  const confirmMsg = lang === 'ar'
                                    ? 'هل تود فتح التلميح العلمي مقابل خصم 0.25 درجة من السؤال؟'
                                    : 'Do you want to unlock the study hint for a 0.25 points deduction?';
                                  if (window.confirm(confirmMsg)) {
                                    setHintsUsed(prev => {
                                      const next = new Set(prev);
                                      next.add(activeQuestions[currentQuestionIndex].id);
                                      return next;
                                    });
                                    setShowHintMsg(true);
                                  }
                                }}
                                className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 font-extrabold bg-amber-500/10 px-3.5 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                              >
                                <span>💡</span>
                                <span>{lang === 'ar' ? 'عرض تلميح المساعدة (-0.25 د)' : 'Show Help Hint (-0.25 pts)'}</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Question Input Choices */}
                        {activeQuestions[currentQuestionIndex].type !== 'fill' && activeQuestions[currentQuestionIndex].type !== 'fill_blank' ? (
                          <div className="space-y-2">
                            {(activeQuestions[currentQuestionIndex].options || []).map((opt) => {
                              const isSelected = selectedOption === opt.key;
                              const isCorrectOpt = opt.key === activeQuestions[currentQuestionIndex].correctKey;
                              
                              let optionStyle = 'border-slate-100 dark:border-slate-800 hover:border-emerald-500 bg-white dark:bg-slate-900';
                              let checkBadge = null;

                              if (showFeedback) {
                                if (isCorrectOpt) {
                                  optionStyle = 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20';
                                  checkBadge = <CheckCircle className={`w-5 h-5 text-emerald-600 shrink-0 ${lang === 'ar' ? 'mr-auto' : 'ml-auto'}`} />;
                                } else if (isSelected) {
                                  optionStyle = 'border-rose-450 bg-rose-50/30 dark:bg-rose-950/20';
                                  checkBadge = <XCircle className={`w-5 h-5 text-rose-500 shrink-0 ${lang === 'ar' ? 'mr-auto' : 'ml-auto'}`} />;
                                }
                              }

                              return (
                                <button
                                  key={opt.key}
                                  onClick={() => handleOptionClick(opt.key)}
                                  disabled={showFeedback}
                                  className={`w-full flex items-center p-4 rounded-xl border transition-all active:scale-[0.99] ${
                                    lang === 'ar' ? 'text-right' : 'text-left'
                                  } ${optionStyle}`}
                                >
                                  <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-black transition-colors shrink-0 ${
                                    lang === 'ar' ? 'ml-3' : 'mr-3'
                                  } ${
                                    isSelected 
                                      ? (isCorrectOpt ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') 
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-450'
                                  }`}>
                                    {opt.key}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{lang === 'ar' ? opt.textAr : opt.textEn}</span>
                                  {checkBadge}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          // Fill in the blanks input
                          <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px]">
                            <input 
                              type="text" 
                              value={fillInput} 
                              onChange={(e) => setFillInput(e.target.value)}
                              disabled={showFeedback}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                              placeholder={lang === 'ar' ? 'اكتب كلمتك الإملائية الصحيحة...' : 'Type correct word...'}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && fillInput.trim()) {
                                  handleFillSubmit();
                                }
                              }}
                            />
                            {!showFeedback ? (
                              <button 
                                onClick={handleFillSubmit}
                                disabled={!fillInput.trim()}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold py-3.5 rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                              >
                                {lang === 'ar' ? 'تحقق من صحة العبارة' : 'Submit & Verify'}
                              </button>
                            ) : (
                              <div className="text-xs font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-650">
                                {lang === 'ar' ? `إجابتك المسجلة: ${fillInput}` : `Your Answer: ${fillInput}`}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Active Feedback display */}
                        {showFeedback && (
                          <div className={`p-5 rounded-[24px] border flex gap-3 animate-fadeIn ${
                            isAnswerCorrect 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900 text-emerald-900 dark:text-emerald-350' 
                              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-150 dark:border-rose-950 text-rose-900 dark:text-rose-350'
                          }`}>
                            {isAnswerCorrect ? (
                              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                            ) : (
                              <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                            )}
                            <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                              <p className="font-extrabold text-xs">
                                {isAnswerCorrect ? t.correctAnswerText : t.wrongAnswerText}
                              </p>
                              <p className="text-[11px] opacity-90 mt-1 leading-relaxed font-bold">
                                {lang === 'ar' ? activeQuestions[currentQuestionIndex].explanationAr : activeQuestions[currentQuestionIndex].explanationEn}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Next trigger */}
                        {showFeedback && (
                          <div className={`flex ${lang === 'ar' ? 'justify-end' : 'justify-start'}`}>
                            <button 
                              onClick={handleNextQuestion}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                            >
                              {currentQuestionIndex === activeQuestions.length - 1 
                                ? (lang === 'ar' ? 'عرض النتيجة النهائية' : 'Show Scorecard') 
                                : (lang === 'ar' ? 'السؤال التالي' : 'Next Question')}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Quiz Finished view
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 text-center space-y-4 animate-scaleUp">
                        <div className="flex justify-center">
                          <div className="w-16 h-16 bg-amber-400 text-white rounded-2xl flex items-center justify-center shadow-lg">
                            <Trophy className="w-8 h-8" />
                          </div>
                        </div>
                        <h3 className="font-black text-slate-800 dark:text-white text-base">
                          {lang === 'ar' ? 'تهانينا! لقد أنهيت الاختبار' : 'Great Job! Test Completed'}
                        </h3>
                        <div className="flex justify-around items-center py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                          <div>
                            <span className="block text-2xl font-black text-emerald-500">{score} / {activeQuestions.length}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{lang === 'ar' ? 'الدرجة الكلية' : 'Final Score'}</span>
                          </div>
                          <div>
                            <span className="block text-2xl font-black text-slate-850 dark:text-white">
                              {Math.round((score / activeQuestions.length) * 100)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{lang === 'ar' ? 'معدل النجاح' : 'Success Rate'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startQuiz(quizMode)}
                            className="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            {lang === 'ar' ? 'إعادة الاختبار 🔄' : 'Retake Exam 🔄'}
                          </button>
                          <button
                            onClick={() => setQuizMode('select')}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                          >
                            {lang === 'ar' ? 'خروج للرئيسية' : 'Exit to Main'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}


              </>
            )}
          </div>
        )}



        {/* Next Lesson Card (Always visible at the bottom of standard details or when student completes work) */}
        {(() => {
          const currentIdx = lessons.findIndex(l => l.id === lesson.id);
          const nextLesson = currentIdx >= 0 && currentIdx < lessons.length - 1
            ? lessons[currentIdx + 1]
            : null;

          if (nextLesson && onSelectLesson) {
            const nextTitle = nextLesson.folder.split('/')[1] ||
              (lang === 'ar' ? nextLesson.titleAr : nextLesson.titleEn);
            return (
              <section className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[28px] p-5 shadow-xl shadow-emerald-500/20 relative overflow-hidden animate-fadeIn">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-100" />
                    <span className="text-emerald-100 text-[10px] font-extrabold uppercase tracking-wider">
                      {lang === 'ar' ? 'الدرس التالي في المنهج' : 'Up Next Course'}
                    </span>
                  </div>
                  <h4 className="text-white font-black text-sm mb-3 leading-snug">{nextTitle}</h4>
                  <button
                    onClick={() => {
                      onSelectLesson(nextLesson);
                      setActiveTab('explore');
                      onNavigate('lesson-details', 'push');
                    }}
                    className="w-full bg-white/20 hover:bg-white/30 text-white font-black py-3 rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 border border-white/20 cursor-pointer"
                  >
                    {lang === 'ar' ? 'انتقال إلى الدرس التالي' : 'Start Next Lesson'}
                    {lang === 'ar'
                      ? <ChevronLeft className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </section>
            );
          }
          return null;
        })()}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 z-50">
        <button 
          onClick={() => onNavigate('main-dashboard', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.home}</span>
        </button>
        
        <button 
          onClick={() => onNavigate('units-navigation', 'none')} 
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl px-4 py-1.5 active:scale-90 transition-transform font-black"
        >
          <BookOpen className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span className="text-xs">{t.myLessonsMenu}</span>
        </button>

        <button 
          onClick={() => onNavigate('biology-quiz', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <PenTool className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.openTraining}</span>
        </button>

        <button 
          onClick={() => onNavigate('student-profile', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myProfile}</span>
        </button>
      </nav>


      {/* AI Tutor Chat Drawer */}
      <AnimatePresence>
        {isTutorOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 md:p-4 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTutorOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Chat Body */}
            <motion.div
              initial={{ y: '100%', opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-[32px] md:rounded-[32px] w-full max-w-lg h-[80vh] md:h-[75vh] flex flex-col overflow-hidden shadow-2xl relative z-10 text-slate-800 dark:text-slate-100 font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </span>
                  <div className="text-right">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      مساعد الأحياء الذكي 🤖
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      معلمك الافتراضي الشخصي للمنهج اليمني
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTutorOpen(false)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors border-0 cursor-pointer bg-transparent"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-850 p-2 rounded-lg font-mono text-center shrink-0">
                  Debug - LocalStorage Server URL: "{localStorage.getItem('server_url') || 'none'}" | Env URL: "{import.meta.env.VITE_SERVER_URL || 'none'}"
                </div>
                {tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-[20px] p-3 text-xs leading-relaxed shadow-sm font-semibold whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-emerald-500 text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-150 border border-slate-100 dark:border-slate-850 rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {tutorLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-550 border border-slate-100 dark:border-slate-850 rounded-[20px] rounded-bl-none p-3 text-xs flex items-center gap-2 shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                      <span>المعلم الافتراضي يفكر في الإجابة...</span>
                    </div>
                  </div>
                )}

                {tutorError && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 font-extrabold text-center">
                    ⚠️ {tutorError}
                  </div>
                )}
                
                {/* Scroll anchor */}
                <div id="tutor-bottom-anchor" />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendTutorMessage(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    placeholder="اكتب سؤالك هنا عن الدرس..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                    disabled={tutorLoading}
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer border-0"
                    disabled={!tutorInput.trim() || tutorLoading}
                  >
                    إرسال
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
