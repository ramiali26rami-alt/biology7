/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Dna, ArrowLeft, ArrowRight, Sparkles, BookOpen, PenTool, Award } from 'lucide-react';
import { ScreenId } from '../types';
import { Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

interface WelcomeScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

const STEPS = ['lang', 'name', 'ready'] as const;
type Step = typeof STEPS[number];

export default function WelcomeScreen({ onNavigate, lang, setLang }: WelcomeScreenProps) {
  const [step, setStep] = useState<Step>('lang');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);

  const isAr = lang === 'ar';

  const handleNameNext = () => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError(true);
      return;
    }
    setNameError(false);
    localStorage.setItem('student_name', name.trim());
    localStorage.setItem('student_email', '');
    setStep('ready');
  };

  const handleStart = () => {
    onNavigate('main-dashboard', 'push');
  };

  const features = isAr
    ? [
        { icon: <BookOpen className="w-5 h-5" />, text: 'دروس تفاعلية مع خرائط ذهنية' },
        { icon: <PenTool className="w-5 h-5" />, text: 'اختبارات تلقائية وبنك أسئلة' },
        { icon: <Award className="w-5 h-5" />, text: 'تتبع تقدمك خطوة بخطوة' },
      ]
    : [
        { icon: <BookOpen className="w-5 h-5" />, text: 'Interactive lessons with mind maps' },
        { icon: <PenTool className="w-5 h-5" />, text: 'Auto-graded quizzes & question bank' },
        { icon: <Award className="w-5 h-5" />, text: 'Track your progress step by step' },
      ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 flex flex-col items-center justify-center px-6 font-sans overflow-hidden relative"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Ambient background blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-20 h-20 rounded-[28px] overflow-hidden bg-slate-950 flex items-center justify-center shadow-2xl shadow-emerald-900/40 mb-4 border border-slate-800">
            <img src="/logo.png" className="w-full h-full object-cover" alt="Smart Bio Logo" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isAr ? 'سمارت بايو' : 'Smart Bio'}
          </h1>
          <p className="text-emerald-400 text-xs font-bold mt-1">
            {isAr ? 'الصف الثالث الثانوي — اليمن' : '3rd Secondary — Yemen'}
          </p>
        </motion.div>

        {/* Step content */}
        <AnimatePresence mode="wait">

          {/* STEP 1: Language */}
          {step === 'lang' && (
            <motion.div
              key="lang"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-white">
                  {isAr ? 'اختر لغة التطبيق' : 'Choose App Language'}
                </h2>
                <p className="text-slate-400 text-sm font-medium">
                  {isAr ? 'يمكنك تغييرها لاحقاً من الإعدادات' : 'You can change this later in settings'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setLang('ar'); localStorage.setItem('lang', 'ar'); }}
                  className={`p-5 rounded-2xl border-2 transition-all active:scale-95 flex flex-col items-center gap-3 ${
                    lang === 'ar'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                >
                  <span className="text-3xl">🇾🇪</span>
                  <div className="text-center">
                    <span className="block text-white font-black text-sm">العربية</span>
                    <span className="block text-slate-400 text-xs font-medium">Arabic</span>
                  </div>
                  {lang === 'ar' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </button>

                <button
                  onClick={() => { setLang('en'); localStorage.setItem('lang', 'en'); }}
                  className={`p-5 rounded-2xl border-2 transition-all active:scale-95 flex flex-col items-center gap-3 ${
                    lang === 'en'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                >
                  <span className="text-3xl">🇺🇸</span>
                  <div className="text-center">
                    <span className="block text-white font-black text-sm">English</span>
                    <span className="block text-slate-400 text-xs font-medium">الإنجليزية</span>
                  </div>
                  {lang === 'en' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>

              <button
                onClick={() => setStep('name')}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2"
              >
                {isAr ? 'التالي' : 'Next'}
                {isAr
                  ? <ArrowLeft className="w-4 h-4 rotate-180" />
                  : <ArrowRight className="w-4 h-4" />}
              </button>
            </motion.div>
          )}

          {/* STEP 2: Name */}
          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-white">
                  {isAr ? 'ما اسمك؟' : 'What\'s your name?'}
                </h2>
                <p className="text-slate-400 text-sm font-medium">
                  {isAr ? 'سيظهر اسمك في ملفك الشخصي' : 'Your name will appear on your profile'}
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleNameNext(); }}
                  placeholder={isAr ? 'أدخل اسمك الكامل...' : 'Enter your full name...'}
                  className={`w-full bg-slate-800/70 border-2 rounded-2xl px-5 py-4 text-white font-bold text-sm placeholder:text-slate-500 focus:outline-none transition-colors ${
                    nameError
                      ? 'border-rose-500 focus:border-rose-400'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                {nameError && (
                  <p className="text-rose-400 text-xs font-bold px-1">
                    {isAr ? '⚠️ الرجاء إدخال اسم لا يقل عن حرفين' : '⚠️ Please enter at least 2 characters'}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('lang')}
                  className="px-5 py-4 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-bold text-sm active:scale-95 transition-all"
                >
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  onClick={handleNameNext}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2"
                >
                  {isAr ? 'التالي' : 'Next'}
                  {isAr
                    ? <ArrowLeft className="w-4 h-4 rotate-180" />
                    : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Ready */}
          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  className="text-5xl mb-3"
                >
                  🎉
                </motion.div>
                <h2 className="text-2xl font-black text-white">
                  {isAr ? `أهلاً، ${name}!` : `Welcome, ${name}!`}
                </h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  {isAr
                    ? 'أنت الآن جاهز لبدء رحلتك في تعلم الأحياء. إليك ما ينتظرك:'
                    : 'You\'re all set to start your Biology journey. Here\'s what awaits:'}
                </p>
              </div>

              {/* Feature list */}
              <div className="space-y-3">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                  >
                    <span className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                      {f.icon}
                    </span>
                    <span className="text-sm font-bold text-slate-200">{f.text}</span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={handleStart}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm active:scale-95 transition-all shadow-xl shadow-emerald-900/50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isAr ? 'ابدأ رحلتك الآن!' : 'Start Your Journey!'}
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Step dots indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${
                STEPS.indexOf(step) === i
                  ? 'w-6 h-2 bg-emerald-500'
                  : STEPS.indexOf(step) > i
                  ? 'w-2 h-2 bg-emerald-700'
                  : 'w-2 h-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
