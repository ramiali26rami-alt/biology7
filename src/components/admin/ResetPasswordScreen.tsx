import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete';

export default function ResetPasswordScreen() {
  const [state, setState] = useState<RecoveryState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error')) {
      setMessage('رابط الاستعادة غير صالح أو انتهت صلاحيته. أرسل رابطاً جديداً من Supabase.');
      setState('invalid');
      return;
    }

    let settled = false;
    const acceptSession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (settled) return;
      if (session?.user.email && !session.user.is_anonymous) {
        settled = true;
        setState('ready');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        acceptSession(session);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage('تعذّر التحقق من رابط الاستعادة. اطلب رابطاً جديداً.');
        setState('invalid');
        return;
      }
      acceptSession(data.session);
      window.setTimeout(() => {
        if (!settled) {
          setMessage('رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.');
          setState('invalid');
        }
      }, 1500);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (password.length < 10) {
      setMessage('استخدم كلمة مرور لا تقل عن 10 أحرف.');
      return;
    }
    if (password !== confirmation) {
      setMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message.includes('anonymous user')
        ? 'هذه ليست جلسة استعادة حساب المالك. افتح أحدث رابط وصل إلى بريد رامي.'
        : 'لم يتم تغيير كلمة المرور. اطلب رابط استعادة جديداً وحاول مرة أخرى.');
      setSaving(false);
      return;
    }

    setState('complete');
    await supabase.auth.signOut();
    window.setTimeout(() => window.location.replace('/admin'), 1200);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5" dir="rtl">
      <section className="w-full max-w-md rounded-app-card border border-emerald-100 bg-white p-6 shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-center text-xl font-black text-slate-900">تعيين كلمة مرور جديدة</h1>
        <p className="mt-2 text-center text-sm font-bold leading-6 text-slate-500">لحساب مالك منصة الأحياء</p>

        {state === 'checking' && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> جاري التحقق من الرابط…
          </div>
        )}

        {state === 'invalid' && (
          <div className="mt-6 rounded-app-btn border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-700">
            <div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div>
            <a href="/admin" className="mt-4 block text-center font-black underline">العودة إلى دخول المالك</a>
          </div>
        )}

        {state === 'ready' && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-black text-slate-700">
              كلمة المرور الجديدة
              <span className="relative mt-2 block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-app-btn border border-slate-200 bg-slate-50 px-4 py-3 pl-12 outline-none focus:border-emerald-500"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار أو إخفاء كلمة المرور">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>
            <label className="block text-sm font-black text-slate-700">
              تأكيد كلمة المرور
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-app-btn border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-500"
                required
              />
            </label>
            {message && <p className="rounded-app-btn bg-rose-50 p-3 text-sm font-bold text-rose-700">{message}</p>}
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-app-btn bg-emerald-600 py-3.5 text-sm font-black text-white disabled:opacity-60">
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {saving ? 'جاري الحفظ…' : 'حفظ كلمة المرور'}
            </button>
          </form>
        )}

        {state === 'complete' && (
          <div className="mt-7 text-center text-emerald-700">
            <CheckCircle2 className="mx-auto h-10 w-10" />
            <p className="mt-3 font-black">تم تغيير كلمة المرور بنجاح</p>
            <p className="mt-1 text-sm font-bold">سيتم نقلك إلى لوحة المالك…</p>
          </div>
        )}
      </section>
    </main>
  );
}
