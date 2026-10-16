// Кейс 03 — ProjectsPanel: сохранить / открыть / переименовать / удалить проекты.
// Владелец — из JWT, чужие проекты бэк не отдаёт (см. ScenarioService).
// Стекло и пилюли — как остальные панели конструктора (см. AGENTS.md).
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  createScenario,
  deleteScenario,
  getScenario,
  listScenarios,
  updateScenario,
  type ScenarioRow,
} from '@/lib/api';
import type { DistrictModel } from '@/lib/city/model';

interface ProjectsPanelProps {
  token: string | null;
  /** Текущий граф конструктора — для кнопки «Сохранить текущее». */
  currentModel: DistrictModel;
  /** Загрузить проект в конструктор. */
  onOpen: (model: DistrictModel) => void;
}

function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Не удалось связаться с сервером';
}

export default function ProjectsPanel({ token, currentModel, onOpen }: ProjectsPanelProps) {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    try {
      setRows(await listScenarios(token));
    } catch (e) {
      setError(errText(e));
    }
  }, [token]);

  useEffect(() => {
    setError(null);
    void reload();
  }, [reload]);

  if (!token) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Войдите, чтобы хранить проекты на сервере.</p>;
  }

  const save = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createScenario(token, clean, currentModel);
      setRows((rs) => [{ id: created.id, name: created.name, updatedAt: created.updatedAt }, ...rs]);
      setName('');
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setError(null);
    try {
      const d = await getScenario(token, id);
      onOpen(d.graph as DistrictModel);
    } catch (e) {
      setError(errText(e));
    }
  };

  const commitRename = async (id: string) => {
    const clean = rename.trim();
    if (!clean) {
      setRenameId(null);
      return;
    }
    setError(null);
    try {
      const d = await updateScenario(token, id, { name: clean });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: d.name, updatedAt: d.updatedAt } : r)));
      setRenameId(null);
    } catch (e) {
      setError(errText(e));
    }
  };

  const remove = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setError(null);
    try {
      await deleteScenario(token, id);
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <div aria-live="polite">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
          placeholder="Название, например Вариант А"
          maxLength={120}
          aria-label="Название проекта"
          className="min-w-0 flex-1 rounded-full border border-white/60 bg-white/60 px-4 py-1.5 text-sm text-gray-900 placeholder-gray-500 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.02] focus:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-400"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-full bg-[#141a26]/90 px-4 py-1.5 text-sm font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none disabled:opacity-40 disabled:pointer-events-none dark:bg-white dark:text-gray-900"
        >
          {busy ? '…' : 'Сохранить'}
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-2xl border border-red-200/70 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Проектов пока нет — сохраните текущий вариант.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/60 bg-white/60 p-3 dark:border-white/20 dark:bg-white/10"
            >
              {renameId === r.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(r.id);
                      if (e.key === 'Escape') setRenameId(null);
                    }}
                    maxLength={120}
                    autoFocus
                    aria-label="Новое название проекта"
                    className="min-w-0 flex-1 rounded-full border border-white/60 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => void commitRename(r.id)}
                    className="shrink-0 rounded-full bg-gray-800 px-3 py-1 text-sm font-medium text-white transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:bg-white dark:text-gray-900"
                  >
                    Ок
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.updatedAt).toLocaleString('ru-RU')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void open(r.id)}
                      className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
                    >
                      Открыть
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRename(r.name);
                        setRenameId(r.id);
                        setConfirmDeleteId(null);
                      }}
                      className="rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
                    >
                      Переименовать
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(r.id)}
                      className={
                        confirmDeleteId === r.id
                          ? 'rounded-full bg-[#141a26]/90 px-3 py-1 text-xs font-medium text-white transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:bg-white dark:text-gray-900'
                          : 'rounded-full border border-red-200/70 bg-red-50/80 px-3 py-1 text-xs font-medium text-red-700 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300'
                      }
                    >
                      {confirmDeleteId === r.id ? 'Точно удалить?' : 'Удалить'}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
