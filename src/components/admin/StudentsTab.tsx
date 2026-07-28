import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Copy } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { getDifficultQuestions } from '../../utils/supabaseHelper';
import { getAbsoluteUrl } from '../../utils/urlHelper';
import { Language } from '../../utils/translations';
import { Lesson } from '../../types';
import { motion } from 'motion/react';

interface StudentsTabProps {
  lang: Language;
  lessons: Lesson[];
}

export default function StudentsTab({ lang, lessons }: StudentsTabProps) {
  // Supabase Students Management States
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [dbStudentsLoading, setDbStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [activationCodes, setActivationCodes] = useState<any[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  // Difficult Questions States
  const [difficultQuestions, setDifficultQuestions] = useState<any[]>([]);
  const [diffQuestionsLoading, setDiffQuestionsLoading] = useState(false);
  const [studentsSubTab, setStudentsSubTab] = useState<'roster' | 'difficulty'>('roster');

  useEffect(() => {
    fetchStudents();
    fetchActivationCodes();
    fetchDiffQuestions();
  }, []);

  const fetchDiffQuestions = async () => {
    setDiffQuestionsLoading(true);
    try {
      const data = await getDifficultQuestions();
      setDifficultQuestions(data || []);
    } catch (err) {
      console.error('Error fetching difficult questions:', err);
    } finally {
      setDiffQuestionsLoading(false);
    }
  };

  const fetchStudents = async () => {
    setDbStudentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDbStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setDbStudentsLoading(false);
    }
  };

  const fetchActivationCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setActivationCodes(data || []);
    } catch (err) {
      console.error('Error fetching activation codes:', err);
    }
  };

  const handleToggleStudentPremium = async (phone: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_premium: !currentStatus })
        .eq('phone', phone);
      if (error) throw error;
      
      // Update local state
      setDbStudents(prev => prev.map(s => s.phone === phone ? { ...s, is_premium: !currentStatus } : s));
    } catch (err) {
      console.error('Error toggling student premium status:', err);
      alert('فشل تعديل تفعيل الحساب');
    }
  };

  const handleResetStudentDevice = async (phone: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من إعادة ضبط هاتف هذا الطالب؟ سيتيح له هذا التسجيل من هاتف جديد.' : 'Are you sure you want to reset this student\'s device? This lets them register on a new phone.')) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ device_id: 'reset' })
        .eq('phone', phone);
      if (error) throw error;
      alert(lang === 'ar' ? 'تم إعادة ضبط الهاتف بنجاح! يمكن للطالب الآن التسجيل من هاتف جديد.' : 'Device reset successfully! The student can now register from a new phone.');
      fetchStudents();
    } catch (err) {
      console.error('Error resetting device:', err);
      alert('فشل إعادة ضبط جهاز الطالب');
    }
  };

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment1 = '';
    let segment2 = '';
    for (let i = 0; i < 4; i++) {
      segment1 += chars.charAt(Math.floor(Math.random() * chars.length));
      segment2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newCode = `BIO-${segment1}-${segment2}`;

    try {
      const { error } = await supabase
        .from('activation_codes')
        .insert([{ code: newCode }]);
      if (error) throw error;
      setGeneratedCode(newCode);
      fetchActivationCodes();
    } catch (err) {
      console.error('Error generating activation code:', err);
      alert('فشل إنشاء كود التفعيل');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <motion.div
      key="students"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Supabase Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 mt-1 block">{dbStudents.length}</span>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-app-card flex items-center justify-center font-black">👥</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'الطلاب المشتركين (Premium)' : 'Premium Students'}</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-450 mt-1 block">{dbStudents.filter(s => s.is_premium).length}</span>
          </div>
          <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-app-card flex items-center justify-center font-black">🌟</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'أكواد التفعيل المتاحة' : 'Available Codes'}</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-455 mt-1 block">{activationCodes.filter(c => !c.is_used).length}</span>
          </div>
          <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-app-card flex items-center justify-center font-black">🔑</div>
        </div>
      </div>

      {/* Students Tab Sub-Navigation */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 my-2">
        <button
          onClick={() => setStudentsSubTab('roster')}
          className={`pb-3 text-xs font-black transition-all border-b-2 ${
            studentsSubTab === 'roster'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650'
          }`}
        >
          👥 {lang === 'ar' ? 'إدارة الطلاب والتفعيل' : 'Roster & Keys'}
        </button>
        <button
          onClick={() => setStudentsSubTab('difficulty')}
          className={`pb-3 text-xs font-black transition-all border-b-2 ${
            studentsSubTab === 'difficulty'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650'
          }`}
        >
          📊 {lang === 'ar' ? 'الأسئلة الأكثر صعوبة للطلاب' : 'Difficult Questions'}
        </button>
      </div>

      {studentsSubTab === 'roster' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Students List (takes 2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'إدارة الطلاب وتفعيل الاشتراكات' : 'Student Subscriptions'}</h2>
                <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'ابحث عن اسم الطالب وقم بتفعيل حسابه بضغطة زر' : 'Activate or reset student accounts with one click'}</p>
              </div>
              <button
                onClick={fetchStudents}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black text-xs px-3.5 py-2 rounded-app-btn border border-slate-150 dark:border-slate-700 active:scale-95 transition-all shrink-0 flex items-center gap-1.5 justify-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dbStudentsLoading ? 'animate-spin' : ''}`} />
                {lang === 'ar' ? 'تحديث البيانات' : 'Refresh'}
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder={lang === 'ar' ? 'ابحث باسم الطالب أو رقم الهاتف...' : 'Search by name or phone...'}
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-app-btn px-4 py-3 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
            />

            {/* Students List Table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-app-card">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-black border-b border-slate-100 dark:border-slate-800">
                    <th className="p-4">{lang === 'ar' ? 'اسم الطالب' : 'Student Name'}</th>
                    <th className="p-4">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="p-4">{lang === 'ar' ? 'المحافظة' : 'Gov'}</th>
                    <th className="p-4">{lang === 'ar' ? 'حالة الهاتف' : 'Device'}</th>
                    <th className="p-4">{lang === 'ar' ? 'الاشتراك' : 'Access'}</th>
                    <th className="p-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {dbStudentsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-450">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                        {lang === 'ar' ? 'جاري تحميل قائمة الطلاب...' : 'Loading students...'}
                      </td>
                    </tr>
                  ) : dbStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-450">
                        👥 {lang === 'ar' ? 'لا يوجد طلاب مسجلين بعد في قاعدة البيانات.' : 'No registered students yet.'}
                      </td>
                    </tr>
                  ) : dbStudents.filter(s => 
                      s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                      s.phone.includes(studentSearch)
                    ).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-450">
                        🔍 {lang === 'ar' ? 'لم يتم العثور على نتائج تطابق بحثك.' : 'No matching results found.'}
                      </td>
                    </tr>
                  ) : (
                    dbStudents
                      .filter(s => 
                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                        s.phone.includes(studentSearch)
                      )
                      .map(s => (
                        <tr key={s.phone} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                          <td className="p-4">
                            <span className="font-extrabold block text-slate-900 dark:text-white">{s.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              {lang === 'ar' ? 'سجل في: ' : 'Reg: '} {new Date(s.created_at).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US')}
                            </span>
                          </td>
                          <td className="p-4 font-mono select-all">{s.phone}</td>
                          <td className="p-4">{s.governorate || '—'}</td>
                          <td className="p-4">
                            {s.device_id === 'reset' ? (
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                {lang === 'ar' ? 'بانتظار هاتف جديد' : 'Reset Pending'}
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                {lang === 'ar' ? 'نشط' : 'Active'}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleStudentPremium(s.phone, s.is_premium)}
                              className={`text-[10px] font-black px-3 py-1.5 rounded-app-btn transition-all active:scale-95 shadow-sm ${
                                s.is_premium
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 border border-slate-200/40 dark:border-slate-700'
                              }`}
                            >
                              {s.is_premium 
                                ? (lang === 'ar' ? '⭐ تفعيل كامل' : '⭐ Premium') 
                                : (lang === 'ar' ? 'تفعيل الحساب 🟢' : 'Activate 🟢')}
                            </button>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleResetStudentDevice(s.phone)}
                              title={lang === 'ar' ? 'إعادة ضبط الهاتف' : 'Reset Device ID'}
                              className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-455 text-[10px] font-black px-2.5 py-1.5 rounded-app-btn active:scale-95 transition-all"
                            >
                              {lang === 'ar' ? 'نقل الهاتف 🔄' : 'Transfer 🔄'}
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Code Generator (takes 1 col) */}
          <div className="space-y-6">
            {/* Generator Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'توليد أكواد التفعيل' : 'Code Generator'}</h2>
                <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'أنشئ أكواد فريدة صالحة للتنشيط لمرة واحدة' : 'Generate single-use premium keys'}</p>
              </div>

              <button
                onClick={handleGenerateCode}
                disabled={codeLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3.5 rounded-app-btn active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {codeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <span>🔑 {lang === 'ar' ? 'توليد كود تفعيل جديد' : 'Generate New Key'}</span>
                  </>
                )}
              </button>

              {generatedCode && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-app-card space-y-2 text-center">
                  <span className="text-[10px] text-slate-400 font-black block">{lang === 'ar' ? 'الكود الجديد المنشأ:' : 'NEW KEY GENERATED:'}</span>
                  <span className="text-md font-extrabold text-blue-600 dark:text-blue-450 block tracking-wider select-all">{generatedCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      alert(lang === 'ar' ? 'تم نسخ كود التفعيل!' : 'Code copied!');
                    }}
                    className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-black px-3 py-1.5 rounded-app-btn active:scale-95 transition-all inline-flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'نسخ كود التفعيل' : 'Copy Key'}
                  </button>
                </div>
              )}
            </div>

            {/* Codes List Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'الأكواد المنشأة سابقاً' : 'Recent Keys'}</h2>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-2.5 py-1 rounded-full font-black">
                  {activationCodes.length}
                </span>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 rounded-app-card p-2">
                {activationCodes.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 font-bold text-xs">
                    🗝️ {lang === 'ar' ? 'لا يوجد أكواد منشأة بعد.' : 'No codes generated yet.'}
                  </div>
                ) : (
                  activationCodes.map(c => (
                    <div
                      key={c.code}
                      className={`p-3 rounded-app-btn border flex flex-col gap-1 ${
                        c.is_used
                          ? 'bg-rose-50/20 border-rose-100 dark:bg-rose-950/10 dark:border-rose-955/20'
                          : 'bg-emerald-50/20 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-950/20'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold tracking-wider text-xs select-all text-slate-800 dark:text-white">{c.code}</span>
                        {c.is_used ? (
                          <span className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-455 text-[9px] px-2 py-0.5 rounded-full font-black">
                            {lang === 'ar' ? 'مستعمل' : 'Used'}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-455 text-[9px] px-2 py-0.5 rounded-full font-black">
                            {lang === 'ar' ? 'متاح' : 'Available'}
                          </span>
                        )}
                      </div>
                      {c.is_used && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                          {lang === 'ar' ? 'المستخدم: ' : 'User: '} {c.used_by_phone}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {studentsSubTab === 'difficulty' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-xl shadow-slate-100/25 dark:shadow-none space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'الأسئلة الصعبة في الكويزات' : 'Difficult Questions Analytics'}</h2>
              <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'الأسئلة المرتبة تنازلياً حسب نسبة إخفاق الطلاب فيها' : 'Questions ranked by student failure rate'}</p>
            </div>
            <button
              onClick={fetchDiffQuestions}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black text-xs px-3.5 py-2 rounded-app-btn border border-slate-150 dark:border-slate-700 active:scale-95 transition-all shrink-0 flex items-center gap-1.5 justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diffQuestionsLoading ? 'animate-spin' : ''}`} />
              {lang === 'ar' ? 'تحديث الإحصائيات' : 'Refresh'}
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-app-card">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-black border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">{lang === 'ar' ? 'السؤال' : 'Question'}</th>
                  <th className="p-4">{lang === 'ar' ? 'الدرس' : 'Lesson'}</th>
                  <th className="p-4">{lang === 'ar' ? 'الخطأ' : 'Wrong Ans'}</th>
                  <th className="p-4">{lang === 'ar' ? 'الصواب' : 'Correct Ans'}</th>
                  <th className="p-4">{lang === 'ar' ? 'نسبة الفشل' : 'Failure Rate'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                {diffQuestionsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-450">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                      {lang === 'ar' ? 'جاري تحميل إحصائيات الأسئلة...' : 'Loading analytics...'}
                    </td>
                  </tr>
                ) : difficultQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-450">
                      📊 {lang === 'ar' ? 'لا توجد أية إجابات مسجلة بعد في قاعدة البيانات للأسئلة.' : 'No logged question results yet.'}
                    </td>
                  </tr>
                ) : (
                  difficultQuestions.map(q => {
                    const lessonName = lessons.find(l => l.id === q.lesson_id)?.titleAr || q.lesson_id;
                    return (
                      <tr key={q.question_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                        <td className="p-4 max-w-[280px]">
                          <span className="font-extrabold block text-slate-900 dark:text-white leading-relaxed">{q.question_text}</span>
                          <span className="text-[9px] text-slate-450 font-mono block mt-0.5">ID: {q.question_id}</span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">{lessonName}</td>
                        <td className="p-4 text-rose-500 dark:text-rose-455 font-extrabold">❌ {q.wrong_count}</td>
                        <td className="p-4 text-emerald-500 dark:text-emerald-500">🟢 {q.correct_count}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="bg-rose-500 h-full rounded-full" style={{ width: `${q.failureRate}%` }}></div>
                            </div>
                            <span className="font-black text-rose-600 dark:text-rose-450">{q.failureRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
