import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type { DatabaseState, Student, TestAttempt } from './src/types/index.ts';
import {
  findExistingStudent,
  formatDisplayName,
  normalizeUzbekText,
  validateStudentNameOrder,
} from './src/utils/uzbekName.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB: DatabaseState = {
  students: [],
  settings: {
    timerMinutes: 15,
    teacherPassword: process.env.TEACHER_DEFAULT_PASSWORD || 'Jalolova@2026',
    cheaterUnlockCode: process.env.CHEATER_UNLOCK_CODE || '2026Al1209.9',
  },
};

function ensureDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return structuredClone(DEFAULT_DB);
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      settings: {
        timerMinutes:
          typeof parsed.settings?.timerMinutes === 'number' &&
          parsed.settings.timerMinutes >= 1 &&
          parsed.settings.timerMinutes <= 120
            ? parsed.settings.timerMinutes
            : DEFAULT_DB.settings.timerMinutes,
        teacherPassword:
          typeof parsed.settings?.teacherPassword === 'string' &&
          parsed.settings.teacherPassword.length > 0
            ? parsed.settings.teacherPassword
            : DEFAULT_DB.settings.teacherPassword,
        cheaterUnlockCode:
          typeof parsed.settings?.cheaterUnlockCode === 'string' &&
          parsed.settings.cheaterUnlockCode.length > 0
            ? parsed.settings.cheaterUnlockCode
            : DEFAULT_DB.settings.cheaterUnlockCode,
      },
    };
  } catch {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return structuredClone(DEFAULT_DB);
  }
}

function saveDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/bootstrap', (_req, res) => {
    const db = ensureDb();
    res.json({
      students: db.students,
      settings: {
        timerMinutes: db.settings.timerMinutes,
      },
    });
  });

  app.post('/api/students/login', (req, res) => {
    const { fullName, classCode } = req.body ?? {};
    if (typeof fullName !== 'string' || typeof classCode !== 'string') {
      res.status(400).json({ error: 'Ism-familiya va sinf kiritilishi shart.' });
      return;
    }

    const db = ensureDb();
    const validation = validateStudentNameOrder(fullName, db.students);
    if (!validation.isValid) {
      res.status(400).json({
        error: validation.message,
        errorType: validation.errorType,
        suggestedFix: validation.suggestedFix,
      });
      return;
    }

    const now = new Date().toISOString();
    const existing = findExistingStudent(fullName, db.students);
    if (existing) {
      existing.lastLoginAt = now;
      existing.classCode = classCode as Student['classCode'];
      saveDb(db);
      res.json({ student: existing, isReturning: true });
      return;
    }

    const newStudent: Student = {
      id: `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fullName: formatDisplayName(fullName),
      normalizedName: normalizeUzbekText(fullName),
      classCode: classCode as Student['classCode'],
      createdAt: now,
      lastLoginAt: now,
      attempts: [],
    };
    db.students.push(newStudent);
    saveDb(db);
    res.json({ student: newStudent, isReturning: false });
  });

  app.post('/api/attempts', (req, res) => {
    const { studentId, attempt } = req.body ?? {};
    if (typeof studentId !== 'string' || !attempt || typeof attempt !== 'object') {
      res.status(400).json({ error: 'Notoʻgʻri urinish maʼlumoti.' });
      return;
    }

    const db = ensureDb();
    const student = db.students.find((s) => s.id === studentId);
    if (!student) {
      res.status(404).json({ error: 'Oʻquvchi topilmadi.' });
      return;
    }

    const typedAttempt = attempt as TestAttempt;
    if (!student.attempts.some((a) => a.id === typedAttempt.id)) {
      student.attempts.push(typedAttempt);
    }
    student.lastLoginAt = new Date().toISOString();
    saveDb(db);
    res.json({ student });
  });

  app.delete('/api/students/:id', (req, res) => {
    const password = req.headers['x-teacher-password'] ?? req.body?.password;
    const db = ensureDb();
    if (password !== db.settings.teacherPassword) {
      res.status(403).json({ error: 'Oʻqituvchi paroli notoʻgʻri.' });
      return;
    }
    const before = db.students.length;
    db.students = db.students.filter((s) => s.id !== req.params.id);
    if (db.students.length === before) {
      res.status(404).json({ error: 'Oʻquvchi topilmadi.' });
      return;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  app.post('/api/teacher/login', (req, res) => {
    const { password } = req.body ?? {};
    const db = ensureDb();
    const ok = typeof password === 'string' && password === db.settings.teacherPassword;
    if (!ok) {
      res.status(401).json({ ok: false, error: 'Parol notoʻgʻri.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/cheater/verify', (req, res) => {
    const { code } = req.body ?? {};
    const db = ensureDb();
    const ok =
      typeof code === 'string' &&
      code.trim() === db.settings.cheaterUnlockCode;
    res.json({ ok });
  });

  app.put('/api/settings/timer', (req, res) => {
    const { password, timerMinutes } = req.body ?? {};
    const db = ensureDb();
    if (password !== db.settings.teacherPassword) {
      res.status(403).json({ error: 'Oʻqituvchi paroli notoʻgʻri.' });
      return;
    }
    const parsed = Number(timerMinutes);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
      res.status(400).json({ error: 'Taymer 1 dan 120 daqiqagacha boʻlishi kerak.' });
      return;
    }
    db.settings.timerMinutes = Math.round(parsed);
    saveDb(db);
    res.json({ timerMinutes: db.settings.timerMinutes });
  });

  app.put('/api/settings/password', (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const db = ensureDb();
    if (currentPassword !== db.settings.teacherPassword) {
      res.status(403).json({ error: 'Joriy parol notoʻgʻri.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      res.status(400).json({ error: 'Yangi parol kamida 4 ta belgidan iborat boʻlishi kerak.' });
      return;
    }
    db.settings.teacherPassword = newPassword.trim();
    saveDb(db);
    res.json({ ok: true });
  });

  app.put('/api/settings/cheater-code', (req, res) => {
    const { password, newCode } = req.body ?? {};
    const db = ensureDb();
    if (password !== db.settings.teacherPassword) {
      res.status(403).json({ error: 'Oʻqituvchi paroli notoʻgʻri.' });
      return;
    }
    if (typeof newCode !== 'string' || newCode.trim().length < 4) {
      res.status(400).json({ error: 'Cheater kodi kamida 4 ta belgidan iborat boʻlishi kerak.' });
      return;
    }
    db.settings.cheaterUnlockCode = newCode.trim();
    saveDb(db);
    res.json({ ok: true });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GrammarCheck server running on http://localhost:${PORT}`);
  });
}

startServer();
