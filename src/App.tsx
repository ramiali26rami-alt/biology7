/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, Lesson } from './types';
import StudentProfileScreen from './components/StudentProfileScreen';
import MainDashboardScreen from './components/MainDashboardScreen';
import UnitsNavigationScreen from './components/UnitsNavigationScreen';
import LessonsListScreen from './components/LessonsListScreen';
import LessonDetailsScreen from './components/LessonDetailsScreen';
import LessonVideoScreen from './components/LessonVideoScreen';
import LessonSummaryScreen from './components/LessonSummaryScreen';
import BiologyQuizScreen from './components/BiologyQuizScreen';
import MinistryExamsScreen from './components/MinistryExamsScreen';
import WelcomeScreen from './components/WelcomeScreen';
import AdminDashboardScreen from './components/AdminDashboardScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import { Language } from './utils/translations';
import { AppWrapper } from './AppWrapper';
import { checkAndUpdate } from './utils/autoUpdate';
import { loadCurriculum } from './utils/curriculumLoader';
import { checkStudentSubscription, syncUnsavedQuizResults } from './utils/supabaseHelper';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => {
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

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const [updateInfo, setUpdateInfo] = useState<{
    show: boolean;
    newLessons: number;
  }>({ show: false, newLessons: 0 });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

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
      small: '14px',
      normal: '16px',
      large: '18.5px',
      xlarge: '21px'
    };
    document.documentElement.style.fontSize = sizeMap[fontSize] || '16px';
    localStorage.setItem('font_size', fontSize);
  }, [fontSize]);

  const handleNavigate = (targetScreen: ScreenId, transition?: 'push' | 'push_back' | 'none') => {
    if (transition === 'push') {
      setTransitionDirection('forward');
    } else if (transition === 'push_back') {
      setTransitionDirection('backward');
    } else {
      setTransitionDirection('none');
    }
    setCurrentScreen(targetScreen);
  };

  // Guard: only go to quiz if a lesson is already selected
  const handleQuizNavigate = () => {
    if (selectedLesson) {
      handleNavigate('biology-quiz', 'none');
    } else {
      handleNavigate('units-navigation', 'none');
    }
  };

  const renderScreen = () => {
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
      case 'admin-dashboard':
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
      {updateInfo.show && (
        <div
          className="fixed top-4 right-4 left-4 z-50
            bg-green-500 text-white p-4 rounded-2xl
            shadow-xl text-center font-bold text-sm"
          dir="rtl"
        >
          ✅ تم تحديث المنهج — {updateInfo.newLessons} درس متاح الآن
        </div>
      )}
      <div className="min-h-screen bg-[#f7f9fb] dark:bg-slate-950 w-full overflow-x-hidden relative transition-colors duration-250">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="min-h-screen w-full relative"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppWrapper>
  );
}
