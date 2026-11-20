import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  Lock,
  Send,
  X,
} from 'lucide-react';
import type { ShuffledQuestion, Student, TestAttempt, UnitInfo } from '../types';
import { getQuestionsForUnit, QUESTION_MAP } from '../data/questions';
import {
  formatDurationUz,
  gradeShuffledQuiz,
  prepareShuffledQuiz,
} from '../utils/quizEngine';
import {
  getCheaterLock,
  setCheaterLock,
  verifyCheaterUnlockCode,
} from '../services/storage';

interface TestRunnerProps {
  student: Student;
  unit: UnitInfo;
  timerMinutes: number;
  onFinishAttempt: (attempt: TestAttempt) => Promise<void>;
  onExitAfterCheaterUnlock: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function TestRunner({
  student,
  unit,
  timerMinutes,
  onFinishAttempt,
  onExitAfterCheaterUnlock,
}: TestRunnerProps) {
  const totalTimeSeconds = timerMinutes * 60;

  const [questions] = useState<ShuffledQuestion[]>(() =>
    prepareShuffledQuiz(getQuestionsForUnit(unit.id))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(totalTimeSeconds);
  const [showMap, setShowMap] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Persistent Cheater Lock state
  const [isCheaterLocked, setIsCheaterLocked] = useState<boolean>(() => {
    const existing = getCheaterLock();
    return Boolean(existing?.locked);
  });
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const startedAtRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);
  const wasFullscreenActiveRef = useRef<boolean>(
    typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );

  const lockAsCheater = useCallback(() => {
    if (finishedRef.current) return;
    setCheaterLock({
      locked: true,
      studentId: student.id,
      unitId: unit.id,
      lockedAt: new Date().toISOString(),
    });
    setIsCheaterLocked(true);
    setShowMap(false);
    setConfirmFinish(false);
  }, [student.id, unit.id]);

  // Monitor fullscreen transitions: once fullscreen is active, exiting it triggers Cheater Lock
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      wasFullscreenActiveRef.current = true;
    }

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreenActiveRef.current = true;
      } else if (wasFullscreenActiveRef.current && !finishedRef.current) {
        lockAsCheater();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [lockAsCheater]);

  const handleSubmitTest = useCallback(async () => {
    if (finishedRef.current || isCheaterLocked || submitting) return;
    finishedRef.current = true;
    setSubmitting(true);

    const graded = gradeShuffledQuiz(questions, answers, QUESTION_MAP);
    const elapsedSeconds = Math.min(
      totalTimeSeconds,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    );

    const attempt: TestAttempt = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      studentId: student.id,
      unitId: unit.id,
      score: graded.score,
      correctCount: graded.correctCount,
      totalQuestions: graded.totalQuestions,
      percentage: graded.percentage,
      durationSeconds: elapsedSeconds,
      createdAt: new Date().toISOString(),
      wrongAnswers: graded.wrongAnswers,
    };

    if (typeof document !== 'undefined' && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore fullscreen exit errors
      }
    }

    await onFinishAttempt(attempt);
  }, [
    answers,
    isCheaterLocked,
    onFinishAttempt,
    questions,
    student.id,
    submitting,
    totalTimeSeconds,
    unit.id,
  ]);

  // Countdown timer
  useEffect(() => {
    if (isCheaterLocked || submitting) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [handleSubmitTest, isCheaterLocked, submitting]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion || isCheaterLocked) return;
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.originalId]: optionIndex,
      }));
    },
    [currentQuestion, isCheaterLocked]
  );

  const toggleFlag = useCallback(() => {
    if (!currentQuestion || isCheaterLocked) return;
    setFlagged((prev) => ({
      ...prev,
      [currentQuestion.originalId]: !prev[currentQuestion.originalId],
    }));
  }, [currentQuestion, isCheaterLocked]);

  // Keyboard shortcuts: A-D / 1-4, Left/Right arrows, F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCheaterLocked || showMap || confirmFinish) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'a' || key === '1') {
        selectOption(0);
      } else if (key === 'b' || key === '2') {
        selectOption(1);
      } else if (key === 'c' || key === '3') {
        selectOption(2);
      } else if (key === 'd' || key === '4') {
        selectOption(3);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((idx) => Math.max(0, idx - 1));
      } else if (key === 'f') {
        toggleFlag();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmFinish, isCheaterLocked, questions.length, selectOption, showMap, toggleFlag]);

  const handleUnlockSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!unlockCode.trim()) {
      setUnlockError('Kod maydonini toʻldiring.');
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      const valid = await verifyCheaterUnlockCode(unlockCode);
      if (valid) {
        setCheaterLock(null);
        setIsCheaterLocked(false);
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch {
            // Ignore
          }
        }
        onExitAfterCheaterUnlock();
      } else {
        setUnlockError('Ochish kodi notoʻgʻri.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  // Persistent Anti-Cheat Lock Screen
  if (isCheaterLocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-rose-800/70 bg-slate-900 p-8 text-center shadow-2xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-950 text-rose-500 border border-rose-800">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tight text-rose-500">
              Cheater
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Test vaqtida toʻliq ekran (fullscreen) rejimidan chiqilgani sababli test bloklandi. Davom ettirish imkonsiz. Chiqish uchun oʻqituvchi kodini kiriting.
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-3 text-left">
            <label
              htmlFor="cheater-unlock-input"
              className="block text-xs font-medium text-slate-400"
            >
              Ochish kodi
            </label>
            <input
              id="cheater-unlock-input"
              type="password"
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              placeholder="Kodni kiriting"
              autoFocus
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            {unlockError && (
              <p className="text-xs font-medium text-rose-400" role="alert">
                {unlockError}
              </p>
            )}
            <button
              type="submit"
              disabled={unlocking}
              className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
            >
              {unlocking ? 'Tekshirilmoqda...' : 'Ochish'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const selectedOpt = answers[currentQuestion.originalId] ?? null;
  const isFlagged = Boolean(flagged[currentQuestion.originalId]);
  const isDangerTime = timeLeft <= 60;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Minimal Distraction-Free Top Bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
              Unit {unit.id} · {student.fullName}
            </p>
            <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {unit.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              data-testid="test-timer"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                isDangerTime
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{formatDurationUz(timeLeft)}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Savollar xaritasi</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmFinish(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Yakunlash</span>
            </button>
          </div>
        </div>

        {/* Thin Progress Track */}
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-sky-600 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main Centered Question Canvas */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 flex flex-col justify-between gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 tabular-nums">
              Savol {currentIndex + 1} / {questions.length} · Javob berilgan: {answeredCount}
            </span>

            <button
              type="button"
              onClick={toggleFlag}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                isFlagged
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{isFlagged ? 'Belgilangan' : 'Keyinga belgilash (F)'}</span>
            </button>
          </div>

          <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50 leading-relaxed">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3" role="radiogroup" aria-label="Javob variantlari">
            {currentQuestion.shuffledOptions.map((optText, idx) => {
              const isSelected = selectedOpt === idx;
              return (
                <button
                  key={`${currentQuestion.originalId}-${idx}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => selectOption(idx)}
                  className={`w-full text-left flex items-start gap-3.5 rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/80 dark:border-sky-500 dark:bg-sky-950/40 ring-1 ring-sky-600 dark:ring-sky-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {LETTERS[idx]}
                  </span>
                  <span className="pt-0.5 text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {optText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Oldingi</span>
          </button>

          <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">
            Klaviatura: A–D / 1–4 javob · ← → oʻtish · F belgilash
          </span>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 dark:hover:bg-sky-700 transition-colors"
            >
              <span>Keyingi</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmFinish(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>Testni yakunlash</span>
            </button>
          )}
        </div>
      </main>

      {/* Question Map Modal */}
      {showMap && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Savollar xaritasi"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Savollar xaritasi
              </h3>
              <button
                type="button"
                onClick={() => setShowMap(false)}
                aria-label="Yopish"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.originalId] !== undefined;
                const isQFlagged = Boolean(flagged[q.originalId]);
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.originalId}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMap(false);
                    }}
                    className={`relative h-10 rounded-xl text-xs font-bold tabular-nums transition-colors border ${
                      isCurrent
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : isAnswered
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {idx + 1}
                    {isQFlagged && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Javob berilgan: {answeredCount}</span>
              <span>Qoldirilgan: {questions.length - answeredCount}</span>
              <span>Belgilangan: {Object.values(flagged).filter(Boolean).length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Finish Confirmation Modal (replaces window.confirm) */}
      {confirmFinish && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Testni yakunlash"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Testni yakunlaysizmi?
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Siz <strong className="tabular-nums">{questions.length}</strong> ta savoldan{' '}
                  <strong className="tabular-nums">{answeredCount}</strong> tasiga javob berdingiz.
                  {questions.length - answeredCount > 0 &&
                    ` Javob berilmagan ${questions.length - answeredCount} ta savol xato hisoblanadi.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmFinish(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Testga qaytish
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitTest()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {submitting ? 'Saqlanmoqda...' : 'Ha, yakunlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
