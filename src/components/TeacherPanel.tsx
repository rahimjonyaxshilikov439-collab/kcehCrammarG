import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Download,
  Eye,
  KeyRound,
  Lock,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { UNITS } from '../data/units';
import { QUESTION_MAP } from '../data/questions';
import type { Student } from '../types';
import {
  deleteStudentRecord,
  updateCheaterCodeSetting,
  updateTeacherPasswordSetting,
  updateTimerSetting,
} from '../services/storage';
import { formatDurationUz, generateStudentsCsv } from '../utils/quizEngine';
import {
  calculateCompletedUnitsCount,
  calculateLevelInfo,
  calculateStudentAveragePercentage,
  calculateStudentTotalScore,
  computeClassStats,
  computeTopHardestQuestions,
  getAttemptDelta,
} from '../utils/scoring';
import { CLASS_CODES, matchesSmartStudentSearch } from '../utils/uzbekName';
import { GrowthChart } from './GrowthChart';

interface TeacherPanelProps {
  students: Student[];
  timerMinutes: number;
  teacherPassword: string;
  onRefreshStudents: (nextStudents: Student[]) => void;
  onTimerUpdated: (nextMinutes: number) => void;
  onTeacherPasswordUpdated: (nextPassword: string) => void;
  onExitPanel: () => void;
}

const TIMER_PRESETS = [5, 10, 15, 20, 30, 45] as const;

