// Прокси к бэкенду: браузер ходит same-origin (/backend/*), CORS не нужен.
// BACKEND_URL — серверная переменная (в compose: http://backend:8080).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/backend/:path*', destination: `${BACKEND_URL}/api/:path*` },
      // Возврат от Флида ID: зарегистрированный redirect_uri смотрит на фронт-origin,
      // а обрабатывает код бэкенд. Точное совпадение (не префикс!), чтобы /flida/finish
      // остался обычной страницей Next. Фронтендер, не переживай: вся магия — в Java,
      // тут просто трубка до /api/auth/flida/callback.
      { source: '/flida/oauth2/callback', destination: `${BACKEND_URL}/api/auth/flida/callback` },
    ];
  },
};

module.exports = nextConfig;
