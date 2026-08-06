import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Loader2, Lock, Mail, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../../utils/translations';

interface AdminLoginModalProps {
  onLoginSuccess: () => void;
  onBack: () => void;
  lang: Language;
}

export default function AdminLoginModal({ onLoginSuccess, onBack, lang }: AdminLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isAr = lang === 'ar';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        onLoginSuccess();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err: any) {
      console.error('Admin Login Error:', err);
      setErrorMsg(
        isAr 
          ? 'خطأ في تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.' 
          : 'Login failed. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 dark:from-slate-950 dark:via-emerald-950 dark:to-slate-900 flex items-center justify-center p-6 text-right font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card max-w-md w-full p-6 shadow-2xl space-y-6"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white">
            {isAr ? 'بوابة إدارة المنصة' : 'Admin Control Portal'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            {isAr ? 'يجب تسجيل الدخول بصلاحيات المسؤول للمتابعة' : 'Please sign in with admin credentials to proceed'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-650 dark:text-slate-300 block px-1">
              {isAr ? 'البريد الإلكتروني للمسؤول:' : 'Admin Email:'}
            </label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-app-btn pr-11 pl-4 py-3.5 text-slate-800 dark:text-white font-bold text-sm focus:outline-none transition-colors"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-650 dark:text-slate-300 block px-1">
              {isAr ? 'كلمة المرور:' : 'Password:'}
            </label>
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-app-btn pr-11 pl-4 py-3.5 text-slate-800 dark:text-white font-bold text-sm focus:outline-none transition-colors"
                disabled={loading}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 p-4 rounded-app-card text-xs font-bold flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3.5 rounded-app-btn border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:dark:text-white hover:border-slate-400 dark:hover:border-slate-500 font-bold text-sm active:scale-95 transition-all"
              disabled={loading}
            >
              {isAr ? 'رجوع' : 'Back'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-3.5 rounded-app-btn text-sm active:scale-95 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isAr ? 'جاري التحقق...' : 'Verifying...'}
                </>
              ) : (
                <>
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
