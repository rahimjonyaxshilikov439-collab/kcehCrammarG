import type { Question } from '../../types';
import { UNIT_01_QUESTIONS } from './unit01';
import { UNIT_02_QUESTIONS } from './unit02';
import { UNIT_03_QUESTIONS } from './unit03';
import { UNIT_04_QUESTIONS } from './unit04';
import { UNIT_05_QUESTIONS } from './unit05';
import { UNIT_06_QUESTIONS } from './unit06';
import { UNIT_07_QUESTIONS } from './unit07';
import { UNIT_08_QUESTIONS } from './unit08';
import { UNIT_09_QUESTIONS } from './unit09';
import { UNIT_10_QUESTIONS } from './unit10';
import { UNIT_11_QUESTIONS } from './unit11';
import { UNIT_12_QUESTIONS } from './unit12';
import { UNIT_13_QUESTIONS } from './unit13';
import { UNIT_14_QUESTIONS } from './unit14';
import { UNIT_15_QUESTIONS } from './unit15';
import { UNIT_16_QUESTIONS } from './unit16';

export const QUESTIONS_BY_UNIT: Record<number, Question[]> = {
  1: UNIT_01_QUESTIONS,
  2: UNIT_02_QUESTIONS,
  3: UNIT_03_QUESTIONS,
  4: UNIT_04_QUESTIONS,
  5: UNIT_05_QUESTIONS,
  6: UNIT_06_QUESTIONS,
  7: UNIT_07_QUESTIONS,
  8: UNIT_08_QUESTIONS,
  9: UNIT_09_QUESTIONS,
  10: UNIT_10_QUESTIONS,
  11: UNIT_11_QUESTIONS,
  12: UNIT_12_QUESTIONS,
  13: UNIT_13_QUESTIONS,
  14: UNIT_14_QUESTIONS,
  15: UNIT_15_QUESTIONS,
  16: UNIT_16_QUESTIONS,
};

export const ALL_QUESTIONS: Question[] = Object.values(QUESTIONS_BY_UNIT).flat();

export const QUESTION_MAP: Map<string, Question> = new Map(
  ALL_QUESTIONS.map((q) => [q.id, q])
);

export function getQuestionsForUnit(unitId: number): Question[] {
  return QUESTIONS_BY_UNIT[unitId] ?? [];
}
