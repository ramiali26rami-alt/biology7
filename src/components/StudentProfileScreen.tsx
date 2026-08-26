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
  BellOff,
  ShieldCheck
} from 'lucide-react';
import { ScreenId } from '../types';
import { Lesson } from '../types';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { loadProgress, getStreak, overallPercent } from '../utils/progress';
import { playClickSound, playCorrectSound } from '../utils/soundEffects';
import { scheduleReminderNotification, getReminderTime, setReminderTime } from '../utils/notifications';
import { SecureStorage, setPremiumUnlockedState, checkPremiumStatus } from '../utils/security';
import { claimActivationCode, checkStudentSubscription } from '../utils/supabaseHelper';
import { ensureAuthenticatedSession, supabase } from '../utils/supabaseClient';

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

// FIX: حد أقصى لحجم الصورة المرفوعة (2MB)
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

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
  // Sync states from localStorage / SecureStorage for persistence
  const [name, setName] = useState(() => SecureStorage.getItem('student_name') || '');
  // FIX: نقل student_email من localStorage إلى SecureStorage
  const [email, setEmail] = useState(() => SecureStorage.getItem('student_email') || localStorage.getItem('student_email') || '');
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('student_avatar') || PRESET_AVATARS[0].url);
  const [premiumUnlocked, setPremiumUnlocked] = useState(() => checkPremiumStatus());
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
  const [legalModalType, setLegalModalType] = useState<'about' | 'privacy' | 'terms' | null>(null);

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey.trim()) return;

    setActivationLoading(true);
    setActivationMessage(null);

    try {
      const res = await claimActivationCode(activationKey.trim());
      if (res.success) {
        setPremiumUnlocked(true);
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
          text: res.message
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

  // No longer auto-filling defaults — the WelcomeScreen handles first-time name entry

  // Sync subscription status and notifications on mount
  useEffect(() => {
    // 1. فحص فوري للتخزين المحلي المشفر
    setPremiumUnlocked(checkPremiumStatus());

    // 2. مزامنة حية مع السحابة للتأكد من حالة الطالب وتحديث الواجهة فوراً
    checkStudentSubscription().then((isPrem) => {
      setPremiumUnlocked(isPrem);
    }).catch(() => {});

    if ('Notification' in window) {
      setNotifStatus(Notification.permission as 'default'|'granted'|'denied');
      // Re-schedule if already granted
      if (Notification.permission === 'granted') {
        scheduleReminderNotification(getReminderTime(), lang);
      }
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inputName.trim();
    const cleanEmail = inputEmail.trim();
    setName(cleanName);
    setEmail(cleanEmail);
    SecureStorage.setItem('student_name', cleanName);
    // FIX: حفظ الإيميل في SecureStorage بدلاً من localStorage
    SecureStorage.setItem('student_email', cleanEmail);
    localStorage.removeItem('student_email'); // تنظيف النسخة القديمة
    setIsEditing(false);

    // Sync updated name directly to Supabase cloud database
    const phone = localStorage.getItem('student_phone');
    if (phone && cleanName) {
      try {
        await ensureAuthenticatedSession();
        const { error } = await supabase.rpc('update_student_name', { student_name: cleanName });
        if (error) throw error;
      } catch (err) {
        console.error('Error syncing updated name to Supabase:', err);
      }
    }
  };

  const handleSelectAvatar = (url: string) => {
    setAvatarUrl(url);
    localStorage.setItem('student_avatar', url);
    setShowAvatarPicker(false);
  };

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 300;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              setAvatarUrl(compressedDataUrl);
              localStorage.setItem('student_avatar', compressedDataUrl);
            }
          };
          img.src = uploadEvent.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
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
      setPremiumUnlockedState(false);
      window.location.reload();
    }
  };

  const ChevronIcon = lang === 'ar' ? ChevronLeft : ChevronRight;
  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-sans select-none transition-colors duration-[250ms]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-md shadow-slate-100/30 dark:shadow-none">
        <button 
          onClick={() => onNavigate('main-dashboard', 'push_back')} 
          aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
          className="active:scale-95 tap-target rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          {backIcon}
        </button>
        <h1 className="font-black text-lg text-slate-900 dark:text-white">{t.profileScreenTitle}</h1>
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="active:scale-95 tap-target rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 cursor-pointer"
          aria-label={lang === 'ar' ? 'الإعدادات' : 'Settings'}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6">
        
        {/* Profile Header & Avatar Editor */}
        <section className="flex flex-col items-center mt-6 bg-white dark:bg-slate-900 p-6 rounded-app-card border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
          <div className="relative group">
            <div className="w-24 h-24 rounded-app-card overflow-hidden border-4 border-emerald-500 dark:border-emerald-400 shadow-xl shadow-emerald-250/20">
              <img 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
                alt={lang === 'ar' ? 'الصورة الشخصية للطالب' : 'Student Portrait'} 
                src={avatarUrl} 
              />
            </div>
            <button 
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="absolute bottom-0 right-0 bg-emerald-500 dark:bg-emerald-600 text-white p-2 rounded-app-btn border-2 border-white dark:border-slate-900 shadow-md hover:bg-emerald-600 active:scale-90 transition-all flex items-center justify-center"
              title={t.uploadPhoto}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Avatar Selection Grid */}
          {showAvatarPicker && (
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-app-card border border-slate-100 dark:border-slate-800 mt-4 animate-fadeIn">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center">{t.chooseAvatar}</p>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => handleSelectAvatar(av.url)}
                    className="w-12 h-12 rounded-app-btn overflow-hidden border-2 border-transparent hover:border-emerald-500 transition-all active:scale-95 mx-auto"
                  >
                    <img src={av.url} className="w-full h-full object-cover" alt={av.name} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center">
                <label className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold px-4 py-2 rounded-app-btn cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-center w-full">
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
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-400 mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                <input 
                  type="email" 
                  value={inputEmail} 
                  onChange={(e) => setInputEmail(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-app-btn text-xs active:scale-95 transition-transform"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-app-btn text-xs active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {t.save}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Premium Upgrade & Pricing Screen 1 Integration */}
        <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-emerald-950 dark:to-slate-900 border border-emerald-200 dark:border-emerald-500/20 text-slate-800 dark:text-white p-5 rounded-app-card shadow-md relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100/60 dark:bg-white/10 rounded-app-btn border border-emerald-200/50 dark:border-white/10">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <h3 className="font-black text-sm text-slate-850 dark:text-white">{t.premiumStatus}</h3>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-black border uppercase tracking-wider ${
                premiumUnlocked 
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-400 dark:text-emerald-300' 
                  : 'bg-amber-105 border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-400 dark:text-amber-300'
              }`}>
                {premiumUnlocked ? t.premiumUnlocked : t.premiumLocked}
              </span>
            </div>
            
            <p className="text-slate-600 dark:text-emerald-100/90 text-xs font-semibold leading-relaxed">
              {lang === 'ar' 
                ? 'شراء الباقة المميزة يمنحك حق الوصول الفوري إلى الوحدة الثانية والثالثة من منهج الأحياء للصف الثالث الثانوي بالجمهورية اليمنية، وحل نماذج الامتحانات الوزارية مع بنك الأسئلة الممتد.' 
                : 'Upgrading unlocks Unit 2, Unit 3, past Yemeni Ministry exam simulations, and all interactive flashcard packages instantly.'
              }
            </p>

            {premiumUnlocked ? (
              <div className="w-full py-3 px-4 rounded-app-btn bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'ar' ? '✨ باقتك الذهبية مفعّلة ونشطة (جميع الوحدات والامتحانات مفتوحة)' : '✨ Premium Access Active (All Units & Exams Unlocked)'}</span>
              </div>
            ) : (
              <div className="w-full font-bold text-xs py-3 px-4 rounded-app-btn bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ar' ? 'أدخل كرت التفعيل أدناه لفتح المنهج كاملاً' : 'Enter your activation key below to unlock full curriculum'}</span>
              </div>
            )}

            {!premiumUnlocked && (
              <form onSubmit={handleActivateKey} className="border-t border-slate-150 dark:border-white/10 pt-4 mt-4 space-y-3 text-right">
                <label className="text-xs font-extrabold text-slate-700 dark:text-emerald-200 block">
                  {t.enterActivationKey}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder={t.activationKeyPlaceholder}
                    disabled={activationLoading}
                    className="flex-1 bg-white dark:bg-white/10 border border-slate-250 dark:border-white/20 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:bg-slate-50 focus:border-emerald-450 dark:focus:bg-white/15 dark:focus:border-white/30 rounded-app-btn px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={activationLoading || !activationKey.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs px-4 py-2.5 rounded-app-btn transition-all active:scale-95 shadow-md shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {activationLoading ? t.activating : t.activateBtn}
                  </button>
                </div>
                {activationMessage && (
                  <div className={`text-[10px] font-black px-3 py-2 rounded-app-btn ${
                    activationMessage.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {activationMessage.text}
                  </div>
                )}
              </form>
            )}

            {/* Advanced Server Settings */}
            <div className="border-t border-slate-150 dark:border-white/10 pt-4 mt-4 space-y-3 text-right">
              <label className="text-xs font-extrabold text-slate-700 dark:text-emerald-200 block">
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
                  className="flex-1 bg-white dark:bg-white/10 border border-slate-250 dark:border-white/20 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:bg-slate-50 focus:border-emerald-450 dark:focus:bg-white/15 dark:focus:border-white/30 rounded-app-btn px-4 py-2.5 text-xs font-mono focus:outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-emerald-200/70 font-bold leading-normal">
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
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-app-card shadow-xl shadow-slate-200/30 dark:shadow-none">
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

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-app-card shadow-xl shadow-slate-200/30 dark:shadow-none flex flex-col justify-between">
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
              {scoredLessons.length > 0 ? (
                <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-5 shadow-xl shadow-slate-200/20 dark:shadow-none space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-3">
                    <span className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-app-btn text-indigo-500">
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
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-app-card p-3 border border-emerald-100 dark:border-emerald-900">
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                            ✅ {lang === 'ar' ? 'نقاط القوة' : 'Strengths'}
                          </p>
                          {strong.map((l, i) => (
                            <p key={i} className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">• {l.title}</p>
                          ))}
                        </div>
                      )}
                      {weak.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 rounded-app-card p-3 border border-rose-100 dark:border-rose-900">
                          <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
                            📚 {lang === 'ar' ? 'تحتاج مراجعة' : 'Needs Review'}
                          </p>
                          {weak.map((l, i) => (
                            <p key={i} className="text-xs font-bold text-rose-700 dark:text-rose-350 truncate">• {l.title}</p>
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
              ) : (
                <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-xl shadow-slate-200/25 dark:shadow-none text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                    <Award className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-800 dark:text-white text-sm">
                      {lang === 'ar' ? 'لا توجد بيانات اختبارات بعد' : 'No quiz performance data yet'}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
                      {lang === 'ar' 
                        ? 'ابدأ بحل أسئلة الدروس التفاعلية وسوف يظهر هنا تحليل ذكي لنقاط قوتك والدروس التي تحتاج لمراجعتها.' 
                        : 'Start answering interactive quiz questions for lessons, and a smart analysis of your strengths and topics to review will appear here.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      playClickSound();
                      onNavigate('main-dashboard', 'push_back');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-app-btn shadow-md active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>🎯</span>
                    <span>{lang === 'ar' ? 'ابدأ أول اختبار الآن' : 'Start Your First Quiz'}</span>
                  </button>
                </section>
              )}
            </>
          );
        })()}



        {/* List Actions */}
        <section className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-app-card border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-none">

            <button 
              onClick={() => setShowSettingsModal(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-app-btn">
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
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-app-btn">
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
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-[205ms] focus:outline-none shrink-0 relative flex items-center ${
                  isDarkMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-750'
                }`}
                aria-label="Toggle dark mode"
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-[205ms] ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Notifications & Reminders */}
          <div className="mx-4 border-t border-slate-100 dark:border-slate-800"></div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center rounded-app-btn ${
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
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] px-3 py-1.5 rounded-app-btn active:scale-95 transition-all shrink-0"
                >
                  {lang === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
              )}
              {notifStatus === 'granted' && (
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-app-btn shrink-0">
                  {lang === 'ar' ? 'مفعّلة ✓' : 'Active ✓'}
                </span>
              )}
            </div>

            {/* Time Picker — only if granted */}
            {notifStatus === 'granted' && (
              <div className={`flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-app-card p-3 border border-indigo-100 dark:border-indigo-900`}>
                <Bell className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className={`flex-1 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-1">
                    {lang === 'ar' ? 'وقت التذكير اليومي' : 'Daily reminder time'}
                  </p>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => { setReminderTimeState(e.target.value); setReminderSaved(false); }}
                    className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-app-btn px-3 py-1.5 text-sm font-black text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500 w-full"
                  />
                </div>
                <button
                  onClick={() => {
                    setReminderTime(reminderTime, lang);
                    setReminderSaved(true);
                    setTimeout(() => setReminderSaved(false), 2000);
                  }}
                  className={`shrink-0 font-black text-[10px] px-3 py-1.5 rounded-app-btn active:scale-95 transition-all ${
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
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950 rounded-app-card hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors group shadow-md shadow-rose-100/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center rounded-app-btn text-rose-600">
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
          className="flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-app-btn px-4 py-1.5 active:scale-90 transition-transform font-black"
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
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-dialog w-full max-w-md p-6 overflow-hidden shadow-2xl relative z-10 text-slate-800 dark:text-slate-100 font-sans flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-app-btn">
                    <Settings className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'إعدادات التطبيق' : 'App Settings'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  aria-label={lang === 'ar' ? 'إغلاق الإعدادات' : 'Close settings'}
                  className="tap-target p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="space-y-4 overflow-y-auto max-h-[60vh] pe-1.5 scrollbar-thin">
                {/* Font Size Settings */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-app-card space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-app-btn shadow-sm text-emerald-500">
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
                  <div className="grid grid-cols-4 gap-1 bg-white dark:bg-slate-900 p-1 rounded-app-btn border border-slate-100 dark:border-slate-800">
                    {(['small', 'normal', 'large', 'xlarge'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`text-[10px] font-black py-2 rounded-app-btn transition-all active:scale-95 cursor-pointer ${
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
                  <div className="bg-white dark:bg-slate-900/50 p-2.5 rounded-app-btn border border-slate-100 dark:border-slate-800/50 text-center">
                    <p 
                      className="text-slate-800 dark:text-slate-200 font-bold transition-all"
                      style={{ 
                        fontSize: fontSize === 'small' ? '12px' : fontSize === 'normal' ? '14px' : fontSize === 'large' ? '16.5px' : '19px' 
                      }}
                    >
                      {lang === 'ar' ? 'معاينة حجم نص القراءة' : 'Reading text preview'}
                    </p>
                  </div>
                </div>

                {/* Audio/Sound Settings */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-app-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white dark:bg-slate-900 flex items-center justify-center rounded-app-btn shadow-sm">
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
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-[205ms] focus:outline-none shrink-0 relative flex items-center ${
                      soundEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-750'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-[205ms] ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Platform Policies & Terms Section */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-app-card space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold">{lang === 'ar' ? 'حول التطبيق والسياسات' : 'About & Policies'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => setLegalModalType('about')}
                      className="text-[10px] font-black py-2 rounded-app-btn bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-500 hover:border-emerald-200 active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                    >
                      {lang === 'ar' ? 'من نحن' : 'About'}
                    </button>
                    <button
                      onClick={() => setLegalModalType('terms')}
                      className="text-[10px] font-black py-2 rounded-app-btn bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-500 hover:border-emerald-200 active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                    >
                      {lang === 'ar' ? 'الشروط' : 'Terms'}
                    </button>
                    <button
                      onClick={() => setLegalModalType('privacy')}
                      className="text-[10px] font-black py-2 rounded-app-btn bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-500 hover:border-emerald-200 active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                    >
                      {lang === 'ar' ? 'الخصوصية' : 'Privacy'}
                    </button>
                  </div>
                </div>

                {/* Developer Info Section */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-app-card space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold">{lang === 'ar' ? 'معلومات التطبيق' : 'About Application'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{lang === 'ar' ? 'اسم التطبيق:' : 'App Name:'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">ALAHYA'A</span>
                    </div>
                    <div className="flex justify-between select-none">
                      <span>{lang === 'ar' ? 'الإصدار:' : 'Version:'}</span>
                      <span className="font-bold hover:underline text-emerald-650 dark:text-emerald-500">v1.0.0</span>
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
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/30 dark:border-rose-900/50 font-black text-xs py-3.5 rounded-app-btn transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    {lang === 'ar' ? 'إعادة ضبط وحذف جميع البيانات' : 'Reset All App Data'}
                  </button>
                </div>
              </div>

              {/* Close Button / Bottom Info */}
              <div className="mt-6 text-center">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wider">
                  © 2026 ALAHYA'A. All rights reserved.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Legal terms overlay (about, privacy, terms) */}
      <AnimatePresence>
        {legalModalType && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLegalModalType(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card max-w-md w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl relative z-10 space-y-4 text-right text-slate-800 dark:text-slate-100 font-sans"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {legalModalType === 'about' && (lang === 'ar' ? 'من نحن' : 'About Us')}
                  {legalModalType === 'terms' && (lang === 'ar' ? 'شروط الاستخدام' : 'Terms of Use')}
                  {legalModalType === 'privacy' && (lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy')}
                </h3>
                <button
                  onClick={() => setLegalModalType(null)}
                  className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-black p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-bold space-y-3 whitespace-pre-line">
                {legalModalType === 'about' && (
                  lang === 'ar' 
                    ? "منصة تعليمية متكاملة تقودها نخبة من المعلمين والتربويين ذوي الخبرة والكفاءة في تدريس مادة الأحياء. نسعى لتقديم تجربة تعليمية تفاعلية بصرية حديثة، تعتمد على التكنولوجيا لتبسيط المفاهيم الصعبة وتهيئة الطالب بشكل كامل لاجتياز امتحانات الشهادة الثانوية بتفوق ونيل الدرجات الكاملة."
                    : "An integrated educational platform led by an elite group of experienced and qualified teachers in biology. We strive to provide a modern visual interactive learning experience that leverages technology to simplify difficult concepts, preparing students to successfully pass high school certificate exams with excellence."
                )}

                {legalModalType === 'terms' && (
                  lang === 'ar'
                    ? `1. شروط الاستخدام:
                       باستخدامك هذا التطبيق، فإنك توافق على الالتزام بشروط الخدمة هذه.
                       
                       2. استخدام شخصي:
                       الحساب مخصص للاستخدام الشخصي للطالب المسجل فقط على جهاز واحد. يُمنع مشاركة الحساب أو محاولة تجاوزه.
                       
                       3. الملكية الفكرية:
                       جميع الحقوق محفوظة للمنصة، بما في ذلك التصاميم، الأسئلة، الملخصات والخرائط الذهنية المتضمنة.`
                    : `1. Terms of Use:
                       By using this app, you agree to comply with these terms of service.
                       
                       2. Personal Use:
                       The account is for the personal use of the registered student only on a single device. Sharing accounts or attempting bypasses is prohibited.
                       
                       3. Intellectual Property:
                       All rights are reserved to the platform, including designs, questions, summaries, and mindmaps.`
                )}

                {legalModalType === 'privacy' && (
                  lang === 'ar'
                    ? `1. جمع البيانات:
                       نحن نجمع فقط البيانات الأساسية اللازمة لتشغيل حسابك (الاسم، رقم الهاتف، المحافظة، ومعرّف الجهاز UUID لتأمين الحساب).
                       
                       2. أمان البيانات:
                       نحن لا نبيع أو نشارك بياناتك الشخصية مع أي طرف ثالث خارج إطار تفعيل وتحسين خدمات التطبيق.
                       
                       3. التخزين السحابي:
                       يتم حفظ إحصائيات إنجاز الكويزات سحابياً لغرض تحسين لوحة الصدارة ورصد الأسئلة الصعبة لتقديم دعم أكاديمي أفضل.`
                    : `1. Data Collection:
                       We only collect basic data required to operate your account (Name, Phone number, Governorate, and Device UUID for security).
                       
                       2. Data Security:
                       We do not sell or share your personal data with any third party outside the scope of app operations.
                       
                       3. Cloud Storage:
                       Quiz progress statistics are stored in the cloud to compute leaderboards and analyze difficult questions.`
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setLegalModalType(null)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-2.5 rounded-app-btn transition-all cursor-pointer active:scale-95 text-center"
                >
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