export function TeacherPanel({
  students,
  timerMinutes,
  teacherPassword,
  onRefreshStudents,
  onTimerUpdated,
  onTeacherPasswordUpdated,
  onExitPanel,
}: TeacherPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<number | 'all'>('all');

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Settings states
  const [timerInput, setTimerInput] = useState<string>(String(timerMinutes));
  const [timerStatus, setTimerStatus] = useState<string | null>(null);

  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [pwdStatus, setPwdStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [newCheaterCode, setNewCheaterCode] = useState('');
  const [cheaterStatus, setCheaterStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (classFilter !== 'all' && s.classCode !== classFilter) return false;
        if (
          unitFilter !== 'all' &&
          !s.attempts.some((a) => a.unitId === unitFilter)
        ) {
          return false;
        }
        return matchesSmartStudentSearch(s, searchQuery);
      })
      .sort(
        (a, b) =>
          calculateStudentTotalScore(b.attempts) -
          calculateStudentTotalScore(a.attempts)
      );
  }, [students, classFilter, unitFilter, searchQuery]);

  const totalAttemptsCount = useMemo(
    () => students.reduce((sum, s) => sum + s.attempts.length, 0),
    [students]
  );

  const overallAvgPercentage = useMemo(() => {
    const allAttempts = students.flatMap((s) => s.attempts);
    if (allAttempts.length === 0) return 0;
    const sum = allAttempts.reduce((acc, a) => acc + a.percentage, 0);
    return Math.round(sum / allAttempts.length);
  }, [students]);

  const classStats = useMemo(() => computeClassStats(students), [students]);
  const topHardest = useMemo(
    () => computeTopHardestQuestions(students, QUESTION_MAP, 5),
    [students]
  );

  const detailStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const handleDownloadCsv = () => {
    const csv = generateStudentsCsv(filteredStudents, unitFilter);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GrammarCheck_Natijalar_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const res = await deleteStudentRecord(studentId, teacherPassword);
    if (res.ok) {
      onRefreshStudents(students.filter((s) => s.id !== studentId));
      setPendingDeleteId(null);
      if (selectedStudentId === studentId) {
        setSelectedStudentId(null);
      }
    }
  };

  const handleSaveTimer = async (minutesToSave?: number) => {
    const target = minutesToSave ?? Number(timerInput);
    if (!Number.isFinite(target) || target < 1 || target > 120) {
      setTimerStatus('Taymer 1 dan 120 daqiqagacha boʻlishi kerak.');
      return;
    }
    const res = await updateTimerSetting(teacherPassword, target);
    if (res.ok && res.timerMinutes !== undefined) {
      setTimerInput(String(res.timerMinutes));
      onTimerUpdated(res.timerMinutes);
      setTimerStatus(`Taymer ${res.timerMinutes} daqiqa qilib saqlandi.`);
    } else {
      setTimerStatus(res.error ?? 'Xatolik yuz berdi.');
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    const res = await updateTeacherPasswordSetting(currentPwdInput, newPwdInput);
    if (res.ok) {
      onTeacherPasswordUpdated(newPwdInput.trim());
      setCurrentPwdInput('');
      setNewPwdInput('');
      setPwdStatus({ ok: true, msg: 'Oʻqituvchi paroli muvaffaqiyatli yangilandi.' });
    } else {
      setPwdStatus({ ok: false, msg: res.error ?? 'Parolni yangilab boʻlmadi.' });
    }
  };

  const handleUpdateCheaterCode = async (e: FormEvent) => {
    e.preventDefault();
    const res = await updateCheaterCodeSetting(teacherPassword, newCheaterCode);
    if (res.ok) {
      setNewCheaterCode('');
      setCheaterStatus({ ok: true, msg: 'Cheater ochish kodi yangilandi.' });
    } else {
      setCheaterStatus({ ok: false, msg: res.error ?? 'Kodni yangilab boʻlmadi.' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Boshqaruv tizimi
          </p>
          <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            Oʻqituvchi boshqaruv paneli
          </h1>
        </div>

        <button
          type="button"
          onClick={onExitPanel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Paneldan chiqish</span>
        </button>
      </div>

      {/* KPI Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Jami oʻquvchilar</span>
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {students.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Topshirilgan testlar</span>
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {totalAttemptsCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Oʻrtacha natija</span>
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
            {overallAvgPercentage}%
          </div>
        </div>
      </section>

      {/* Filters & Students Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Aqlli qidiruv (ism-familiya, teskari tartib, apostrof)..."
              aria-label="Oʻquvchilarni qidirish"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Sinf filtri"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">Barcha sinflar</option>
              {CLASS_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Unit filtri"
              value={unitFilter === 'all' ? 'all' : String(unitFilter)}
              onChange={(e) =>
                setUnitFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="all">Barcha unitlar</option>
              {UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.id}: {u.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4 font-semibold">Oʻquvchi</th>
                <th className="py-3 px-3 font-semibold">Sinf</th>
                <th className="py-3 px-3 font-semibold">Ball</th>
                <th className="py-3 px-3 font-semibold">Unitlar</th>
                <th className="py-3 px-3 font-semibold">Oʻrtacha</th>
                <th className="py-3 px-3 font-semibold">Urinish</th>
                <th className="py-3 pl-3 text-right font-semibold">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    Oʻquvchilar topilmadi.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const relevant =
                    unitFilter === 'all'
                      ? stu.attempts
                      : stu.attempts.filter((a) => a.unitId === unitFilter);
                  const score = calculateStudentTotalScore(relevant);
                  const completed = calculateCompletedUnitsCount(relevant);
                  const avg = calculateStudentAveragePercentage(relevant);
                  const isConfirmingDelete = pendingDeleteId === stu.id;

                  return (
                    <tr
                      key={stu.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {stu.fullName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums">
                        {stu.classCode}
                      </td>
                      <td className="py-3 px-3 font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                        {score}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums">
                        {completed} / {UNITS.length}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {avg}%
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 tabular-nums">
                        {relevant.length}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(stu.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Batafsil</span>
                          </button>

                          {isConfirmingDelete ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleDeleteStudent(stu.id)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                Tasdiqlash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300"
                              >
                                Yoʻq
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(stu.id)}
                              aria-label={`${stu.fullName}ni oʻchirish`}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Oʻchirish</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* "Sinflar va qiyin savollar" Section */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
          Sinflar va qiyin savollar
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Class averages */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Sinflar boʻyicha oʻrtacha koʻrsatkichlar
            </h3>

            {classStats.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hali sinflar boʻyicha maʼlumot yoʻq.
              </p>
            ) : (
              <div className="space-y-2.5">
                {classStats.map((cs) => (
                  <div
                    key={cs.classCode}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-3.5 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {cs.classCode}-sinf
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {cs.studentCount} oʻquvchi · {cs.attemptCount} test
                      </span>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {cs.averagePercentage}%
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        ({cs.averageTotalScore} ball)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top 5 Hardest Questions */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Eng koʻp xato qilingan Top 5 savol
            </h3>

            {topHardest.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hali xato javoblar statistikasi shakllanmagan.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topHardest.map((hq, idx) => (
                  <div
                    key={hq.questionId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        #{idx + 1} · Unit {hq.unitId}
                      </span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {hq.wrongCount} marta xato
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {hq.question}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Toʻgʻri javob: {hq.correctAnswer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Settings Section: Timer, Teacher Password, Cheater Code */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timer setting */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Taymer sozlamasi
              </h3>
            </div>
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
              Taymer: {timerMinutes} daq
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TIMER_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void handleSaveTimer(m)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  timerMinutes === m
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {m} daq
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              aria-label="Taymer daqiqalari"
              value={timerInput}
              onChange={(e) => setTimerInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
            />
            <button
              type="button"
              onClick={() => void handleSaveTimer()}
              className="shrink-0 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Saqlash
            </button>
          </div>
          {timerStatus && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{timerStatus}</p>
          )}
        </div>

        {/* Teacher Password Update */}
        <form
          onSubmit={handleUpdatePassword}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Parolni yangilash
            </h3>
          </div>

          <input
            type="password"
            placeholder="Joriy parol"
            value={currentPwdInput}
            onChange={(e) => setCurrentPwdInput(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <input
            type="password"
            placeholder="Yangi parol (kamida 4 belgi)"
            value={newPwdInput}
            onChange={(e) => setNewPwdInput(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 dark:bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-600 dark:hover:bg-sky-700"
          >
            Parolni yangilash
          </button>
          {pwdStatus && (
            <p
              className={`text-xs ${
                pwdStatus.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {pwdStatus.msg}
            </p>
          )}
        </form>

        {/* Cheater Unlock Code Update */}
        <form
          onSubmit={handleUpdateCheaterCode}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Cheater paroli
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Test bloklanganda ochish uchun ishlatiladigan maxsus kodni alohida yangilang.
          </p>
          <input
            type="text"
            placeholder="Yangi Cheater ochish kodi"
            value={newCheaterCode}
            onChange={(e) => setNewCheaterCode(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Cheater kodini saqlash
          </button>
          {cheaterStatus && (
            <p
              className={`text-xs ${
                cheaterStatus.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {cheaterStatus.msg}
            </p>
          )}
        </form>
      </section>

      {/* Student Detail Modal ("Batafsil") */}
      {detailStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Oʻquvchi batafsil maʼlumotlari"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {detailStudent.classCode}-sinf · Daraja{' '}
                  {calculateLevelInfo(calculateStudentTotalScore(detailStudent.attempts)).level}
                </p>
                <h3 className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  {detailStudent.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                aria-label="Yopish"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <GrowthChart attempts={detailStudent.attempts} />

            <div className="space-y-2.5">
              <h4 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Test urinishlari ({detailStudent.attempts.length})
              </h4>
              {detailStudent.attempts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hali test topshirilmagan.
                </p>
              ) : (
                [...detailStudent.attempts]
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .map((att) => {
                    const delta = getAttemptDelta(att, detailStudent.attempts);
                    return (
                      <div
                        key={att.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                          <span>Unit {att.unitId}</span>
                          <span className="tabular-nums">
                            {att.percentage}% ({att.correctCount}/{att.totalQuestions}) ·{' '}
                            {formatDurationUz(att.durationSeconds)}
                            {delta !== null
                              ? ` · ${delta > 0 ? `+${delta}%` : `${delta}%`}`
                              : ''}
                          </span>
                        </div>
                        {att.wrongAnswers.length > 0 && (
                          <div className="text-slate-500 dark:text-slate-400">
                            Xatolar ({att.wrongAnswers.length} ta):{' '}
                            {att.wrongAnswers
                              .slice(0, 3)
                              .map((w) => w.question)
                              .join(' | ')}
                            {att.wrongAnswers.length > 3 ? ' ...' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
