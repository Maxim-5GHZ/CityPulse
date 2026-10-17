'use client';

import Link from 'next/link';
import QRCode from 'react-qr-code';
import { ArrowLeft } from 'lucide-react';
import PulseLogo from '@/components/PulseLogo';

const SITE_URL = 'https://hotcodeband.ru';
const GITHUB_URL = 'https://github.com/Maxim-5GHZ/CityPulse';

// Стекло в стиле логина: белая плёнка + blur + тонкая светлая рамка.
const cardCls =
  'w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 px-6 py-8 ' +
  'backdrop-blur-xl backdrop-saturate-150 md:px-8 ' +
  'shadow-2xl shadow-black/40';

// Back-пилюля для хедера — та же, что в логине.
const backBtn =
  'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-300 ' +
  'transition-colors hover:bg-white/5 hover:text-zinc-100';

// QR-ссылка обязана быть сплошной bg-white (иначе не сканируется).
const qrLinkCls =
  'block rounded-2xl border border-white/20 bg-white p-4 shadow-2xl shadow-black/40 ' +
  'transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.99] ' +
  'motion-reduce:transform-none';

// Внутренний стеклянный блок (например, для разработчиков).
const innerGlass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur-md';

export default function AboutPage() {
  return (
    <section className="relative min-h-screen">
      <div className="relative flex flex-col min-h-screen px-4 pt-6 sm:px-6">
        <header className="w-full max-w-xl mx-auto">
          <Link href="/" className={backBtn}>
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </header>

        <main className="flex flex-col flex-1 w-full max-w-xl px-2 py-6 mx-auto">
          <div className="flex flex-col items-center justify-center flex-1 py-6">
            <div className={`${cardCls} flex flex-col items-center gap-5`}>
              <div className="flex justify-center my-2">
                <PulseLogo as="span" size="lg" />
              </div>

              <h1 className="text-2xl font-black tracking-tight text-center text-zinc-50">
                Контакты
              </h1>
              <p className="max-w-md text-sm font-medium leading-relaxed text-center text-zinc-300">
                GitHub и сайт проекта — QR и ссылки. Дальше — вход и регистрация.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <figure className="flex flex-col items-center gap-2">
                  <a
                    href={SITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Наш Сайт"
                    className={qrLinkCls}
                  >
                    <QRCode value={SITE_URL} size={180} />
                  </a>
                  <figcaption className="text-sm font-medium text-zinc-300">
                    Наш Сайт
                  </figcaption>
                </figure>
                <figure className="flex flex-col items-center gap-2">
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Наш GitHub"
                    className={qrLinkCls}
                  >
                    <QRCode value={GITHUB_URL} size={180} />
                  </a>
                  <figcaption className="text-sm font-medium text-zinc-300">
                    Наш GitHub
                  </figcaption>
                </figure>
              </div>

              <div className={innerGlass}>
                <p className="text-xs tracking-wide uppercase text-zinc-400">
                  Разработчики
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-200">
                  Состав команды добавим позже
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}