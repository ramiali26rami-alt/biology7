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
  Loader2,
  UserCheck,
  LogOut,
  Send,
  Cloud,
  CloudOff,
  RotateCcw
} from 'lucide-react';
import { ScreenId, Lesson, VideoChapter, Flashcard, GlossaryItem, ConfigQuestion } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { validateExcelData } from '../utils/excelValidator';
import { supabase } from '../utils/supabaseClient';

import { SecureStorage } from '../utils/security';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import StudentsTab from './admin/StudentsTab';
import LessonsTab from './admin/LessonsTab';
import ExamBankTab from './admin/ExamBankTab';
import SystemSettingsTab from './admin/SystemSettingsTab';

interface AdminDashboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
}

type TabType = 'lessons-list' | 'lesson-editor' | 'preview' | 'export' | 'keys' | 'helper' | 'students';
type EditorSubTab = 'basic' | 'chapters' | 'summary-flash' | 'quiz' | 'ministry-quiz' | 'files';

export default function AdminDashboardScreen({ onNavigate, lang, lessons, setLessons }: AdminDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lessons-list');
  const [draftLessons, setDraftLessons] = useState<Lesson[]>(lessons);
  const [publishedLessons, setPublishedLessons] = useState<Lesson[]>(lessons);
  const [draftSavedFingerprint, setDraftSavedFingerprint] = useState(() => JSON.stringify(lessons));
  const [draftLoadStatus, setDraftLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'published' | 'error'>('idle');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('basic');

  const handleLogout = async () => {
    if (hasUnsavedDraft) {
      const shouldLogout = window.confirm(lang === 'ar'
        ? 'توجد تعديلات غير محفوظة في المسودة. هل تريد تسجيل الخروج وفقدانها؟'
        : 'The draft has unsaved changes. Sign out and discard them?');
      if (!shouldLogout) return;
    }
    await supabase.auth.signOut();
    window.location.href = '/';
  };








  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const draftFingerprint = JSON.stringify(draftLessons);
  const publishedFingerprint = JSON.stringify(publishedLessons);
  const hasUnsavedDraft = draftFingerprint !== draftSavedFingerprint;
  const hasUnpublishedChanges = draftFingerprint !== publishedFingerprint;

  useEffect(() => {
    if (!hasUnsavedDraft) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedDraft]);

  const handleLeaveAdmin = () => {
    if (hasUnsavedDraft) {
      const shouldLeave = window.confirm(lang === 'ar'
        ? 'توجد تعديلات غير محفوظة في المسودة. هل تريد الخروج وفقدانها؟'
        : 'The draft has unsaved changes. Leave and discard them?');
      if (!shouldLeave) return;
    }
    onNavigate('student-profile', 'push_back');
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['curriculum_data', 'curriculum_draft']);

      if (cancelled) return;

      if (error) {
        console.warn('Failed to load curriculum draft:', error);
        setDraftLoadStatus('error');
        return;
      }

      const publishedRow = data?.find(row => row.key === 'curriculum_data');
      const draftRow = data?.find(row => row.key === 'curriculum_draft');
      const cloudPublished = Array.isArray(publishedRow?.value) ? publishedRow.value as Lesson[] : lessons;
      const cloudDraft = Array.isArray(draftRow?.value) ? draftRow.value as Lesson[] : cloudPublished;

      setPublishedLessons(cloudPublished);
      setDraftLessons(cloudDraft);
      setDraftSavedFingerprint(JSON.stringify(cloudDraft));
      setDraftLoadStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const errs: string[] = [];
    (draftLessons || []).forEach(l => {
      if (!l) return;
      if (!l.titleAr) errs.push(lang === 'ar' ? `الدرس (${l.id}) يفتقر للعنوان العربي.` : `Lesson (${l.id}) lacks Arabic title.`);
      if (!l.titleEn) errs.push(lang === 'ar' ? `الدرس (${l.id}) يفتقر للعنوان الإنجليزي.` : `Lesson (${l.id}) lacks English title.`);
      if (!l.pdfFile) errs.push(lang === 'ar' ? `الدرس (${l.id}) لا يحتوي على ملف PDF.` : `Lesson (${l.id}) is missing PDF file.`);
      if (l.quiz && l.quiz.length === 0) {
        errs.push(lang === 'ar' ? `الدرس (${l.id}) لا يحتوي على أسئلة اختبار.` : `Lesson (${l.id}) has no quiz questions.`);
      }

      const validateQuestionSet = (questions: ConfigQuestion[] | undefined, labelAr: string, labelEn: string) => {
        if (!questions?.length) return;

        const seenIds = new Set<string>();
        questions.forEach((question, index) => {
          const questionId = String(question.id ?? '').trim();
          if (!question.textAr?.trim()) {
            errs.push(lang === 'ar'
              ? `الدرس (${l.id}): ${labelAr} رقم ${index + 1} بلا نص.`
              : `Lesson (${l.id}): ${labelEn} #${index + 1} has no text.`);
          }
          if (!questionId) {
            errs.push(lang === 'ar'
              ? `الدرس (${l.id}): ${labelAr} رقم ${index + 1} بلا معرّف ثابت.`
              : `Lesson (${l.id}): ${labelEn} #${index + 1} has no stable ID.`);
          } else if (seenIds.has(questionId)) {
            errs.push(lang === 'ar'
              ? `الدرس (${l.id}): المعرّف ${questionId} مكرر في ${labelAr}.`
              : `Lesson (${l.id}): ID ${questionId} is duplicated in ${labelEn}.`);
          } else {
            seenIds.add(questionId);
          }
        });
      };

      validateQuestionSet(l.quiz, 'أسئلة التدريب', 'practice questions');
      validateQuestionSet(l.ministryExams, 'الأسئلة الوزارية', 'ministry questions');
    });
    setValidationErrors(errs);
  }, [draftLessons, lang]);











  // AI Quiz Generator states




  const t = translations[lang];

  // Helper for layout direction
  const isRtl = lang === 'ar';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const backIcon = isRtl ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  const handleTriggerDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(draftLessons, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `biology_curriculum_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Save the owner's working copy only. Students never read curriculum_draft.
  const saveAllToServer = async (lessonsToSave: Lesson[]) => {
    setSaveStatus('saving');
    try {
      SecureStorage.setItem('curriculum_draft', lessonsToSave);
      const savedAt = new Date().toISOString();
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          key: 'curriculum_draft',
          value: lessonsToSave,
          updated_at: savedAt
        });

      if (error) throw error;

      setDraftLessons(lessonsToSave);
      setDraftSavedFingerprint(JSON.stringify(lessonsToSave));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (error) {
      console.error('Failed to save curriculum draft:', error);
      setSaveStatus('error');
      throw error;
    }
  };

  const publishDraft = async () => {
    if (validationErrors.length > 0) {
      alert(lang === 'ar'
        ? 'لا يمكن النشر قبل معالجة ملاحظات سلامة المنهج الظاهرة في اللوحة.'
        : 'Resolve the syllabus validation warnings before publishing.');
      return;
    }

    setPublishStatus('publishing');
    try {
      await saveAllToServer(draftLessons);

      const publishedAt = new Date().toISOString();
      const { data: sessionData } = await supabase.auth.getSession();
      const release = {
        id: publishedAt,
        published_at: publishedAt,
        published_by: sessionData.session?.user.id ?? null,
        lessons_count: draftLessons.length
      };

      // One bulk upsert keeps the backup, published curriculum and release marker together.
      const { error } = await supabase
        .from('system_settings')
        .upsert([
          {
            key: 'curriculum_backup_latest',
            value: { lessons: publishedLessons, backed_up_at: publishedAt },
            updated_at: publishedAt
          },
          {
            key: 'curriculum_data',
            value: draftLessons,
            updated_at: publishedAt
          },
          {
            key: 'curriculum_release',
            value: release,
            updated_at: publishedAt
          }
        ]);

      if (error) throw error;

      SecureStorage.setItem('curriculum_data', draftLessons);
      SecureStorage.setItem('curriculum_updated_at', publishedAt);
      setPublishedLessons(draftLessons);
      setLessons(draftLessons);
      setPublishStatus('published');
      setTimeout(() => setPublishStatus('idle'), 5000);
    } catch (error) {
      console.error('Failed to publish curriculum:', error);
      setPublishStatus('error');
      alert(lang === 'ar'
        ? 'فشل نشر المنهج. بقيت المسودة محفوظة ولم تتغير نسخة الطلاب.'
        : 'Publishing failed. The draft is safe and the student version was not changed.');
    }
  };

  const restorePublishedToDraft = async () => {
    const confirmed = window.confirm(lang === 'ar'
      ? 'هل تريد حذف تعديلات المسودة واستعادة آخر نسخة منشورة للطلاب؟'
      : 'Discard draft changes and restore the version currently published to students?');
    if (!confirmed) return;

    setDraftLessons(publishedLessons);
    setEditingLesson(null);
    setEditingLessonIndex(null);
    try {
      await saveAllToServer(publishedLessons);
    } catch {
      setDraftLessons(draftLessons);
    }
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-20 font-sans transition-colors duration-[250ms]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Admin Header */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLeaveAdmin}
            aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
            className="active:scale-95 tap-target p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {backIcon}
          </button>
          <div>
            <h1 className="font-black text-base md:text-lg text-emerald-600 dark:text-emerald-400">
              {lang === 'ar' ? 'لوحة المالك والإدارة' : 'Owner Content Panel'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {lang === 'ar' ? 'الأحياء - اليمن' : 'Al-Ahya - Yemen'}
            </p>
          </div>
        </div>

        {/* Global Action Header Buttons */}
        <div className="flex items-center gap-2">
          {/* Save Status Badge */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-app-btn border border-amber-200 dark:border-amber-800">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-app-btn border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تم الحفظ تلقائياً ✓' : 'Auto-Saved ✓'}</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-app-btn border border-rose-200 dark:border-rose-800">
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'خطأ في الحفظ' : 'Save Error'}</span>
            </span>
          )}
          <button
            onClick={handleTriggerDownload}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير المنهج' : 'Download JSON'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-3 py-2 rounded-app-btn active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer border-0"
            title={lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'خروج' : 'Log Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-20 px-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar (Vertical on Desktop, Horizontal on Mobile) */}
        <section className="lg:col-span-1 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-4 shadow-xl shadow-slate-100/30 dark:shadow-none flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
            
            <button
              onClick={() => setActiveTab('lessons-list')}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
                activeTab === 'lessons-list'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'ar' ? 'قائمة المنهج' : 'Syllabus List'}</span>
              <span className="ms-auto bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-sans">
                {draftLessons.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (editingLesson && editingLessonIndex !== null) {
                  setActiveTab('lesson-editor');
                } else if (draftLessons.length > 0) {
                  setEditingLesson(draftLessons[0]);
                  setEditingLessonIndex(0);
                  setActiveTab('lesson-editor');
                } else {
                  setActiveTab('lesson-editor');
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
                  setActiveTab('preview');
                } else if (draftLessons.length > 0) {
                  setEditingLesson(draftLessons[0]);
                  setEditingLessonIndex(0);
                  setActiveTab('preview');
                } else {
                  alert(lang === 'ar' ? 'الرجاء إضافة درس أولاً لمعاينته!' : 'Please add a lesson first to preview!');
                }
              }}
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
              className={`flex-1 lg:flex-initial flex items-center gap-3 px-4 py-3 rounded-app-btn text-sm font-black transition-all shrink-0 ${
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
          <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 p-5 shadow-xl shadow-slate-100/30 dark:shadow-none space-y-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {lang === 'ar' ? 'حالة أمان المنهج' : 'Syllabus Integrity'}
              </h4>
            </div>
            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-3 rounded-app-btn border border-emerald-100 dark:border-emerald-900 text-xs font-bold">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'جميع البيانات سليمة وجاهزة!' : 'All configurations verified!'}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 p-3 rounded-app-btn border border-rose-100 dark:border-rose-900 text-xs font-bold">
                  {lang === 'ar' ? `يوجد ${validationErrors.length} ملاحظات تكوين:` : `Found ${validationErrors.length} validation warnings:`}
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pe-1 text-[10px] text-rose-500 font-bold font-sans">
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
                {draftLessons.map((l, i) => (
                  <span key={i} className="text-[9px] font-bold font-sans bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-app-btn text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-750">
                    {i + 1}: {l.id || '❔'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Editor / Dashboard Panel */}
        <section className="lg:col-span-3 space-y-6">
          <div className="overflow-hidden rounded-app-card border border-emerald-200/70 bg-white shadow-lg shadow-emerald-950/5 dark:border-emerald-900/70 dark:bg-slate-900">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-app-btn ${
                  draftLoadStatus === 'error'
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                    : hasUnpublishedChanges
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                }`}>
                  {draftLoadStatus === 'error' ? <CloudOff className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      {lang === 'ar' ? 'مساحة إعداد المنهج' : 'Curriculum workspace'}
                    </h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      hasUnsavedDraft
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                        : hasUnpublishedChanges
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    }`}>
                      {hasUnsavedDraft
                        ? (lang === 'ar' ? 'تعديلات غير محفوظة' : 'Unsaved changes')
                        : hasUnpublishedChanges
                          ? (lang === 'ar' ? 'مسودة محفوظة غير منشورة' : 'Saved draft, not published')
                          : (lang === 'ar' ? 'مطابق للنسخة المنشورة' : 'Matches published version')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500 dark:text-slate-400">
                    {lang === 'ar'
                      ? 'الحفظ يحمي عملك داخل المسودة فقط. لن يرى الطلاب أي تغيير حتى تضغط نشر للطلاب.'
                      : 'Saving updates the private draft only. Students see changes only after publishing.'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                {hasUnpublishedChanges ? (
                  <button
                    type="button"
                    onClick={() => void restorePublishedToDraft()}
                    disabled={saveStatus === 'saving' || publishStatus === 'publishing'}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-app-btn px-3 py-2.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>{lang === 'ar' ? 'استعادة المنشور' : 'Restore published'}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveAllToServer(draftLessons).catch(() => undefined)}
                  disabled={saveStatus === 'saving' || draftLoadStatus === 'loading'}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-app-btn border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {saveStatus === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{saveStatus === 'saved' ? (lang === 'ar' ? 'تم حفظ المسودة' : 'Draft saved') : (lang === 'ar' ? 'حفظ المسودة' : 'Save draft')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void publishDraft()}
                  disabled={publishStatus === 'publishing' || validationErrors.length > 0 || draftLoadStatus !== 'ready'}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-app-btn bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
                  title={validationErrors.length > 0 ? (lang === 'ar' ? 'عالج ملاحظات سلامة المنهج قبل النشر' : 'Resolve validation warnings before publishing') : undefined}
                >
                  {publishStatus === 'publishing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{publishStatus === 'published' ? (lang === 'ar' ? 'تم النشر للطلاب' : 'Published') : (lang === 'ar' ? 'نشر للطلاب' : 'Publish to students')}</span>
                </button>
              </div>
            </div>
            {saveStatus === 'error' ? (
              <div className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
                {lang === 'ar' ? 'تعذر حفظ المسودة. لم يتم عرض نجاح وهمي ويمكنك المحاولة مجدداً.' : 'Draft save failed. Nothing was reported as saved; please retry.'}
              </div>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            
            {/* TAB 1: Lessons List Management */}
            {(activeTab === 'lessons-list' || activeTab === 'lesson-editor' || activeTab === 'preview') && (
              <LessonsTab
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                lang={lang}
                lessons={draftLessons}
                setLessons={setDraftLessons}
                saveAllToServer={saveAllToServer}
                saveStatus={saveStatus}
                editingLesson={editingLesson}
                setEditingLesson={setEditingLesson}
                editingLessonIndex={editingLessonIndex}
                setEditingLessonIndex={setEditingLessonIndex}
                editorSubTab={editorSubTab}
                setEditorSubTab={setEditorSubTab}
              />
            )}

                        {activeTab === 'export' && (
              <ExamBankTab
                lang={lang}
                lessons={draftLessons}
                setLessons={setDraftLessons}
                saveAllToServer={saveAllToServer}
                onPublish={publishDraft}
                publishStatus={publishStatus}
                canPublish={validationErrors.length === 0 && draftLoadStatus === 'ready'}
              />
            )}

            {activeTab === 'keys' && (
              <SystemSettingsTab
                activeTab={activeTab}
                lang={lang}
                lessons={draftLessons}
                setLessons={setDraftLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

                        {activeTab === 'helper' && (
              <SystemSettingsTab
                activeTab={activeTab}
                lang={lang}
                lessons={draftLessons}
                setLessons={setDraftLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

                        {activeTab === 'students' && (
              <StudentsTab lang={lang} lessons={draftLessons} />
            )}

          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}


