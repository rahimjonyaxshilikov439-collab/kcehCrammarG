import type { ClassCode, Student } from '../types/index.ts';

export const CLASS_CODES: ClassCode[] = [
  '5-01', '5-02', '5-03',
  '6-01', '6-02', '6-03',
  '7-01', '7-02', '7-03',
  '8-01', '8-02', '8-03',
  '9-01', '9-02', '9-03',
  '10-01', '10-02', '10-03',
];

const APOSTROPHE_REGEX = /[\u0027\u2018\u2019\u0060\u02BB\u02BC\u02BD\u02C8\uFF07]/g;

const SURNAME_SUFFIXES = [
  'ovich',
  'ovna',
  'yeva',
  'yev',
  'skaya',
  'skiy',
  'ova',
  'eva',
  'ov',
  'ev',
];

/**
 * Normalizes Uzbek apostrophes, collapses whitespace, and lowercases text
 * so "Oʻgʻiloy   Karimova" and "o'g'iloy karimova" produce the exact same key.
 */
export function normalizeUzbekText(input: string): string {
  return input
    .trim()
    .replace(APOSTROPHE_REGEX, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Formats a display name cleanly, capitalizing the first letter of each word
 * while preserving Uzbek apostrophes like O'g'iloy or G'afurov.
 */
export function formatDisplayName(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function isSurnameLikeWord(word: string): boolean {
  const normalized = normalizeUzbekText(word).replace(/[^a-z']/g, '');
  if (normalized.length < 4) return false;
  return SURNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function swapNameOrder(input: string): string {
  const words = input.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length < 2) return formatDisplayName(input);
  const reordered = [...words.slice(1), words[0]];
  return formatDisplayName(reordered.join(' '));
}

export interface NameValidationResult {
  isValid: boolean;
  errorType?: 'incomplete' | 'surname_first';
  message?: string;
  suggestedFix?: string;
}

/**
 * Validates that a student enters Firstname Lastname (not Lastname Firstname).
 * Blocks login if:
 * 1) The first word ends with a known surname suffix (-ov, -ova, -ev, -eva, -yev, -yeva, -ovich, -ovna, -skiy, -skaya)
 * 2) OR the reversed word order matches an existing student in the database.
 */
export function validateStudentNameOrder(
  rawInput: string,
  existingStudents: Pick<Student, 'normalizedName'>[] = []
): NameValidationResult {
  const cleaned = rawInput.trim().replace(/\s+/g, ' ');
  const words = cleaned.split(' ').filter(Boolean);

  if (words.length < 2) {
    return {
      isValid: false,
      errorType: 'incomplete',
      message: 'Iltimos, ism va familiyangizni toʻliq kiriting (kamida ikki soʻz).',
    };
  }

  const firstWord = words[0];
  const reversedNormalized = normalizeUzbekText([...words.slice(1), firstWord].join(' '));
  const directNormalized = normalizeUzbekText(cleaned);

  const matchesReversedExisting =
    reversedNormalized !== directNormalized &&
    existingStudents.some((s) => s.normalizedName === reversedNormalized);

  if (isSurnameLikeWord(firstWord) || matchesReversedExisting) {
    const suggestedFix = swapNameOrder(cleaned);
    return {
      isValid: false,
      errorType: 'surname_first',
      message: 'Avval ismingizni, keyin familiyangizni yozing',
      suggestedFix,
    };
  }

  return { isValid: true };
}

/**
 * Finds an existing student matching the normalized name (case & apostrophe insensitive).
 */
export function findExistingStudent(
  rawName: string,
  students: Student[]
): Student | undefined {
  const target = normalizeUzbekText(rawName);
  if (!target) return undefined;
  return students.find((s) => s.normalizedName === target);
}

/**
 * Smart search matcher for the Teacher Panel:
 * matches regardless of Uzbek apostrophe variants, casing, extra spaces,
 * or swapped "Familiya Ism" order.
 */
export function matchesSmartStudentSearch(student: Student, rawQuery: string): boolean {
  const query = normalizeUzbekText(rawQuery);
  if (!query) return true;

  const studentNorm = student.normalizedName;
  if (studentNorm.includes(query)) return true;
  if (student.classCode.toLowerCase().includes(query)) return true;

  const queryWords = query.split(' ').filter(Boolean);
  if (queryWords.length >= 2) {
    const reversedQuery = [...queryWords.slice(1), queryWords[0]].join(' ');
    if (studentNorm.includes(reversedQuery)) return true;
    const studentWords = studentNorm.split(' ');
    if (queryWords.every((qw) => studentWords.some((sw) => sw.includes(qw)))) {
      return true;
    }
  }

  return false;
}
