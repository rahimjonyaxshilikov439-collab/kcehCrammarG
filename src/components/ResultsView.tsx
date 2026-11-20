import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  Send,
  Share2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import type { Student, TestAttempt, UnitInfo } from '../types';
import { formatDurationUz, renderResultCardPng } from '../utils/quizEngine';
import { calculateStudentTotalScore, getAttemptDelta } from '../utils/scoring';

interface ResultsViewProps {
  student: Student;
  unit: UnitInfo;
  attempt: TestAttempt;
  onBackToUnits: () => void;
  onRetakeUnit: (unitId: number) => void;
  onGoToProfile: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function ResultsView({
  student,
  unit,
  attempt,
  onBackToUnits,
  onRetakeUnit,
  onGoToProfile,
}: ResultsViewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'shared'>('idle');

  const totalScore = calculateStudentTotalScore(student.attempts);
  const delta = getAttemptDelta(attempt, student.attempts);
  const wrongCount = attempt.totalQuestions - attempt.correctCount;

  const summaryText = [
    `GrammarCheck · Grammarway 3`,
    `Oʻquvchi: ${student.fullName} (${student.classCode})`,
    `Boʻlim: Unit ${unit.id} — ${unit.title}`,
    `Natija: ${attempt.percentage}% (${attempt.correctCount}/${attempt.totalQuestions} toʻgʻri)`,
    `Ushbu test bali: +${attempt.score} ball | Umumiy ball: ${totalScore} ball`,
    `Sarflangan vaqt: ${formatDurationUz(attempt.durationSeconds)}`,
  ].join('\n');

  const telegramShareHref = `https://t.me/share/url?url=${encodeURIComponent(
    typeof window !== 'undefined' ? window.location.origin : 'https://grammarcheck.app'
  )}&text=${encodeURIComponent(summaryText)}`;

  const handleSavePng = () => {
    const dataUrl = renderResultCardPng({
      studentName: student.fullName,
      classCode: student.classCode,
      unitNumber: unit.id,
      unitTitle: unit.title,
      attempt,
      totalScore,
      deltaPercent: delta,
    });
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `GrammarCheck_Unit_${unit.id}_${student.fullName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      // Clipboard blocked in restricted frame
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `GrammarCheck — Unit ${unit.id} natijasi`,
          text: summaryText,
        });
        setCopyStatus('shared');
        setTimeout(() => setCopyStatus('idle'), 2500);
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyText();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToUnits}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Unitlar menyusiga qaytish</span>
        </button>

        <button
          type="button"
          onClick={onGoToProfile}
          className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
        >
          Shaxsiy profilga oʻtish →
        </button>
      </div>

      {/* Main Result Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Unit {unit.id} · Test yakunlandi
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
              {unit.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {student.fullName} · {student.classCode}-sinf
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span
              className={`font-display text-5xl font-bold tabular-nums ${
                attempt.percentage >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : attempt.percentage >= 50
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {attempt.percentage}%
            </span>
            {delta !== null && (
              <span
                className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
                  delta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {delta > 0 ? `+${delta}%` : `${delta}%`}
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Toʻgʻri</div>
            <div className="mt-1 font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {attempt.correctCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Xato</div>
            <div className="mt-1 font-display text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {wrongCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Ushbu test bali</div>
            <div className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              +{attempt.score}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
            <div className="mt-1 font-display text-xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {totalScore}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Sarflangan vaqt</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatDurationUz(attempt.durationSeconds)}
            </div>
          </div>
        </div>

        {/* Share & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleSavePng}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>PNG skrinshot qilib saqlash</span>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            <span>{copyStatus === 'shared' ? 'Ulashildi' : 'Ulashish'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {copyStatus === 'copied' ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span>{copyStatus === 'copied' ? 'Nusxalandi' : 'Matnini nusxalash'}</span>
          </button>

          <a
            href={telegramShareHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs sm:text-sm font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
          >
            <Send className="h-4 w-4" />
            <span>Telegramdan yuborish</span>
          </a>

          <button
            type="button"
            onClick={() => onRetakeUnit(unit.id)}
            className="sm:ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Qayta topshirish</span>
          </button>
        </div>
      </section>

      {/* Mistakes & Explanations */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          Xato savollar tahlili ({attempt.wrongAnswers.length} ta)
        </h2>

        {attempt.wrongAnswers.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">
              Ajoyib natija! Ushbu unitdagi barcha savollarga toʻgʻri javob berdingiz.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {attempt.wrongAnswers.map((item, idx) => (
              <div
                key={item.questionId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 mt-1 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {idx + 1}. {item.question}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 text-xs">
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-rose-800 dark:text-rose-200">
                    <span className="font-semibold">Sizning javobingiz: </span>
                    {item.selectedIndex !== null
                      ? `${LETTERS[item.selectedIndex]}. ${item.options[item.selectedIndex]}`
                      : 'Belgilanmagan'}
                  </div>
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                    <span className="font-semibold">Toʻgʻri javob: </span>
                    {LETTERS[item.correctIndex]}. {item.options[item.correctIndex]}
                  </div>
                </div>

                <p className="pl-6 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong className="font-semibold text-slate-800 dark:text-slate-100">Izoh: </strong>
                  {item.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
