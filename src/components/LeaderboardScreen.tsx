import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2, Trophy, Medal, Star, Target } from 'lucide-react';
import { ScreenId } from '../types';
import { Language } from '../utils/translations';
import { getLeaderboard } from '../utils/supabaseHelper';

interface LeaderboardScreenProps {
  onNavigate: (screen: ScreenId, transition?: 'push' | 'push_back' | 'none') => void;
  lang: Language;
}

export default function LeaderboardScreen({ onNavigate, lang }: LeaderboardScreenProps) {
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(data => {
        setStandings(data);
      })
      .catch(err => console.error("Error loading leaderboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleBack = () => {
    onNavigate('main-dashboard', 'push_back');
  };

  const backIcon = lang === 'ar' ? <ArrowRight className="w-6 h-6 rotate-180 text-emerald-500" /> : <ArrowLeft className="w-6 h-6 text-emerald-500" />;

  // Separate top 3 and the rest
  const topThree = standings.slice(0, 3);

  // Position styles for podium
  const getPodiumOrder = () => {
    const order = [];
    if (topThree[1]) order.push({ data: topThree[1], rank: 2, scale: 'scale-95', height: 'h-28', medal: '🥈', color: 'text-slate-400' });
    if (topThree[0]) order.push({ data: topThree[0], rank: 1, scale: 'scale-105 z-10', height: 'h-36', medal: '👑', color: 'text-amber-500' });
    if (topThree[2]) order.push({ data: topThree[2], rank: 3, scale: 'scale-90', height: 'h-24', medal: '🥉', color: 'text-amber-700' });
    return order;
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-20 font-sans transition-colors duration-250" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 h-16 shadow-sm">
        <button onClick={handleBack} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full active:scale-95 transition-all">
          {backIcon}
        </button>
        <h1 className="text-md font-black text-slate-800 dark:text-white flex items-center gap-1.5">
          <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
          {lang === 'ar' ? 'لوحة صدارة المتفوقين' : 'Students Leaderboard'}
        </h1>
        <div className="w-10"></div>
      </header>

      <main className="pt-20 px-4 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 font-bold text-xs gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            {lang === 'ar' ? 'جاري تحميل لوحة الصدارة سحابياً...' : 'Loading leaderboard standings...'}
          </div>
        ) : standings.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🏆</div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm mb-1">{lang === 'ar' ? 'لا توجد بيانات بعد' : 'No Standings Yet'}</h3>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">{lang === 'ar' ? 'كن أول من ينجز كويزات الدروس ليتصدر اسمك لوحة الشرف!' : 'Be the first to finish quizzes and top the honor board!'}</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium Cards */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-3 gap-2 items-end pt-6 pb-2 px-1">
                {getPodiumOrder().map(({ data, rank, scale, height, medal }) => (
                  <motion.div
                    key={data.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * rank }}
                    className={`flex flex-col items-center text-center space-y-2 ${scale}`}
                  >
                    <div className="relative">
                      {/* Avatar Circle with initials */}
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-450 to-teal-500 flex items-center justify-center text-white text-md font-black shadow-lg shadow-emerald-500/10 border-2 ${rank === 1 ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'}`}>
                        {data.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                      </div>
                      <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border border-slate-100 dark:border-slate-800">
                        {medal}
                      </span>
                    </div>

                    <div className="px-1 min-w-0">
                      <span className="font-extrabold text-xs block truncate text-slate-850 dark:text-white max-w-[80px]">
                        {data.name.split(' ')[0]}
                      </span>
                      {data.governorate && (
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block truncate">
                          {data.governorate}
                        </span>
                      )}
                    </div>

                    {/* Podium Pillar */}
                    <div className={`w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-t-2xl shadow-xl flex flex-col justify-end p-2 pb-4 ${height}`}>
                      <span className="text-xs font-black block text-emerald-500">{data.lessonsCount} 📚</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{data.totalScore} {lang === 'ar' ? 'نقطة' : 'pts'}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Rest of the leaderboard list */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] shadow-xl shadow-slate-100/20 dark:shadow-none overflow-hidden">
              <div className="p-5 border-b border-slate-50 dark:border-slate-850 flex justify-between items-center">
                <span className="text-xs font-black text-slate-850 dark:text-white">{lang === 'ar' ? 'قائمة المتصدرين' : 'Rankings Table'}</span>
                <span className="text-[10px] font-bold text-slate-400">{standings.length} {lang === 'ar' ? 'طالب نشط' : 'active students'}</span>
              </div>

              <div className="divide-y divide-slate-50 dark:divide-slate-850">
                {standings.map((student, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  
                  return (
                    <motion.div
                      key={student.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * Math.min(index, 10) }}
                      className={`flex items-center justify-between p-4 ${isTopThree ? 'bg-slate-50/25 dark:bg-slate-900/10' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          rank === 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                          rank === 2 ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-350' :
                          rank === 3 ? 'bg-orange-100 text-orange-850 dark:bg-orange-950/30 dark:text-orange-400' :
                          'text-slate-400'
                        }`}>
                          {rank}
                        </span>

                        <div className="min-w-0">
                          <span className="font-extrabold text-xs text-slate-850 dark:text-white block truncate">
                            {student.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {student.governorate && (
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8px] font-black px-1.5 py-0.5 rounded">
                                {student.governorate}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 font-bold">
                              {student.quizzesCount} {lang === 'ar' ? 'اختبار' : 'quizzes'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-xs font-black text-emerald-500 block">
                            {student.lessonsCount} {lang === 'ar' ? 'دروس' : 'lessons'}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
                            {student.totalScore} pts ({student.accuracy}%)
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
