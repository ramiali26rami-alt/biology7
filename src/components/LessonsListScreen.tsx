/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Search, 
  Sparkles, 
  Flame, 
  Play, 
  Lock, 
  Dna, 
  BookOpen, 
  TrendingUp, 
  User,
  ShieldAlert,
  Compass,
  PenTool
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { lessonPercent, overallPercent, getStreak } from '../utils/progress';
import { checkPremiumStatus } from '../utils/security';
import { checkStudentSubscription } from '../utils/supabaseHelper';

interface LessonsListScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  selectedUnit: number;
  onSelectLesson: (lesson: Lesson) => void;
  onQuizNavigate: () => void;
}

export default function LessonsListScreen({ onNavigate, lang, lessons, selectedUnit, onSelectLesson, onQuizNavigate }: LessonsListScreenProps) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(() => checkPremiumStatus());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    setPremiumUnlocked(checkPremiumStatus());
    checkStudentSubscription().then(isPrem => {
      setPremiumUnlocked(isPrem);
    }).catch(() => {});
  }, []);

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  const handleLessonClick = (lesson: Lesson) => {
    const isLocked = lesson.locked && !premiumUnlocked;
    if (isLocked) {
      onNavigate('student-profile', 'push');
    } else {
      onSelectLesson(lesson);
      onNavigate('lesson-details', 'push');
    }
  };

  const getUnitFullTitle = () => {
    const firstLesson = lessons.find(l => Number(l.unit) === selectedUnit);
    if (!firstLesson) return `الوحدة ${selectedUnit}`;
    const unitTitle = firstLesson.unitNameAr;
    const unitNumberText = [
          'الوحدة الأولى', 
          'الوحدة الثانية', 
          'الوحدة الثالثة', 
          'الوحدة الرابعة', 
          'الوحدة الخامسة', 
          'الوحدة السادسة', 
          'الوحدة السابعة', 
          'الوحدة الثامنة'
        ][selectedUnit - 1] || `الوحدة ${selectedUnit}`;
    return `${unitNumberText}: ${unitTitle}`;
  };

  // Filter lessons belonging to the currently selected unit
  const unitLessons = lessons.filter(l => Number(l.unit) === selectedUnit);
  const unitAccent = ['#e85d75', '#f59e0b', '#ef6351', '#9b6ad6', '#5577c9', '#08a77a', '#139b8f', '#3f83c5'][selectedUnit - 1] || '#08a77a';

  return (
    <div className="bio-catalog-shell dark:text-slate-100 pb-32 font-sans select-none transition-colors duration-[250ms]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="bio-topbar flex items-center px-6 h-16 w-full fixed top-0 z-50 border-b">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate('units-navigation', 'push_back')} 
              aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
              className="active:scale-95 transition-transform tap-target p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.syllabusDetails}</h1>
          </div>
          <button
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}
            aria-label={lang === 'ar' ? 'بحث' : 'Search'}
            className={`tap-target p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 ${showSearch ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-6 max-w-2xl mx-auto space-y-6">

        {/* Search Bar (visible when toggled) */}
        {showSearch && (
          <div className="pt-2">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث عن درس...' : 'Search lessons...'}
              className="bio-search-field w-full border rounded-app-btn px-4 py-3 text-sm font-bold dark:text-white focus:outline-none transition-colors shadow-sm"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
        )}
        
        {/* Hero Branding Section */}
        <div className="bio-catalog-hero mb-1 mt-1">
          <span className="bio-catalog-kicker relative z-10">{lang === 'ar' ? 'مسار الوحدة' : 'Unit pathway'}</span>
          <h2 className="relative z-10 text-xl font-black text-white leading-snug mt-2">
            {getUnitFullTitle()}
          </h2>
          <p className="relative z-10 text-xs text-emerald-50/75 font-bold mt-2">
            {unitLessons.length} {lang === 'ar' ? 'دروس مرتبة ضمن هذه الوحدة' : 'lessons in this unit'}
          </p>
        </div>

        {/* Compact Horizontal Statistics Bar */}
        <div className="bio-learning-strip p-3 flex items-center justify-between gap-4">
          {/* Completion Rate */}
          <div className="flex items-center gap-2.5 flex-1">
            <span className="w-8 h-8 rounded-app-btn bg-emerald-55 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 fill-emerald-500/20" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider block">{t.learningStats}</span>
              <span className="text-xs font-black text-slate-800 dark:text-white block mt-0.5">
                {overallPercent(unitLessons.map(l => l.id))}% {lang === 'ar' ? 'مكتمل' : 'Completed'}
              </span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0" />

          {/* Study Streak */}
          <div className="flex items-center gap-2.5 flex-1">
            <span className="w-8 h-8 rounded-app-btn bg-amber-50 dark:bg-amber-955/50 dark:bg-amber-950 text-amber-500 flex items-center justify-center shrink-0">
              <Flame className="w-4.5 h-4.5 fill-amber-500" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider block">{t.studyStreak}</span>
              <span className="text-xs font-black text-slate-800 dark:text-white block mt-0.5">
                {getStreak()} {lang === 'ar' ? 'يوم' : 'Days'}
              </span>
            </div>
          </div>
        </div>

        {/* Lessons List */}
        <section className="space-y-4">
          
          {/* Unit Header */}
          <div className="flex items-center justify-between py-2 border-b-2 border-emerald-500">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {lang === 'ar' ? `${unitLessons.length} دروس` : `${unitLessons.length} Lessons`}
            </h4>
            <span className="text-[10px] font-black bg-emerald-500 text-white px-3 py-1.5 rounded-full shadow-md">
              {overallPercent(unitLessons.map(l => l.id))}% {lang === 'ar' ? 'مكتمل' : 'complete'}
            </span>
          </div>

          {unitLessons.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-bold text-sm">
              {lang === 'ar' ? 'لا توجد دروس متاحة في هذه الوحدة حالياً.' : 'No lessons available in this unit yet.'}
            </div>
          ) : (
            [...unitLessons]
              .sort((a, b) => {
                const getL = (id: string) => {
                  const match = id.match(/-l(\d+)/i);
                  return match ? parseInt(match[1], 10) : 999;
                };
                return getL(a.id) - getL(b.id);
              })
              .filter(lesson => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (
                  (lesson.folder.split('/')[1] || '').toLowerCase().includes(q) ||
                  lesson.titleAr.toLowerCase().includes(q)
                );
              })
              .map((lesson, idx) => {
              const isLocked = lesson.locked && !premiumUnlocked;

              return (
                <div 
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson)}
                  style={{ '--unit-accent': unitAccent } as React.CSSProperties}
                  className={`bio-lesson-card p-5 flex items-center justify-between transition-all duration-200 active:scale-[0.99] cursor-pointer group ${
                    isLocked 
                      ? 'opacity-70'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="bio-lesson-index w-12 h-12 rounded-app-btn flex flex-col items-center justify-center transition-colors duration-200 shrink-0">
                      <span className="text-[9px] font-black opacity-70">{lang === 'ar' ? 'درس' : 'L'}</span>
                      <span className="text-base font-black leading-none">{idx + 1}</span>
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                      <h5 className={`font-black text-slate-800 dark:text-slate-100 text-[15px] mb-1 ${isLocked ? 'text-slate-500 dark:text-slate-450' : ''}`}>
                        {lesson.folder.split('/')[1] || lesson.titleAr}
                      </h5>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const pct = isLocked ? 0 : lessonPercent(lesson.id);
                          const label = pct === 0 ? (lang === 'ar' ? 'لم يبدأ' : 'Not started')
                                      : pct === 33 ? (lang === 'ar' ? 'بدأت' : 'Started')
                                      : pct === 66 ? (lang === 'ar' ? 'شاهدت الفيديو' : 'Video done')
                                      : (lang === 'ar' ? 'مكتمل ✓' : 'Done ✓');
                          return (
                            <>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    isLocked ? 'bg-slate-300 dark:bg-slate-700'
                                    : pct === 100 ? 'bg-emerald-500'
                                    : pct > 0 ? 'bg-amber-400'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${
                                pct === 100 ? 'text-emerald-500' : pct > 0 ? 'text-amber-500' : 'text-slate-400'
                              }`}>{label}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  {isLocked ? (
                    <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                  ) : (
                    <Play className="w-5 h-5 text-slate-450 group-hover:text-emerald-500 group-hover:scale-110 transition-all fill-slate-100 dark:fill-slate-800" />
                  )}
                </div>
              );
            })
          )}

        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bio-bottom-nav fixed z-50 flex justify-around items-center px-3 py-2.5">
        <button 
          onClick={() => onNavigate('main-dashboard', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.home}</span>
        </button>

        <button 
          onClick={() => onNavigate('units-navigation', 'none')} 
          className="bio-bottom-nav__active flex flex-col items-center justify-center rounded-app-btn px-4 py-1.5 active:scale-90 transition-transform font-black"
        >
          <BookOpen className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span className="text-xs">{t.myLessonsMenu}</span>
        </button>

        <button 
          onClick={onQuizNavigate} 
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
