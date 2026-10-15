// Тонкий клиент бэкенда через same-origin прокси /backend/* (см. next.config.js).
// Токен — из localStorage, 401 дальше решает вызывающий код.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(
  path: string,
  token: string | null,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/backend${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string } | null)?.message ??
      (data as { error?: string } | null)?.error ??
      `Ошибка сети (код ${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export interface HealthStatus {
  status: string;
}

export interface DbStatus {
  select1: number;
  postgres: string;
}

export interface Me {
  email: string;
  role: string;
}

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return req<HealthStatus>('/health', null, signal ? { signal } : undefined);
}

export function getDbStatus(signal?: AbortSignal): Promise<DbStatus> {
  return req<DbStatus>('/db', null, signal ? { signal } : undefined);
}

export function getMe(token: string): Promise<Me> {
  return req<Me>('/me', token);
}

export function login(email: string, password: string): Promise<{ token: string }> {
  return req<{ token: string }>('/auth/login', null, {
    method: 'POST',
    body: { email, password },
  });
}

export function register(email: string, password: string): Promise<{ token: string }> {
  return req<{ token: string }>('/auth/register', null, {
    method: 'POST',
    body: { email, password },
  });
}
