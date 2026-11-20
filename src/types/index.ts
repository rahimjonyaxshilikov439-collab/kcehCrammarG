export type ClassCode =
  | '5-01' | '5-02' | '5-03'
  | '6-01' | '6-02' | '6-03'
  | '7-01' | '7-02' | '7-03'
  | '8-01' | '8-02' | '8-03'
  | '9-01' | '9-02' | '9-03'
  | '10-01' | '10-02' | '10-03';

export interface Question {
  id: string;
  unitId: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface UnitInfo {
  id: number;
  title: string;
  uzTitle: string;
  subtitle: string;
  pages: string;
  topics: string[];
  keywords: string[];
}

export interface WrongAnswerDetail {
  questionId: string;
  unitId: number;
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface TestAttempt {
  id: string;
  studentId: string;
  unitId: number;
  score: number; // correctCount * 10
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  durationSeconds: number;
  createdAt: string;
  wrongAnswers: WrongAnswerDetail[];
}

export interface Student {
  id: string;
  fullName: string;
  normalizedName: string;
  classCode: ClassCode;
  createdAt: string;
  lastLoginAt: string;
  attempts: TestAttempt[];
}

export interface AppSettings {
  timerMinutes: number; // 1..120, default 15
  teacherPassword: string; // default Jalolova@2026
  cheaterUnlockCode: string; // default 2026Al1209.9
}

export interface DatabaseState {
  students: Student[];
  settings: AppSettings;
}

export interface LevelInfo {
  level: number; // 1..5
  title: string;
  minPoints: number;
  nextLevelPoints: number | null;
  progressPercent: number;
  totalPoints: number;
}

export interface ShuffledQuestion {
  originalId: string;
  unitId: number;
  question: string;
  shuffledOptions: [string, string, string, string];
  shuffledCorrectIndex: 0 | 1 | 2 | 3;
  // Maps shuffled option index (0..3) back to original option index (0..3)
  optionOrder: [number, number, number, number];
  explanation: string;
}

export type AppView =
  | 'login'
  | 'units'
  | 'test'
  | 'results'
  | 'profile'
  | 'teacher';
