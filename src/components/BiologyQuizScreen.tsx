/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  CheckCircle, 
  HelpCircle, 
  Compass, 
  BookOpen, 
  User, 
  PenTool,
  XCircle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Sparkles
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { markQuizDone, getLessonProgress } from '../utils/progress';
import { SecureStorage } from '../utils/security';
import { VirtualizedList } from './VirtualizedList';
import { getCachedAssetUrl } from '../utils/cacheManager';

interface QuestionImageProps {
  lessonId: string;
  folder: string;
  fileName: string;
}

function QuestionImage({ lessonId, folder, fileName }: QuestionImageProps) {
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const loadImg = async () => {
      try {
        const fallback = `/${folder}/${fileName}`;
        const url = await getCachedAssetUrl(lessonId, fileName, fallback);
        if (active) setImgUrl(url);
      } catch (e) {
        if (active) setImgUrl(`/${folder}/${fileName}`);
      }
    };
    loadImg();
    return () => { active = false; };
  }, [lessonId, folder, fileName]);

  if (!imgUrl) return null;

  return (
    <div className="w-full flex justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-xl shadow-sm overflow-hidden my-2">
      <img 
        src={imgUrl} 
        alt="Question Diagram" 
        className="max-h-28 object-contain rounded-lg"
      />
    </div>
  );
}

interface BiologyQuizScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lesson: Lesson | null;
  lessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
}

interface Question {
  id: number;
  text: string;
  type: 'mcq' | 'tf' | 'fill';
  options?: { key: string; text: string }[];
  correctKey?: string;
  correctAnswers?: string[];
  explanation: string;
  hint?: string;
  definition?: string;
  questionImage?: string;
}

