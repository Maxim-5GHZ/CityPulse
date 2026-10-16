// Клиент сценариев конструктора через same-origin /backend/*.
// Бэк: ScenarioController (GET/POST/PUT/DELETE /api/scenarios), владелец — JWT.

import { ApiError } from './api';

export interface ScenarioRow {
  id: string;
  name: string;
  payload: string;
  updatedAt: string;
}

async function req<T>(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<T> {
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
    throw new ApiError(res.status, body.message ?? body.error ?? `Ошибка сети (код ${res.status})`);
  }
  return data as T;
}

export function listScenarios(token: string): Promise<ScenarioRow[]> {
  return req<ScenarioRow[]>('/scenarios', token);
}

export function createScenario(token: string, name: string, payload: string): Promise<ScenarioRow> {
  return req<ScenarioRow>('/scenarios', token, { method: 'POST', body: { name, payload } });
}

export function deleteScenario(token: string, id: string): Promise<{ deleted: string }> {
  return req<{ deleted: string }>(`/scenarios/${id}`, token, { method: 'DELETE' });
}
