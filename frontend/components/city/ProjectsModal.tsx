'use client';

import { X } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Сохранённые проекты"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black tracking-tight uppercase text-zinc-100">
            Сохранённые проекты в Postgres
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto max-h-60">
          {projects.length === 0 ? (
            <p className="text-xs font-medium text-zinc-500">Проектов нет.</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 p-2 pl-3 transition-colors border rounded-xl border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10"
              >
                <span className="flex-1 min-w-0 text-xs font-semibold truncate text-zinc-100">
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

        <div className="flex justify-end mt-4">
          <button type="button" onClick={onClose} className={cadBtn}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}