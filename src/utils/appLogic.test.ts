import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_CODES,
  findExistingStudent,
  formatDisplayName,
  isSurnameLikeWord,
  matchesSmartStudentSearch,
  normalizeUzbekText,
  swapNameOrder,
  validateStudentNameOrder,
} from './uzbekName';
import {
  buildMistakeBank,
  calculateCompletedUnitsCount,
  calculateLevelInfo,
  calculateStudentAveragePercentage,
  calculateStudentTotalScore,
  computeClassStats,
  computeTopHardestQuestions,
  getAttemptDelta,
  getNextRecommendedUnitId,
} from './scoring';
import {
  formatDurationUz,
  generateStudentsCsv,
  gradeShuffledQuiz,
  prepareShuffledQuiz,
} from './quizEngine';
import { UNITS } from '../data/units';
import { ALL_QUESTIONS, QUESTION_MAP, QUESTIONS_BY_UNIT } from '../data/questions';
import type { Student, TestAttempt } from '../types';

test('Class codes cover 5-01 through 10-03 (18 classes)', () => {
  assert.equal(CLASS_CODES.length, 18);
  assert.equal(CLASS_CODES[0], '5-01');
  assert.equal(CLASS_CODES[CLASS_CODES.length - 1], '10-03');
});

test('Uzbek apostrophe and whitespace normalization prevents duplicate profiles', () => {
  const variants = [
    "O'g'iloy Karimova",
    'o’g’iloy   karimova',
    'Oʻgʻiloy KARIMOVA',
    'oʼgʼiloy karimova',
    'o`g`iloy  karimova',
  ];
  const keys = variants.map(normalizeUzbekText);
  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], "o'g'iloy karimova");
  assert.equal(formatDisplayName('  aziza   KARIMOVA '), 'Aziza Karimova');
});

test('Surname-first detection blocks -ov/-ova/-ev/-eva/-yev/-yeva/-ovich/-ovna/-skiy/-skaya and reversed DB matches', () => {
  assert.equal(isSurnameLikeWord('Karimova'), true);
  assert.equal(isSurnameLikeWord('Alimov'), true);
  assert.equal(isSurnameLikeWord('Tursunovich'), true);
  assert.equal(isSurnameLikeWord('Belinskaya'), true);
  assert.equal(isSurnameLikeWord('Aziza'), false);

  const res1 = validateStudentNameOrder('Karimova Aziza', []);
  assert.equal(res1.isValid, false);
  assert.equal(res1.errorType, 'surname_first');
  assert.equal(res1.message, 'Avval ismingizni, keyin familiyangizni yozing');
  assert.equal(res1.suggestedFix, 'Aziza Karimova');
  assert.equal(swapNameOrder('Karimova Aziza'), 'Aziza Karimova');

  // Reversed word order matching an existing student without -ov/-ova suffix
  const existing = [{ normalizedName: normalizeUzbekText('Madina Rustam') }];
  const res2 = validateStudentNameOrder('Rustam Madina', existing);
  assert.equal(res2.isValid, false);
  assert.equal(res2.errorType, 'surname_first');
  assert.equal(res2.suggestedFix, 'Madina Rustam');

  // Valid order passes
  const res3 = validateStudentNameOrder('Aziza Karimova', existing);
  assert.equal(res3.isValid, true);
});

test('Existing student lookup and smart teacher search handle apostrophes and swapped names', () => {
  const student: Student = {
    id: 's1',
    fullName: "O'g'iloy G'afurova",
    normalizedName: normalizeUzbekText("O'g'iloy G'afurova"),
    classCode: '8-02',
    createdAt: '2026-01-01T10:00:00.000Z',
    lastLoginAt: '2026-01-01T10:00:00.000Z',
    attempts: [],
  };

  assert.equal(findExistingStudent('oʻgʻiloy   gʼafurova', [student])?.id, 's1');
  assert.equal(matchesSmartStudentSearch(student, 'G’afurova Oʻgʻiloy'), true);
  assert.equal(matchesSmartStudentSearch(student, '8-02'), true);
  assert.equal(matchesSmartStudentSearch(student, 'Aliyev'), false);
});

