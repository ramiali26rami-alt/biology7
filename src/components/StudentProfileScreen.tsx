/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft,
  Settings, 
  Award, 
  UserCheck, 
  LineChart, 
  FileCheck, 
  Sliders, 
  LogOut,
  Compass, 
  BookOpen, 
  PenTool, 
  User, 
  FlaskConical, 
  Calendar, 
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Edit2,
  Check,
  CreditCard,
  Camera,
  Flame,
  FileText,
  X,
  Volume2,
  VolumeX,
  Trash2,
  Info,
  Bell,
  BellOff
} from 'lucide-react';
import { ScreenId } from '../types';
import { Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { loadProgress, getStreak, overallPercent } from '../utils/progress';
import { playClickSound, playCorrectSound } from '../utils/soundEffects';
import { scheduleReminderNotification, getReminderTime, setReminderTime } from '../utils/notifications';
import { SecureStorage } from '../utils/security';

interface StudentProfileScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: string;
  setTheme: (theme: string) => void;
  lessons?: Lesson[];
  fontSize: string;
  setFontSize: (size: string) => void;
}

const PRESET_AVATARS = [
  { id: 'student', name: 'Student', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256' },
  { id: 'neuron', name: 'Neuron Master', url: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=256' },
  { id: 'dna', name: 'DNA Pioneer', url: 'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?auto=format&fit=crop&q=80&w=256' },
  { id: 'scientist', name: 'Scientist', url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=256' }
];

export default function StudentProfileScreen({ 
  onNavigate, 
  lang, 
  setLang, 
  theme, 
  setTheme, 
  lessons = [],
  fontSize,
  setFontSize
}: StudentProfileScreenProps) {
  // Sync states from localStorage for persistence
  const [name, setName] = useState(() => SecureStorage.getItem('student_name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('student_email') || '');
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('student_avatar') || PRESET_AVATARS[0].url);
  const [premiumUnlocked, setPremiumUnlocked] = useState(() => SecureStorage.getItem('premium_unlocked') === 'true');
  const isDarkMode = theme === 'dark';

  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [inputName, setInputName] = useState(name);
  const [inputEmail, setInputEmail] = useState(email);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('sound_enabled') !== 'false');
  const [notifStatus, setNotifStatus] = useState<'default'|'granted'|'denied'|'unsupported'>('unsupported');
  const [reminderTime, setReminderTimeState] = useState(() => getReminderTime());
  const [reminderSaved, setReminderSaved] = useState(false);

  // Activation key states
  const [activationKey, setActivationKey] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationMessage, setActivationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState(() => localStorage.getItem('server_url') || '');

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey.trim()) return;

    setActivationLoading(true);
    setActivationMessage(null);

    try {
      const serverUrl = (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const res = await fetch(`${serverUrl}/api/activate-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: activationKey.trim(),
          studentName: name || 'Student',
          deviceUuid: localStorage.getItem('client_device_uuid') || 'default'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPremiumUnlocked(true);
        SecureStorage.setItem('premium_unlocked', 'true');
        setActivationMessage({
          type: 'success',
          text: t.activationSuccess
        });
        setActivationKey('');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setActivationMessage({
          type: 'error',
          text: data.error === 'already_used'
            ? (lang === 'ar' ? 'كود التفعيل مستخدم بالفعل!' : 'Activation key already used!')
            : data.error === 'already_used_other_device'
              ? (lang === 'ar' ? 'عذراً، هذا الكود مفعل على جهاز آخر!' : 'Sorry, this key is activated on another device!')
              : t.activationError
        });
      }
    } catch (err) {
      setActivationMessage({
        type: 'error',
        text: t.activationError
      });
    } finally {
      setActivationLoading(false);
    }
  };

  const t = translations[lang];

  const handleCheckAdminPin = () => {
    const inputElement = document.getElementById('admin-pin-input') as HTMLInputElement | null;
    if (inputElement) {
      const pin = inputElement.value;
      const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '3000';
      
      if (isLocalDev && pin === '2026') {
        setShowSettingsModal(false);
        onNavigate('admin-dashboard', 'push');
      } else {
        alert(lang === 'ar' 
          ? 'عذراً، لوحة التحكم وإدارة المحتوى غير متاحة في نسخ الهواتف والإنتاج!' 
          : 'Sorry, the content management dashboard is disabled on mobile and production builds!'
        );
        inputElement.value = '';
      }
    }
  };

  // No longer auto-filling defaults — the WelcomeScreen handles first-time name entry

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotifStatus(Notification.permission as 'default'|'granted'|'denied');
      // Re-schedule if already granted
      if (Notification.permission === 'granted') {
        scheduleReminderNotification(getReminderTime(), lang);
      }
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setName(inputName);
    setEmail(inputEmail);
    SecureStorage.setItem('student_name', inputName);
    localStorage.setItem('student_email', inputEmail);
    setIsEditing(false);
  };

  const handleSelectAvatar = (url: string) => {
    setAvatarUrl(url);
    localStorage.setItem('student_avatar', url);
    setShowAvatarPicker(false);
  };

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          const resultStr = uploadEvent.target.result as string;
          setAvatarUrl(resultStr);
          localStorage.setItem('student_avatar', resultStr);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleTogglePremium = () => {
    const nextPremium = !premiumUnlocked;
    setPremiumUnlocked(nextPremium);
    SecureStorage.setItem('premium_unlocked', nextPremium ? 'true' : 'false');
  };

  const toggleDarkMode = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    setLang(nextLang);
    localStorage.setItem('lang', nextLang);
  };

  const toggleSound = () => {
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    localStorage.setItem('sound_enabled', nextSound ? 'true' : 'false');
    if (nextSound) {
      setTimeout(() => playCorrectSound(), 50);
    }
  };

  const handleResetData = () => {
    const confirmMessage = lang === 'ar' 
      ? 'هل أنت متأكد من رغبتك في حذف جميع بياناتك وإعادة تصفير نسبة التقدم في الدروس والاختبارات؟' 
      : 'Are you sure you want to reset all your data, progress, and exam scores?';
    if (window.confirm(confirmMessage)) {
      localStorage.clear();
      setName('');
      setEmail('');
      setAvatarUrl(PRESET_AVATARS[0].url);
      setPremiumUnlocked(false);
      SecureStorage.setItem('premium_unlocked', 'false');
      window.location.reload();
    }
  };

  const ChevronIcon = lang === 'ar' ? ChevronLeft : ChevronRight;
  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <button 
          onClick={() => onNavigate('main-dashboard', 'push_back')} 
          className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200"
        >
          {backIcon}
        </button>
        <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.profileScreenTitle}</h1>
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="active:scale-95 p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
          aria-label="Open settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Profile Header & Avatar Editor */}
        <section className="flex flex-col items-center mt-6 bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
          <div className="relative group">
            <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-emerald-500 dark:border-emerald-400 shadow-xl shadow-emerald-250/20">
              <img 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
                alt="Student Portrait" 
                src={avatarUrl} 
              />
            </div>
            <button 
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="absolute bottom-0 right-0 bg-emerald-500 dark:bg-emerald-600 text-white p-2 rounded-xl border-2 border-white dark:border-slate-900 shadow-md hover:bg-emerald-600 active:scale-90 transition-all flex items-center justify-center"
              title={t.uploadPhoto}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Avatar Selection Grid */}
          {showAvatarPicker && (
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mt-4 animate-fadeIn">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center">{t.chooseAvatar}</p>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => handleSelectAvatar(av.url)}
                    className="w-12 h-12 rounded-xl overflow-hidden border-2 border-transparent hover:border-emerald-500 transition-all active:scale-95 mx-auto"
                  >
                    <img src={av.url} className="w-full h-full object-cover" alt={av.name} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center">
                <label className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-center w-full">
                  <span>{lang === 'ar' ? 'تحميل صورة من جهازك' : 'Upload From Device'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleSimulateUpload} />
                </label>
              </div>
            </div>
          )}

          {/* Student Editable Fields */}
          {!isEditing ? (
            <div className="text-center mt-4 w-full">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
                {name}
                <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-emerald-500 active:scale-90 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">{email}</p>
              <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-xs font-bold px-3 py-1 rounded-full mt-2">
                {t.studentGrade}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="mt-4 w-full space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'الاسم بالكامل' : 'Full Name'}</label>
                <input 
                  type="text" 
                  value={inputName} 
                  onChange={(e) => setInputName(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                <input 
                  type="email" 
                  value={inputEmail} 
                  onChange={(e) => setInputEmail(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-transform"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {t.save}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Premium Upgrade & Pricing Screen 1 Integration */}
        <section className="bg-gradient-to-tr from-slate-900 to-slate-850 dark:from-emerald-950 dark:to-slate-900 text-white p-6 rounded-[32px] shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 rounded-xl">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </span>
                <h3 className="font-black text-lg">{t.premiumStatus}</h3>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full font-black border uppercase tracking-wider ${
                premiumUnlocked 
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-350' 
                  : 'bg-amber-505 bg-amber-500/20 border-amber-400 text-amber-400'
              }`}>
                {premiumUnlocked ? t.premiumUnlocked : t.premiumLocked}
              </span>
            </div>
            
            <p className="text-slate-300 text-xs font-semibold leading-relaxed">
              {lang === 'ar' 
                ? 'شراء الباقة المميزة يمنحك حق الوصول الفوري إلى الوحدة الثانية والثالثة من منهج الأحياء للصف الثالث الثانوي بالجمهورية اليمنية، وحل نماذج الامتحانات الوزارية مع بنك الأسئلة الممتد.' 
                : 'Upgrading unlocks Unit 2, Unit 3, past Yemeni Ministry exam simulations, and all interactive flashcard packages instantly.'
              }
            </p>

            <button 
              onClick={handleTogglePremium}
              className={`w-full font-black text-sm py-3.5 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 ${
                premiumUnlocked 
                  ? 'bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-900/30'
              }`}
            >
              <Flame className="w-4 h-4" />
              {premiumUnlocked 
                ? (lang === 'ar' ? 'إلغاء الاشتراك التجريبي' : 'Deactivate Premium Trial') 
                : t.premiumButtonText
              }
            </button>

            {!premiumUnlocked && (
              <form onSubmit={handleActivateKey} className="border-t border-slate-800/80 pt-4 mt-4 space-y-3 text-right">
                <label className="text-[11px] font-black text-slate-400 block">
                  {t.enterActivationKey}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder={t.activationKeyPlaceholder}
                    disabled={activationLoading}
                    className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={activationLoading || !activationKey.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shrink-0 flex items-center justify-center gap-1.5"
                  >
                    {activationLoading ? t.activating : t.activateBtn}
                  </button>
                </div>
                {activationMessage && (
                  <div className={`text-[10px] font-black px-3 py-2 rounded-lg ${
                    activationMessage.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {activationMessage.text}
                  </div>
                )}
              </form>
            )}

            {/* Advanced Server Settings */}
            <div className="border-t border-slate-800/80 pt-4 mt-4 space-y-3 text-right">
              <label className="text-[11px] font-black text-slate-400 block">
                {lang === 'ar' ? 'عنوان خادم المعلم الافتراضي (اختياري)' : 'AI Tutor Server URL (Optional)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => {
                    setServerUrlInput(e.target.value);
                    localStorage.setItem('server_url', e.target.value.trim());
                  }}
                  placeholder="https://biology-server.up.railway.app"
                  className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-655 focus:outline-none focus:border-emerald-500 transition-colors placeholder-slate-600"
                />
              </div>
              <p className="text-[9px] text-slate-500 font-bold leading-tight">
                {lang === 'ar' 
                  ? 'ملاحظة: اتركه فارغاً لاستخدام خادم التطبيق الافتراضي. مفيد جداً لتشغيل خدمات الذكاء الاصطناعي أوفلاين على الهواتف.'
                  : 'Note: Leave blank to use default application server. Helpful for offline AI features on mobile apps.'}
              </p>
            </div>
          </div>
        </section>

        {/* Real Learning Statistics */}
        {(() => {
          const progress = loadProgress();
          const streak = getStreak();
          const totalPct = overallPercent(lessons.map(l => l.id));
          const completedLessons = lessons.filter(l => progress.lessons[l.id]?.quizDone).length;
          const visitedLessons = lessons.filter(l => progress.lessons[l.id]?.visited).length;

          // Compute scores for lessons that have quiz done
          const scoredLessons = lessons
            .filter(l => progress.lessons[l.id]?.quizDone)
            .map(l => ({
              title: l.folder.split('/')[1] || (lang === 'ar' ? l.titleAr : l.titleEn),
              score: progress.lessons[l.id].bestScore,
              raw: progress.lessons[l.id].bestScoreRaw,
            }))
            .sort((a, b) => b.score - a.score);

          const strong = scoredLessons.filter(l => l.score >= 75);
          const weak   = scoredLessons.filter(l => l.score < 75);

          return (
            <>
              {/* Stats Grid */}
              <section className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px] shadow-xl shadow-slate-200/30 dark:shadow-none">
                  <div className="flex items-center justify-between mb-2">
                    <LineChart className="w-6 h-6 text-emerald-500" />
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                      {totalPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold">{t.completionRate}</p>
                  <p className="text-base font-black text-slate-800 dark:text-slate-100">
                    {completedLessons}/{lessons.length} {lang === 'ar' ? 'درس' : 'lessons'}
                  </p>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${totalPct}%` }}></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[24px] shadow-xl shadow-slate-200/30 dark:shadow-none flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <Flame className="w-6 h-6 text-amber-500 fill-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold">{t.studyStreak ?? (lang === 'ar' ? 'سلسلة المذاكرة' : 'Study Streak')}</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{streak} <span className="text-sm text-slate-400">{lang === 'ar' ? 'يوم' : 'days'}</span></p>
                  </div>
                  <p className="text-xs text-emerald-500 mt-2 font-bold">{t.keepGoing}</p>
                </div>
              </section>

              {/* Performance Analysis */}
              {scoredLessons.length > 0 && (
                <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-5 shadow-xl shadow-slate-200/20 dark:shadow-none space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-3">
                    <span className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-xl text-indigo-500">
                      <Award className="w-5 h-5" />
                    </span>
                    <h3 className="font-black text-slate-800 dark:text-white text-[15px]">
                      {lang === 'ar' ? 'تحليل الأداء التفصيلي' : 'Performance Analysis'}
                    </h3>
                  </div>

                  {/* Per-lesson score bars */}
                  <div className="space-y-3">
                    {scoredLessons.map((l, i) => (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[70%]">{l.title}</span>
                          <span className={`text-xs font-black ${
                            l.score >= 75 ? 'text-emerald-500' : l.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>{l.score}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              l.score >= 75 ? 'bg-emerald-500' : l.score >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                            style={{ width: `${l.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strong / Weak tags */}
                  {(strong.length > 0 || weak.length > 0) && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {strong.length > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-900">
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                            ✅ {lang === 'ar' ? 'نقاط القوة' : 'Strengths'}
                          </p>
                          {strong.map((l, i) => (
                            <p key={i} className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">• {l.title}</p>
                          ))}
                        </div>
                      )}
                      {weak.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 rounded-2xl p-3 border border-rose-100 dark:border-rose-900">
                          <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
                            📚 {lang === 'ar' ? 'تحتاج مراجعة' : 'Needs Review'}
                          </p>
                          {weak.map((l, i) => (
                            <p key={i} className="text-xs font-bold text-rose-700 dark:text-rose-300 truncate">• {l.title}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visited but no quiz yet */}
                  {visitedLessons > completedLessons && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold text-center pt-1">
                      {lang === 'ar'
                        ? `لديك ${visitedLessons - completedLessons} دروس بدأتها ولم تكمل اختبارها بعد`
                        : `${visitedLessons - completedLessons} lesson(s) started but quiz not completed yet`}
                    </p>
                  )}
                </section>
              )}
            </>
          );
        })()}

        {/* My Badges Section */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{t.myBadges}</h3>
            <button className="text-emerald-500 hover:underline text-xs font-bold">{t.viewAll}</button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 flex gap-4 overflow-x-auto pb-4 scrollbar-none shadow-xl shadow-slate-200/30 dark:shadow-none">
            <div className="flex-shrink-0 flex flex-col items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-[110px]">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 rounded-full flex items-center justify-center mb-2">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-800 dark:text-slate-200 text-center font-bold">Biology Master</span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-[110px]">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 rounded-full flex items-center justify-center mb-2">
                <HelpCircle className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-800 dark:text-slate-200 text-center font-bold">Quiz Expert</span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-[110px]">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 rounded-full flex items-center justify-center mb-2">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-800 dark:text-slate-200 text-center font-bold">
                {lang === 'ar' ? 'حضور كامل' : 'Perfect Streak'}
              </span>
            </div>
          </div>
        </section>

        {/* List Actions */}
        <section className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-none">
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-lg">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-250">{t.uploadedCertificates}</span>
              </div>
              <ChevronIcon className="w-5 h-5 text-emerald-500" />
            </button>
            <div className="mx-4 border-t border-slate-100 dark:border-slate-800"></div>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-lg">
                  <Sliders className="w-5 h-5 text-purple-500" />
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-250">{t.appSettings}</span>
              </div>
              <ChevronIcon className="w-5 h-5 text-emerald-500" />
            </button>
            
            <div className="mx-4 border-t border-slate-100 dark:border-slate-800"></div>
            
            {/* الوضع الداكن / Dark Mode Toggle */}
            <div className="w-full flex items-center justify-between p-4 bg-transparent transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-lg">
                  {isDarkMode ? (
                    <Moon className="w-5 h-5 text-indigo-500 fill-indigo-100" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500 fill-amber-100" />
                  )}
                </div>
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-250 block">{t.darkMode}</span>
                  <span className="text-[10px] text-slate-400 block">{t.darkModeDesc}</span>
                </div>
              </div>
              <button 
                dir="ltr"
                onClick={toggleDarkMode}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-205 focus:outline-none shrink-0 relative flex items-center ${
                  isDarkMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-750'
                }`}
                aria-label="Toggle dark mode"
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-205 ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Notifications & Reminders */}
          <div className="mx-4 border-t border-slate-100 dark:border-slate-800"></div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                notifStatus === 'granted'
                  ? 'bg-indigo-100 dark:bg-indigo-900'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                {notifStatus === 'granted'
                  ? <Bell className="w-5 h-5 text-indigo-500" />
                  : <BellOff className="w-5 h-5 text-slate-400" />}
              </div>
              <div className={`flex-1 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-250 block">
                  {lang === 'ar' ? 'تذكيرات المذاكرة اليومية' : 'Daily Study Reminders'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {notifStatus === 'granted'
                    ? (lang === 'ar' ? 'مفعّلة — اختر وقت التذكير' : 'Enabled — choose reminder time')
                    : notifStatus === 'denied'
                    ? (lang === 'ar' ? 'محظورة من إعدادات المتصفح' : 'Blocked in browser settings')
                    : (lang === 'ar' ? 'غير مفعّلة' : 'Not enabled')}
                </span>
              </div>
              {notifStatus === 'default' && (
                <button
                  onClick={async () => {
                    const res = await Notification.requestPermission();
                    setNotifStatus(res as 'granted'|'denied'|'default');
                    if (res === 'granted') scheduleReminderNotification(reminderTime, lang);
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] px-3 py-1.5 rounded-lg active:scale-95 transition-all shrink-0"
                >
                  {lang === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
              )}
              {notifStatus === 'granted' && (
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-lg shrink-0">
                  {lang === 'ar' ? 'مفعّلة ✓' : 'Active ✓'}
                </span>
              )}
            </div>

            {/* Time Picker — only if granted */}
            {notifStatus === 'granted' && (
              <div className={`flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl p-3 border border-indigo-100 dark:border-indigo-900`}>
                <Bell className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className={`flex-1 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-1">
                    {lang === 'ar' ? 'وقت التذكير اليومي' : 'Daily reminder time'}
                  </p>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => { setReminderTimeState(e.target.value); setReminderSaved(false); }}
                    className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-1.5 text-sm font-black text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500 w-full"
                  />
                </div>
                <button
                  onClick={() => {
                    setReminderTime(reminderTime, lang);
                    setReminderSaved(true);
                    setTimeout(() => setReminderSaved(false), 2000);
                  }}
                  className={`shrink-0 font-black text-[10px] px-3 py-1.5 rounded-xl active:scale-95 transition-all ${
                    reminderSaved
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
                >
                  {reminderSaved
                    ? (lang === 'ar' ? 'تم ✓' : 'Saved ✓')
                    : (lang === 'ar' ? 'حفظ' : 'Save')}
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleResetData}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950 rounded-[24px] hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors group shadow-md shadow-rose-100/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center rounded-xl text-rose-600">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-sm font-extrabold text-rose-600">{t.logout}</span>
            </div>
            {lang === 'ar' ? (
              <ArrowRight className="w-5 h-5 text-rose-600 rotate-180" />
            ) : (
              <ArrowLeft className="w-5 h-5 text-rose-600" />
            )}
          </button>
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
          className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-bold">{t.myLessonsMenu}</span>
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
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl px-4 py-1.5 active:scale-90 transition-transform font-black"
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-xs">{t.myProfile}</span>
        </button>
      </nav>

      {/* Advanced Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] w-full max-w-md p-6 overflow-hidden shadow-2xl relative z-10 text-slate-800 dark:text-slate-100 font-sans flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Settings className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'إعدادات التطبيق' : 'App Settings'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1.5 scrollbar-thin">
                {/* Font Size Settings */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-xl shadow-sm text-emerald-500">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                      <span className="text-xs font-bold block">{t.fontSizeTitle}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                        {t.fontSizeDesc}
                      </span>
                    </div>
                  </div>
                  
                  {/* Segmented Selector for Font Sizes */}
                  <div className="grid grid-cols-4 gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                    {(['small', 'normal', 'large', 'xlarge'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`text-[10px] font-black py-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
                          fontSize === size
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {size === 'small' && t.fontSizeSmall}
                        {size === 'normal' && t.fontSizeNormal}
                        {size === 'large' && t.fontSizeLarge}
                        {size === 'xlarge' && t.fontSizeXLarge}
                      </button>
                    ))}
                  </div>

                  {/* Font Size Preview Text */}
                  <div className="bg-white dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/50 text-center">
                    <p 
                      className="text-slate-850 dark:text-slate-200 font-bold transition-all"
                      style={{ 
                        fontSize: fontSize === 'small' ? '12px' : fontSize === 'normal' ? '14px' : fontSize === 'large' ? '16.5px' : '19px' 
                      }}
                    >
                      {lang === 'ar' ? 'معاينة حجم نص القراءة' : 'Reading text preview'}
                    </p>
                  </div>
                </div>

                {/* Audio/Sound Settings */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-xl shadow-sm">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                      <span className="text-xs font-bold block">{lang === 'ar' ? 'المؤثرات الصوتية' : 'Sound Effects'}</span>
                      <span className="text-[10px] text-slate-405 text-slate-400 dark:text-slate-500 block">
                        {lang === 'ar' ? 'تشغيل أصوات الإجابات والتفاعل' : 'Play interaction sound effects'}
                      </span>
                    </div>
                  </div>
                  <button 
                    dir="ltr"
                    onClick={toggleSound}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-205 focus:outline-none shrink-0 relative flex items-center ${
                      soundEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-750'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-205 ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Demo Control: Unlock All Content */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-xl shadow-sm">
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                      <span className="text-xs font-bold block">{lang === 'ar' ? 'تفعيل كافة الدروس (ديمو)' : 'Unlock All Content (Demo)'}</span>
                      <span className="text-[10px] text-slate-405 text-slate-400 dark:text-slate-500 block">
                        {lang === 'ar' ? 'فتح الباقة الذهبية للامتحانات والدروس فوراً' : 'Activate golden tier access instantly'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleTogglePremium}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 relative flex items-center ${
                      premiumUnlocked ? 'bg-emerald-500 justify-start' : 'bg-slate-200 dark:bg-slate-750 justify-end'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-200" />
                  </button>
                </div>
                {/* Admin Dashboard Entry */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-xl shadow-sm text-emerald-500">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                        <span className="text-xs font-bold block">{lang === 'ar' ? 'إدارة محتوى التطبيق (للمالك)' : 'App Content Management (Owner)'}</span>
                        <span className="text-[10px] text-slate-450 text-slate-450 block">
                          {lang === 'ar' ? 'إضافة وتعديل المنهج والأسئلة والفيديوهات' : 'Add/edit lessons, videos, and quizzes'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={lang === 'ar' ? 'أدخل الرمز السري' : 'Enter Admin PIN'}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 text-center"
                      maxLength={8}
                      id="admin-pin-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCheckAdminPin();
                        }
                      }}
                    />
                    <button
                      onClick={handleCheckAdminPin}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-4 py-1.5 rounded-xl active:scale-95 transition-all shrink-0"
                    >
                      {lang === 'ar' ? 'دخول' : 'Enter'}
                    </button>
                  </div>
                </div>

                {/* Developer Info Section */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold">{lang === 'ar' ? 'معلومات التطبيق' : 'About Application'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{lang === 'ar' ? 'اسم التطبيق:' : 'App Name:'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">Biotech Biology</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'ar' ? 'الإصدار:' : 'Version:'}</span>
                      <span className="font-bold">v1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'ar' ? 'المنهج الدراسي:' : 'Curriculum:'}</span>
                      <span className="font-bold">{lang === 'ar' ? 'الثانوية العامة - اليمن' : '3rd Secondary - Yemen'}</span>
                    </div>
                  </div>
                </div>

                {/* Reset Progress Section */}
                <div className="pt-2">
                  <button
                    onClick={handleResetData}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/30 dark:border-rose-900/50 font-black text-xs py-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    {lang === 'ar' ? 'إعادة ضبط وحذف جميع البيانات' : 'Reset All App Data'}
                  </button>
                </div>
              </div>

              {/* Close Button / Bottom Info */}
              <div className="mt-6 text-center">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wider">
                  © 2026 Biotech Academy. All rights reserved.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
