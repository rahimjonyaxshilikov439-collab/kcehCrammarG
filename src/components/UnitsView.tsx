import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import { UNITS } from '../data/units';
import { QUESTIONS_BY_UNIT } from '../data/questions';
import type { Student } from '../types';
import {
  calculateBestPercentageByUnit,
  calculateBestScoresByUnit,
  calculateCompletedUnitsCount,
  calculateLevelInfo,
  calculateStudentAveragePercentage,
  calculateStudentTotalScore,
  getNextRecommendedUnitId,
} from '../utils/scoring';

interface UnitsViewProps {
  student: Student;
  timerMinutes: number;
  onStartUnit: (unitId: number) => void;
  onGoToProfile: () => void;
}

type StatusFilter = 'all' | 'todo' | 'done';
type SortOption = 'unit' | 'todo_first' | 'lowest_score';
type RangeTab = 'all' | '1-4' | '5-8' | '9-12' | '13-16';

export function UnitsView({
  student,
  timerMinutes,
  onStartUnit,
  onGoToProfile,
}: UnitsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('unit');
  const [rangeTab, setRangeTab] = useState<RangeTab>('all');

  const bestScores = useMemo(
    () => calculateBestScoresByUnit(student.attempts),
    [student.attempts]
  );
  const bestPct = useMemo(
    () => calculateBestPercentageByUnit(student.attempts),
    [student.attempts]
  );
  const totalScore = useMemo(
    () => calculateStudentTotalScore(student.attempts),
    [student.attempts]
  );
  const completedCount = useMemo(
    () => calculateCompletedUnitsCount(student.attempts),
    [student.attempts]
  );
  const avgPercentage = useMemo(
    () => calculateStudentAveragePercentage(student.attempts),
    [student.attempts]
  );
  const levelInfo = useMemo(() => calculateLevelInfo(totalScore), [totalScore]);
  const recommendedUnitId = useMemo(
    () => getNextRecommendedUnitId(student.attempts, UNITS.length),
    [student.attempts]
  );
  const recommendedUnit = UNITS.find((u) => u.id === recommendedUnitId) ?? UNITS[0];
  const masteryPercent = Math.round((completedCount / UNITS.length) * 100);

  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = UNITS.filter((unit) => {
      // Range tab filter
      if (rangeTab === '1-4' && (unit.id < 1 || unit.id > 4)) return false;
      if (rangeTab === '5-8' && (unit.id < 5 || unit.id > 8)) return false;
      if (rangeTab === '9-12' && (unit.id < 9 || unit.id > 12)) return false;
      if (rangeTab === '13-16' && (unit.id < 13 || unit.id > 16)) return false;

      // Status filter
      const isDone = bestScores[unit.id] !== undefined;
      if (statusFilter === 'done' && !isDone) return false;
      if (statusFilter === 'todo' && isDone) return false;

      // Search filter (number, title, topics, keywords, or questions inside unit)
      if (!q) return true;
      const inMeta =
        String(unit.id) === q ||
        `unit ${unit.id}`.includes(q) ||
        unit.title.toLowerCase().includes(q) ||
        unit.uzTitle.toLowerCase().includes(q) ||
        unit.subtitle.toLowerCase().includes(q) ||
        unit.topics.some((t) => t.toLowerCase().includes(q)) ||
        unit.keywords.some((k) => k.toLowerCase().includes(q));

      if (inMeta) return true;

      const unitQuestions = QUESTIONS_BY_UNIT[unit.id] ?? [];
      return unitQuestions.some(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.explanation.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'todo_first') {
        const aDone = bestScores[a.id] !== undefined ? 1 : 0;
        const bDone = bestScores[b.id] !== undefined ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.id - b.id;
      }
      if (sortBy === 'lowest_score') {
        const aPct = bestPct[a.id] ?? -1;
        const bPct = bestPct[b.id] ?? -1;
        if (aPct !== bPct) return aPct - bPct;
        return a.id - b.id;
      }
      return a.id - b.id;
    });
  }, [searchQuery, rangeTab, statusFilter, sortBy, bestScores, bestPct]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top KPI & Recommendation Summary */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                {student.classCode}-sinf · Daraja {levelInfo.level}: {levelInfo.title}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                Xush kelibsiz, {student.fullName}
              </h1>
            </div>
            <button
              type="button"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Award className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>Shaxsiy profil</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
              <div className="mt-1 font-display text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {totalScore}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Bajarilgan unitlar</div>
              <div className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {completedCount} / {UNITS.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha foiz</div>
              <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {avgPercentage}%
              </div>
            </div>
          </div>

          {/* Mastery Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Umumiy oʻzlashtirish darajasi
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {masteryPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-300"
                style={{ width: `${masteryPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Next Recommended Unit CTA */}
        <div className="lg:col-span-4 rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Tavsiya etilgan unit</span>
            </div>
            <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-slate-50">
              Unit {recommendedUnit.id}: {recommendedUnit.title}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {recommendedUnit.uzTitle} · {QUESTIONS_BY_UNIT[recommendedUnit.id]?.length ?? 30} ta savol · {timerMinutes} daqiqa
            </p>
          </div>

          <button
            type="button"
            onClick={() => onStartUnit(recommendedUnit.id)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Testni boshlash</span>
          </button>
        </div>
      </section>

      {/* Search, Filters & Range Tabs */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-6 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Unit raqami, mavzu yoki grammatik soʻz boʻyicha qidiring..."
              aria-label="Unitlarni qidirish"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="md:col-span-3 flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1">
            {(
              [
                { key: 'all', label: 'Barchasi' },
                { key: 'todo', label: 'Ishlanmagan' },
                { key: 'done', label: 'Bajarilgan' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === item.key
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Saralash tartibi"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              <option value="unit">Saralash: Unit raqami</option>
              <option value="todo_first">Saralash: Avval ishlanmaganlar</option>
              <option value="lowest_score">Saralash: Eng past natijadan</option>
            </select>
          </div>
        </div>

        {/* Range tabs matching Grammarway 3 sections */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          {(
            [
              { key: 'all', label: 'Barchasi (1–16)' },
              { key: '1-4', label: 'Unit 1–4' },
              { key: '5-8', label: 'Unit 5–8' },
              { key: '9-12', label: 'Unit 9–12' },
              { key: '13-16', label: 'Unit 13–16' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRangeTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                rangeTab === tab.key
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Qidiruv mezonlariga mos unit topilmadi.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredUnits.map((unit) => {
            const bestUnitScore = bestScores[unit.id];
            const bestUnitPct = bestPct[unit.id];
            const isCompleted = bestUnitScore !== undefined;
            const questionCount = QUESTIONS_BY_UNIT[unit.id]?.length ?? 30;
            const attemptCount = student.attempts.filter((a) => a.unitId === unit.id).length;

            return (
              <article
                key={unit.id}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-sky-300 dark:hover:border-sky-700 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                      <BookOpen className="h-3.5 w-3.5" />
                      Unit {unit.id} · {unit.pages}-betlar
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                        isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Eng yaxshi: {bestUnitPct}% ({bestUnitScore} ball)</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" />
                          <span>Ishlanmagan</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                      {unit.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {unit.uzTitle}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {unit.topics.join(' · ')}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {questionCount} savol · {timerMinutes} daqiqa
                    {attemptCount > 0 ? ` · ${attemptCount} marta` : ''}
                  </span>

                  <button
                    type="button"
                    onClick={() => onStartUnit(unit.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-600 dark:hover:bg-sky-700 transition-colors"
                  >
                    <span>Testni boshlash</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
