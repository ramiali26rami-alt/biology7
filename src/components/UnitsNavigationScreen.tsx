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
  GitBranch
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';

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
    setPremiumUnlocked(localStorage.getItem('premium_unlocked') === 'true');
  }, []);

  // Extract unique units based on unit number
  const uniqueUnits = lessons.reduce<number[]>((acc, lesson) => {
    const unitNum = Number(lesson.unit) || 1;
    if (!acc.includes(unitNum)) {
      acc.push(unitNum);
    }
    return acc;
  }, []).sort((a, b) => a - b);

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
    const trans = translations[currentLang];
    if (unitNum === 1) return trans.unit1Title || 'الوحدة الأولى: التنظيم العصبي في الكائن الحي';
    if (unitNum === 2) return trans.unit2Title || 'الوحدة الثانية: البيولوجيا الجزيئية';
    return currentLang === 'ar' ? `الوحدة ${unitNum}` : `Unit ${unitNum}`;
  };

  const getUnitSubtitle = (idx: number) => {
    if (lang === 'ar') {
      const labels = ['الوحدة الأولى', 'الوحدة الثانية', 'الوحدة الثالثة', 'الوحدة الرابعة', 'الوحدة الخامسة'];
      return labels[idx] || `الوحدة ${idx + 1}`;
    } else {
      const labels = ['UNIT 1', 'UNIT 2', 'UNIT 3', 'UNIT 4', 'UNIT 5'];
      return labels[idx] || `UNIT ${idx + 1}`;
    }
  };

  const unitStyles = [
    {
      icon: <GitBranch className="w-6 h-6" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-600 dark:text-emerald-350',
      accentText: 'text-emerald-500 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500',
      hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-500',
      hoverText: 'group-hover:text-emerald-500'
    },
    {
      icon: <Dna className="w-6 h-6" />,
      bg: 'bg-purple-50 dark:bg-purple-950',
      text: 'text-purple-600 dark:text-purple-300',
      accentText: 'text-purple-500 dark:text-purple-400',
      badgeBg: 'bg-purple-500',
      hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-500',
      hoverText: 'group-hover:text-purple-500'
    },
    {
      icon: <Binary className="w-6 h-6" />,
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-600 dark:text-blue-300',
      accentText: 'text-blue-500 dark:text-blue-400',
      badgeBg: 'bg-blue-500',
      hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500',
      hoverText: 'group-hover:text-blue-500'
    }
  ];

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('main-dashboard', 'push_back')} 
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
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
          <div className="bg-gradient-to-tr from-slate-900 to-slate-850 text-white p-6 rounded-[28px] border border-slate-700 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="font-black text-base text-amber-200">{lang === 'ar' ? 'الباب مغلق ومحمي!' : 'Content Premium Locked!'}</h3>
              </div>
              <button 
                onClick={() => setShowPremiumPrompt(false)}
                className="text-slate-400 hover:text-white font-extrabold text-sm"
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
                className="flex-1 bg-slate-850 text-slate-400 hover:text-white font-bold py-2 rounded-xl text-xs border border-slate-700"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
              <button 
                onClick={() => onNavigate('student-profile', 'push')} 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs shadow-md"
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
                className={`bg-white dark:bg-slate-900 border p-6 rounded-[32px] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99] group flex flex-col justify-between min-h-[160px] ${
                  isLocked 
                    ? 'border-slate-100 dark:border-slate-800 opacity-80' 
                    : `border-slate-100 dark:border-slate-800 ${style.hoverBorder}`
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${style.bg} ${style.text}`}>
                    {style.icon}
                  </div>
                  <span className={`text-xs font-black text-white px-3 py-1.5 rounded-full shadow-md ${style.badgeBg}`}>
                    {lessonsCount} {t.lessonsQuantity}
                  </span>
                </div>
                <div className="mt-4">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide block ${style.accentText}`}>
                    {getUnitSubtitle(idx)}
                  </span>
                  <h3 className={`font-black text-slate-800 dark:text-white text-base mt-0.5 transition-colors ${style.hoverText}`}>
                    {unitTitle}
                  </h3>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold border-t border-slate-50 dark:border-slate-800 pt-3 mt-4">
                  <span>
                    {idx === 0 
                      ? (lang === 'ar' ? 'مفتوح بالكامل مجاناً' : 'Fully Unlocked')
                      : premiumUnlocked 
                        ? (lang === 'ar' ? 'مفتوح بريميوم' : 'Unlocked with Premium')
                        : (lang === 'ar' ? 'مغلق (يتطلب اشتراك)' : 'Requires Upgrade')}
                  </span>
                  {isLocked 
                    ? <Lock className="w-4 h-4 text-amber-500" />
                    : <Unlock className="w-4 h-4 text-emerald-500" />}
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
