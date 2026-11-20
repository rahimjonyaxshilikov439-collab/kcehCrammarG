import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, BookOpenCheck, CheckCircle2, GraduationCap, Shield } from 'lucide-react';
import type { ClassCode, Student } from '../types';
import { CLASS_CODES, validateStudentNameOrder } from '../utils/uzbekName';

interface LoginViewProps {
  existingStudents: Pick<Student, 'normalizedName'>[];
  onStudentSubmit: (fullName: string, classCode: ClassCode) => Promise<{
    ok: boolean;
    error?: string;
    suggestedFix?: string;
  }>;
  onOpenTeacherModal: () => void;
}

const GRADES = ['5', '6', '7', '8', '9', '10'] as const;

export function LoginView({
  existingStudents,
  onStudentSubmit,
  onOpenTeacherModal,
}: LoginViewProps) {
  const [classCode, setClassCode] = useState<ClassCode>('8-01');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestedFix, setSuggestedFix] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setFullName(val);
    if (errorMsg) {
      const check = validateStudentNameOrder(val, existingStudents);
      if (check.isValid) {
        setErrorMsg(null);
        setSuggestedFix(null);
      } else if (check.errorType === 'surname_first') {
        setErrorMsg(check.message ?? null);
        setSuggestedFix(check.suggestedFix ?? null);
      }
    }
  };

  const handleApplyFix = () => {
    if (!suggestedFix) return;
    setFullName(suggestedFix);
    setErrorMsg(null);
    setSuggestedFix(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const localValidation = validateStudentNameOrder(fullName, existingStudents);
    if (!localValidation.isValid) {
      setErrorMsg(localValidation.message ?? 'Ism-familiyani toʻgʻri kiriting.');
      setSuggestedFix(localValidation.suggestedFix ?? null);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuggestedFix(null);
    try {
      const result = await onStudentSubmit(fullName, classCode);
      if (!result.ok) {
        setErrorMsg(result.error ?? 'Kirishda xatolik yuz berdi.');
        setSuggestedFix(result.suggestedFix ?? null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left column: Concise book & platform overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            <BookOpenCheck className="h-4 w-4" />
            <span>Grammarway 3 · Intermediate</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            Ingliz tili grammatikasidan interaktiv unit testlari
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Jenny Dooley va Virginia Evansning <strong className="font-semibold text-slate-900 dark:text-slate-100">Grammarway 3</strong> darsligidagi barcha 16 ta unit boʻyicha tuzilgan 480 ta takrorlanmas test savoli, batafsil oʻzbekcha tahlillar va shaxsiy oʻsish profili.
          </p>

          <dl className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Boʻlimlar</dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                16 Unit
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Savollar</dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                480+
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Sinflar</dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                5–10
              </dd>
            </div>
          </dl>

          <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Har bir unit uchun kamida 30 ta alohida savol va oʻzbekcha qoida izohi</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Shaxsiy profil, 5 bosqichli daraja tizimi va Xatolar banki mashqi</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Avtomatik natija saqlash — avval kirgan boʻlsangiz, profilingiz darhol ochiladi</span>
            </li>
          </ul>
        </div>

        {/* Right column: Student Entry Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  Oʻquvchi maʼlumotlari
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sinfingizni tanlang va avval ismingiz, keyin familiyangizni yozing
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="class-select"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Sinf va guruh
                </label>
                <select
                  id="class-select"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value as ClassCode)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {GRADES.map((grade) => (
                    <optgroup key={grade} label={`${grade}-sinf`}>
                      {CLASS_CODES.filter((c) => c.startsWith(`${grade}-`)).map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="student-fullname"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Ism va familiya
                </label>
                <input
                  id="student-fullname"
                  type="text"
                  autoComplete="name"
                  placeholder="Masalan: Aziza Karimova"
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    errorMsg
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 focus:ring-sky-500/20'
                  }`}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Tartib: <span className="font-medium text-slate-700 dark:text-slate-300">Ism Familiya</span> (masalan, Oʻgʻiloy Rustamova)
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-sm text-rose-800 dark:text-rose-200 space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span className="font-medium">{errorMsg}</span>
                  </div>
                  {suggestedFix && (
                    <button
                      type="button"
                      onClick={handleApplyFix}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
                    >
                      <span>«{suggestedFix}» deb toʻgʻrilash</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors"
              >
                <span>{submitting ? 'Tekshirilmoqda...' : 'Davom etish'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Oʻqituvchi boshqaruvi va hisobotlar
              </span>
              <button
                type="button"
                onClick={onOpenTeacherModal}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Oʻqituvchi paneli</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
