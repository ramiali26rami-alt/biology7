/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight,
  Bookmark, 
  Play, 
  Pause, 
  Maximize2, 
  Settings, 
  Lock, 
  CheckCircle, 
  BookOpen, 
  Map, 
  Video, 
  HelpCircle, 
  PenTool, 
  Clock, 
  Award,
  Compass,
  User,
  Edit,
  Save,
  FileText
} from 'lucide-react';

import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { markVideoSeen } from '../utils/progress';

interface LessonVideoScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lesson: Lesson | null;
}

export default function LessonVideoScreen({ onNavigate, lang, lesson }: LessonVideoScreenProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavedNotes, setIsSavedNotes] = useState(false);
  
  const t = translations[lang];
  const backIcon = lang === 'ar' ? <ArrowRight className="w-5 h-5 text-emerald-500 hover:scale-110 transition-transform" /> : <ArrowLeft className="w-5 h-5 text-emerald-500 hover:scale-110 transition-transform" />;

  useEffect(() => {
    if (lesson) {
      setNotes(localStorage.getItem(`study_notes_${lesson.id}`) || '');
      // Track progress: mark video as seen
      markVideoSeen(lesson.id);
    }
  }, [lesson?.id]);

  const handleSaveNotes = () => {
    if (lesson) {
      localStorage.setItem(`study_notes_${lesson.id}`, notes);
      setIsSavedNotes(true);
      setTimeout(() => setIsSavedNotes(false), 2000);
    }
  };

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center font-bold text-slate-400" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {lang === 'ar' ? 'جاري تحميل الفيديو...' : 'Loading video details...'}
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 fixed top-0 w-full z-50 shadow-md shadow-slate-150/30 dark:shadow-none">
        <div className="flex justify-between items-center w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate('lesson-details', 'push_back')} 
              className="active:scale-95 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
              {lang === 'ar' ? lesson.titleAr : lesson.titleEn}
            </h1>
          </div>
          <button 
            onClick={() => setBookmarked(!bookmarked)}
            className="active:scale-95 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full"
          >
            <Bookmark className={`w-5 h-5 transition-colors ${bookmarked ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`} />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Video Player Box - Dynamic iframe player */}
        <section className="relative w-full aspect-video bg-black overflow-hidden shadow-2xl rounded-2xl">
          <iframe
            src={lesson.videoUrl.includes('embed') ? lesson.videoUrl : lesson.videoUrl.replace('watch?v=', 'embed/')}
            title={lang === 'ar' ? lesson.titleAr : lesson.titleEn}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </section>

        {/* Dynamic Study Sequence Tabs */}
        <nav className="flex overflow-x-auto gap-4 scrollbar-none border-b border-slate-100 dark:border-slate-800 pb-2 bg-transparent">
          <button 
            onClick={() => onNavigate('lesson-details', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {t.detailsTitle}
          </button>
          <button className="flex-shrink-0 px-4 py-2 text-sm font-black text-emerald-500 border-b-2 border-emerald-500">
            {t.videoTab}
          </button>
          <button 
            onClick={() => onNavigate('lesson-summary', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {lang === 'ar' ? 'الملخص' : 'Summary'}
          </button>
          <button 
            onClick={() => onNavigate('biology-quiz', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {t.quizTab}
          </button>
        </nav>

        {/* Video Info Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-350 px-2.5 py-0.5 rounded text-xs font-black">
              {t.invertebratesTag}
            </span>
            <span className="text-slate-450 text-xs">• {lang === 'ar' ? 'الدروس التفاعلية' : 'Interactive Lessons'}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
            {lang === 'ar' ? lesson.titleAr : lesson.titleEn}
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block mt-1 select-all">{t.youtubeLink}: {lesson.videoUrl}</span>
        </div>

        {/* Lesson Chapters / Timeline Seekers */}
        <section className="space-y-3">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">{t.chaptersTitle}</h3>
          <div className="space-y-2">
            
            {lesson.videoChapters && lesson.videoChapters.length > 0 ? (
              lesson.videoChapters.map((chapter, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 hover:shadow-xs transition-all border border-slate-100 dark:border-slate-800 group"
                >
                  <Clock className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-150 text-sm group-hover:text-emerald-500 transition-colors">
                        {lang === 'ar' ? chapter.titleAr : chapter.titleEn}
                      </h4>
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">{chapter.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">
                      {lang === 'ar' ? chapter.descAr : chapter.descEn}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center font-bold">
                {lang === 'ar' ? 'لا توجد فصول مدرجة لهذا الفيديو.' : 'No chapters listed for this video.'}
              </p>
            )}

          </div>
        </section>

        {/* Study Notebook Component / المفكرة الدراسية */}
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-xl shadow-slate-200/20 dark:shadow-none space-y-3">
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-500 shrink-0">
                <Edit className="w-5 h-5" />
              </span>
              <h3 className="font-black text-slate-850 dark:text-white text-[15px]">{t.myNotes}</h3>
            </div>
            <button 
              onClick={handleSaveNotes}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-[10px] active:scale-95 transition-all shadow-md cursor-pointer"
            >
              {isSavedNotes ? (lang === 'ar' ? 'تم الحفظ!' : 'Saved!') : (lang === 'ar' ? 'حفظ الملاحظة' : 'Save Note')}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-700 dark:text-slate-350 focus:outline-none focus:border-emerald-500 min-h-[100px] leading-relaxed resize-none"
            placeholder={t.writeNotesPlaceholder}
          ></textarea>
        </section>

        {/* Next Study Phase Navigation Button */}
        <div className={`flex items-center mt-6 ${lang === 'ar' ? 'justify-end' : 'justify-start'}`}>
          <button 
            onClick={() => onNavigate('lesson-summary', 'push')}
            className="flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:scale-[1.02] active:scale-95 group transition-all"
          >
            {lang === 'ar' ? 'ملخص بطاقات الدرس الفلاشية' : 'Revision Summary & Cards'}
            {lang === 'ar' ? (
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform rotate-180" />
            ) : (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </div>

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
    </div>
  );
}
