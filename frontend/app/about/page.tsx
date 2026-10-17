import Link from 'next/link';
import QRCode from 'react-qr-code';
import PulseLogo from '@/components/PulseLogo';

const SITE_URL = 'https://hotcodeband.ru';
const GITHUB_URL = 'https://github.com/Maxim-5GHZ/CityPulse';

// Та же QR-ссылка, что в hero на `/`: обязана быть сплошной bg-white,
// иначе QR не сканируется. Тени не трогать.
const qrLinkCls =
  'transform-gpu rounded-2xl border border-white/60 bg-white p-4 ' +
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9),0_6px_18px_-8px_rgba(20,26,38,0.4)] ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none';

const cardCls =
  'w-full max-w-xl rounded-[32px] border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-xl ' +
  'backdrop-saturate-150 md:px-8 ' +
  'shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_24px_60px_-16px_rgba(20,26,38,0.35)] ' +
  'dark:border-white/20 dark:bg-gray-900/40';

const glassPill =
  'inline-block min-w-40 transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-center text-sm font-medium text-gray-700 backdrop-blur-xl ' +
  'transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20';

const darkBtn =
  'inline-block min-w-40 transform-gpu rounded-full bg-[#141a26]/90 px-6 py-2.5 text-center text-sm font-medium tracking-wide text-white ' +
  'backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-[#141a26] active:scale-[0.98] ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_14px_30px_-10px_rgba(20,26,38,0.6)] ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-300/60 focus-visible:scale-[1.05]';

// Отдельная страница контактов: GitHub/сайт + место под разработчиков.
// h1 здесь — заголовок страницы, поэтому логотип — span.
export default function AboutPage() {
  return (
    <section
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/city.png')" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40 dark:from-black/60 dark:via-black/40 dark:to-black/70"
      />

      <div className="relative flex min-h-screen flex-col px-4 pt-6 sm:px-6">
        <header className="flex items-center justify-start">
          <Link
            href="/"
            className="inline-block transform-gpu rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-sm font-medium text-gray-700 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-[1.05] hover:bg-white/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/20 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
          >
            ← На главную
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-2 py-6">
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <div className={`${cardCls} flex flex-col items-center gap-5`}>
              <div className="mx-auto flex justify-center">
                <PulseLogo as="span" size="lg" className="scale-110 sm:scale-125 my-2" />
              </div>

              <h1 className="text-center text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                Контакты
              </h1>
              <p className="max-w-md text-center text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-200">
                GitHub и сайт проекта — QR и ссылки. Дальше — вход и регистрация.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <figure className="flex flex-col items-center gap-2">
                  <a href={SITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Наш Сайт" className={qrLinkCls}>
                    <QRCode value={SITE_URL} size={180} />
                  </a>
                  <figcaption className="text-sm font-medium text-gray-600 dark:text-gray-200">Наш Сайт</figcaption>
                </figure>
                <figure className="flex flex-col items-center gap-2">
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="Наш GitHub" className={qrLinkCls}>
                    <QRCode value={GITHUB_URL} size={180} />
                  </a>
                  <figcaption className="text-sm font-medium text-gray-600 dark:text-gray-200">Наш GitHub</figcaption>
                </figure>
              </div>

              <div className="w-full rounded-2xl border border-white/60 bg-white/30 px-5 py-4 text-center backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/30">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Разработчики</p>
                <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-200">
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
