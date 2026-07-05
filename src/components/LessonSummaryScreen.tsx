/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Compass, 
  BookOpen, 
  PenTool, 
  User, 
  Sparkles,
  HelpCircle,
  RotateCw,
  Award,
  FileText
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { VirtualizedList } from './VirtualizedList';

interface LessonSummaryScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lesson: Lesson | null;
}

export default function LessonSummaryScreen({ onNavigate, lang, lesson }: LessonSummaryScreenProps) {
  const [flippedCard, setFlippedCard] = useState<number | null>(null);

  const t = translations[lang];

  const handleCardClick = (idx: number) => {
    setFlippedCard(flippedCard === idx ? null : idx);
  };

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center font-bold text-slate-400" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {lang === 'ar' ? 'جاري تحميل الملخص...' : 'Loading summary details...'}
      </div>
    );
  }

  const summaryPoints = lang === 'ar' ? lesson.summaryPointsAr : lesson.summaryPointsEn;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('lesson-video', 'push_back')} 
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
          >
            {backIcon}
          </button>
          <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.summaryHeading}</h1>
        </div>
        <button className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-500">
          <Sparkles className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Study Tabs */}
        <nav className="flex overflow-x-auto gap-4 scrollbar-none border-b border-slate-100 dark:border-slate-800 pb-2">
          <button 
            onClick={() => onNavigate('lesson-details', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {t.detailsTitle}
          </button>
          <button 
            onClick={() => onNavigate('lesson-video', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {t.videoTab}
          </button>
          <button className="flex-shrink-0 px-4 py-2 text-sm font-black text-emerald-500 border-b-2 border-emerald-500">
            {lang === 'ar' ? 'الملخص' : 'Summary'}
          </button>
          <button 
            onClick={() => onNavigate('biology-quiz', 'none')}
            className="flex-shrink-0 px-4 py-2 text-sm font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
          >
            {t.quizTab}
          </button>
        </nav>

        {/* High-Yield Point Checklist */}
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-xl shadow-slate-200/20 dark:shadow-none space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-3">
            <span className="p-2 bg-amber-50 dark:bg-amber-950 rounded-xl text-amber-500">
              <Award className="w-5 h-5 fill-amber-500" />
            </span>
            <h3 className="font-black text-slate-800 dark:text-white text-[15px]">{t.highYieldTitle}</h3>
          </div>
          
          <ul className="space-y-3.5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {summaryPoints && summaryPoints.length > 0 ? (
              summaryPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
                  <p className="text-xs leading-5 font-extrabold text-slate-700 dark:text-slate-350">{point}</p>
                </li>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center font-bold">
                {lang === 'ar' ? 'لا توجد نقاط ملخصة مدرجة حالياً.' : 'No summary points listed yet.'}
              </p>
            )}
          </ul>
        </section>

        {/* 3D Flipping Flashcards Section */}
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white">{lang === 'ar' ? 'بطاقات الاستدعاء النشط التفاعلية' : 'Active Recall Flashcards'}</h3>
            <p className="text-xs text-slate-450 dark:text-slate-500 font-bold">{t.flashcardsSub}</p>
          </div>

          <div className="space-y-4">
            {lesson.flashcards && lesson.flashcards.length > 0 ? (
              <VirtualizedList
                items={lesson.flashcards}
                itemHeight={136}
                renderItem={(card: any, idx: number) => {
                  const isFlipped = flippedCard === idx;
                  const question = lang === 'ar' ? card.qAr : card.qEn;
                  const answer = lang === 'ar' ? card.aAr : card.aEn;

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleCardClick(idx)}
                      className="w-full min-h-[120px] pb-4 cursor-pointer relative perspective-1000 group active:scale-[0.98] transition-transform duration-150"
                    >
                      <div className={`w-full h-full min-h-[120px] relative transition-transform duration-500 transform-style-3d ${
                        isFlipped ? 'rotate-y-180' : ''
                      }`}>
                        {/* Front Side */}
                        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-md backface-hidden flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-500 shrink-0">
                              <HelpCircle className="w-5 h-5" />
                            </span>
                            <p className={`text-xs font-black text-slate-800 dark:text-slate-100 leading-normal ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                              {question}
                            </p>
                          </div>
                          <RotateCw className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0" />
                        </div>

                        {/* Back Side */}
                        <div className="absolute inset-0 w-full h-full bg-emerald-500 text-white rounded-2xl p-5 shadow-md backface-hidden rotate-y-180 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-white/20 rounded-xl text-white shrink-0">
                              <Sparkles className="w-5 h-5 fill-white" />
                            </span>
                            <p className={`text-xs font-black leading-relaxed ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                              {answer}
                            </p>
                          </div>
                          <RotateCw className="w-4 h-4 text-emerald-100 shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              <p className="text-xs text-slate-400 text-center font-bold">
                {lang === 'ar' ? 'لا توجد بطاقات استدعاء نشط مدرجة للدرس.' : 'No flashcards listed for this lesson.'}
              </p>
            )}
          </div>
        </section>

        {/* Next Study Phase Navigation Button */}
        <div className={`flex items-center mt-6 ${lang === 'ar' ? 'justify-end' : 'justify-start'}`}>
          <button 
            onClick={() => onNavigate('biology-quiz', 'push')}
            className="flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:scale-[1.02] active:scale-95 group transition-all"
          >
            {t.nextPhase}
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
