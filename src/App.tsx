/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, Lesson } from './types';
const StudentProfileScreen = React.lazy(() => import('./components/StudentProfileScreen'));
const MainDashboardScreen = React.lazy(() => import('./components/MainDashboardScreen'));
const UnitsNavigationScreen = React.lazy(() => import('./components/UnitsNavigationScreen'));
const LessonsListScreen = React.lazy(() => import('./components/LessonsListScreen'));
const LessonDetailsScreen = React.lazy(() => import('./components/LessonDetailsScreen'));
const LessonVideoScreen = React.lazy(() => import('./components/LessonVideoScreen'));
const LessonSummaryScreen = React.lazy(() => import('./components/LessonSummaryScreen'));
const BiologyQuizScreen = React.lazy(() => import('./components/BiologyQuizScreen'));
const MinistryExamsScreen = React.lazy(() => import('./components/MinistryExamsScreen'));
const WelcomeScreen = React.lazy(() => import('./components/WelcomeScreen'));
const AdminDashboardScreen = React.lazy(() => import('./components/AdminDashboardScreen'));
const AdminLoginModal = React.lazy(() => import('./components/admin/AdminLoginModal'));
const ResetPasswordScreen = React.lazy(() => import('./components/admin/ResetPasswordScreen'));
const LeaderboardScreen = React.lazy(() => import('./components/LeaderboardScreen'));
import { Language } from './utils/translations';
import { AppWrapper } from './AppWrapper';
import { checkAndUpdate } from './utils/autoUpdate';
import { loadCurriculum } from './utils/curriculumLoader';
import { checkStudentSubscription, syncUnsavedQuizResults } from './utils/supabaseHelper';
import { isAdminUser, supabase } from './utils/supabaseClient';
import { checkForAppUpdate, installAppUpdate, type AppUpdateManifest } from './utils/appUpdater';
import { Download, Loader2, ShieldCheck, X } from 'lucide-react';

