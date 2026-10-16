// Админка: таблица пользователей + broadcast в SSE-ленту. Tailwind, как весь проект.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EntityTable from '@/components/admin/EntityTable';
import { useAuth } from '@/lib/auth';
import {
  broadcastEvent,
  createUser,
  deleteUser,
  listUsers,
  setUserRole,
  type AdminUser,
} from '@/lib/adminApi';

const btnCls =
  'rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white transition-all duration-200 ease-out ' +
  'hover:scale-[1.05] hover:bg-gray-700 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ' +
  'disabled:opacity-50 disabled:hover:scale-100';

const ghostBtnCls =
  'rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-all ' +
  'duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] motion-reduce:transform-none ' +
  'motion-reduce:transition-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200';

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 ' +
  'outline-none transition-all duration-200 ease-out hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-500 ' +
  'motion-reduce:transform-none motion-reduce:transition-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

export default function AdminPage() {
  const { ready, token, role, logout } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  // Не-админов — в workspace.
  useEffect(() => {
    if (ready && (!token || role !== 'ADMIN')) router.replace('/workspace');
  }, [ready, token, role, router]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await listUsers(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!ready || !token || role !== 'ADMIN') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-6">
        <p className="text-center text-sm text-gray-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 bg-gray-100 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-black tracking-tight text-gray-900">Админка</h1>
        <div className="flex gap-2">
          <button type="button" className={ghostBtnCls} onClick={() => router.push('/workspace')}>
            В workspace
          </button>
          <button
            type="button"
            className={ghostBtnCls}
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      <EntityTable<AdminUser>
        title="Пользователи"
        rows={rows}
        loading={loading}
        error={error}
        createFields={[
          { name: 'email', label: 'Email' },
          { name: 'password', label: 'Пароль', type: 'password' },
          { name: 'role', label: 'Роль', options: ['USER', 'ADMIN'] },
        ]}
        onCreate={async (v) => {
          await createUser(token, {
            email: v.email ?? '',
            password: v.password ?? '',
            role: v.role ?? 'USER',
          });
          await reload();
        }}
        columns={[
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Роль' },
          { key: 'createdAt', header: 'Создан' },
          { key: 'actions', header: 'Действия' },
        ]}
        renderRowActions={(row) => (
          <span className="flex items-center gap-2">
            <select
              aria-label={`Роль ${row.email}`}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              value={row.role}
              onChange={async (e) => {
                try {
                  await setUserRole(token, row.id, e.target.value);
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось сменить роль');
                }
              }}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              type="button"
              className="text-sm font-medium text-red-700 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98]"
              onClick={async () => {
                if (!window.confirm(`Удалить ${row.email}?`)) return;
                try {
                  await deleteUser(token, row.id);
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось удалить');
                }
              }}
            >
              Удалить
            </button>
          </span>
        )}
      />

      <section className="rounded-lg border bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Рассылка в live-ленту
        </h2>
        {sent && <p className="mt-2 text-sm font-medium text-green-700">{sent}</p>}
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!msg.trim()) return;
            try {
              const r = await broadcastEvent(token, msg.trim());
              setSent(`Доставлено ${r.sent} из ${r.clients} подключений`);
              setMsg('');
            } catch (err) {
              setSent(null);
              setError(err instanceof Error ? err.message : 'Не удалось отправить');
            }
          }}
        >
          <input
            className={inputCls}
            placeholder="Сообщение всем подключённым"
            aria-label="Сообщение всем подключённым"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <button type="submit" className={btnCls} disabled={!msg.trim()}>
            Отправить
          </button>
        </form>
      </section>
    </main>
  );
}
