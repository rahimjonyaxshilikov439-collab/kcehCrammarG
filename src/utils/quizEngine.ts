import type {
  Question,
  ShuffledQuestion,
  Student,
  TestAttempt,
  WrongAnswerDetail,
} from '../types';
import {
  calculateCompletedUnitsCount,
  calculateStudentAveragePercentage,
  calculateStudentTotalScore,
  POINTS_PER_CORRECT,
} from './scoring';

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles both the question order AND the A/B/C/D options of every question
 * while maintaining exact mapping back to the original question & correct answer.
 */
export function prepareShuffledQuiz(
  questions: readonly Question[],
  rng: () => number = Math.random
): ShuffledQuestion[] {
  const shuffledQs = shuffleArray(questions, rng);
  return shuffledQs.map((q) => {
    const indices = shuffleArray([0, 1, 2, 3] as const, rng) as [number, number, number, number];
    const shuffledOptions = [
      q.options[indices[0]],
      q.options[indices[1]],
      q.options[indices[2]],
      q.options[indices[3]],
    ] as [string, string, string, string];
    const shuffledCorrectIndex = indices.indexOf(q.correctIndex) as 0 | 1 | 2 | 3;

    return {
      originalId: q.id,
      unitId: q.unitId,
      question: q.question,
      shuffledOptions,
      shuffledCorrectIndex,
      optionOrder: indices,
      explanation: q.explanation,
    };
  });
}

export interface GradedQuizResult {
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
  score: number;
  percentage: number;
  wrongAnswers: WrongAnswerDetail[];
}

export function gradeShuffledQuiz(
  shuffledQuestions: readonly ShuffledQuestion[],
  selectedShuffledIndices: Record<string, number | null>,
  originalQuestionsMap: Map<string, Question>
): GradedQuizResult {
  let correctCount = 0;
  const wrongAnswers: WrongAnswerDetail[] = [];

  for (const sq of shuffledQuestions) {
    const chosenShuffledIdx = selectedShuffledIndices[sq.originalId] ?? null;
    if (chosenShuffledIdx === sq.shuffledCorrectIndex) {
      correctCount += 1;
    } else {
      const origQ = originalQuestionsMap.get(sq.originalId);
      const originalSelectedIndex =
        chosenShuffledIdx !== null && chosenShuffledIdx >= 0 && chosenShuffledIdx <= 3
          ? sq.optionOrder[chosenShuffledIdx]
          : null;

      wrongAnswers.push({
        questionId: sq.originalId,
        unitId: sq.unitId,
        question: origQ ? origQ.question : sq.question,
        options: origQ ? origQ.options : sq.shuffledOptions,
        selectedIndex: originalSelectedIndex,
        correctIndex: origQ ? origQ.correctIndex : (sq.optionOrder[sq.shuffledCorrectIndex] as 0 | 1 | 2 | 3),
        explanation: sq.explanation,
      });
    }
  }

  const totalQuestions = shuffledQuestions.length;
  const wrongCount = totalQuestions - correctCount;
  const score = correctCount * POINTS_PER_CORRECT;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    correctCount,
    wrongCount,
    totalQuestions,
    score,
    percentage,
    wrongAnswers,
  };
}

export function formatDurationUz(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function generateStudentsCsv(students: Student[], unitFilter?: number | 'all'): string {
  const header = [
    'Oʻquvchi',
    'Sinf',
    'Umumiy ball',
    'Bajarilgan unitlar',
    'Oʻrtacha foiz',
    'Urinishlar soni',
    'Oxirgi faollik',
  ];

  const rows = students.map((s) => {
    const relevantAttempts =
      unitFilter && unitFilter !== 'all'
        ? s.attempts.filter((a) => a.unitId === unitFilter)
        : s.attempts;
    const totalScore = calculateStudentTotalScore(relevantAttempts);
    const completed = calculateCompletedUnitsCount(relevantAttempts);
    const avgPct = calculateStudentAveragePercentage(relevantAttempts);
    const lastActive = s.lastLoginAt
      ? new Date(s.lastLoginAt).toLocaleString('uz-UZ')
      : '-';

    return [
      s.fullName,
      s.classCode,
      String(totalScore),
      String(completed),
      `${avgPct}%`,
      String(relevantAttempts.length),
      lastActive,
    ];
  });

  const escapeCell = (val: string) => {
    const str = val.replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates a crisp high-DPI PNG data URL of the student's test result card
 * directly via HTML5 Canvas, avoiding DOM cloning issues across themes.
 */
export function renderResultCardPng(params: {
  studentName: string;
  classCode: string;
  unitNumber: number;
  unitTitle: string;
  attempt: TestAttempt;
  totalScore: number;
  deltaPercent: number | null;
}): string {
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 540;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Subtle geometric accent bar at top
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, width, 10);

  // Outer card frame
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  // Brand header
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('GrammarCheck  ·  Grammarway 3 (Intermediate)', 64, 82);

  // Student info
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(params.studentName, 64, 136);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Sinf: ${params.classCode}   ·   Unit ${params.unitNumber}: ${params.unitTitle}`, 64, 174);

  // Divider
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 204);
  ctx.lineTo(width - 64, 204);
  ctx.stroke();

  // Primary Percentage Box
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(64, 232, 260, 180);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 232, 260, 180);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText('NATIJA FOIZI', 92, 274);

  ctx.fillStyle = params.attempt.percentage >= 70 ? '#34d399' : params.attempt.percentage >= 50 ? '#fbbf24' : '#f87171';
  ctx.font = 'bold 68px sans-serif';
  ctx.fillText(`${params.attempt.percentage}%`, 92, 355);

  if (params.deltaPercent !== null) {
    const sign = params.deltaPercent > 0 ? '+' : '';
    ctx.fillStyle = params.deltaPercent >= 0 ? '#34d399' : '#f87171';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Avvalgi urinishga nisbatan: ${sign}${params.deltaPercent}%`, 92, 392);
  }

  // Stats grid on right
  const stats = [
    { label: 'TOʻGʻRI JAVOBLAR', value: `${params.attempt.correctCount} / ${params.attempt.totalQuestions}` },
    { label: 'USHBU TEST BALI', value: `+${params.attempt.score} ball` },
    { label: 'UMUMIY BALL', value: `${params.totalScore} ball` },
    { label: 'SARFLANGAN VAQT', value: formatDurationUz(params.attempt.durationSeconds) },
  ];

  stats.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 356 + col * 276;
    const y = 232 + row * 98;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, 256, 82);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText(item.label, x + 20, y + 30);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(item.value, x + 20, y + 64);
  });

  // Footer timestamp
  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  const dateStr = new Date(params.attempt.createdAt).toLocaleString('uz-UZ');
  ctx.fillText(`Sana: ${dateStr}`, 64, 466);

  return canvas.toDataURL('image/png');
}
