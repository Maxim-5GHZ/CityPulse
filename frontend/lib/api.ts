// Тонкий клиент бэкенда через same-origin прокси /backend/* (см. next.config.js).
// Токен — из localStorage, 401 дальше решает вызывающий код.
// Формат ошибок бэка: {message, fieldErrors?} (см. GlobalExceptionHandler).
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string> | null;
  constructor(status: number, message: string, fieldErrors?: Record<string, string> | null) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors ?? null;
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
    const body = (data ?? {}) as { message?: string; error?: string; fieldErrors?: Record<string, string> };
    const msg = body.message ?? body.error ?? `Ошибка сети (код ${res.status})`;
    throw new ApiError(res.status, msg, body.fieldErrors ?? null);
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

// Вход через Флида ID (Web SDK): фронт уже добыл Flida access_token,
// бэкенд перепроверит его через userinfo и вернёт НАШ JWT.
export function exchangeFlida(flidaAccessToken: string): Promise<{ token: string }> {
  return req<{ token: string }>('/auth/flida', null, {
    method: 'POST',
    body: { access_token: flidaAccessToken },
  });
}
