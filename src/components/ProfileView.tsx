import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  History,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { UNITS } from '../data/units';
import type { Student, WrongAnswerDetail } from '../types';
import { formatDurationUz, shuffleArray } from '../utils/quizEngine';
import {
  buildMistakeBank,
  calculateCompletedUnitsCount,
  calculateLevelInfo,
  calculateStudentAveragePercentage,
  calculateStudentTotalScore,
  getAttemptDelta,
  LEVEL_THRESHOLDS,
} from '../utils/scoring';
import { GrowthChart } from './GrowthChart';

interface ProfileViewProps {
  student: Student;
  returningBanner: boolean;
  onDismissBanner: () => void;
  onGoToUnits: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

interface DrillItem {
  mistake: WrongAnswerDetail;
  shuffledOptions: [string, string, string, string];
  shuffledCorrectIndex: number;
}

export function ProfileView({
  student,
  returningBanner,
  onDismissBanner,
  onGoToUnits,
}: ProfileViewProps) {
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillItems, setDrillItems] = useState<DrillItem[]>([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillSelected, setDrillSelected] = useState<number | null>(null);
  const [drillCorrectCount, setDrillCorrectCount] = useState(0);

  const totalScore = useMemo(
    () => calculateStudentTotalScore(student.attempts),
    [student.attempts]
  );
  const completedCount = useMemo(
    () => calculateCompletedUnitsCount(student.attempts),
    [student.attempts]
  );
  const avgPct = useMemo(
    () => calculateStudentAveragePercentage(student.attempts),
    [student.attempts]
  );
  const levelInfo = useMemo(() => calculateLevelInfo(totalScore), [totalScore]);
  const mistakeBank = useMemo(
    () => buildMistakeBank(student.attempts),
    [student.attempts]
  );

  const sortedHistory = useMemo(
    () =>
      [...student.attempts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [student.attempts]
  );

  const toggleReveal = (qId: string) => {
    setRevealedIds((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const startMistakeDrill = () => {
    if (mistakeBank.length === 0) return;
    const prepared: DrillItem[] = shuffleArray(mistakeBank).map((m) => {
      const order = shuffleArray([0, 1, 2, 3]);
      const shuffledOptions = [
        m.options[order[0]],
        m.options[order[1]],
        m.options[order[2]],
        m.options[order[3]],
      ] as [string, string, string, string];
      const shuffledCorrectIndex = order.indexOf(m.correctIndex);
      return { mistake: m, shuffledOptions, shuffledCorrectIndex };
    });
    setDrillItems(prepared);
    setDrillIndex(0);
    setDrillSelected(null);
    setDrillCorrectCount(0);
    setDrillOpen(true);
  };

  const handleDrillSelect = (idx: number) => {
    if (drillSelected !== null) return;
    setDrillSelected(idx);
    const current = drillItems[drillIndex];
    if (current && idx === current.shuffledCorrectIndex) {
      setDrillCorrectCount((c) => c + 1);
    }
  };

  const currentDrill = drillItems[drillIndex];
  const isDrillFinished = drillOpen && drillIndex >= drillItems.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      {returningBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-3.5 text-sm text-emerald-900 dark:text-emerald-100"
        >
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Siz avval ham kirgan ekansiz, profilga kiramiz!</span>
          </div>
          <button
            type="button"
            onClick={onDismissBanner}
            aria-label="Xabarni yopish"
            className="rounded-lg p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Shaxsiy profil · {student.classCode}-sinf
          </p>
          <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            {student.fullName}
          </h1>
        </div>

        <button
          type="button"
          onClick={onGoToUnits}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Unitlar menyusiga oʻtish</span>
        </button>
      </div>

      {/* 5-Tier Level System & Summary Stats */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Daraja tizimi
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  Daraja {levelInfo.level}: {levelInfo.title}
                </h2>
              </div>
            </div>
            <span className="font-display text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {totalScore} ball
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 dark:text-slate-300">
                {levelInfo.nextLevelPoints !== null
                  ? `Daraja ${levelInfo.level + 1} gacha yana ${
                      levelInfo.nextLevelPoints - totalScore
                    } ball`
                  : 'Eng yuqori 5-darajaga erishildi!'}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {levelInfo.progressPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-300"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {LEVEL_THRESHOLDS.map((tier) => {
              const reached = totalScore >= tier.minPoints;
              return (
                <div
                  key={tier.level}
                  className={`rounded-lg border px-2 py-1.5 text-center ${
                    reached
                      ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div className="text-[11px] font-bold tabular-nums">Daraja {tier.level}</div>
                  <div className="text-[10px] tabular-nums">{tier.minPoints}+</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball (eng yuqori)</div>
            <div className="mt-2 font-display text-3xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {totalScore}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Har bir unitning eng yaxshi natijasi qoʻshiladi
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Bajarilgan unitlar</div>
            <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {completedCount} / {UNITS.length}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {Math.round((completedCount / UNITS.length) * 100)}% qamrov
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha foiz</div>
            <div className="mt-2 font-display text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {avgPct}%
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Ishlangan unitlar boʻyicha
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Jami urinishlar</div>
            <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {student.attempts.length}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Xatolar banki: {mistakeBank.length} ta savol
            </p>
          </div>
        </div>
      </section>

      {/* SVG Growth Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Natijalar oʻsish grafigi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Topshirilgan testlar ketma-ketligi boʻyicha foiz dinamikasi
          </p>
        </div>
        <GrowthChart attempts={student.attempts} />
      </section>

      {/* Attempt History & Mistake Bank */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Attempt History */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Ishlangan testlar tarixi
            </h2>
          </div>

          {sortedHistory.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hali birorta test topshirilmagan.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {sortedHistory.map((att) => {
                const unitInfo = UNITS.find((u) => u.id === att.unitId);
                const delta = getAttemptDelta(att, student.attempts);
                return (
                  <div
                    key={att.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Unit {att.unitId}: {unitInfo?.title ?? ''}
                      </span>
                      <span className="font-display text-sm font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                        {att.percentage}%
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        {att.correctCount}/{att.totalQuestions} toʻgʻri · +{att.score} ball ·{' '}
                        {formatDurationUz(att.durationSeconds)}
                      </span>
                      {delta !== null && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-semibold ${
                            delta >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {delta >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {delta > 0 ? `+${delta}%` : `${delta}%`}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(att.createdAt).toLocaleString('uz-UZ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mistake Bank + Mistake Drill */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Xatolar banki ({mistakeBank.length} ta)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Xato qilingan savollarni qayta koʻrib chiqing va mashq qiling
              </p>
            </div>

            {mistakeBank.length > 0 && (
              <button
                type="button"
                onClick={startMistakeDrill}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors"
              >
                <Dumbbell className="h-4 w-4" />
                <span>Xatolar ustida mashq</span>
              </button>
            )}
          </div>

          {mistakeBank.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Hozircha Xatolar bankida savol yoʻq.
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {mistakeBank.map((item) => {
                const isRevealed = Boolean(revealedIds[item.questionId]);
                return (
                  <div
                    key={item.questionId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Unit {item.unitId}
                        </span>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.question}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleReveal(item.questionId)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {isRevealed ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Javobni yashirish</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            <span>Javobni koʻrish</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isRevealed && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-xs space-y-1">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                          Toʻgʻri javob: {item.options[item.correctIndex]}
                        </p>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Interactive Mistake Drill Modal */}
      {drillOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xatolar ustida mashq"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Xatolar ustida mashq (Mistake Drill)
                </h3>
                {!isDrillFinished && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Savol {drillIndex + 1} / {drillItems.length} · Toʻgʻri: {drillCorrectCount}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrillOpen(false)}
                aria-label="Yopish"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isDrillFinished ? (
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                    Mashq yakunlandi!
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                    Natija: {drillCorrectCount} / {drillItems.length} ta toʻgʻri javob
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={startMistakeDrill}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Qayta mashq qilish
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrillOpen(false)}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            ) : (
              currentDrill && (
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Unit {currentDrill.mistake.unitId}
                  </span>
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {currentDrill.mistake.question}
                  </p>

                  <div className="space-y-2.5">
                    {currentDrill.shuffledOptions.map((opt, idx) => {
                      const answered = drillSelected !== null;
                      const isCorrect = idx === currentDrill.shuffledCorrectIndex;
                      const isPicked = idx === drillSelected;
                      let cls =
                        'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 hover:border-sky-400';
                      if (answered) {
                        if (isCorrect) {
                          cls =
                            'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100';
                        } else if (isPicked) {
                          cls =
                            'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100';
                        } else {
                          cls =
                            'border-slate-200 dark:border-slate-800 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={answered}
                          onClick={() => handleDrillSelect(idx)}
                          className={`w-full text-left flex items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors ${cls}`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                            {LETTERS[idx]}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {answered && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          {answered && isPicked && !isCorrect && (
                            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {drillSelected !== null && (
                    <div className="space-y-3 pt-1">
                      <p className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <strong className="font-semibold">Izoh: </strong>
                        {currentDrill.mistake.explanation}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDrillIndex((i) => i + 1);
                          setDrillSelected(null);
                        }}
                        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                      >
                        {drillIndex + 1 < drillItems.length
                          ? 'Keyingi savol'
                          : 'Natijani koʻrish'}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