test('Scoring takes ONLY highest score per unit (anti-farming), computes delta, levels, and stats', () => {
  const a1: TestAttempt = {
    id: 'a1',
    studentId: 's1',
    unitId: 1,
    score: 200, // 20 correct
    correctCount: 20,
    totalQuestions: 30,
    percentage: 67,
    durationSeconds: 400,
    createdAt: '2026-01-01T10:00:00.000Z',
    wrongAnswers: [
      {
        questionId: 'u1-q1',
        unitId: 1,
        question: 'Q1',
        options: ['a', 'b', 'c', 'd'],
        selectedIndex: 1,
        correctIndex: 0,
        explanation: 'Exp 1',
      },
    ],
  };
  const a2: TestAttempt = {
    id: 'a2',
    studentId: 's1',
    unitId: 1,
    score: 260, // 26 correct (higher score on same unit)
    correctCount: 26,
    totalQuestions: 30,
    percentage: 87,
    durationSeconds: 350,
    createdAt: '2026-01-02T10:00:00.000Z',
    wrongAnswers: [],
  };
  const a3: TestAttempt = {
    id: 'a3',
    studentId: 's1',
    unitId: 2,
    score: 150,
    correctCount: 15,
    totalQuestions: 30,
    percentage: 50,
    durationSeconds: 500,
    createdAt: '2026-01-03T10:00:00.000Z',
    wrongAnswers: [
      {
        questionId: 'u2-q1',
        unitId: 2,
        question: 'Q2',
        options: ['a', 'b', 'c', 'd'],
        selectedIndex: 2,
        correctIndex: 0,
        explanation: 'Exp 2',
      },
    ],
  };

  const attempts = [a1, a2, a3];
  // Max(Unit 1) = 260 + Max(Unit 2) = 150 => 410 (NOT 200+260+150=610)
  assert.equal(calculateStudentTotalScore(attempts), 410);
  assert.equal(calculateCompletedUnitsCount(attempts), 2);
  assert.equal(calculateStudentAveragePercentage(attempts), Math.round((87 + 50) / 2));
  assert.equal(getAttemptDelta(a1, attempts), null);
  assert.equal(getAttemptDelta(a2, attempts), 20);
  assert.equal(getNextRecommendedUnitId(attempts, 16), 3);

  const lvl1 = calculateLevelInfo(410);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.nextLevelPoints, 1000);
  const lvl5 = calculateLevelInfo(4200);
  assert.equal(lvl5.level, 5);
  assert.equal(lvl5.nextLevelPoints, null);
  assert.equal(lvl5.progressPercent, 100);

  const mistakes = buildMistakeBank(attempts);
  assert.equal(mistakes.length, 2);

  const student: Student = {
    id: 's1',
    fullName: 'Aziza Karimova',
    normalizedName: 'aziza karimova',
    classCode: '7-01',
    createdAt: '2026-01-01T10:00:00.000Z',
    lastLoginAt: '2026-01-03T10:00:00.000Z',
    attempts,
  };
  const classStats = computeClassStats([student]);
  assert.equal(classStats.length, 1);
  assert.equal(classStats[0].classCode, '7-01');
  assert.equal(classStats[0].averageTotalScore, 410);

  const hardest = computeTopHardestQuestions([student], QUESTION_MAP, 5);
  assert.equal(hardest.length, 2);
});

test('Quiz engine shuffles questions & options while preserving exact grading mapping', () => {
  const unit1Qs = QUESTIONS_BY_UNIT[1];
  const shuffled = prepareShuffledQuiz(unit1Qs);
  assert.equal(shuffled.length, unit1Qs.length);

  // Answer every question with its shuffledCorrectIndex -> must score 100% (300 pts)
  const perfectAnswers: Record<string, number> = {};
  for (const sq of shuffled) {
    perfectAnswers[sq.originalId] = sq.shuffledCorrectIndex;
  }
  const perfectResult = gradeShuffledQuiz(shuffled, perfectAnswers, QUESTION_MAP);
  assert.equal(perfectResult.correctCount, unit1Qs.length);
  assert.equal(perfectResult.wrongCount, 0);
  assert.equal(perfectResult.score, unit1Qs.length * 10);
  assert.equal(perfectResult.percentage, 100);

  // Duration & CSV UTF-8 BOM
  assert.equal(formatDurationUz(65), '01:05');
  const csv = generateStudentsCsv([
    {
      id: 's1',
      fullName: 'Aziza Karimova',
      normalizedName: 'aziza karimova',
      classCode: '9-01',
      createdAt: '2026-01-01T10:00:00.000Z',
      lastLoginAt: '2026-01-01T10:00:00.000Z',
      attempts: [],
    },
  ]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv.includes('Aziza Karimova'), true);
});

test('Book content integrity: 16 units, >= 30 unique questions per unit, valid structure', () => {
  assert.equal(UNITS.length, 16);
  const seenIds = new Set<string>();
  const seenStems = new Set<string>();

  for (const unit of UNITS) {
    const qs = QUESTIONS_BY_UNIT[unit.id];
    assert.ok(Array.isArray(qs), `Unit ${unit.id} must have a question array`);
    assert.ok(qs.length >= 30, `Unit ${unit.id} must have at least 30 questions (found ${qs.length})`);

    for (const q of qs) {
      assert.equal(q.unitId, unit.id, `Question ${q.id} unitId mismatch`);
      assert.equal(seenIds.has(q.id), false, `Duplicate question id: ${q.id}`);
      seenIds.add(q.id);

      const normalizedStem = `${q.unitId}:${q.question.trim().toLowerCase()}`;
      assert.equal(seenStems.has(normalizedStem), false, `Duplicate stem in unit ${unit.id}: ${q.question}`);
      seenStems.add(normalizedStem);

      assert.equal(q.options.length, 4, `Question ${q.id} must have 4 options`);
      assert.equal(new Set(q.options.map((o) => o.trim())).size, 4, `Duplicate options in ${q.id}`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3, `Invalid correctIndex in ${q.id}`);
      assert.ok(q.explanation.trim().length > 10, `Missing explanation in ${q.id}`);
    }
  }

  assert.equal(ALL_QUESTIONS.length >= 480, true);
});
