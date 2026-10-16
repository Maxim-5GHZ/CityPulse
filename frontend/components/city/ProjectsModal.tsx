'use client';

import { ProjectSummary } from '@/lib/projectApi';
import { cadBtn, cadBtnActive } from './cadStyles';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  onSelectProject: (id: string) => void;
}

export default function ProjectsModal({
  isOpen,
  onClose,
  projects,
  onSelectProject,
}: ProjectsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141a26]/30 p-4 backdrop-blur-[2px] dark:bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/60 bg-white/70 p-5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_24px_60px_-12px_rgba(20,26,38,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/70"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Сохранённые проекты"
      >
        <h2 className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
          Сохранённые проекты в Postgres
        </h2>
        <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Проектов нет.</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-white/60 bg-white/50 p-2 pl-3 backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] dark:border-white/15 dark:bg-white/10"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {p.name}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectProject(p.id)}
                  className={cadBtnActive}
                >
                  Открыть
                </button>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={cadBtn}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
