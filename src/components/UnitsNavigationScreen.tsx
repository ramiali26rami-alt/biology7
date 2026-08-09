/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Lock, 
  Unlock, 
  BookOpen, 
  Compass, 
  PenTool, 
  User, 
  Award,
  Crown,
  Dna,
  Binary,
  GitBranch,
  Brain,
  Activity,
  Heart,
  FlaskConical,
  Leaf,
  Globe
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { checkPremiumStatus } from '../utils/security';

interface UnitsNavigationScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lessons: Lesson[];
  onSelectUnit: (unit: number) => void;
  onQuizNavigate: () => void;
}

export default function UnitsNavigationScreen({ onNavigate, lang, lessons, onSelectUnit, onQuizNavigate }: UnitsNavigationScreenProps) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    setPremiumUnlocked(checkPremiumStatus());
  }, []);

  // Display all 8 units of the curriculum statically so they are always visible in the dashboard
  const uniqueUnits = [1, 2, 3, 4, 5, 6, 7, 8];

  const handleUnitClick = (unitId: number) => {
    onSelectUnit(unitId);
    if (unitId === 1) {
      // First unit is unlocked
      onNavigate('lessons-list', 'push');
    } else {
      // Subsequent units require premium
      if (premiumUnlocked) {
        onNavigate('lessons-list', 'push');
      } else {
        setShowPremiumPrompt(true);
      }
    }
  };

  const getFallbackUnitTitle = (unitNum: number, currentLang: Language) => {
    if (unitNum === 1) return currentLang === 'ar' ? 'الجهاز العصبي' : 'Nervous System';
    if (unitNum === 2) return currentLang === 'ar' ? 'التنظيم الهرموني' : 'Hormonal Regulation';
    if (unitNum === 3) return currentLang === 'ar' ? 'التكاثر في الكائنات الحية' : 'Reproduction in Living Organisms';
    if (unitNum === 4) return currentLang === 'ar' ? 'أساسيات علم الوراثة' : 'Basics of Genetics';
    if (unitNum === 5) return currentLang === 'ar' ? 'الوراثة الجزيئية' : 'Molecular Genetics';
    if (unitNum === 6) return currentLang === 'ar' ? 'التقانة الحيوية' : 'Biotechnology';
    if (unitNum === 7) return currentLang === 'ar' ? 'البيئة ومشكلاتها' : 'Environment and its Problems';
    if (unitNum === 8) return currentLang === 'ar' ? 'تاريخ الأرض' : 'History of Earth';
    return currentLang === 'ar' ? `الوحدة ${unitNum}` : `Unit ${unitNum}`;
  };

  const getUnitSubtitle = (idx: number) => {
    if (lang === 'ar') {
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
      return labels[idx] || `الوحدة ${idx + 1}`;
    } else {
      const labels = [
        'UNIT 1', 
        'UNIT 2', 
        'UNIT 3', 
        'UNIT 4', 
        'UNIT 5', 
        'UNIT 6', 
        'UNIT 7', 
        'UNIT 8'
      ];
      return labels[idx] || `UNIT ${idx + 1}`;
    }
  };

  const unitStyles = [
    {
      // Unit 1: الجهاز العصبي
      icon: <Brain className="w-8 h-8" />,
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      text: 'text-rose-600 dark:text-rose-400',
      accentText: 'text-rose-500 dark:text-rose-450 dark:text-rose-400',
      badgeBg: 'bg-rose-500',
      hoverBorder: 'hover:border-rose-500 dark:hover:border-rose-500',
      hoverText: 'group-hover:text-rose-500'
    },
    {
      // Unit 2: التنظيم الهرموني
      icon: <Activity className="w-8 h-8" />,
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-600 dark:text-amber-400',
      accentText: 'text-amber-500 dark:text-amber-400',
      badgeBg: 'bg-amber-500',
      hoverBorder: 'hover:border-amber-500 dark:hover:border-amber-500',
      hoverText: 'group-hover:text-amber-500'
    },
    {
      // Unit 3: التكاثر
      icon: <Heart className="w-8 h-8" />,
      bg: 'bg-red-50 dark:bg-red-950/30',
      text: 'text-red-600 dark:text-red-400',
      accentText: 'text-red-500 dark:text-red-400',
      badgeBg: 'bg-red-500',
      hoverBorder: 'hover:border-red-500 dark:hover:border-red-500',
      hoverText: 'group-hover:text-red-500'
    },
    {
      // Unit 4: أساسيات علم الوراثة
      icon: <Dna className="w-8 h-8" />,
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      text: 'text-purple-600 dark:text-purple-400',
      accentText: 'text-purple-500 dark:text-purple-400',
      badgeBg: 'bg-purple-500',
      hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-500',
      hoverText: 'group-hover:text-purple-500'
    },
    {
      // Unit 5: الوراثة الجزيئية
      icon: <Binary className="w-8 h-8" />,
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      text: 'text-indigo-600 dark:text-indigo-400',
      accentText: 'text-indigo-500 dark:text-indigo-400',
      badgeBg: 'bg-indigo-500',
      hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-500',
      hoverText: 'group-hover:text-indigo-500'
    },
    {
      // Unit 6: التقانة الحيوية
      icon: <FlaskConical className="w-8 h-8" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      accentText: 'text-emerald-500 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500',
      hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-500',
      hoverText: 'group-hover:text-emerald-500'
    },
    {
      // Unit 7: البيئة ومشكلاتها
      icon: <Leaf className="w-8 h-8" />,
      bg: 'bg-teal-50 dark:bg-teal-950/30',
      text: 'text-teal-600 dark:text-teal-400',
      accentText: 'text-teal-500 dark:text-teal-400',
      badgeBg: 'bg-teal-500',
      hoverBorder: 'hover:border-teal-500 dark:hover:border-teal-500',
      hoverText: 'group-hover:text-teal-500'
    },
    {
      // Unit 8: تاريخ الأرض
      icon: <Globe className="w-8 h-8" />,
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-600 dark:text-blue-400',
      accentText: 'text-blue-500 dark:text-blue-400',
      badgeBg: 'bg-blue-500',
      hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500',
      hoverText: 'group-hover:text-blue-500'
    }
  ];

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-[250ms]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('main-dashboard', 'push_back')} 
            aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
            className="active:scale-95 tap-target p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
          >
            {backIcon}
          </button>
          <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.unitsTitle}</h1>
        </div>
        {premiumUnlocked && (
          <span className="p-2 bg-amber-500/10 text-amber-500 rounded-full shrink-0">
            <Crown className="w-5 h-5 fill-amber-500 animate-pulse" />
          </span>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Intro */}
        <div className="mt-4">
          <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full mb-2">
            {t.biologyAcademy}
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t.biologySyllabusTitle}</h2>
          <p className="text-slate-500 dark:text-slate-450 text-sm font-medium mt-1">{t.biologySyllabusDesc}</p>
        </div>

        {/* Locked/Premium Gating Modal Prompt */}
        {showPremiumPrompt && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-app-card border border-slate-700 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="font-black text-base text-amber-200">{lang === 'ar' ? 'الباب مغلق ومحمي!' : 'Content Premium Locked!'}</h3>
              </div>
              <button 
                onClick={() => setShowPremiumPrompt(false)}
                className="tap-target text-slate-400 hover:text-white font-extrabold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.unitLockedDesc}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPremiumPrompt(false)} 
                className="flex-1 bg-slate-800 text-slate-400 hover:text-white font-bold py-2 rounded-app-btn text-xs border border-slate-700"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
              <button 
                onClick={() => onNavigate('student-profile', 'push')} 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-app-btn text-xs shadow-md"
              >
                {t.premiumButtonText}
              </button>
            </div>
          </div>
        )}

        {/* Units Cards Grid */}
        <section className="space-y-4">
          {uniqueUnits.map((unitNum, idx) => {
            const unitId = unitNum;
            const isLocked = idx > 0 && !premiumUnlocked;
            const lessonsCount = lessons.filter(l => Number(l.unit) === unitNum).length;
            const style = unitStyles[idx % unitStyles.length];
            const firstLesson = lessons.find(l => Number(l.unit) === unitNum);
            const unitTitle = (lang === 'ar' ? firstLesson?.unitNameAr : firstLesson?.unitNameEn) || 
              getFallbackUnitTitle(unitNum, lang);

            return (
              <div 
                key={unitNum}
                onClick={() => handleUnitClick(unitId)}
                className={`bg-white dark:bg-slate-900 border p-5 rounded-app-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99] group flex items-center justify-between gap-4.5 ${
                  isLocked 
                    ? 'border-slate-100 dark:border-slate-800 opacity-80' 
                    : `border-slate-100 dark:border-slate-800 ${style.hoverBorder}`
                }`}
              >
                <div className="flex items-center gap-4.5 flex-1 min-w-0">
                  <div className={`w-14 h-14 rounded-app-card flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <h3 className="font-black text-slate-800 dark:text-white transition-colors leading-snug">
                      <span className={`text-[16px] font-black uppercase tracking-wide inline-block ${lang === 'ar' ? 'ms-2' : 'me-2'} ${style.accentText}`}>
                        {getUnitSubtitle(idx)}:
                      </span>
                      <span className={`text-[20px] ${style.hoverText}`}>{unitTitle}</span>
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isLocked && <Lock className="w-4.5 h-4.5 text-amber-500" />}
                  <span className={`text-[12px] font-black text-white px-3.5 py-1 rounded-app-btn shadow-sm shrink-0 ${style.badgeBg}`}>
                    {lessonsCount} {t.lessonsQuantity}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

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
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-app-btn px-4 py-1.5 active:scale-90 transition-transform font-black"
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
