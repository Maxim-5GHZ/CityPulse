'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createScenario, deleteScenario, listScenarios } from '@/lib/scenarios';
import type { ScenarioRow } from '@/lib/scenarios';
import type { DistrictState } from '@/lib/urban/types';

interface ScenarioPanelProps {
  token: string;
  state: DistrictState;
  onLoad: (state: DistrictState) => void;
}

const BTN =
  'transform-gpu rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:pointer-events-none disabled:opacity-40';

/** Сценарии в бэкенде: сохранить / загрузить / удалить (правило «создал — удали»). */
export default function ScenarioPanel({ token, state, onLoad }: ScenarioPanelProps) {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setRows(await listScenarios(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить сценарии');
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async () => {
    const title = name.trim() || `Сценарий ${rows.length + 1}`;
    setBusy(true);
    setError(null);
    try {
      await createScenario(token, title, JSON.stringify(state));
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const load = (row: ScenarioRow) => {
    try {
      const parsed = JSON.parse(row.payload) as DistrictState;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('bad payload');
      }
      onLoad(parsed);
    } catch {
      setError('Сценарий повреждён');
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteScenario(token, id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Сценарии в базе">
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Сценарии в базе</p>
      <div className="mt-2 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название сценария"
          aria-label="Название сценария"
          className="min-w-0 flex-1 transform-gpu rounded-full border border-white/60 bg-white/60 px-4 py-1.5 text-sm text-gray-800 backdrop-blur-xl outline-none transition-all duration-200 ease-out placeholder:text-gray-400 hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-400 focus:ring-2 focus:ring-blue-300/60 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={`${BTN} shrink-0 bg-blue-600 text-white hover:bg-blue-700`}
        >
          Сохранить
        </button>
      </div>
      {error && (
        <div className="mt-2 rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-2 text-sm text-red-700 backdrop-blur-xl">
          {error}
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/30 px-3 py-1.5 backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/30"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                {r.name}
              </span>
              <button type="button" onClick={() => load(r)} className={`${BTN} bg-white/60 text-gray-700 hover:bg-white dark:bg-white/10 dark:text-gray-200`}>
                Открыть
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label={`Удалить ${r.name}`}
                className={`${BTN} text-red-700 hover:bg-red-50 dark:text-red-300`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
