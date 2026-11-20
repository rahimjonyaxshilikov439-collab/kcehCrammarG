import type {
  ClassCode,
  DatabaseState,
  Student,
  TestAttempt,
} from '../types';
import {
  findExistingStudent,
  formatDisplayName,
  normalizeUzbekText,
  validateStudentNameOrder,
} from '../utils/uzbekName';

const DB_STORAGE_KEY = 'grammarcheck_db_v1';
const CURRENT_STUDENT_KEY = 'grammarcheck_current_student_id';
const THEME_KEY = 'grammarcheck_theme';
const CHEATER_LOCK_KEY = 'grammarcheck_cheater_lock';

const DEFAULT_TIMER_MINUTES = 15;
const DEFAULT_TEACHER_PASSWORD = 'Jalolova@2026';
const DEFAULT_CHEATER_CODE = '2026Al1209.9';

export interface CheaterLockState {
  locked: boolean;
  studentId: string;
  unitId: number;
  lockedAt: string;
}

export interface BootstrapResult {
  students: Student[];
  timerMinutes: number;
  mode: 'server' | 'local';
}

export interface StudentLoginResult {
  ok: boolean;
  student?: Student;
  isReturning?: boolean;
  error?: string;
  errorType?: 'incomplete' | 'surname_first';
  suggestedFix?: string;
}

function readLocalDb(): DatabaseState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const initial: DatabaseState = {
        students: [],
        settings: {
          timerMinutes: DEFAULT_TIMER_MINUTES,
          teacherPassword: DEFAULT_TEACHER_PASSWORD,
          cheaterUnlockCode: DEFAULT_CHEATER_CODE,
        },
      };
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      settings: {
        timerMinutes:
          typeof parsed.settings?.timerMinutes === 'number' &&
          parsed.settings.timerMinutes >= 1 &&
          parsed.settings.timerMinutes <= 120
            ? parsed.settings.timerMinutes
            : DEFAULT_TIMER_MINUTES,
        teacherPassword:
          typeof parsed.settings?.teacherPassword === 'string' &&
          parsed.settings.teacherPassword.length > 0
            ? parsed.settings.teacherPassword
            : DEFAULT_TEACHER_PASSWORD,
        cheaterUnlockCode:
          typeof parsed.settings?.cheaterUnlockCode === 'string' &&
          parsed.settings.cheaterUnlockCode.length > 0
            ? parsed.settings.cheaterUnlockCode
            : DEFAULT_CHEATER_CODE,
      },
    };
  } catch {
    return {
      students: [],
      settings: {
        timerMinutes: DEFAULT_TIMER_MINUTES,
        teacherPassword: DEFAULT_TEACHER_PASSWORD,
        cheaterUnlockCode: DEFAULT_CHEATER_CODE,
      },
    };
  }
}

function writeLocalDb(db: DatabaseState): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota errors cleanly
  }
}

