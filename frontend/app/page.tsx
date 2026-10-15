'use client';

import Link from 'next/link';
import QRCode from 'react-qr-code';
import PulseLogo from '@/components/PulseLogo';

const SITE_URL = 'https://hotcodeband.ru';
const GITHUB_URL = 'https://github.com/Maxim-5GHZ/CityPulse';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-6">
      <header className="flex items-center justify-end">
        <Link
          href="/login"
          className="inline-block rounded-lg border px-5 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Войти
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <PulseLogo as="h1" size="lg" />

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <figure className="flex flex-col items-center gap-2">
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="rounded-2xl border bg-white p-4 shadow-sm">
              <QRCode value={SITE_URL} size={180} />
            </a>
            <figcaption className="text-sm text-gray-500">Сайт</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-2">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="rounded-2xl border bg-white p-4 shadow-sm">
              <QRCode value={GITHUB_URL} size={180} />
            </a>
            <figcaption className="text-sm text-gray-500">GitHub</figcaption>
          </figure>
        </div>
        <p className="text-sm text-gray-500">Наведи камеру — откроется ссылка</p>

        <nav className="flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block min-w-40 rounded-lg bg-blue-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            GitHub
          </a>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block min-w-40 rounded-lg bg-blue-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Сайт
          </a>
        </nav>
      </div>
    </main>
  );
}
