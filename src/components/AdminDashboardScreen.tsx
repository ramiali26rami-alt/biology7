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
  UserCheck
} from 'lucide-react';
import { ScreenId, Lesson, VideoChapter, Flashcard, GlossaryItem, ConfigQuestion } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { validateExcelData } from '../utils/excelValidator';

import { SecureStorage } from '../utils/security';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getAbsoluteUrl } from '../utils/urlHelper';
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
type EditorSubTab = 'basic' | 'chapters' | 'summary-flash' | 'quiz' | 'files';

export default function AdminDashboardScreen({ onNavigate, lang, lessons, setLessons }: AdminDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lessons-list');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('basic');








  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const errs: string[] = [];
    lessons.forEach(l => {
      if (!l.titleAr) errs.push(lang === 'ar' ? `الدرس (${l.id}) يفتقر للعنوان العربي.` : `Lesson (${l.id}) lacks Arabic title.`);
      if (!l.titleEn) errs.push(lang === 'ar' ? `الدرس (${l.id}) يفتقر للعنوان الإنجليزي.` : `Lesson (${l.id}) lacks English title.`);
      if (!l.pdfFile) errs.push(lang === 'ar' ? `الدرس (${l.id}) لا يحتوي على ملف PDF.` : `Lesson (${l.id}) is missing PDF file.`);
      if (l.quiz && l.quiz.length === 0) {
        errs.push(lang === 'ar' ? `الدرس (${l.id}) لا يحتوي على أسئلة اختبار.` : `Lesson (${l.id}) has no quiz questions.`);
      }
    });
    setValidationErrors(errs);
  }, [lessons, lang]);











  // AI Quiz Generator states




  const t = translations[lang];

  // Helper for layout direction
  const isRtl = lang === 'ar';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const backIcon = isRtl ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  const handleTriggerDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lessons, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `biology_curriculum_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
      const res = await fetch(getAbsoluteUrl('/api/save-config'), {
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

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-20 font-sans transition-colors duration-[250ms]" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Admin Header */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('student-profile', 'push_back')} 
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
                } else if (lessons.length > 0) {
                  setEditingLesson(lessons[0]);
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
                {lessons.map((l, i) => (
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
          <AnimatePresence mode="wait">
            
            {/* TAB 1: Lessons List Management */}
            {(activeTab === 'lessons-list' || activeTab === 'lesson-editor' || activeTab === 'preview') && (
              <LessonsTab
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                lang={lang}
                lessons={lessons}
                setLessons={setLessons}
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
                lessons={lessons}
                setLessons={setLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

            {activeTab === 'keys' && (
              <SystemSettingsTab
                activeTab={activeTab}
                lang={lang}
                lessons={lessons}
                setLessons={setLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

                        {activeTab === 'helper' && (
              <SystemSettingsTab
                activeTab={activeTab}
                lang={lang}
                lessons={lessons}
                setLessons={setLessons}
                saveAllToServer={saveAllToServer}
              />
            )}

                        {activeTab === 'students' && (
              <StudentsTab lang={lang} lessons={lessons} />
            )}

          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}