export default function App() {
  const isPasswordRecoveryPage = window.location.pathname === '/reset-password';
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => {
    if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin')) {
      return 'admin-login';
    }
    // New users (no name saved) go to welcome screen
    const isRegistered = localStorage.getItem('student_name');
    return isRegistered ? 'main-dashboard' : 'welcome';
  });
  
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward' | 'none'>('none');
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'ar';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('font_size') || 'normal';
  });
  const [appUpdate, setAppUpdate] = useState<AppUpdateManifest | null>(null);
  const [appUpdateInstalling, setAppUpdateInstalling] = useState(false);
  const [appUpdateMessage, setAppUpdateMessage] = useState('');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const navigationHistoryRef = useRef<ScreenId[]>([]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdminAuthenticated(isAdminUser(session?.user));
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthenticated(isAdminUser(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isPasswordRecoveryPage) return;
    const timer = window.setTimeout(() => {
      checkForAppUpdate().then(setAppUpdate).catch(() => {});
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isPasswordRecoveryPage]);

  const handleInstallAppUpdate = async () => {
    if (!appUpdate) return;
    setAppUpdateInstalling(true);
    setAppUpdateMessage(lang === 'ar' ? 'جاري تنزيل التحديث والتحقق منه...' : 'Downloading and verifying the update...');
    try {
      const result = await installAppUpdate(appUpdate);
      if (result.permissionRequired) {
        setAppUpdateMessage(lang === 'ar'
          ? 'فعّل «السماح من هذا المصدر»، ثم عد إلى التطبيق واضغط تثبيت التحديث مرة أخرى.'
          : 'Enable “Allow from this source”, return to the app, then tap install again.');
      } else {
        setAppUpdateMessage(lang === 'ar'
          ? 'تم التحقق من الحزمة. أكمل التثبيت من شاشة Android.'
          : 'Package verified. Complete the installation in the Android prompt.');
      }
    } catch (error) {
      console.error('App update installation failed:', error);
      setAppUpdateMessage(lang === 'ar'
        ? 'فشل تنزيل التحديث أو التحقق من توقيعه. لم يتم تثبيت أي ملف.'
        : 'The update failed download or signature verification. Nothing was installed.');
    } finally {
      setAppUpdateInstalling(false);
    }
  };

  const [updateInfo, setUpdateInfo] = useState<{
    show: boolean;
    newLessons: number;
  }>({ show: false, newLessons: 0 });

  useEffect(() => {
    if (isPasswordRecoveryPage) return;
    // Correct any stale or default server URL in localStorage
    const storedServer = localStorage.getItem('server_url');
    if (!storedServer || storedServer.includes('railway') || storedServer.includes('biology-server') || storedServer === 'none') {
      localStorage.setItem('server_url', 'https://biology7.vercel.app');
    }

    loadCurriculum()
      .then(data => {
        if (data) setLessons(data);
      })
      .catch(err => console.error("Error loading lessons config:", err));

    // Check student subscription and sync offline results on boot
    checkStudentSubscription().catch(() => {});
    syncUnsavedQuizResults().catch(() => {});
  }, [isPasswordRecoveryPage]);

  useEffect(() => {
    if (isPasswordRecoveryPage) return;
    checkAndUpdate().then(async (result) => {
      if (result.updated) {
        const updatedLessons = await loadCurriculum(true);
        if (updatedLessons) {
          setLessons(updatedLessons);
        }
        setUpdateInfo({
          show: true,
          newLessons: result.newLessons
        });
        setTimeout(() =>
          setUpdateInfo({ show: false, newLessons: 0 })
        , 4000);
      }
    });
  }, [isPasswordRecoveryPage]);

  useEffect(() => {
    // Sync current dark theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Sync current language direction
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, theme]);

  useEffect(() => {
    // Sync current font size
    const sizeMap: Record<string, string> = {
      small: '15px',
      normal: '17px',
      large: '19px',
      xlarge: '21.5px'
    };
    document.documentElement.style.fontSize = sizeMap[fontSize] || '16px';
    localStorage.setItem('font_size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    // Intercept hardware back button on Android
    let sub: any = null;
    const initBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        sub = await CapApp.addListener('backButton', () => {
          if (currentScreen === 'main-dashboard' || currentScreen === 'welcome') {
            CapApp.exitApp();
          } else {
            const screenBackMap: Record<string, ScreenId> = {
              'leaderboard': 'student-profile',
              'admin-dashboard': 'student-profile',
              'biology-quiz': 'lessons-list',
              'lesson-video': 'lesson-details',
              'lesson-summary': 'lesson-details',
              'lesson-details': 'lessons-list',
              'lessons-list': 'units-navigation',
              'units-navigation': 'main-dashboard',
              'student-profile': 'main-dashboard'
            };
            const prevScreen = screenBackMap[currentScreen];
            if (prevScreen) {
              handleNavigate(prevScreen, 'push_back');
            } else {
              CapApp.exitApp();
            }
          }
        });
      } catch (e) {
        // Safe fail on Web browsers
      }
    };
    initBackButton();
    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, [currentScreen]);

  const handleNavigate = (targetScreen: ScreenId, transition?: 'push' | 'push_back' | 'none') => {
    let destination = targetScreen;

    if (transition === 'push_back') {
      destination = navigationHistoryRef.current.pop() || targetScreen;
    } else if (
      currentScreen !== targetScreen &&
      (transition === 'push' || targetScreen === 'biology-quiz')
    ) {
      // The quiz can be opened from several places. Remember the actual origin
      // even when a caller uses a non-animated transition.
      navigationHistoryRef.current.push(currentScreen);
    }

    if (transition === 'push') {
      setTransitionDirection('forward');
    } else if (transition === 'push_back') {
      setTransitionDirection('backward');
    } else {
      setTransitionDirection('none');
    }
    setCurrentScreen(destination);

    // Auto-sync owner updates on navigation transitions
    if (destination === 'main-dashboard' || destination === 'units-navigation') {
      checkAndUpdate().then(async (result) => {
        if (result.updated) {
          const updatedLessons = await loadCurriculum(true);
          if (updatedLessons) {
            setLessons(updatedLessons);
          }
          setUpdateInfo({
            show: true,
            newLessons: result.newLessons
          });
          setTimeout(() =>
            setUpdateInfo({ show: false, newLessons: 0 })
          , 4000);
        }
      }).catch(() => {});
    }
  };

  // Open Training / Progressive Test mode: resets lesson selection to load all quiz questions
  const handleQuizNavigate = () => {
    setSelectedLesson(null);
    handleNavigate('biology-quiz', 'none');
  };

  const renderScreen = () => {
    if (isPasswordRecoveryPage) {
      return <ResetPasswordScreen />;
    }

    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen onNavigate={handleNavigate} lang={lang} setLang={setLang} />;
      case 'student-profile':
        return (
          <StudentProfileScreen 
            onNavigate={handleNavigate} 
            lang={lang} 
            setLang={setLang} 
            theme={theme} 
            setTheme={setTheme} 
            lessons={lessons} 
            fontSize={fontSize}
            setFontSize={setFontSize}
          />
        );
      case 'main-dashboard':
        return <MainDashboardScreen onNavigate={handleNavigate} lang={lang} onQuizNavigate={handleQuizNavigate} lessons={lessons} />;
      case 'units-navigation':
        return <UnitsNavigationScreen onNavigate={handleNavigate} lang={lang} lessons={lessons} onSelectUnit={setSelectedUnit} onQuizNavigate={handleQuizNavigate} />;
      case 'lessons-list':
        return <LessonsListScreen onNavigate={handleNavigate} lang={lang} lessons={lessons} selectedUnit={selectedUnit} onSelectLesson={setSelectedLesson} onQuizNavigate={handleQuizNavigate} />;
      case 'lesson-details':
        return <LessonDetailsScreen onNavigate={handleNavigate} lang={lang} lesson={selectedLesson} lessons={lessons} onSelectLesson={setSelectedLesson} />;
      case 'lesson-video':
        return <LessonVideoScreen onNavigate={handleNavigate} lang={lang} lesson={selectedLesson} />;
      case 'lesson-summary':
        return <LessonSummaryScreen onNavigate={handleNavigate} lang={lang} lesson={selectedLesson} />;
      case 'biology-quiz':
        return <BiologyQuizScreen onNavigate={handleNavigate} lang={lang} lesson={selectedLesson} lessons={lessons} onSelectLesson={setSelectedLesson} />;
      case 'ministry-exams':
        return <MinistryExamsScreen onNavigate={handleNavigate} lang={lang} lesson={selectedLesson} lessons={lessons} />;
      case 'admin-login':
        return (
          <AdminLoginModal 
            onLoginSuccess={() => {
              setIsAdminAuthenticated(true);
              handleNavigate('admin-dashboard', 'none');
            }} 
            onBack={() => { handleNavigate('main-dashboard', 'none'); }} 
            lang={lang} 
          />
        );
      case 'admin-dashboard':
        if (isAdminAuthenticated === null) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold">
              {lang === 'ar' ? 'جاري التحقق من جلسة المسؤول...' : 'Verifying admin session...'}
            </div>
          );
        }
        if (!isAdminAuthenticated) {
          return (
            <AdminLoginModal 
              onLoginSuccess={() => {
                setIsAdminAuthenticated(true);
                handleNavigate('admin-dashboard', 'none');
              }} 
              onBack={() => { handleNavigate('main-dashboard', 'none'); }} 
              lang={lang} 
            />
          );
        }
        return <AdminDashboardScreen onNavigate={handleNavigate} lang={lang} lessons={lessons} setLessons={setLessons} />;
      case 'leaderboard':
        return <LeaderboardScreen onNavigate={handleNavigate} lang={lang} />;
      default:
        return <MainDashboardScreen onNavigate={handleNavigate} lang={lang} onQuizNavigate={handleQuizNavigate} lessons={lessons} />;
    }
  };

  // Determine sliding offsets matching native mobile animations
  const getVariants = () => {
    if (transitionDirection === 'forward') {
      return {
        initial: { opacity: 0, x: -50 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 50 }
      };
    } else if (transitionDirection === 'backward') {
      return {
        initial: { opacity: 0, x: 50 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -50 }
      };
    } else {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      };
    }
  };

  const variants = getVariants();

  return (
    <AppWrapper>
      {appUpdate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-app-card shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="p-2.5 rounded-app-btn bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'تحديث موثّق متاح' : 'Verified update available'}
                  </h2>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1" dir="ltr">
                    v{appUpdate.versionName}
                  </p>
                </div>
              </div>
              {!appUpdate.mandatory && !appUpdateInstalling && (
                <button
                  type="button"
                  onClick={() => setAppUpdate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label={lang === 'ar' ? 'لاحقاً' : 'Later'}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              {(lang === 'ar' ? appUpdate.notesAr : appUpdate.notesEn)
                || (lang === 'ar' ? 'يتضمن هذا الإصدار تحسينات أمان وأداء.' : 'This release includes security and performance improvements.')}
            </p>

            <div className="rounded-app-btn bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'يتحقق التطبيق من رقم الحزمة والتوقيع وبصمة SHA‑256 قبل فتح شاشة تثبيت Android.'
                : 'The app verifies the package name, signing certificate, version, and SHA-256 before opening Android installer.'}
            </div>

            {appUpdateMessage && (
              <p className="text-xs font-bold text-center text-amber-700 dark:text-amber-400 leading-relaxed">
                {appUpdateMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleInstallAppUpdate}
              disabled={appUpdateInstalling}
              className="w-full py-3.5 rounded-app-btn bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {appUpdateInstalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {appUpdateInstalling
                ? (lang === 'ar' ? 'جاري التنزيل والتحقق...' : 'Downloading and verifying...')
                : (lang === 'ar' ? 'تنزيل وتثبيت التحديث' : 'Download and install update')}
            </button>
          </div>
        </div>
      )}
      {updateInfo.show && (
        <div
          className="fixed top-4 right-4 left-4 z-50
            bg-green-500 text-white p-4 rounded-app-card
            shadow-xl text-center font-bold text-sm"
          dir="rtl"
        >
          ✅ تم تحديث المنهج — {updateInfo.newLessons} درس متاح الآن
        </div>
      )}
      <div className="min-h-screen bg-[#f7f9fb] dark:bg-slate-950 w-full overflow-x-hidden relative transition-colors duration-[250ms]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`min-h-screen w-full relative ${
              currentScreen === 'admin-dashboard' || currentScreen === 'admin-login'
                ? ''
                : 'student-reading-scale'
            }`}
          >
            <React.Suspense fallback={<ScreenSkeleton />}>
              {renderScreen()}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppWrapper>
  );
}

function ScreenSkeleton() {
  const isRtl = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') === 'ar' : true;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col justify-between animate-pulse" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="space-y-4">
        {/* Fake Header */}
        <div className="flex items-center justify-between h-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-805 rounded-app-card px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="w-28 h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="w-20 h-2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
        </div>

        {/* Fake Content Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-805 rounded-app-card p-4 space-y-3">
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
              <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="w-2/3 h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Fake Large Layout */}
        <div className="h-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-805 rounded-app-card p-4 space-y-4">
          <div className="w-1/3 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="w-4/5 h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
