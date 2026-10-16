// Флида ID через Web SDK (public-клиент, секрета нет).
// SDK сам управляет state/PKCE(S256), меняет код через POST /api/oidc/token
// с client_id без секрета; scope берётся из настроек проекта в консоли.
// Фронт получает Flida-токены и меняет их на НАШ JWT через POST /backend/auth/flida
// (бэкенд перепроверяет access_token через userinfo сервер-сервер).

export interface FlidaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
}

export interface FlidaAuthorizeOptions {
  signal?: AbortSignal;
}

interface FlidaSDKInstance {
  authorize: (opts?: FlidaAuthorizeOptions) => Promise<FlidaTokenResponse | undefined>;
  autoAuthorization: Promise<FlidaTokenResponse | undefined>;
  getUser: (accessToken: string, signal?: AbortSignal) => Promise<unknown>;
}

interface FlidaNamespace {
  FlidaSDK: new (config: Record<string, unknown>) => FlidaSDKInstance;
  FlidaError: new (...args: never[]) => Error & { code?: string; status?: number };
}

declare global {
  interface Window {
    Flida?: FlidaNamespace;
  }
}

const SDK_URL = 'https://id.flida.ru/sdk/v1/sdk.js';

let nsPromise: Promise<FlidaNamespace> | null = null;
let sdkPromise: Promise<FlidaSDKInstance> | null = null;

function loadNamespace(): Promise<FlidaNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Только в браузере'));
  if (window.Flida?.FlidaSDK) return Promise.resolve(window.Flida);
  if (nsPromise) return nsPromise;
  nsPromise = new Promise<FlidaNamespace>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => {
      if (window.Flida?.FlidaSDK) resolve(window.Flida);
      else {
        nsPromise = null;
        reject(new Error('SDK Флида ID не загрузился'));
      }
    };
    s.onerror = () => {
      nsPromise = null;
      reject(new Error('Не удалось загрузить SDK Флида ID — проверь сеть'));
    };
    document.head.appendChild(s);
  });
  return nsPromise;
}

/** Синглтон SDK: redirect-режим без FedCM (первая итерация, 1-в-1 как старая кнопка). */
export async function getFlidaSdk(): Promise<FlidaSDKInstance> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = loadNamespace().then((ns) => {
    const clientId = process.env.NEXT_PUBLIC_FLIDA_CLIENT_ID;
    if (!clientId) {
      sdkPromise = null;
      throw new Error('Вход через Флида ID не настроен (нет NEXT_PUBLIC_FLIDA_CLIENT_ID)');
    }
    return new ns.FlidaSDK({
      clientId,
      redirectUri: window.location.origin + '/flida/finish',
      fedcm: [],
      mode: 'redirect',
    });
  }).catch((e) => {
    sdkPromise = null;
    throw e;
  });
  return sdkPromise;
}

/** Человеческий текст по коду FlidaError (см. раздел «Ошибки SDK» в доке). */
export function flidaErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'invalid_config':
      return 'Вход через Флида ID не настроен — напиши нам, починим.';
    case 'invalid_state':
      return 'Сессия входа истекла или уже использована — попробуй ещё раз.';
    case 'authorization_in_progress':
      return 'Вход уже идёт — дождись завершения.';
    case 'popup_blocked':
    case 'popup_closed':
      return 'Всплывающее окно закрыто — попробуй ещё раз.';
    case 'timeout':
      return 'Флида ID не ответил вовремя — попробуй ещё раз.';
    case 'invalid_response':
    case 'http_error':
      return 'Флида ID вернул некорректный ответ — попробуй ещё раз.';
    case 'oauth_error':
      return 'Флида ID отклонил вход — попробуй ещё раз или войди по email.';
    case 'crypto_unavailable':
      return 'Браузер не поддерживает безопасный вход — обнови его или войди по email.';
    default:
      return 'Не удалось войти через Флида ID — попробуй ещё раз или войди по email.';
  }
}

/** Правда ли, что это отмена через AbortController (не показываем как ошибку). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
