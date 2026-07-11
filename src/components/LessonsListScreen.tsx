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

interface LessonsListScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  selectedUnit: number;
  onSelectLesson: (lesson: Lesson) => void;
  onQuizNavigate: () => void;
}

export default function LessonsListScreen({ onNavigate, lang, lessons, selectedUnit, onSelectLesson, onQuizNavigate }: LessonsListScreenProps) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    setPremiumUnlocked(localStorage.getItem('premium_unlocked') === 'true');
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

  // Extract unique units based on the first folder segment
  const uniqueUnits = lessons.reduce<string[]>((acc, lesson) => {
    const unitFolder = lesson.folder.split('/')[0];
    if (unitFolder && !acc.includes(unitFolder)) {
      acc.push(unitFolder);
    }
    return acc;
  }, []);

  const currentUnitFolder = uniqueUnits[selectedUnit - 1] || '';

  const getUnitTitle = () => {
    return currentUnitFolder;
  };

  // Filter lessons belonging to the currently selected unit
  const unitLessons = lessons.filter(l => l.folder.split('/')[0] === currentUnitFolder);

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="flex items-center px-6 h-16 w-full fixed top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-md shadow-slate-100/50 dark:shadow-none">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate('units-navigation', 'push_back')} 
              className="active:scale-95 transition-transform p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.syllabusDetails}</h1>
          </div>
          <button
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}
            className={`p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 ${showSearch ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
              className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
        )}
        
        {/* Hero Branding Section */}
        <div className="mb-2 mt-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
            {getUnitTitle()}
          </h2>
        </div>

        {/* Compact Horizontal Statistics Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex items-center justify-between gap-4">
          {/* Completion Rate */}
          <div className="flex items-center gap-2.5 flex-1">
            <span className="w-8 h-8 rounded-lg bg-emerald-55 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
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
            <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-955/50 dark:bg-amber-950 text-amber-500 flex items-center justify-center shrink-0">
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
            unitLessons
              .filter(lesson => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (
                  (lesson.folder.split('/')[1] || '').toLowerCase().includes(q) ||
                  lesson.titleAr.toLowerCase().includes(q) ||
                  lesson.titleEn.toLowerCase().includes(q)
                );
              })
              .map((lesson, idx) => {
              const isLocked = lesson.locked && !premiumUnlocked;
              // Cycle colors for variety
              const colorSchemes = [
                { bg: 'bg-emerald-55 bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-300', activeBg: 'group-hover:bg-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300' },
                { bg: 'bg-purple-55 bg-purple-50 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-300', activeBg: 'group-hover:bg-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300' },
                { bg: 'bg-blue-55 bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-300', activeBg: 'group-hover:bg-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300' }
              ];
              const scheme = colorSchemes[idx % colorSchemes.length];

              return (
                <div 
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson)}
                  className={`bg-white dark:bg-slate-900 border p-5 rounded-[24px] flex items-center justify-between transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-sm group ${
                    isLocked 
                      ? 'border-slate-100 dark:border-slate-800/80 opacity-70'
                      : `border-slate-100 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg`
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:text-white transition-colors duration-200 ${scheme.iconBg} ${isLocked ? '' : scheme.activeBg}`}>
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                      <h5 className={`font-black text-slate-850 dark:text-slate-100 text-[15px] mb-1 ${isLocked ? 'text-slate-500 dark:text-slate-450' : ''}`}>
                        {lesson.folder.split('/')[1] || (lang === 'ar' ? lesson.titleAr : lesson.titleEn)}
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
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-300/30">
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
