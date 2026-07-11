/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  BookOpen, 
  PenTool, 
  User, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  ArrowRight, 
  ArrowLeft,
  Settings,
  Bell,
  BellOff,
  Award,
  Crown,
  FileText,
  HelpCircle,
  Volume2,
  BookMarked,
  AlertTriangle,
  X,
  Loader2,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { ScreenId } from '../types';
import { translations, Language } from '../utils/translations';
import { overallPercent, getStreak, loadProgress } from '../utils/progress';
import { scheduleReminderNotification } from '../utils/notifications';
import { Lesson } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface MainDashboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  onQuizNavigate: () => void;
  lessons?: Lesson[];
}

export default function MainDashboardScreen({ onNavigate, lang, onQuizNavigate, lessons = [] }: MainDashboardScreenProps) {
  const t = translations[lang];

  const [studentName, setStudentName] = useState('');
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256');
  const [studiedToday, setStudiedToday] = useState(true);      // assume true to avoid flash
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'default'|'granted'|'denied'|'unsupported'>('unsupported');
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);

  // AI Tutor States
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<Array<{ role: 'user' | 'model', content: string }>>([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Collapsible Banner Expansion States
  const [isStreakExpanded, setIsStreakExpanded] = useState(false);
  const [isPremiumExpanded, setIsPremiumExpanded] = useState(false);
  const [isTutorPromptExpanded, setIsTutorPromptExpanded] = useState(false);

  // Initialize tutor chat when general chat is opened
  useEffect(() => {
    if (isTutorOpen && tutorMessages.length === 0) {
      setTutorMessages([
        {
          role: 'model',
          content: t.aiTutorWelcome || `مرحباً! أنا معلم الأحياء الافتراضي الخاص بك 🤖. كيف يمكنني مساعدتك اليوم؟ يمكنك أن تسألني أي سؤال في منهج الأحياء أو تطلب مني شرح وتلخيص موضوع معين.`
        }
      ]);
    }
  }, [isTutorOpen, tutorMessages.length, t.aiTutorWelcome]);

  // Scroll chat to bottom
  useEffect(() => {
    if (isTutorOpen) {
      setTimeout(() => {
        const anchor = document.getElementById('dashboard-tutor-bottom-anchor');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth' });
        }
      }, 80);
    }
  }, [tutorMessages.length, tutorLoading, isTutorOpen]);

  const handleSendTutorMessage = async (customText?: string) => {
    const textToSend = customText || tutorInput.trim();
    if (!textToSend || tutorLoading) return;

    const newMessages: Array<{ role: 'user' | 'model', content: string }> = [
      ...tutorMessages, 
      { role: 'user' as const, content: textToSend }
    ];
    setTutorMessages(newMessages);
    setTutorInput('');
    setTutorLoading(true);
    setTutorError(null);

    try {
      const storedKey = localStorage.getItem('gemini_api_key') || '';
      
      const serverUrl = (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const response = await fetch(`${serverUrl}/api/tutor-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': storedKey
        },
        body: JSON.stringify({
          messages: newMessages
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTutorMessages(prev => [...prev, { role: 'model', content: data.reply }]);
      } else {
        setTutorError(data.error || t.aiTutorError || 'حدث خطأ أثناء الاتصال بالمعلم الافتراضي.');
      }
    } catch (e) {
      setTutorError(lang === 'ar' ? 'فشل الاتصال. يرجى التأكد من اتصال الإنترنت وصلاحية السيرفر.' : 'Connection failed. Please check your internet connection and server status.');
    } finally {
      setTutorLoading(false);
    }
  };

  useEffect(() => {
    const storedName = localStorage.getItem('student_name');
    if (storedName) setStudentName(storedName);
    else setStudentName(lang === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed');

    setPremiumUnlocked(localStorage.getItem('premium_unlocked') === 'true');

    const storedAvatar = localStorage.getItem('student_avatar');
    if (storedAvatar) setAvatarUrl(storedAvatar);

    // Check if studied today
    const prog = loadProgress();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    setStudiedToday(prog.lastStudyDate === todayStr);

    // Check notification permission
    if ('Notification' in window) {
      setNotifStatus(Notification.permission as 'default'|'granted'|'denied');
    }

    // Restore banner dismissal (per-day)
    const dismissed = localStorage.getItem('streak_banner_dismissed');
    if (dismissed === todayStr) setStreakBannerDismissed(true);
    const notifDismissed = localStorage.getItem('notif_banner_dismissed');
    if (notifDismissed === todayStr) setNotifBannerDismissed(true);
  }, [lang]);

  /** Request notification permission and schedule daily reminder */
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifStatus(result as 'granted'|'denied'|'default');
    if (result === 'granted') {
      const reminderTime = localStorage.getItem('reminder_time') || '20:00';
      scheduleReminderNotification(reminderTime, lang);
      // Dismiss banner
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      localStorage.setItem('notif_banner_dismissed', todayStr);
      setNotifBannerDismissed(true);
    }
  };

  const dismissStreakBanner = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    localStorage.setItem('streak_banner_dismissed', todayStr);
    setStreakBannerDismissed(true);
  };

  const chevronIcon = lang === 'ar' ? <ArrowLeft className="w-5 h-5 text-emerald-500" /> : <ArrowRight className="w-5 h-5 text-emerald-500" />;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onNavigate('student-profile', 'push')}
            className="w-9 h-9 rounded-full overflow-hidden border border-emerald-500 cursor-pointer active:scale-95 transition-transform"
          >
            <img src={avatarUrl} className="w-full h-full object-cover" alt="Student avatar" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider">{t.biologyAcademy}</span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 block">{studentName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {premiumUnlocked && (
            <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2.5 py-1 rounded-lg">
              <Crown className="w-3.5 h-3.5 fill-amber-500 animate-pulse" />
              {lang === 'ar' ? 'مميز' : 'PREMIUM'}
            </span>
          )}
          <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 relative">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-18 px-5 max-w-2xl mx-auto space-y-4">
        
        {/* Welcome Section */}
        <section className="mt-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
            {t.welcomeStudent}
          </h2>
          <p className="text-slate-500 dark:text-slate-450 text-xs font-semibold mt-0.5">
            {lang === 'ar' ? 'استعد لاجتياز امتحانات الشهادة الثانوية بتفوق تام في مادة الأحياء.' : 'Gear up to conquer your third-year biology exams with total confidence.'}
          </p>
        </section>

        {/* Streak At Risk Banner */}
        {!studiedToday && !streakBannerDismissed && getStreak() > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500 rounded-[20px] p-3.5 shadow-md shadow-amber-500/20 relative overflow-hidden"
          >
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-lg" />
            <div className="flex flex-col gap-2">
              <div 
                onClick={() => setIsStreakExpanded(!isStreakExpanded)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-white fill-white shrink-0" />
                  <p className="text-white font-black text-xs">
                    {lang === 'ar' ? `🔥 سلسلتك (${getStreak()} يوم) في خطر!` : `🔥 Your ${getStreak()}-day streak is at risk!`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ChevronDown className={`w-4 h-4 text-white transition-transform ${isStreakExpanded ? 'rotate-180' : ''}`} />
                  <button 
                    onClick={(e) => { e.stopPropagation(); dismissStreakBanner(); }} 
                    className="text-white/60 hover:text-white active:scale-90 transition-transform ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {isStreakExpanded && (
                <div className="text-right border-t border-white/20 pt-2 animate-slideDown">
                  <p className="text-amber-100 text-xs font-bold leading-relaxed">
                    {lang === 'ar' ? 'لم تذاكر اليوم بعد. ادخل أي درس للحفاظ على سلسلتك.' : "You haven't studied today yet. Open any lesson to keep your streak."}
                  </p>
                  <button
                    onClick={() => onNavigate('units-navigation', 'push')}
                    className="mt-2 bg-white text-amber-600 font-black text-[11px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    {lang === 'ar' ? 'اذهب للدروس ←' : 'Go to Lessons →'}
                  </button>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Notification Enable Banner */}
        {notifStatus === 'default' && !notifBannerDismissed && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-[24px] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-indigo-900 dark:text-indigo-200 font-black text-xs">
                  {lang === 'ar' ? 'فعّل تذكيرات المذاكرة اليومية' : 'Enable daily study reminders'}
                </p>
                <p className="text-indigo-500 text-[10px] font-bold mt-0.5">
                  {lang === 'ar' ? 'نذكّرك كل يوم بوقت المذاكرة الذي تختاره' : "We'll remind you at your chosen study time every day"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleEnableNotifications}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  {lang === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                    localStorage.setItem('notif_banner_dismissed', todayStr);
                    setNotifBannerDismissed(true);
                  }}
                  className="text-indigo-400 hover:text-indigo-600 active:scale-90 transition-transform"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Premium Banner (Dashboard CTA) */}
        {!premiumUnlocked && (
          <section 
            className="bg-gradient-to-r from-emerald-500 to-teal-655 text-white p-3.5 rounded-[20px] shadow-md shadow-emerald-500/10 relative overflow-hidden transition-all duration-250"
          >
            <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10 flex flex-col gap-2">
              <div 
                onClick={() => setIsPremiumExpanded(!isPremiumExpanded)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                  <h3 className="font-black text-xs tracking-wide text-amber-200">{t.upgradeBannerTitle}</h3>
                </div>
                <ChevronDown className={`w-4 h-4 text-emerald-100 transition-transform ${isPremiumExpanded ? 'rotate-180' : ''}`} />
              </div>
              
              {isPremiumExpanded && (
                <div className="text-right border-t border-emerald-450/20 pt-2 animate-slideDown">
                  <p className="text-[11px] text-emerald-50 font-semibold leading-relaxed">
                    {t.upgradeBannerDesc}
                  </p>
                  <button 
                    onClick={() => onNavigate('student-profile', 'push')}
                    className="mt-2.5 bg-white text-emerald-600 hover:bg-emerald-50 font-black text-[11px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1.5 mr-auto"
                  >
                    <span>{lang === 'ar' ? 'تفعيل الآن' : 'Activate Now'}</span>
                    {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* AI Biology Tutor General Banner */}
        <section 
          className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white p-3.5 rounded-[20px] shadow-md shadow-indigo-500/10 relative overflow-hidden transition-all duration-250"
        >
          <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div 
              onClick={() => setIsTutorPromptExpanded(!isTutorPromptExpanded)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-100 animate-pulse shrink-0" />
                <h3 className="font-black text-xs tracking-wide text-indigo-100">{t.aiTutorPromptGeneral}</h3>
              </div>
              <ChevronDown className={`w-4 h-4 text-indigo-100 transition-transform ${isTutorPromptExpanded ? 'rotate-180' : ''}`} />
            </div>
            
            {isTutorPromptExpanded && (
              <div className="text-right border-t border-indigo-400/20 pt-2 animate-slideDown">
                <p className="text-[11px] text-indigo-50 font-semibold leading-relaxed">
                  {t.aiTutorPromptGeneralDesc}
                </p>
                <button 
                  onClick={() => setIsTutorOpen(true)}
                  className="mt-2.5 bg-white text-indigo-600 hover:bg-indigo-50 font-black text-[11px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1.5 mr-auto"
                >
                  <span>{lang === 'ar' ? 'افتح المحادثة' : 'Open Chat'}</span>
                  {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Bento Statistics Grid */}
        <section className="grid grid-cols-2 gap-3">
          
          {/* Bento Stats 1: Streak */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex items-center gap-3">
            <span className="w-9 h-9 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-500 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 fill-amber-500" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider block">{t.studyStreak}</span>
              <span className="text-sm font-black text-slate-855 dark:text-white block mt-0.5">{getStreak()} {lang === 'ar' ? 'يوم' : 'days'}</span>
            </div>
          </div>

          {/* Bento Stats 2: Completion Rate */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex items-center gap-3">
            <span className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              {(() => {
                const pct = overallPercent(lessons.map(l => l.id));
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider block">{t.learningStats}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-350 font-black">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }}></div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

        </section>

        {/* Quick Access Menu Options */}
        <section className="space-y-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-2">{t.quickAccess}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            
            {/* Units Syllabus Navigation Card */}
            <div 
              onClick={() => onNavigate('units-navigation', 'push')}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm flex items-center justify-between hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-200 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <h4 className="font-black text-slate-850 dark:text-slate-100 text-xs">{t.myLessonsMenu}</h4>
                </div>
              </div>
              {chevronIcon}
            </div>

            {/* Ministry Past Exams Portal Card */}
            <div 
              onClick={() => onNavigate('ministry-exams', 'push')}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm flex items-center justify-between hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors duration-200 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <h4 className="font-black text-slate-855 dark:text-slate-100 text-xs">{t.previousExams}</h4>
                </div>
              </div>
              {chevronIcon}
            </div>

            {/* Practice and Quiz Card */}
            <div 
              onClick={() => onNavigate('biology-quiz', 'push')}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm flex items-center justify-between hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors duration-200 shrink-0">
                  <PenTool className="w-5 h-5" />
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <h4 className="font-black text-slate-855 dark:text-slate-100 text-xs">{t.openTraining}</h4>
                </div>
              </div>
              {chevronIcon}
            </div>

            {/* Profile Settings Card */}
            <div 
              onClick={() => onNavigate('student-profile', 'push')}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm flex items-center justify-between hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-955/50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors duration-200 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <h4 className="font-black text-slate-855 dark:text-slate-100 text-xs">{t.myProfile}</h4>
                </div>
              </div>
              {chevronIcon}
            </div>

          </div>
        </section>

        {/* Daily Biology Fact — rotates every day */}
        {(() => {
          const factsAr = [
            { tag: 'الجهاز العصبي', text: 'تنتقل النبضة العصبية بسرعة تصل إلى 120 متر/ثانية في الخلايا العصبية الإنسانية.' },
            { tag: 'الأميبا', text: 'تعتمد الأميبا على البروتوبلازم كاملاً في الإحساس والاستجابة ولا يوجد فيها جهاز عصبي متخصص.' },
            { tag: 'الهيدرا', text: 'تمتلك الهيدرا شبكة عصبية بدائية تسمى منتشر عصبي، وهي أبسط نماذج القوس العصبي.' },
            { tag: 'دودة الأرض', text: 'يتكون الجهاز العصبي لدودة الأرض من عقدتين سفلية وسلسلة بطنية من عقد عصبية لكل حلقة من حلقاتها.' },
            { tag: 'الخلية العصبية', text: 'تتكون الخلية العصبية (النيورون) من 3 أجزاء رئيسية: جسم الخلية، والتجمعات الشجرية، والمحور.' },
            { tag: 'المنعكسات', text: 'تسمح المنعكسات بالاستجابة السريعة والتلقائية دون تدخل مركز أعلى مما يوفر وقت التفاعل.' },
            { tag: 'البراميسيوم', text: 'يمتلك البراميسيوم خيوطاً عصبية تنسّق حركة الأهداب تسمى الحبيبات القاعدية.' },
            { tag: 'التكيف', text: 'يستطيع جسم الإنسان التكيف مع التغيرات البيئية بفضل الجهاز العصبي الذي يستقبل ويحلل ويستجيب.' },
            { tag: 'العصبونات', text: 'العصبونات هي مواد كيميائية تنقل النبضة العصبية عبر الفجوة التشابكية ومنها الأدرينالين والسيروتونين.' },
            { tag: 'الإحساس', text: 'الإحساس هو قدرة الكائن الحي على استقبال المؤثرات سواء داخلية أو خارجية والاستجابة لها.' },
          ];
          const factsEn = [
            { tag: 'Nervous System', text: 'Nerve impulses can travel up to 120 meters per second in human myelinated neurons.' },
            { tag: 'Amoeba', text: 'Amoeba relies entirely on its protoplasm for sensation — it has no specialized nervous system.' },
            { tag: 'Hydra', text: 'Hydra has a nerve net — the simplest form of a nervous system, with no brain or spinal cord.' },
            { tag: 'Earthworm', text: 'The earthworm has two ventral ganglia and a chain of nerve ganglia — one per segment.' },
            { tag: 'Neuron', text: 'A neuron has 3 main parts: cell body, dendrites, and axon.' },
            { tag: 'Reflex', text: 'Reflexes allow rapid, automatic responses without involving a higher brain center, saving reaction time.' },
            { tag: 'Paramecium', text: 'Paramecium has basal granules (kinetosome fibrils) that coordinate cilia movement.' },
            { tag: 'Adaptation', text: 'The nervous system allows organisms to adapt to environmental changes by receiving and processing stimuli.' },
            { tag: 'Neurotransmitters', text: 'Neurotransmitters are chemicals that carry nerve impulses across the synaptic gap — e.g. adrenaline, serotonin.' },
            { tag: 'Irritability', text: 'Irritability is the ability of a living organism to detect and respond to stimuli from its environment.' },
          ];

          const facts = lang === 'ar' ? factsAr : factsEn;
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          const fact = facts[dayOfYear % facts.length];

          return (
            <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[32px] shadow-xl shadow-slate-200/20 dark:shadow-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Sparkles className="w-16 h-16 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-500">
                  <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
                </span>
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 dark:text-white text-[15px]">
                    {lang === 'ar' ? '💡 هل تعلم؟' : '💡 Did You Know?'}
                  </h4>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">{fact.tag}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">
                  {lang === 'ar' ? 'تتغيّر يومياً' : 'Daily fact'}
                </span>
              </div>
              <p className="text-slate-650 dark:text-slate-400 text-xs font-bold leading-relaxed">
                {fact.text}
              </p>
            </section>
          );
        })()}

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 z-50">
        <button 
          onClick={() => onNavigate('main-dashboard', 'none')} 
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl px-4 py-1.5 active:scale-90 transition-transform font-black"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-xs">{t.home}</span>
        </button>
        
        <button 
          onClick={() => onNavigate('units-navigation', 'none')} 
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myLessonsMenu}</span>
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

      {/* AI Tutor Chat Drawer */}
      <AnimatePresence>
        {isTutorOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 md:p-4 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTutorOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Chat Body */}
            <motion.div
              initial={{ y: '100%', opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-[32px] md:rounded-[32px] w-full max-w-lg h-[80vh] md:h-[75vh] flex flex-col overflow-hidden shadow-2xl relative z-10 text-slate-800 dark:text-slate-100 font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </span>
                  <div className="text-right">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      مساعد الأحياء الذكي 🤖
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      معلمك الافتراضي الشخصي للمنهج اليمني
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTutorOpen(false)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors border-0 cursor-pointer bg-transparent"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                {tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-[20px] p-3 text-xs leading-relaxed shadow-sm font-semibold whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-emerald-500 text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-150 border border-slate-100 dark:border-slate-850 rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {tutorLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-550 border border-slate-100 dark:border-slate-850 rounded-[20px] rounded-bl-none p-3 text-xs flex items-center gap-2 shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                      <span>المعلم الافتراضي يفكر في الإجابة...</span>
                    </div>
                  </div>
                )}

                {tutorError && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 font-extrabold text-center">
                    ⚠️ {tutorError}
                  </div>
                )}
                
                {/* Scroll anchor */}
                <div id="dashboard-tutor-bottom-anchor" />
              </div>
              {/* Input Area */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendTutorMessage(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={tutorInput}
                    onChange={(e) => setTutorInput(e.target.value)}
                    placeholder="اكتب سؤالك العام هنا..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                    disabled={tutorLoading}
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer border-0"
                    disabled={!tutorInput.trim() || tutorLoading}
                  >
                    إرسال
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