async function fetchApiJson<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; networkUnavailable?: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Static Netlify hosting returns index.html on /api/* redirect
      return { ok: false, status: response.status, networkUnavailable: true };
    }
    const data = (await response.json()) as T;
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, networkUnavailable: true };
  }
}

export async function bootstrapData(): Promise<BootstrapResult> {
  const res = await fetchApiJson<{
    students: Student[];
    settings: { timerMinutes: number };
  }>('/api/bootstrap');

  if (res.ok && res.data) {
    // Keep a local mirror of students + timer for seamless resilience
    const local = readLocalDb();
    writeLocalDb({
      students: res.data.students,
      settings: {
        ...local.settings,
        timerMinutes: res.data.settings.timerMinutes,
      },
    });
    return {
      students: res.data.students,
      timerMinutes: res.data.settings.timerMinutes,
      mode: 'server',
    };
  }

  const local = readLocalDb();
  return {
    students: local.students,
    timerMinutes: local.settings.timerMinutes,
    mode: 'local',
  };
}

export async function loginStudent(
  fullName: string,
  classCode: ClassCode
): Promise<StudentLoginResult> {
  const res = await fetchApiJson<{
    student?: Student;
    isReturning?: boolean;
    error?: string;
    errorType?: 'incomplete' | 'surname_first';
    suggestedFix?: string;
  }>('/api/students/login', {
    method: 'POST',
    body: JSON.stringify({ fullName, classCode }),
  });

  if (!res.networkUnavailable) {
    if (res.ok && res.data?.student) {
      const local = readLocalDb();
      const idx = local.students.findIndex((s) => s.id === res.data!.student!.id);
      if (idx >= 0) {
        local.students[idx] = res.data.student;
      } else {
        local.students.push(res.data.student);
      }
      writeLocalDb(local);
      saveCurrentStudentId(res.data.student.id);
      return {
        ok: true,
        student: res.data.student,
        isReturning: Boolean(res.data.isReturning),
      };
    }
    return {
      ok: false,
      error: res.data?.error || 'Kirishda xatolik yuz berdi.',
      errorType: res.data?.errorType,
      suggestedFix: res.data?.suggestedFix,
    };
  }

  // Automatic localStorage fallback (Netlify static mode)
  const local = readLocalDb();
  const validation = validateStudentNameOrder(fullName, local.students);
  if (!validation.isValid) {
    return {
      ok: false,
      error: validation.message,
      errorType: validation.errorType,
      suggestedFix: validation.suggestedFix,
    };
  }

  const now = new Date().toISOString();
  const existing = findExistingStudent(fullName, local.students);
  if (existing) {
    existing.lastLoginAt = now;
    existing.classCode = classCode;
    writeLocalDb(local);
    saveCurrentStudentId(existing.id);
    return { ok: true, student: existing, isReturning: true };
  }

  const created: Student = {
    id: `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fullName: formatDisplayName(fullName),
    normalizedName: normalizeUzbekText(fullName),
    classCode,
    createdAt: now,
    lastLoginAt: now,
    attempts: [],
  };
  local.students.push(created);
  writeLocalDb(local);
  saveCurrentStudentId(created.id);
  return { ok: true, student: created, isReturning: false };
}

export async function submitTestAttempt(
  studentId: string,
  attempt: TestAttempt
): Promise<Student | null> {
  const res = await fetchApiJson<{ student: Student }>('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ studentId, attempt }),
  });

  if (res.ok && res.data?.student) {
    const local = readLocalDb();
    const idx = local.students.findIndex((s) => s.id === studentId);
    if (idx >= 0) {
      local.students[idx] = res.data.student;
    } else {
      local.students.push(res.data.student);
    }
    writeLocalDb(local);
    return res.data.student;
  }

  const local = readLocalDb();
  const student = local.students.find((s) => s.id === studentId);
  if (!student) return null;
  if (!student.attempts.some((a) => a.id === attempt.id)) {
    student.attempts.push(attempt);
  }
  student.lastLoginAt = new Date().toISOString();
  writeLocalDb(local);
  return student;
}

export async function verifyTeacherPassword(password: string): Promise<boolean> {
  const res = await fetchApiJson<{ ok: boolean }>('/api/teacher/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (!res.networkUnavailable) {
    return Boolean(res.ok && res.data?.ok);
  }
  const local = readLocalDb();
  return password === local.settings.teacherPassword;
}

export async function verifyCheaterUnlockCode(code: string): Promise<boolean> {
  const res = await fetchApiJson<{ ok: boolean }>('/api/cheater/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (!res.networkUnavailable) {
    return Boolean(res.ok && res.data?.ok);
  }
  const local = readLocalDb();
  return code.trim() === local.settings.cheaterUnlockCode;
}

export async function deleteStudentRecord(
  studentId: string,
  teacherPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetchApiJson<{ ok?: boolean; error?: string }>(
    `/api/students/${encodeURIComponent(studentId)}`,
    {
      method: 'DELETE',
      headers: { 'x-teacher-password': teacherPassword },
      body: JSON.stringify({ password: teacherPassword }),
    }
  );
  if (!res.networkUnavailable) {
    if (res.ok) {
      const local = readLocalDb();
      local.students = local.students.filter((s) => s.id !== studentId);
      writeLocalDb(local);
      return { ok: true };
    }
    return { ok: false, error: res.data?.error || 'Oʻchirib boʻlmadi.' };
  }

  const local = readLocalDb();
  if (teacherPassword !== local.settings.teacherPassword) {
    return { ok: false, error: 'Oʻqituvchi paroli notoʻgʻri.' };
  }
  local.students = local.students.filter((s) => s.id !== studentId);
  writeLocalDb(local);
  return { ok: true };
}

export async function updateTimerSetting(
  teacherPassword: string,
  timerMinutes: number
): Promise<{ ok: boolean; timerMinutes?: number; error?: string }> {
  const res = await fetchApiJson<{ timerMinutes?: number; error?: string }>(
    '/api/settings/timer',
    {
      method: 'PUT',
      body: JSON.stringify({ password: teacherPassword, timerMinutes }),
    }
  );
  if (!res.networkUnavailable) {
    if (res.ok && typeof res.data?.timerMinutes === 'number') {
      const local = readLocalDb();
      local.settings.timerMinutes = res.data.timerMinutes;
      writeLocalDb(local);
      return { ok: true, timerMinutes: res.data.timerMinutes };
    }
    return { ok: false, error: res.data?.error || 'Taymerni saqlab boʻlmadi.' };
  }

  const local = readLocalDb();
  if (teacherPassword !== local.settings.teacherPassword) {
    return { ok: false, error: 'Oʻqituvchi paroli notoʻgʻri.' };
  }
  const safeMin = Math.min(120, Math.max(1, Math.round(timerMinutes)));
  local.settings.timerMinutes = safeMin;
  writeLocalDb(local);
  return { ok: true, timerMinutes: safeMin };
}

export async function updateTeacherPasswordSetting(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetchApiJson<{ ok?: boolean; error?: string }>(
    '/api/settings/password',
    {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }
  );
  if (!res.networkUnavailable) {
    if (res.ok) {
      const local = readLocalDb();
      local.settings.teacherPassword = newPassword.trim();
      writeLocalDb(local);
      return { ok: true };
    }
    return { ok: false, error: res.data?.error || 'Parolni yangilab boʻlmadi.' };
  }

  const local = readLocalDb();
  if (currentPassword !== local.settings.teacherPassword) {
    return { ok: false, error: 'Joriy parol notoʻgʻri.' };
  }
  if (newPassword.trim().length < 4) {
    return { ok: false, error: 'Yangi parol kamida 4 ta belgidan iborat boʻlishi kerak.' };
  }
  local.settings.teacherPassword = newPassword.trim();
  writeLocalDb(local);
  return { ok: true };
}

export async function updateCheaterCodeSetting(
  teacherPassword: string,
  newCode: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetchApiJson<{ ok?: boolean; error?: string }>(
    '/api/settings/cheater-code',
    {
      method: 'PUT',
      body: JSON.stringify({ password: teacherPassword, newCode }),
    }
  );
  if (!res.networkUnavailable) {
    if (res.ok) {
      const local = readLocalDb();
      local.settings.cheaterUnlockCode = newCode.trim();
      writeLocalDb(local);
      return { ok: true };
    }
    return { ok: false, error: res.data?.error || 'Kodni yangilab boʻlmadi.' };
  }

  const local = readLocalDb();
  if (teacherPassword !== local.settings.teacherPassword) {
    return { ok: false, error: 'Oʻqituvchi paroli notoʻgʻri.' };
  }
  if (newCode.trim().length < 4) {
    return { ok: false, error: 'Cheater kodi kamida 4 ta belgidan iborat boʻlishi kerak.' };
  }
  local.settings.cheaterUnlockCode = newCode.trim();
  writeLocalDb(local);
  return { ok: true };
}

export function getSavedStudentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_STUDENT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentStudentId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(CURRENT_STUDENT_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_STUDENT_KEY);
    }
  } catch {
    // Ignore
  }
}

export function getSavedTheme(): 'light' | 'dark' {
  try {
    const val = localStorage.getItem(THEME_KEY);
    return val === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function getCheaterLock(): CheaterLockState | null {
  try {
    const raw = localStorage.getItem(CHEATER_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheaterLockState;
    return parsed?.locked ? parsed : null;
  } catch {
    return null;
  }
}

export function setCheaterLock(lock: CheaterLockState | null): void {
  try {
    if (lock && lock.locked) {
      localStorage.setItem(CHEATER_LOCK_KEY, JSON.stringify(lock));
    } else {
      localStorage.removeItem(CHEATER_LOCK_KEY);
    }
  } catch {
    // Ignore
  }
}