export default function BiologyQuizScreen({ onNavigate, lang, lesson, lessons, onSelectLesson }: BiologyQuizScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillInput, setFillInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);

  const [hintsUsed, setHintsUsed] = useState<Set<number>>(new Set());
  const [showHintMsg, setShowHintMsg] = useState(false);

  const t = translations[lang];

  // Helper to normalize Arabic characters to ensure validation is bulletproof
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

  const backIcon = lang === 'ar'
    ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" />
    : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center font-bold text-slate-400" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {lang === 'ar' ? 'جاري تحميل الاختبار...' : 'Loading quiz...'}
      </div>
    );
  }

  // Dynamic mapping of lesson.quiz to local Question structure
  const questions: Question[] = (lesson.quiz || [])
    .filter(q => q.type === 'mcq' || q.type === 'tf' || q.type === 'fill' || q.type === 'fill_blank')
    .map((q) => {
    let mappedType: 'mcq' | 'tf' | 'fill' = 'mcq';
    if (q.type === 'tf') mappedType = 'tf';
    else if (q.type === 'fill_blank' || q.type === 'fill') mappedType = 'fill';
    
    return {
      id: q.id,
      type: mappedType,
      text: lang === 'ar' ? q.textAr : q.textEn,
      options: q.options?.map((opt) => ({
        key: opt.key,
        text: lang === 'ar' ? opt.textAr : opt.textEn
      })),
      correctKey: q.correctKey,
      correctAnswers: q.correctAnswers,
      explanation: lang === 'ar' ? q.explanationAr : q.explanationEn,
      hint: lang === 'ar' ? q.hintAr : q.hintEn,
      definition: lang === 'ar' ? q.definitionAr : q.definitionEn,
      questionImage: q.questionImage
    };
  });

  if (questions.length === 0) {
    return (
      <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <header className="flex items-center px-6 h-16 w-full fixed top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-md shadow-slate-100/30 dark:shadow-none">
          <div className="flex items-center gap-4 w-full">
            <button 
              onClick={() => onNavigate('lessons-list', 'push_back')}
              className="active:scale-95 transition-transform text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.quizScreenHeading}</h1>
          </div>
        </header>
        <main className="pt-20 px-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center animate-fadeIn">
          <HelpCircle className="w-16 h-16 text-slate-350 dark:text-slate-700 animate-bounce" />
          <h2 className="text-lg font-black text-slate-700 dark:text-slate-350">
            {lang === 'ar' ? 'لا توجد أسئلة اختبار متوفرة حالياً' : 'No quiz questions available yet'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold max-w-sm">
            {lang === 'ar' ? 'يتم إعداد الأسئلة التفاعلية لهذا الدرس وسوف تتوفر قريباً.' : 'Interactive questions for this lesson are being prepared and will be available soon.'}
          </p>
          <button 
            onClick={() => onNavigate('lessons-list', 'push_back')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
          >
            {lang === 'ar' ? 'العودة لقائمة الدروس' : 'Back to Lessons List'}
          </button>
        </main>
      </div>
    );
  }

  const handleOptionClick = (key: string) => {
    if (showFeedback) return;
    setSelectedOption(key);
    const currentQ = questions[currentQuestionIndex];
    const correct = key === currentQ.correctKey;
    setIsAnswerCorrect(correct);
    if (correct) {
      const isHintUsed = hintsUsed.has(currentQ.id);
      const earnedPoints = isHintUsed ? 0.75 : 1.0;
      setScore((prev) => prev + earnedPoints);
    }
    setShowFeedback(true);
    
    if (lesson) {
      SecureStorage.setItem(`quiz_progress_${lesson.id}`, {
        questionIndex: currentQuestionIndex,
        selectedAnswer: key,
        timestamp: Date.now()
      });
    }
  };

  const handleFillSubmit = () => {
    if (showFeedback || !fillInput.trim()) return;
    const currentQ = questions[currentQuestionIndex];
    const correct = validateFillAnswer(fillInput, currentQ.correctAnswers || []);
    setIsAnswerCorrect(correct);
    if (correct) {
      const isHintUsed = hintsUsed.has(currentQ.id);
      const earnedPoints = isHintUsed ? 0.75 : 1.0;
      setScore((prev) => prev + earnedPoints);
    }
    setShowFeedback(true);
    
    if (lesson) {
      SecureStorage.setItem(`quiz_progress_${lesson.id}`, {
        questionIndex: currentQuestionIndex,
        selectedAnswer: fillInput,
        timestamp: Date.now()
      });
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setFillInput('');
    setShowFeedback(false);
    setShowHintMsg(false); // Reset hint display for next question
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Quiz finished — save real score
      if (lesson) markQuizDone(lesson.id, score, questions.length);
      setQuizFinished(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setFillInput('');
    setShowFeedback(false);
    setShowHintMsg(false);
    setHintsUsed(new Set()); // Reset hints used
    setScore(0);
    setQuizFinished(false);
  };

  const currentQ = questions[currentQuestionIndex];
  const progressPercent = ((currentQuestionIndex + (quizFinished ? 1 : 0)) / questions.length) * 100;

  // Determine section label based on question type
  const getSectionLabel = () => {
    if (currentQ.type === 'tf') {
      return lang === 'ar' ? 'أسئلة صح وخطأ' : 'True / False';
    } else if (currentQ.type === 'mcq') {
      return lang === 'ar' ? 'اختيار من متعدد' : 'Multiple Choice';
    } else {
      return lang === 'ar' ? 'أكمل العبارة' : 'Fill in the Blank';
    }
  };

  if (lesson.quizLocked) {
    return (
      <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <header className="flex items-center px-6 h-16 w-full fixed top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-md shadow-slate-100/30 dark:shadow-none">
          <div className="flex items-center gap-4 w-full">
            <button 
              onClick={() => onNavigate('lessons-list', 'push_back')}
              className="active:scale-95 transition-transform text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.quizScreenHeading}</h1>
          </div>
        </header>
        <main className="pt-20 px-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh] relative">
          <div className="w-full min-h-[400px] relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl p-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-3xl flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2500/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm mb-2">
              {lang === 'ar' ? 'تم قفل هذا الاختبار من قبل المعلم' : 'This quiz is locked by the teacher.'}
            </h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold max-w-sm mb-4 leading-relaxed">
              {lang === 'ar' ? 'يرجى تفعيل النسخة الكاملة للتطبيق للوصول إلى هذا المحتوى.' : 'Please activate the full app version to access this content.'}
            </p>
            <button
              onClick={() => onNavigate('student-profile', 'push')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              تفعيل النسخة الكاملة الآن 🔑
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="flex items-center px-6 h-16 w-full fixed top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4 w-full">
          <button 
            onClick={() => onNavigate('lessons-list', 'push_back')}
            className="active:scale-95 transition-transform text-slate-800 dark:text-slate-200"
          >
            {backIcon}
          </button>
          <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.quizScreenHeading}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-18 px-4 max-w-2xl mx-auto space-y-3.5">
        
        {/* Progress Header */}
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <div className="flex justify-between items-end mb-2">
            <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block">
                {lang === 'ar'
                  ? `السؤال ${currentQuestionIndex + 1} من ${questions.length}`
                  : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
              </span>
              <h2 className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                {getSectionLabel()}
              </h2>
            </div>
            <span className="text-xs text-emerald-500 font-black">
              {score} {lang === 'ar' ? 'درجة' : 'pts'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </section>

        {!quizFinished ? (
          <div className="space-y-3 animate-fadeIn">
            {/* Question Image (if present) - Hidden when feedback is shown to save space for next button */}
            {!showFeedback && currentQ.questionImage && lesson && (
              <QuestionImage 
                lessonId={lesson.id} 
                folder={lesson.folder} 
                fileName={currentQ.questionImage} 
              />
            )}

            {/* Question Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
              <p className="text-slate-850 dark:text-slate-100 text-xs font-black leading-relaxed">
                <strong>{currentQuestionIndex + 1}.</strong> {currentQ.text}
              </p>
            </div>

            {/* Hint Section */}
            {(currentQ.hint || currentQ.definition) && !showFeedback && (
              <div className="flex flex-col items-end pt-1">
                {showHintMsg ? (
                  <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl text-right animate-fadeIn">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mb-1">
                      💡 {lang === 'ar' ? 'التلميح التعليمي / التعريف:' : 'Study Hint / Definition:'}
                    </span>
                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {currentQ.hint || currentQ.definition}
                    </p>
                    <span className="text-[10px] font-bold text-amber-500 mt-2 block">
                      {lang === 'ar' ? '* تم خصم 0.25 درجة من قيمة هذا السؤال لاستخدام المساعدة.' : '* 0.25 pts penalty applied for using help.'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const confirmMsg = lang === 'ar'
                        ? 'هل تريد إظهار التلميح مقابل خصم 0.25 درجة من هذا السؤال؟'
                        : 'Do you want to show the hint in exchange for a 0.25 point deduction on this question?';
                      if (window.confirm(confirmMsg)) {
                        setHintsUsed(prev => {
                          const next = new Set(prev);
                          next.add(currentQ.id);
                          return next;
                        });
                        setShowHintMsg(true);
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 font-extrabold bg-amber-500/10 hover:bg-amber-500/15 px-3.5 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <span>💡</span>
                    <span>{lang === 'ar' ? 'عرض التلميح (خصم 0.25 د)' : 'Show Hint (-0.25 pts)'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Interactive Options Cards */}
            {currentQ.type !== 'fill' ? (
              <div className="space-y-3">
                <VirtualizedList
                  items={currentQ.options || []}
                  itemHeight={52}
                  renderItem={(opt: any) => {
                    const isSelected = selectedOption === opt.key;
                    const isCorrectOpt = opt.key === currentQ.correctKey;
                    
                    let optionStyle = 'border-slate-100 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/10 dark:hover:bg-slate-800/40';
                    let checkBadge = null;

                    if (showFeedback) {
                      if (isCorrectOpt) {
                        optionStyle = 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20';
                        checkBadge = <CheckCircle className={`w-5 h-5 text-emerald-600 shrink-0 ${lang === 'ar' ? 'mr-auto' : 'ml-auto'}`} />;
                      } else if (isSelected) {
                        optionStyle = 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20';
                        checkBadge = <XCircle className={`w-5 h-5 text-rose-500 shrink-0 ${lang === 'ar' ? 'mr-auto' : 'ml-auto'}`} />;
                      }
                    }

                    return (
                      <button 
                        key={opt.key}
                        onClick={() => handleOptionClick(opt.key)}
                        className={`w-full flex items-center p-2.5 rounded-xl border transition-all group active:scale-[0.99] bg-white dark:bg-slate-900 ${
                          lang === 'ar' ? 'text-right' : 'text-left'
                        } ${optionStyle}`}
                        disabled={showFeedback}
                      >
                        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors shrink-0 ${
                          lang === 'ar' ? 'ml-2.5' : 'mr-2.5'
                        } ${
                          isSelected 
                            ? (isCorrectOpt ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-650 dark:text-slate-350 group-hover:bg-emerald-500 group-hover:text-white'
                        }`}>
                          {opt.key === 'T' ? '1' : opt.key === 'F' ? '2' : opt.key}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex-1 leading-tight">{opt.text}</span>
                        {checkBadge}
                      </button>
                    );
                  }}
                />
              </div>
            ) : (
              /* Fill in the Blank Form */
              <div className="space-y-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl">
                <input 
                  type="text" 
                  value={fillInput} 
                  onChange={(e) => setFillInput(e.target.value)}
                  disabled={showFeedback}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-850 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder={lang === 'ar' ? 'اكتب كلمتك هنا...' : 'Type your word here...'}
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
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 dark:disabled:bg-slate-855 disabled:text-slate-400 text-white font-extrabold py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    {lang === 'ar' ? 'إنهاء الإجابة والتحقق' : 'Submit & Verify Answer'}
                  </button>
                ) : (
                  <div className="text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-650 dark:text-slate-350">
                    {lang === 'ar' 
                      ? `إجابتك: ${fillInput}` 
                      : `Your Answer: ${fillInput}`}
                  </div>
                )}
              </div>
            )}

            {/* Explanation Alert Banner */}
            {showFeedback && (
              <div className={`p-3 rounded-xl flex items-start gap-2.5 border animate-fadeIn ${
                isAnswerCorrect 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900 text-emerald-900 dark:text-emerald-350' 
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-150 dark:border-rose-950 text-rose-900 dark:text-rose-350'
              }`}>
                {isAnswerCorrect ? (
                  <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-500" />
                )}
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <p className="font-extrabold text-[11px]">
                    {isAnswerCorrect ? t.correctAnswerText : t.wrongAnswerText}
                  </p>
                  <p className="text-[10px] opacity-90 mt-0.5 leading-relaxed font-bold">
                    {currentQ.explanation}
                  </p>
                </div>
              </div>
            )}

            {/* Next Action trigger */}
            {showFeedback && (
              <div className={`flex ${lang === 'ar' ? 'justify-end' : 'justify-start'} pt-1`}>
                <button 
                  onClick={handleNextQuestion}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {currentQuestionIndex === questions.length - 1 
                    ? (lang === 'ar' ? 'عرض النتائج النهائية' : 'Show Final Results') 
                    : (lang === 'ar' ? 'السؤال التالي' : 'Next Question')}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Finished Score Card View */
          <>
          <section className="bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-scaleUp">
            {/* Trophy icon */}
            <div className="flex justify-center mb-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                Math.round((score / questions.length) * 100) === 100
                  ? 'bg-amber-400 shadow-amber-300/40'
                  : Math.round((score / questions.length) * 100) >= 75
                  ? 'bg-emerald-500 shadow-emerald-300/30'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}>
                <Trophy className={`w-8 h-8 ${
                  Math.round((score / questions.length) * 100) >= 75 ? 'text-white' : 'text-slate-500'
                }`} />
              </div>
            </div>

            <h3 className="font-black text-base text-slate-800 dark:text-white mb-2">{t.performanceSummary}</h3>
            
            <div className="flex justify-around items-center py-4">
              <div>
                <span className="block text-3xl font-black text-emerald-500">{score}/{questions.length}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">{t.scoreLabel}</span>
              </div>
              <div className="w-px h-10 bg-slate-100 dark:bg-slate-850"></div>
              <div>
                <span className="block text-2xl font-black text-slate-900 dark:text-white">
                  {Math.round((score / questions.length) * 100)}%
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                  {lang === 'ar' ? 'النسبة' : 'Percentage'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-6 leading-relaxed px-4">
              {score === questions.length 
                ? (lang === 'ar' ? 'درجة كاملة رائعة! أنت متميز وبطل حقيقي في مادة الأحياء!' : 'Perfect score! You are an amazing Biology Champion!') 
                : score >= Math.ceil(questions.length * 0.75)
                  ? (lang === 'ar' ? 'أداء رائع جداً! لقد اجتزت الاختبار بتفوق كبير.' : 'Wonderful job! You passed the test with great results.')
                  : (lang === 'ar' ? 'أداء جيد، يمكنك مراجعة الدرس وإعادة المحاولة لتحقيق نتيجة أفضل.' : 'Good effort! You can review the lesson and retry to achieve a better score.')
              }
            </p>

            <div className="flex gap-3">
              <button 
                onClick={handleRestartQuiz}
                className="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl active:scale-95 transition-all text-xs border border-slate-100 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                {t.retakeQuiz}
              </button>
              <button 
                onClick={() => onNavigate('lessons-list', 'push_back')}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl active:scale-95 transition-all text-xs cursor-pointer"
              >
                {lang === 'ar' ? 'قائمة الدروس' : 'Lessons List'}
              </button>
            </div>
          </section>

          {/* Next Lesson Card */}
          {(() => {
            const currentIdx = lessons.findIndex(l => l.id === lesson.id);
            const nextLesson = currentIdx >= 0 && currentIdx < lessons.length - 1
              ? lessons[currentIdx + 1]
              : null;

            if (nextLesson) {
              const nextTitle = nextLesson.folder.split('/')[1] ||
                (lang === 'ar' ? nextLesson.titleAr : nextLesson.titleEn);
              return (
                <section className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[28px] p-6 shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-100" />
                      <span className="text-emerald-100 text-xs font-extrabold uppercase tracking-wider">
                        {lang === 'ar' ? 'الدرس التالي' : 'Next Lesson'}
                      </span>
                    </div>
                    <h4 className="text-white font-black text-sm mb-4 leading-snug">{nextTitle}</h4>
                    <button
                      onClick={() => {
                        onSelectLesson(nextLesson);
                        onNavigate('lesson-details', 'push');
                      }}
                      className="w-full bg-white/20 hover:bg-white/30 backdrop-blur text-white font-black py-3.5 rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 border border-white/20"
                    >
                      {lang === 'ar' ? 'انتقل للدرس التالي' : 'Go to Next Lesson'}
                      {lang === 'ar'
                        ? <ChevronLeft className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </section>
              );
            } else {
              return (
                <section className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-[28px] p-6 shadow-xl shadow-amber-500/20 text-center relative overflow-hidden">
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                  <div className="relative z-10">
                    <div className="text-4xl mb-2">🎉</div>
                    <h4 className="text-white font-black text-base mb-1">
                      {lang === 'ar' ? 'أنجزت جميع دروس الوحدة!' : 'You Completed All Lessons!'}
                    </h4>
                    <p className="text-amber-100 text-xs font-bold">
                      {lang === 'ar' ? 'لقد أتممت جميع دروس هذه الوحدة بنجاح. أنت رائع!' : 'You have finished all lessons in this unit. Excellent work!'}
                    </p>
                  </div>
                </section>
              );
            }
          })()}
          </>
        )}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl rounded-t-2xl">
        <button 
          onClick={() => onNavigate('main-dashboard', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.home}</span>
        </button>
        
        <button 
          onClick={() => onNavigate('units-navigation', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myLessonsMenu}</span>
        </button>

        <button 
          onClick={() => onNavigate('biology-quiz', 'none')} 
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl px-4 py-1.5 active:scale-90 transition-transform font-black"
        >
          <PenTool className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span className="text-xs">{t.openTraining}</span>
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
