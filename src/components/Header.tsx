import { BookOpen, LogOut, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import type { AppView, Student } from '../types';

interface HeaderProps {
  currentView: AppView;
  student: Student | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (view: AppView) => void;
  onLogoutStudent: () => void;
  onOpenTeacherModal: () => void;
}

export function Header({
  currentView,
  student,
  theme,
  onToggleTheme,
  onNavigate,
  onLogoutStudent,
  onOpenTeacherModal,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate(student ? 'units' : 'login')}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs group-hover:bg-sky-700 transition-colors">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              GrammarCheck
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
              Grammarway 3 · Intermediate
            </span>
          </span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Asosiy navigatsiya" className="flex items-center gap-1 sm:gap-2">
          {student && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('units')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'units'
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                Unitlar
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'profile'
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <User className="h-4 w-4 hidden sm:inline" />
                <span>Shaxsiy profil</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (currentView === 'teacher') return;
              onOpenTeacherModal();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              currentView === 'teacher'
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70'
            }`}
          >
            <ShieldCheck className="h-4 w-4 hidden sm:inline" />
            <span>Oʻqituvchi</span>
          </button>
        </nav>

        {/* Zone 3: Theme toggle + active student exit */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Kunduzgi rejimga oʻtish' : 'Tun rejimiga oʻtish'}
            title={theme === 'dark' ? 'Kunduzgi rejim' : 'Tun rejimi'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {student && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <span className="hidden md:flex flex-col text-right leading-tight">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                  {student.fullName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {student.classCode}-sinf
                </span>
              </span>
              <button
                type="button"
                onClick={onLogoutStudent}
                title="Boshqa oʻquvchi sifatida kirish"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Chiqish</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
