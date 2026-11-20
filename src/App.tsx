import { useEffect, useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { ProfileView } from './components/ProfileView';
import { ResultsView } from './components/ResultsView';
import { TeacherPanel } from './components/TeacherPanel';
import { TestRunner } from './components/TestRunner';
import { UnitsView } from './components/UnitsView';
import { UNITS } from './data/units';
import {
  bootstrapData,
  getCheaterLock,
  getSavedStudentId,
  getSavedTheme,
  loginStudent,
  saveCurrentStudentId,
  saveTheme,
  submitTestAttempt,
  verifyTeacherPassword,
} from './services/storage';
import type { AppView, ClassCode, Student, TestAttempt } from './types';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [timerMinutes, setTimerMinutes] = useState<number>(15);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(() =>
    getSavedStudentId()
  );
  const [view, setView] = useState<AppView>('login');
  const [activeUnitId, setActiveUnitId] = useState<number>(1);
  const [latestAttempt, setLatestAttempt] = useState<TestAttempt | null>(null);
  const [returningBanner, setReturningBanner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getSavedTheme());

  // Teacher Login Modal (NO password hint anywhere in UI)
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherPwdInput, setTeacherPwdInput] = useState('');
  const [teacherPwdError, setTeacherPwdError] = useState<string | null>(null);
  const [teacherVerifying, setTeacherVerifying] = useState(false);
  const [activeTeacherPassword, setActiveTeacherPassword] = useState('');

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Initial data load & persistent Cheater Lock restoration
  useEffect(() => {
    let mounted = true;
    async function init() {
      const data = await bootstrapData();
      if (!mounted) return;
      setStudents(data.students);
      setTimerMinutes(data.timerMinutes);

      const savedId = getSavedStudentId();
      const matchedStudent = savedId
        ? data.students.find((s) => s.id === savedId) ?? null
        : null;

      const cheaterLock = getCheaterLock();
      if (cheaterLock?.locked) {
        if (matchedStudent) {
          setCurrentStudentId(matchedStudent.id);
        }
        setActiveUnitId(cheaterLock.unitId || 1);
        setView('test');
      } else if (matchedStudent) {
        setCurrentStudentId(matchedStudent.id);
        setView('units');
      } else {
        saveCurrentStudentId(null);
        setCurrentStudentId(null);
        setView('login');
      }
      setLoading(false);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const currentStudent =
    students.find((s) => s.id === currentStudentId) ?? null;

  const handleStudentLogin = async (fullName: string, classCode: ClassCode) => {
    const res = await loginStudent(fullName, classCode);
    if (!res.ok || !res.student) {
      return {
        ok: false,
        error: res.error,
        suggestedFix: res.suggestedFix,
      };
    }

    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === res.student!.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = res.student!;
        return next;
      }
      return [...prev, res.student!];
    });
    setCurrentStudentId(res.student.id);

    if (res.isReturning) {
      setReturningBanner(true);
      setView('profile');
    } else {
      setReturningBanner(false);
      setView('units');
    }
    return { ok: true };
  };

  const handleStartUnit = (unitId: number) => {
    if (!currentStudent) return;
    // Request browser fullscreen directly inside the user click gesture
    if (
      typeof document !== 'undefined' &&
      document.documentElement.requestFullscreen &&
      !document.fullscreenElement
    ) {
      try {
        void document.documentElement.requestFullscreen().catch(() => {});
      } catch {
        // Ignore if environment denies fullscreen
      }
    }
    setActiveUnitId(unitId);
    setView('test');
  };

  const handleFinishAttempt = async (attempt: TestAttempt) => {
    if (!currentStudent) return;
    const updated = await submitTestAttempt(currentStudent.id, attempt);
    if (updated) {
      setStudents((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    }
    setLatestAttempt(attempt);
    setView('results');
  };

  const handleLogoutStudent = () => {
    saveCurrentStudentId(null);
    setCurrentStudentId(null);
    setReturningBanner(false);
    setView('login');
  };

  const handleTeacherLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTeacherVerifying(true);
    setTeacherPwdError(null);
    try {
      const ok = await verifyTeacherPassword(teacherPwdInput);
      if (ok) {
        setActiveTeacherPassword(teacherPwdInput);
        setTeacherPwdInput('');
        setTeacherModalOpen(false);
        setView('teacher');
      } else {
        setTeacherPwdError('Parol notoʻgʻri.');
      }
    } finally {
      setTeacherVerifying(false);
    }
  };

  const activeUnit = UNITS.find((u) => u.id === activeUnitId) ?? UNITS[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }

  const effectiveStudent: Student | null =
    currentStudent ??
    (getCheaterLock()?.locked
      ? {
          id: getCheaterLock()!.studentId,
          fullName: 'Oʻquvchi',
          normalizedName: 'oquvchi',
          classCode: '8-01',
          createdAt: '',
          lastLoginAt: '',
          attempts: [],
        }
      : null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {view !== 'test' && (
        <Header
          currentView={view}
          student={currentStudent}
          theme={theme}
          onToggleTheme={() =>
            setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
          }
          onNavigate={(target) => {
            if (target !== 'profile') setReturningBanner(false);
            setView(target);
          }}
          onLogoutStudent={handleLogoutStudent}
          onOpenTeacherModal={() => {
            setTeacherPwdInput('');
            setTeacherPwdError(null);
            setTeacherModalOpen(true);
          }}
        />
      )}

      {view === 'login' && (
        <LoginView
          existingStudents={students}
          onStudentSubmit={handleStudentLogin}
          onOpenTeacherModal={() => {
            setTeacherPwdInput('');
            setTeacherPwdError(null);
            setTeacherModalOpen(true);
          }}
        />
      )}

      {view === 'units' && currentStudent && (
        <UnitsView
          student={currentStudent}
          timerMinutes={timerMinutes}
          onStartUnit={handleStartUnit}
          onGoToProfile={() => {
            setReturningBanner(false);
            setView('profile');
          }}
        />
      )}

      {view === 'test' && effectiveStudent && (
        <TestRunner
          key={`${activeUnit.id}-${effectiveStudent.id}`}
          student={effectiveStudent}
          unit={activeUnit}
          timerMinutes={timerMinutes}
          onFinishAttempt={handleFinishAttempt}
          onExitAfterCheaterUnlock={() => {
            setView(currentStudent ? 'units' : 'login');
          }}
        />
      )}

      {view === 'results' && currentStudent && latestAttempt && (
        <ResultsView
          student={currentStudent}
          unit={activeUnit}
          attempt={latestAttempt}
          onBackToUnits={() => setView('units')}
          onRetakeUnit={handleStartUnit}
          onGoToProfile={() => {
            setReturningBanner(false);
            setView('profile');
          }}
        />
      )}

      {view === 'profile' && currentStudent && (
        <ProfileView
          student={currentStudent}
          returningBanner={returningBanner}
          onDismissBanner={() => setReturningBanner(false)}
          onGoToUnits={() => {
            setReturningBanner(false);
            setView('units');
          }}
        />
      )}

      {view === 'teacher' && (
        <TeacherPanel
          students={students}
          timerMinutes={timerMinutes}
          teacherPassword={activeTeacherPassword}
          onRefreshStudents={setStudents}
          onTimerUpdated={setTimerMinutes}
          onTeacherPasswordUpdated={setActiveTeacherPassword}
          onExitPanel={() => setView(currentStudent ? 'units' : 'login')}
        />
      )}

      {/* Teacher Login Modal — strictly NO password hint */}
      {teacherModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Oʻqituvchi kirishi"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Oʻqituvchi paneli
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTeacherModalOpen(false)}
                aria-label="Yopish"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTeacherLoginSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="teacher-password-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Parolni kiriting
                </label>
                <input
                  id="teacher-password-input"
                  type="password"
                  autoFocus
                  value={teacherPwdInput}
                  onChange={(e) => setTeacherPwdInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {teacherPwdError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
                  {teacherPwdError}
                </p>
              )}

              <button
                type="submit"
                disabled={teacherVerifying}
                className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors"
              >
                {teacherVerifying ? 'Tekshirilmoqda...' : 'Kirish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
