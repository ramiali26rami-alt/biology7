import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  Loader2, 
  Copy, 
  Download, 
  Filter, 
  ArrowUpDown, 
  Trophy, 
  Medal, 
  Search, 
  CheckCircle2, 
  Sparkles,
  Smartphone,
  Check
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { getDifficultQuestions } from '../../utils/supabaseHelper';
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
  const [filterGov, setFilterGov] = useState('all');
  const [filterPremium, setFilterPremium] = useState('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'newest' | 'oldest' | 'quizzes_desc' | 'accuracy_desc' | 'name_asc'>('score_desc');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Activation Codes States
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
      const [{ data: studentsData, error: sErr }, { data: resultsData, error: rErr }] = await Promise.all([
        supabase.from('students').select('*').order('created_at', { ascending: false }),
        supabase.from('quiz_results').select('student_phone, score, total_questions, lesson_id, completed_at')
      ]);

      if (sErr) throw sErr;

      const statsMap: Record<string, { totalScore: number; totalQuestions: number; quizzesCount: number; accuracy: number; completedLessons: Set<string> }> = {};
      
      resultsData?.forEach(r => {
        const p = r.student_phone;
        if (!statsMap[p]) {
          statsMap[p] = { totalScore: 0, totalQuestions: 0, quizzesCount: 0, accuracy: 0, completedLessons: new Set() };
        }
        statsMap[p].totalScore += r.score || 0;
        statsMap[p].totalQuestions += r.total_questions || 0;
        statsMap[p].quizzesCount += 1;
        if (r.lesson_id) {
          statsMap[p].completedLessons.add(r.lesson_id);
        }
      });

      Object.values(statsMap).forEach(st => {
        st.accuracy = st.totalQuestions > 0 ? Math.round((st.totalScore / st.totalQuestions) * 100) : 0;
      });

      const enrichedStudents = (studentsData || []).map(s => ({
        ...s,
        totalScore: statsMap[s.phone]?.totalScore || 0,
        quizzesCount: statsMap[s.phone]?.quizzesCount || 0,
        accuracy: statsMap[s.phone]?.accuracy || 0,
        lessonsCount: statsMap[s.phone]?.completedLessons?.size || 0
      }));

      setDbStudents(enrichedStudents);
    } catch (err) {
      console.error('Error fetching students and results:', err);
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

  // Distinct governorates list for the filter
  const governoratesList = useMemo(() => {
    const set = new Set<string>();
    dbStudents.forEach(s => {
      if (s.governorate && s.governorate.trim()) {
        set.add(s.governorate.trim());
      }
    });
    return Array.from(set).sort();
  }, [dbStudents]);

  // Filtered and Sorted Students
  const filteredStudents = useMemo(() => {
    return dbStudents
      .filter(s => {
        // Search filter
        const matchSearch = 
          s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
          s.phone.includes(studentSearch);
        if (!matchSearch) return false;

        // Governorate filter
        if (filterGov !== 'all' && s.governorate !== filterGov) return false;

        // Premium filter
        if (filterPremium === 'premium' && !s.is_premium) return false;
        if (filterPremium === 'free' && s.is_premium) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return b.accuracy - a.accuracy;
        }
        if (sortBy === 'quizzes_desc') {
          return b.quizzesCount - a.quizzesCount;
        }
        if (sortBy === 'accuracy_desc') {
          return b.accuracy - a.accuracy;
        }
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name, 'ar');
        }
        return 0;
      });
  }, [dbStudents, studentSearch, filterGov, filterPremium, sortBy]);

  // Export CSV Function with UTF-8 BOM for Arabic Excel Support
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      alert(lang === 'ar' ? 'لا توجد بيانات لتصديرها!' : 'No data to export!');
      return;
    }

    const headers = [
      'الترتيب',
      'اسم الطالب',
      'رقم الهاتف',
      'المحافظة',
      'حالة الاشتراك',
      'مجموع الدرجات',
      'عدد الاختبارات المنجزة',
      'نسبة الدقة %',
      'حالة الهاتف',
      'تاريخ التسجيل'
    ];

    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.phone}"`,
      `"${s.governorate || '—'}"`,
      s.is_premium ? 'مشترك مميز (Premium)' : 'حساب مجاني',
      s.totalScore,
      s.quizzesCount,
      `${s.accuracy}%`,
      s.device_id === 'reset' ? 'بانتظار هاتف جديد' : 'نشط',
      new Date(s.created_at).toLocaleDateString('ar-YE')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_طلاب_الأحياء_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
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
      {/* Supabase Dashboard Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 mt-1 block">{dbStudents.length}</span>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-app-card flex items-center justify-center font-black text-xl">👥</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'الطلاب المشتركين' : 'Premium Students'}</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-450 mt-1 block">{dbStudents.filter(s => s.is_premium).length}</span>
          </div>
          <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-app-card flex items-center justify-center font-black text-xl">⭐</div>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/20 p-5 rounded-3xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'المتفاعلين بالكويزات' : 'Active Quiz Takers'}</span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-450 mt-1 block">{dbStudents.filter(s => s.quizzesCount > 0).length}</span>
          </div>
          <div className="w-12 h-12 bg-purple-500/20 text-purple-500 rounded-app-card flex items-center justify-center font-black text-xl">🏆</div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{lang === 'ar' ? 'أكواد التفعيل المتاحة' : 'Available Codes'}</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-455 mt-1 block">{activationCodes.filter(c => !c.is_used).length}</span>
          </div>
          <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-app-card flex items-center justify-center font-black text-xl">🔑</div>
        </div>
      </div>

      {/* Students Tab Sub-Navigation */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 my-2">
        <button
          onClick={() => setStudentsSubTab('roster')}
          className={`pb-3 text-xs font-black transition-all border-b-2 cursor-pointer ${
            studentsSubTab === 'roster'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650'
          }`}
        >
          👥 {lang === 'ar' ? 'إدارة الطلاب والمتفوقين' : 'Students & Top Achievers'}
        </button>
        <button
          onClick={() => setStudentsSubTab('difficulty')}
          className={`pb-3 text-xs font-black transition-all border-b-2 cursor-pointer ${
            studentsSubTab === 'difficulty'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-650'
          }`}
        >
          📊 {lang === 'ar' ? 'الأسئلة الأكثر صعوبة للطلاب' : 'Difficult Questions'}
        </button>
      </div>

      {studentsSubTab === 'roster' && (
        <div className="space-y-6">
          {/* Main Students List & Management Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-sm space-y-5">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? 'سجل الطلاب والدرجات والاشتراكات' : 'Students Roster & Grades'}</span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {filteredStudents.length} {lang === 'ar' ? 'طالب' : 'students'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  {lang === 'ar' ? 'متابعة شاملة لدرجات الطلاب، محافظاتهم، فرز المتفوقين وتفعيل الاشتراكات' : 'Monitor student scores, filter top achievers, and manage subscriptions'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportCSV}
                  className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-black text-xs px-3.5 py-2 rounded-app-btn border border-emerald-200 dark:border-emerald-800 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  title={lang === 'ar' ? 'تصدير جدول الطلاب كملف Excel / CSV' : 'Export to CSV'}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تصدير إكسل' : 'Export Excel'}</span>
                </button>

                <button
                  onClick={fetchStudents}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black text-xs px-3.5 py-2 rounded-app-btn border border-slate-150 dark:border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dbStudentsLoading ? 'animate-spin' : ''}`} />
                  <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Comprehensive Filter & Search Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
              {/* 1. Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn pr-9 pl-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              {/* 2. Governorate Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={filterGov}
                  onChange={e => setFilterGov(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                >
                  <option value="all">{lang === 'ar' ? '📍 جميع المحافظات' : '📍 All Governorates'}</option>
                  {governoratesList.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>

              {/* 3. Subscription Status Filter */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <select
                  value={filterPremium}
                  onChange={e => setFilterPremium(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                >
                  <option value="all">{lang === 'ar' ? '💎 كل الاشتراكات' : '💎 All Plans'}</option>
                  <option value="premium">{lang === 'ar' ? '⭐ المشتركون فقط (Premium)' : '⭐ Premium Only'}</option>
                  <option value="free">{lang === 'ar' ? '🟢 الحسابات المجانية فقط' : '🟢 Free Accounts'}</option>
                </select>
              </div>

              {/* 4. Sort By */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-blue-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-app-btn px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                >
                  <option value="score_desc">{lang === 'ar' ? '🏆 أعلى درجات (المتفوقين)' : '🏆 Top Score'}</option>
                  <option value="newest">{lang === 'ar' ? '⏱️ الأحدث تسجيلاً' : '⏱️ Newest Registered'}</option>
                  <option value="oldest">{lang === 'ar' ? '📅 الأقدم تسجيلاً' : '📅 Oldest Registered'}</option>
                  <option value="quizzes_desc">{lang === 'ar' ? '📝 الأكثر نشاطاً في الكويزات' : '📝 Most Quizzes'}</option>
                  <option value="accuracy_desc">{lang === 'ar' ? '🎯 أعلى نسبة دقة %' : '🎯 Best Accuracy'}</option>
                  <option value="name_asc">{lang === 'ar' ? '🔤 الاسم أبجدياً (أ-ي)' : '🔤 Name A-Z'}</option>
                </select>
              </div>
            </div>

            {/* Students List Table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-app-card">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-black border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3 text-center w-12">{lang === 'ar' ? '#' : 'Rank'}</th>
                    <th className="px-4 py-3">{lang === 'ar' ? 'اسم الطالب' : 'Student Name'}</th>
                    <th className="px-4 py-3">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3">{lang === 'ar' ? 'المحافظة' : 'Gov'}</th>
                    <th className="px-4 py-3">{lang === 'ar' ? 'الدرجات والأداء 🎯' : 'Score & Accuracy'}</th>
                    <th className="px-4 py-3">{lang === 'ar' ? 'حالة الهاتف' : 'Device'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الاشتراك' : 'Access'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {dbStudentsLoading ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-450">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                        {lang === 'ar' ? 'جاري تحميل قائمة الطلاب والدرجات...' : 'Loading students and scores...'}
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-450">
                        🔍 {lang === 'ar' ? 'لم يتم العثور على طلاب يطابقون خيارات البحث أو الفلترة.' : 'No students found matching your criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => {
                      const isTop1 = idx === 0 && s.totalScore > 0;
                      const isTop2 = idx === 1 && s.totalScore > 0;
                      const isTop3 = idx === 2 && s.totalScore > 0;

                      return (
                        <tr key={s.phone} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/30 transition-colors">
                          {/* Rank / Badge */}
                          <td className="px-4 py-3.5 text-center font-black">
                            {isTop1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-500/20 text-amber-500 rounded-full text-sm" title="المركز الأول 👑">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full text-sm" title="المركز الثاني 🥈">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 bg-amber-700/20 text-amber-700 dark:text-amber-500 rounded-full text-sm" title="المركز الثالث 🥉">
                                🥉
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">{idx + 1}</span>
                            )}
                          </td>

                          {/* Student Name */}
                          <td className="px-4 py-3.5">
                            <span className="font-black block text-slate-900 dark:text-white text-[13px]">{s.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {lang === 'ar' ? 'سجل في: ' : 'Reg: '} {new Date(s.created_at).toLocaleDateString(lang === 'ar' ? 'ar-YE' : 'en-US')}
                            </span>
                          </td>

                          {/* Phone with copy action */}
                          <td className="px-4 py-3.5 font-mono select-all text-xs">
                            <button
                              onClick={() => handleCopyPhone(s.phone)}
                              className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                              title={lang === 'ar' ? 'انقر للنسخ' : 'Click to copy'}
                            >
                              <span>{s.phone}</span>
                              {copiedPhone === s.phone ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-slate-300 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          </td>

                          {/* Governorate */}
                          <td className="px-4 py-3.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                            {s.governorate || '—'}
                          </td>

                          {/* Scores & Performance */}
                          <td className="px-4 py-3.5">
                            {s.quizzesCount > 0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                    {s.totalScore} {lang === 'ar' ? 'درجة' : 'pts'}
                                  </span>
                                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-black">
                                    {s.accuracy}%
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {s.quizzesCount} {lang === 'ar' ? 'كويز منجز' : 'quizzes completed'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-350 dark:text-slate-600 text-[11px] font-normal italic">
                                {lang === 'ar' ? 'لم يحل كويزات بعد' : 'No quizzes yet'}
                              </span>
                            )}
                          </td>

                          {/* Device Status */}
                          <td className="px-4 py-3.5">
                            {s.device_id === 'reset' ? (
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black inline-block">
                                {lang === 'ar' ? 'بانتظار هاتف جديد' : 'Reset Pending'}
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black inline-block">
                                {lang === 'ar' ? 'نشط' : 'Active'}
                              </span>
                            )}
                          </td>

                          {/* Access / Premium Toggle */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleToggleStudentPremium(s.phone, s.is_premium)}
                              className={`text-[10px] font-black px-3 py-1.5 rounded-app-btn transition-all active:scale-95 shadow-sm cursor-pointer ${
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

                          {/* Action: Reset Device */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleResetStudentDevice(s.phone)}
                              title={lang === 'ar' ? 'إعادة ضبط الهاتف' : 'Reset Device ID'}
                              className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-455 text-[10px] font-black px-2.5 py-1.5 rounded-app-btn active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Smartphone className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'نقل الهاتف' : 'Transfer'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Row: 2 Columns for Code Generator & Codes List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Generator Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'توليد أكواد التفعيل' : 'Code Generator'}</h2>
                <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'أنشئ أكواد فريدة صالحة للتنشيط لمرة واحدة' : 'Generate single-use premium keys'}</p>
              </div>

              <button
                onClick={handleGenerateCode}
                disabled={codeLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3.5 rounded-app-btn active:scale-95 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
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
                    className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-black px-3 py-1.5 rounded-app-btn active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'نسخ كود التفعيل' : 'Copy Key'}
                  </button>
                </div>
              )}
            </div>

            {/* Codes List Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-sm space-y-4">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-app-card p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'الأسئلة الصعبة في الكويزات' : 'Difficult Questions Analytics'}</h2>
              <p className="text-xs text-slate-400 font-bold">{lang === 'ar' ? 'الأسئلة المرتبة تنازلياً حسب نسبة إخفاق الطلاب فيها' : 'Questions ranked by student failure rate'}</p>
            </div>
            <button
              onClick={fetchDiffQuestions}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black text-xs px-3.5 py-2 rounded-app-btn border border-slate-150 dark:border-slate-700 active:scale-95 transition-all shrink-0 flex items-center gap-1.5 justify-center cursor-pointer"
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
