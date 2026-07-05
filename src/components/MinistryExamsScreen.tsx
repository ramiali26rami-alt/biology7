/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  Download, 
  Award,
  Play,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCw,
  Compass,
  BookOpen,
  PenTool,
  User,
  Crown
} from 'lucide-react';
import { ScreenId, Lesson } from '../types';
import { translations, Language } from '../utils/translations';
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
    <div className="w-full flex justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-2xl shadow-sm overflow-hidden my-2">
      <img 
        src={imgUrl} 
        alt="Question Diagram" 
        className="max-h-48 object-contain rounded-xl"
      />
    </div>
  );
}

interface MinistryExamsScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  lesson: Lesson | null;
  lessons: Lesson[];
}

interface ExamPaper {
  id: string;
  title: string;
  duration: string;
  year: number;
}

export default function MinistryExamsScreen({ onNavigate, lang, lesson, lessons }: MinistryExamsScreenProps) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10800); // 180 minutes in seconds (3 hours)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [hintsUsed, setHintsUsed] = useState<Set<number>>(new Set());
  const [examFinished, setExamFinished] = useState(false);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    setPremiumUnlocked(localStorage.getItem('premium_unlocked') === 'true');
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: any = null;
    if (isSimulating && timeLeft > 0 && !examFinished) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setExamFinished(true);
    }
    return () => clearInterval(interval);
  }, [isSimulating, timeLeft, examFinished]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const remainingSecs = totalSecs % 3600;
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartExam = () => {
    setIsSimulating(true);
    setTimeLeft(10800); // Reset to 3 hours
    setSelectedAnswers({});
    setHintsUsed(new Set());
    setExamFinished(false);
  };

  const handleAnswerSelect = (questionId: number, optionKey: string) => {
    if (examFinished) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleFinishExam = () => {
    setExamFinished(true);
  };

  const handleSimulateDownload = (examId: string) => {
    setDownloadSuccessId(examId);
    setTimeout(() => {
      setDownloadSuccessId(null);
    }, 2500);
  };

  const exams: ExamPaper[] = [
    { id: '2024', title: t.examYemeni2024, duration: t.examDuration, year: 2024 },
    { id: '2023', title: t.examYemeni2023, duration: t.examDuration, year: 2023 },
    { id: '2022_1', title: t.exam2022_1, duration: t.examDuration, year: 2022 },
    { id: '2022_2', title: t.exam2022_2, duration: t.examDuration, year: 2022 }
  ];

  // Dynamic mapping of lesson.ministryExams to local Question structure
  const activeQuestions = lesson && lesson.ministryExams && lesson.ministryExams.length > 0
    ? lesson.ministryExams.map((q) => ({
        id: q.id,
        text: lang === 'ar' ? q.textAr : q.textEn,
        type: q.type,
        options: q.options?.map((opt) => ({
          key: opt.key,
          text: lang === 'ar' ? opt.textAr : opt.textEn
        })) || [],
        correctKey: q.correctKey,
        correctAnswers: q.correctAnswers,
        explanation: lang === 'ar' ? q.explanationAr : q.explanationEn,
        hint: lang === 'ar' ? q.hintAr : q.hintEn,
        definition: lang === 'ar' ? q.definitionAr : q.definitionEn,
        questionImage: q.questionImage
      }))
    : [
        {
          id: 1,
          text: lang === 'ar' ? 'الوظيفة المباشرة لشبكة الهيدرا العصبية تكمن في تركيز رد الفعل في العضو المتأثر فقط.' : 'The direct function of Hydra\'s nerve net lies in focusing reactions solely in the affected organ.',
          options: [
            { key: 'T', text: lang === 'ar' ? 'صح' : 'True' },
            { key: 'F', text: lang === 'ar' ? 'خطأ' : 'False' }
          ],
          correctKey: 'F',
          explanation: '',
          hint: '',
          definition: ''
        },
        {
          id: 2,
          text: lang === 'ar' ? 'جهاز الألياف تحت الهدبي بالبراميسيوم يتكون من حبيبات قاعدية متصلة بخيوط دقيقة.' : 'The sub-pellicular infraciliary apparatus in Paramecium consists of basal bodies linked by fine neurofibrils.',
          options: [
            { key: 'T', text: lang === 'ar' ? 'صح' : 'True' },
            { key: 'F', text: lang === 'ar' ? 'خطأ' : 'False' }
          ],
          correctKey: 'T',
          explanation: '',
          hint: '',
          definition: ''
        }
      ];

  const calculateScore = () => {
    let score = 0;
    activeQuestions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctKey) {
        const isHintUsed = hintsUsed.has(q.id);
        score += isHintUsed ? 0.75 : 1.0;
      }
    });
    return score;
  };

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  if (lesson && lesson.ministryExamLocked) {
    return (
      <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <header className="flex items-center px-6 h-16 w-full fixed top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-md shadow-slate-100/30 dark:shadow-none">
          <div className="flex items-center gap-4 w-full">
            <button 
              onClick={() => onNavigate('main-dashboard', 'push_back')}
              className="active:scale-95 transition-transform text-slate-800 dark:text-slate-200"
            >
              {backIcon}
            </button>
            <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.previousExams}</h1>
          </div>
        </header>
        <main className="pt-20 px-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh] relative">
          <div className="w-full min-h-[400px] relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl p-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-3xl flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm mb-2">
              {lang === 'ar' ? 'تم قفل هذا القسم من قبل المعلم' : 'This section is locked by the teacher.'}
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
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('main-dashboard', 'push_back')} 
            className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
          >
            {backIcon}
          </button>
          <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.previousExams}</h1>
        </div>
        {!premiumUnlocked && (
          <span 
            onClick={() => onNavigate('student-profile', 'push')}
            className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black px-2.5 py-1 rounded-xl cursor-pointer active:scale-95 transition-all"
          >
            <Crown className="w-3.5 h-3.5 fill-amber-500 shrink-0" />
            {lang === 'ar' ? 'شراء بريميوم' : 'Unlock Premium'}
          </span>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Intro */}
        {!isSimulating && (
          <div className="mt-4">
            <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full mb-2">
              {lang === 'ar' ? 'المركز الامتحاني الوزاري' : 'Ministry Exam Portal'}
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{t.examsCenter}</h2>
            <p className="text-slate-500 dark:text-slate-450 text-xs font-semibold leading-relaxed mt-2">{t.examsCenterDesc}</p>
          </div>
        )}

        {/* Timed Exam Simulation Mode Panel */}
        {!isSimulating ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[28px] shadow-xl shadow-slate-200/20 dark:shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-500 rounded-xl">
                <Clock className="w-6 h-6 animate-pulse" />
              </span>
              <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                <h3 className="font-black text-sm text-slate-800 dark:text-white">{t.mockSimulationTitle}</h3>
                <p className="text-[11px] text-slate-450 dark:text-slate-500 font-bold mt-0.5">{lang === 'ar' ? '٣ ساعات • ٥٠ سؤال وزاري شامل' : '3 Hours • 50 Questions'}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.mockSimulationDesc}
            </p>

            <button 
              onClick={handleStartExam}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3.5 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" />
              {t.startMockExam}
            </button>
          </section>
        ) : (
          /* Active Exam Simulator Screen */
          <section className="bg-white dark:bg-slate-900 border-2 border-emerald-500 p-6 rounded-[28px] shadow-xl space-y-6 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500 animate-spin-slow" />
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">{t.activeExamTimer}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{formatTimer(timeLeft)}</span>
                </div>
              </div>
              
              {!examFinished ? (
                <button 
                  onClick={handleFinishExam}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition-all"
                >
                  {t.finishExam}
                </button>
              ) : (
                <button 
                  onClick={() => setIsSimulating(false)}
                  className="bg-slate-500 hover:bg-slate-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition-all"
                >
                  {lang === 'ar' ? 'الخروج للمركز' : 'Exit Simulator'}
                </button>
              )}
            </div>

            {/* Exam Submitted Stats */}
            {examFinished && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 p-4 rounded-xl text-center space-y-2">
                <span className="block text-2xl font-black text-emerald-600">{calculateScore()} / {activeQuestions.length}</span>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-350">{t.examSubmittedSuccess}</p>
                <button 
                  onClick={handleStartExam}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] px-4 py-1.5 rounded-lg active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'إعادة المحاكاة' : 'Retake Timed Exam'}
                </button>
              </div>
            )}

            {/* Exam simulation questions list */}
            <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin">
              {activeQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-3 border-b border-slate-50 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {q.text}
                  </p>

                  {/* Question Image (if present) */}
                  {q.questionImage && lesson && (
                    <QuestionImage 
                      lessonId={lesson.id} 
                      folder={lesson.folder} 
                      fileName={q.questionImage} 
                    />
                  )}

                  {/* Hint Button for Ministry Exam Questions */}
                  {(q.hint || q.definition) && !examFinished && (
                    <div className="flex flex-col items-end pt-1">
                      {hintsUsed.has(q.id) ? (
                        <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-3 rounded-xl text-right animate-fadeIn mb-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 block mb-0.5">
                            💡 {lang === 'ar' ? 'التلميح التعليمي / التعريف:' : 'Study Hint / Definition:'}
                          </span>
                          <p className="text-[11px] font-extrabold text-slate-705 text-slate-700 dark:text-slate-200">
                            {q.hint || q.definition}
                          </p>
                          <span className="text-[9px] font-bold text-amber-500 mt-1 block">
                            {lang === 'ar' ? '* تم خصم 0.25 درجة لاستخدام المساعدة.' : '* 0.25 pts penalty applied for using help.'}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const confirmMsg = lang === 'ar'
                              ? 'هل تريد عرض التلميح مقابل خصم 0.25 درجة من هذا السؤال؟'
                              : 'Do you want to show the hint in exchange for a 0.25 point deduction on this question?';
                            if (window.confirm(confirmMsg)) {
                              setHintsUsed(prev => {
                                const next = new Set(prev);
                                next.add(q.id);
                                return next;
                              });
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-600 font-extrabold bg-amber-500/10 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer mb-2"
                        >
                          <span>💡</span>
                          <span>{lang === 'ar' ? 'عرض التلميح (-0.25 د)' : 'Show Hint (-0.25 pts)'}</span>
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    {q.options.map((opt) => {
                      const isSelected = selectedAnswers[q.id] === opt.key;
                      const isCorrect = opt.key === q.correctKey;
                      
                      let btnStyle = 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300';
                      
                      if (isSelected) {
                        btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black';
                      }
 
                      if (examFinished) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-100 dark:bg-emerald-950 text-emerald-750 font-black';
                        } else if (isSelected) {
                          btnStyle = 'border-rose-450 bg-rose-50 border-rose-400 text-rose-800 font-bold';
                        }
                      }
 
                      return (
                        <button
                          key={opt.key}
                          onClick={() => handleAnswerSelect(q.id, opt.key)}
                          className={`p-3 rounded-xl border text-xs font-bold text-center active:scale-[0.98] transition-all ${btnStyle}`}
                          disabled={examFinished}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation for Ministry Exam Questions */}
                  {examFinished && q.explanation && (
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2 text-right">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        📝 {lang === 'ar' ? 'التعليل التوضيحي:' : 'Explanation / Reasoning:'}
                      </span>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Previous Ministry Exam Papers Archive List */}
        {!isSimulating && (
          <section className="space-y-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-1">{lang === 'ar' ? 'ارشيف الامتحانات الورقية المعتمدة' : 'Archived Ministerial Paper Sheets'}</h3>
            
            <div className="space-y-3">
              {exams.map((paper) => {
                const isPremiumLockedPaper = paper.year >= 2023 && !premiumUnlocked;
                return (
                  <div 
                    key={paper.id}
                    className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between transition-all ${
                      isPremiumLockedPaper ? 'opacity-70' : 'hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-505 text-slate-500 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-purple-500" />
                      </div>
                      <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                        <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-[14px]">{paper.title}</h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">{paper.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPremiumLockedPaper ? (
                        <button 
                          onClick={() => onNavigate('student-profile', 'push')}
                          className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl border border-amber-500/20 active:scale-90 transition-transform shrink-0"
                          title={t.premiumButtonText}
                        >
                          <Crown className="w-4 h-4 fill-amber-500 shrink-0" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleSimulateDownload(paper.id)}
                          className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 hover:bg-emerald-500 hover:text-white active:scale-90 transition-all shrink-0"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {downloadSuccessId === paper.id && (
                      <div className="fixed bottom-24 left-6 right-6 z-50 bg-emerald-500 text-white p-4 rounded-xl text-xs font-black shadow-lg text-center animate-slideUp">
                        {lang === 'ar' 
                          ? `تم محاكاة تحميل ملف ${paper.title} بنجاح كـ PDF في التنزيلات!` 
                          : `Successfully simulated PDF download of ${paper.title}!`
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 z-50">
        <button 
          onClick={() => onNavigate('main-dashboard', 'none')} 
          className="flex flex-col items-center justify-center text-slate-450 hover:text-emerald-500 transition-colors text-slate-500"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.home}</span>
        </button>
        
        <button 
          onClick={() => onNavigate('units-navigation', 'none')} 
          className="flex flex-col items-center justify-center text-slate-450 hover:text-emerald-500 transition-colors text-slate-500"
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myLessonsMenu}</span>
        </button>

        <button 
          onClick={() => onNavigate('biology-quiz', 'none')} 
          className="flex flex-col items-center justify-center text-slate-450 hover:text-emerald-500 transition-colors text-slate-500"
        >
          <PenTool className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.openTraining}</span>
        </button>

        <button 
          onClick={() => onNavigate('student-profile', 'none')} 
          className="flex flex-col items-center justify-center text-slate-450 hover:text-emerald-505 hover:text-emerald-500 transition-colors text-slate-550"
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myProfile}</span>
        </button>
      </nav>
    </div>
  );
}
