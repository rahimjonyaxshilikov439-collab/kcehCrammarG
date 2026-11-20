import type {
  LevelInfo,
  Question,
  Student,
  TestAttempt,
  WrongAnswerDetail,
} from '../types';

export const POINTS_PER_CORRECT = 10;

export const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Boshlangʻich bosqich', minPoints: 0 },
  { level: 2, title: 'Oʻsib boruvchi', minPoints: 1000 },
  { level: 3, title: 'Ishonchli bilimdon', minPoints: 2000 },
  { level: 4, title: 'Kuchli grammatikachi', minPoints: 3000 },
  { level: 5, title: 'Grammarway ustasi', minPoints: 4000 },
] as const;

export function calculateBestScoresByUnit(attempts: TestAttempt[]): Record<number, number> {
  const best: Record<number, number> = {};
  for (const att of attempts) {
    if (best[att.unitId] === undefined || att.score > best[att.unitId]) {
      best[att.unitId] = att.score;
    }
  }
  return best;
}

export function calculateBestPercentageByUnit(attempts: TestAttempt[]): Record<number, number> {
  const best: Record<number, number> = {};
  for (const att of attempts) {
    if (best[att.unitId] === undefined || att.percentage > best[att.unitId]) {
      best[att.unitId] = att.percentage;
    }
  }
  return best;
}

/**
 * Total score sums ONLY the highest score achieved per unit,
 * preventing infinite point farming from replaying the same unit.
 */
export function calculateStudentTotalScore(attempts: TestAttempt[]): number {
  const bestByUnit = calculateBestScoresByUnit(attempts);
  return Object.values(bestByUnit).reduce((sum, score) => sum + score, 0);
}

export function calculateStudentAveragePercentage(attempts: TestAttempt[]): number {
  if (attempts.length === 0) return 0;
  const bestPctByUnit = calculateBestPercentageByUnit(attempts);
  const values = Object.values(bestPctByUnit);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, pct) => acc + pct, 0);
  return Math.round(sum / values.length);
}

export function calculateCompletedUnitsCount(attempts: TestAttempt[]): number {
  return Object.keys(calculateBestScoresByUnit(attempts)).length;
}

export function calculateLevelInfo(totalPoints: number): LevelInfo {
  let current: (typeof LEVEL_THRESHOLDS)[number] = LEVEL_THRESHOLDS[0];
  let nextMin: number | null = LEVEL_THRESHOLDS[1].minPoints;

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i].minPoints) {
      current = LEVEL_THRESHOLDS[i];
      nextMin = i + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[i + 1].minPoints : null;
    }
  }

  let progressPercent = 100;
  if (nextMin !== null) {
    const span = nextMin - current.minPoints;
    const gained = totalPoints - current.minPoints;
    progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));
  }

  return {
    level: current.level,
    title: current.title,
    minPoints: current.minPoints,
    nextLevelPoints: nextMin,
    progressPercent,
    totalPoints,
  };
}

/**
 * Computes percentage change vs the immediately preceding attempt on the SAME unit.
 * Returns null if this is the first attempt on that unit.
 */
export function getAttemptDelta(
  attempt: TestAttempt,
  allAttempts: TestAttempt[]
): number | null {
  const unitAttempts = allAttempts
    .filter((a) => a.unitId === attempt.unitId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const idx = unitAttempts.findIndex((a) => a.id === attempt.id);
  if (idx <= 0) return null;
  return attempt.percentage - unitAttempts[idx - 1].percentage;
}

export function getNextRecommendedUnitId(
  attempts: TestAttempt[],
  totalUnits: number
): number {
  const completed = new Set(attempts.map((a) => a.unitId));
  for (let i = 1; i <= totalUnits; i++) {
    if (!completed.has(i)) return i;
  }
  // If all completed, recommend the unit with lowest best percentage
  const bestPct = calculateBestPercentageByUnit(attempts);
  let lowestUnit = 1;
  let lowestPct = 101;
  for (let i = 1; i <= totalUnits; i++) {
    const pct = bestPct[i] ?? 0;
    if (pct < lowestPct) {
      lowestPct = pct;
      lowestUnit = i;
    }
  }
  return lowestUnit;
}

/**
 * Collects unique wrong answers from a student's attempts (latest occurrence wins).
 */
export function buildMistakeBank(attempts: TestAttempt[]): WrongAnswerDetail[] {
  const sorted = [...attempts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const seen = new Map<string, WrongAnswerDetail>();
  for (const att of sorted) {
    for (const wrong of att.wrongAnswers) {
      if (!seen.has(wrong.questionId)) {
        seen.set(wrong.questionId, wrong);
      }
    }
  }
  return Array.from(seen.values());
}

export interface ClassAverageStat {
  classCode: string;
  studentCount: number;
  attemptCount: number;
  averagePercentage: number;
  averageTotalScore: number;
}

export function computeClassStats(students: Student[]): ClassAverageStat[] {
  const grouped = new Map<string, Student[]>();
  for (const s of students) {
    const list = grouped.get(s.classCode) ?? [];
    list.push(s);
    grouped.set(s.classCode, list);
  }

  const stats: ClassAverageStat[] = [];
  for (const [classCode, members] of grouped.entries()) {
    const attemptCount = members.reduce((sum, s) => sum + s.attempts.length, 0);
    const allAttempts = members.flatMap((s) => s.attempts);
    const avgPct =
      allAttempts.length > 0
        ? Math.round(
            allAttempts.reduce((sum, a) => sum + a.percentage, 0) / allAttempts.length
          )
        : 0;
    const avgTotalScore =
      members.length > 0
        ? Math.round(
            members.reduce((sum, s) => sum + calculateStudentTotalScore(s.attempts), 0) /
              members.length
          )
        : 0;
    stats.push({
      classCode,
      studentCount: members.length,
      attemptCount,
      averagePercentage: avgPct,
      averageTotalScore: avgTotalScore,
    });
  }

  return stats.sort((a, b) => a.classCode.localeCompare(b.classCode));
}

export interface HardestQuestionStat {
  questionId: string;
  unitId: number;
  question: string;
  correctAnswer: string;
  wrongCount: number;
}

export function computeTopHardestQuestions(
  students: Student[],
  questionLookup: Map<string, Question>,
  limit = 5
): HardestQuestionStat[] {
  const counts = new Map<string, { unitId: number; question: string; correctAnswer: string; wrongCount: number }>();

  for (const s of students) {
    for (const att of s.attempts) {
      for (const w of att.wrongAnswers) {
        const prev = counts.get(w.questionId);
        const qObj = questionLookup.get(w.questionId);
        const correctAnswer = qObj
          ? qObj.options[qObj.correctIndex]
          : w.options[w.correctIndex];
        if (prev) {
          prev.wrongCount += 1;
        } else {
          counts.set(w.questionId, {
            unitId: w.unitId,
            question: qObj ? qObj.question : w.question,
            correctAnswer,
            wrongCount: 1,
          });
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([questionId, data]) => ({ questionId, ...data }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, limit);
}
