/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScreenId =
  | 'welcome'            // Screen 0: شاشة الترحيب للطالب الجديد
  | 'student-profile'    // Screen 1: الملف الشخصي والتسجيل وشراء الباقة
  | 'main-dashboard'     // Screen 2: الواجهة الأساسية للوحة التحكم والإحصائيات
  | 'units-navigation'   // Screen 3: تصفح الوحدات وعدد الدروس فيها
  | 'lessons-list'       // قائمة دروس الوحدة
  | 'lesson-details'     // Screen 5: تفاصيل الدرس والشرح الأكاديمي المنسق
  | 'lesson-video'       // Screen 7: فيديو الدرس التعليمي وفصوله
  | 'lesson-summary'     // Screen 8: ملخص أهم النقاط في الدرس والبطاقات
  | 'biology-quiz'       // Screen 9: اختبار الدرس التفاعلي (صح/خطأ، متعدد)
  | 'admin-dashboard'    // لوحة التحكم المرئية لمالك التطبيق (الإدارة)
  | 'ministry-exams';    // Screen 10: نماذج الامتحانات الوزارية مع مؤقت 180 دقيقة

export interface VideoChapter {
  time: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

export interface Flashcard {
  qAr: string;
  qEn: string;
  aAr: string;
  aEn: string;
}

export interface GlossaryItem {
  term: string;
  descAr: string;
  descEn: string;
}

export interface ConfigQuestion {
  id: number;
  type: 'mcq' | 'tf' | 'fill' | 'fill_blank' | 'explain' | 'what_if' | 'define';
  textAr: string;
  textEn: string;
  options?: { key: string; textAr: string; textEn: string }[];
  correctKey?: string;
  correctAnswers?: string[];
  explanationAr: string;
  explanationEn: string;
  hintAr?: string;
  hintEn?: string;
  definitionAr?: string;
  definitionEn?: string;
  questionImage?: string;
}

export interface MindmapNode {
  id: string;
  parentId?: string;
  textAr: string;
  textEn?: string;
  color?: string;
  details?: string;
}

export interface InteractiveHotspot {
  id: string;
  x: number;
  y: number;
  labelAr: string;
  labelEn?: string;
  descAr: string;
  descEn?: string;
}

export interface InteractiveDiagram {
  imageFile: string;
  titleAr: string;
  titleEn?: string;
  hotspots: InteractiveHotspot[];
}


export interface Lesson {
  id: string;
  unit: number;
  unitNameAr?: string;
  unitNameEn?: string;
  folder: string;
  titleAr: string;
  titleEn: string;
  pdfFile: string;
  diagramFile: string;
  summaryFile: string;
  mindmapFile: string;
  quizFile: string;
  ministryExamFile?: string;
  locked: boolean;
  pdfLocked?: boolean;
  mindmapLocked?: boolean;
  diagramLocked?: boolean;
  quizLocked?: boolean;
  ministryExamLocked?: boolean;
  videoUrl: string;
  videoChapters: VideoChapter[];
  summaryPointsAr: string[];
  summaryPointsEn: string[];
  flashcards: Flashcard[];
  glossary: GlossaryItem[];
  quiz: ConfigQuestion[];
  mindmap?: MindmapNode[];
  interactiveDiagrams?: InteractiveDiagram[];
  ministryExams?: ConfigQuestion[];
  demoSlides?: string[];
}

export interface StudentStats {
  name: string;
  email: string;
  grade: string;
  completionRate: number;
  classRank: string;
  avatarUrl: string;
  premiumUnlocked: boolean;
}
