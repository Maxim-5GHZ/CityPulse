// Клиент сохранённых проектов через same-origin прокси /backend/*
// (см. next.config.js: /backend/:path* -> BACKEND_URL/api/:path*).
// Формат ошибок бэка: {message, fieldErrors?} (см. GlobalExceptionHandler).
import { ApiError } from './api';

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  data: string; // JSON-строка сценария (ноды, рёбра, дома, объекты)
}

async function projectReq<T>(
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
    const body = (data ?? {}) as {
      message?: string;
      error?: string;
      fieldErrors?: Record<string, string>;
    };
    throw new ApiError(
      res.status,
      body.message ?? body.error ?? `Ошибка (${res.status})`,
      body.fieldErrors ?? null,
    );
  }
  return data as T;
}

export const listProjects = (token: string) =>
  projectReq<ProjectSummary[]>('/projects', token);

export const getProject = (token: string, id: string) =>
  projectReq<ProjectDetail>(`/projects/${id}`, token);

export const createProject = (
  token: string,
  name: string,
  data: string,
  description?: string,
) =>
  projectReq<ProjectDetail>('/projects', token, {
    method: 'POST',
    body: { name, data, description },
  });

export const updateProject = (
  token: string,
  id: string,
  name: string,
  data: string,
  description?: string,
) =>
  projectReq<ProjectDetail>(`/projects/${id}`, token, {
    method: 'PUT',
    body: { name, data, description },
  });

export const deleteProject = (token: string, id: string) =>
  projectReq<{ status: string; id: string }>(`/projects/${id}`, token, {
    method: 'DELETE',
  });
