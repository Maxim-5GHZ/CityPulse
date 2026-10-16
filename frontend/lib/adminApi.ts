// API админки. Только для /admin (MUI-зона). Токен — из useAuth.
import { ApiError } from './api';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string | null;
}

async function adminReq<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/backend${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data ?? {}) as { message?: string; error?: string };
    throw new ApiError(res.status, body.message ?? body.error ?? `Ошибка (код ${res.status})`);
  }
  return data as T;
}

export const listUsers = (token: string) => adminReq<AdminUser[]>('/admin/users', token);

export const createUser = (token: string, input: { email: string; password: string; role: string }) =>
  adminReq<AdminUser>('/admin/users', token, { method: 'POST', body: input });

export const setUserRole = (token: string, id: string, role: string) =>
  adminReq<AdminUser>(`/admin/users/${id}/role`, token, { method: 'PATCH', body: { role } });

export const deleteUser = (token: string, id: string) =>
  adminReq<{ deleted: string }>(`/admin/users/${id}`, token, { method: 'DELETE' });

export const broadcastEvent = (token: string, message: string) =>
  adminReq<{ sent: number; clients: number }>('/events/admin/broadcast', token, {
    method: 'POST',
    body: { message },
  });
