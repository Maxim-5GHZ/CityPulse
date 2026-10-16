// Копируемый шаблон таблицы сущности для админки (Tailwind, без UI-китов).
// Новый CRUD: скопируй этот компонент + AdminUserController.java, замени типы/ручки.
'use client';

import { useState } from 'react';

export interface EntityRow {
  id: string;
}

export interface CreateField {
  name: string;
  label: string;
  type?: string;
  options?: string[];
}

export interface Column<T> {
  key: keyof T | 'actions';
  header: string;
}

interface Props<T extends EntityRow> {
  title: string;
  rows: T[];
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  createFields: CreateField[];
  onCreate: (values: Record<string, string>) => Promise<void>;
  renderRowActions?: (row: T) => React.ReactNode;
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 ' +
  'outline-none transition-all duration-200 ease-out hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-500 ' +
  'motion-reduce:transform-none motion-reduce:transition-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

const btnCls =
  'rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] hover:bg-gray-700 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'disabled:opacity-50 disabled:hover:scale-100';

export default function EntityTable<T extends EntityRow>({
  title,
  rows,
  columns,
  loading,
  error,
  createFields,
  onCreate,
  renderRowActions,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await onCreate(values);
      setValues({});
      setOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h2>
        <button type="button" className={btnCls} onClick={() => setOpen(true)}>
          Добавить
        </button>
      </div>
      {(error ?? localError) && (
        <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {error ?? localError}
        </p>
      )}
      <div className="overflow-x-auto p-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Пока пусто</p>
        ) : (
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
                {columns.map((c) => (
                  <th key={String(c.key)} className="px-3 py-2 font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  {columns.map((c) =>
                    c.key === 'actions' ? (
                      <td key="actions" className="px-3 py-2">
                        {renderRowActions?.(row)}
                      </td>
                    ) : (
                      <td key={String(c.key)} className="px-3 py-2 text-gray-700 dark:text-gray-200">
                        {String(row[c.key as keyof T] ?? '')}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Новая запись</h3>
            <div className="mt-3 flex flex-col gap-2">
              {createFields.map((f) =>
                f.options ? (
                  <select
                    key={f.name}
                    aria-label={f.label}
                    className={inputCls}
                    value={values[f.name] ?? f.options[0]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  >
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    key={f.name}
                    className={inputCls}
                    type={f.type ?? 'text'}
                    placeholder={f.label}
                    aria-label={f.label}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    required
                  />
                ),
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnCls} onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button type="submit" className={btnCls} disabled={busy}>
                {busy ? 'Создаём…' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
