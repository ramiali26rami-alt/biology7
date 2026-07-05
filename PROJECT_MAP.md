# PROJECT MAP - Biotech Biology Educational Application

## [TECH_STACK]
- **Core Framework**: React 19.0.1 (Single-page app structured as a native mobile shell)
- **Styling**: Tailwind CSS v4.1.14 (Highly curated, modern gradients, deep-space dark mode, glassmorphism)
- **Icons**: Lucide React v0.546.0
- **Animations**: Motion (Framer Motion) v12.23.24
- **Build Tool**: Vite v6.2.3
- **Language**: TypeScript v5.8.2

## [SYSTEM_FLOW]
The application implements a smooth, high-fidelity 10-screen Android-like mobile workflow:
1. **Screen 1: Student Profile & Registration** (`student-profile`)
   - Profile image upload/avatar selector, Name & Email registration/edit, Class Rank representation.
   - Dark/Light Mode toggle, Language selector, and Premium Purchase status indicator.
2. **Screen 2: Main Dashboard & Settings** (`main-dashboard`)
   - Course overview, overall progress, daily streak tracker, and primary entry points to units.
   - Core settings, notifications preview, and Premium Upgrade call-to-action.
3. **Screen 3: Units Overview Navigation** (`units-navigation`)
   - Yemeni Secondary Syllabus Units (Unit 1: Nervous Coordination - 10 lessons, Unit 2: Molecular Biology - 3 lessons).
   - Clear indicators of locked/unlocked progress.
4. **Screen 4: Interactive Lesson Mind Map** (`lesson-mind-map`)
   - Visual nodes connecting the biological structures (e.g. Amoeba protoplasm, Paramecium cilia, Hydra nerve net).
   - Interactive detail cards for clicked nodes.
5. **Screen 5: Lesson Explanations & Details** (`lesson-details`)
   - High-fidelity academic text breakdown with interactive accordions, terms glossary, and zoomable anatomical concepts.
6. **Screen 6: Illustrative Biology Gallery** (`lesson-images`)
   - Sliding gallery of annotated biological drawings (Neuron anatomy, cellular sensitivity, organisms structures).
7. **Screen 7: Video Tutorial Screen** (`lesson-video`)
   - Embedded video player simulator (YouTube links), video chapters list, play/pause controls, and timestamp seeking.
8. **Screen 8: Quick Lesson Summary** (`lesson-summary`)
   - Bulleted summary, high-yield facts, and interactive biology flashcards for quick revision.
9. **Screen 9: Interactive Lesson Quiz** (`biology-quiz`)
   - Real-time Multiple Choice and True/False questions with immediate explanation feedback and a dynamic score meter.
10. **Screen 10: Ministry Past Exams** (`ministry-exams`)
    - Archive of Yemeni Ministry biology exams from previous years (2022, 2023, 2024), PDF mock links, and timer simulator.

## [ARCHITECTURE]
- **App Shell**: Single-page navigation controller in `App.tsx` handling screen transitions (`ScreenId`) with backward/forward sliding animations.
- **State Store**: LocalStorage-backed state sync for student profile information, purchase status, dark mode, language, and quiz high scores.
- **Component Design**: Highly focused, responsive files using a modern mobile mockup viewport frame to guarantee realistic mobile fidelity.

## [ORPHANS & PENDING]
*(No pending items or orphaned files. Everything has been fully implemented, integrated, and validated!)*
- `[x]` Screen 1: Registration Profile and Premium Unlock (`StudentProfileScreen.tsx`)
- `[x]` Screen 2: Welcome bento dashboard and streak counts (`MainDashboardScreen.tsx`)
- `[x]` Screen 3: Units syllabus and premium locked gating (`UnitsNavigationScreen.tsx`)
- `[x]` Screen 4: Interactive mind map with connection lines (`MindMapScreen.tsx`)
- `[x]` Screen 5: Expandable accordions with terms dictionary (`LessonDetailsScreen.tsx`)
- `[x]` Screen 6: Labeled diagram gallery slider with zoom triggers (`IllustrativeImagesScreen.tsx`)
- `[x]` Screen 7: Active video markers with study notebooks (`LessonVideoScreen.tsx`)
- `[x]` Screen 8: Gold key summaries and 3D flipped recall cards (`LessonSummaryScreen.tsx`)
- `[x]` Screen 9: Full MCQ and T/F scoring test engine (`BiologyQuizScreen.tsx`)
- `[x]` Screen 10: Timer simulator (180 min) for Ministry Past Exams (`MinistryExamsScreen.tsx`)
- `[x]` Routing animations and state synchronization shell (`App.tsx`)
- `[x]` Fully translated and bilingual (Arabic & English) static keys (`translations.ts`)
