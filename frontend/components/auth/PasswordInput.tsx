'use client';

import { useState } from 'react';

const INPUT_CLS =
  'block w-full transform-gpu rounded-full border border-white/60 bg-white/60 px-5 py-2 pr-12 text-gray-800 ' +
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.9)] ' +
  'backdrop-blur-xl outline-none transition-all duration-200 ease-out placeholder:text-gray-400 ' +
  'hover:scale-[1.02] focus:scale-[1.02] focus:border-blue-400 focus:ring-2 focus:ring-blue-300/60 ' +
  'motion-reduce:transform-none motion-reduce:transition-none ' +
  'dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder:text-gray-500';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minLength?: number;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = 'Введите пароль',
  minLength,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        placeholder={placeholder}
        className={INPUT_CLS}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={show}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-all duration-200 ease-out hover:scale-110 hover:text-gray-800 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none dark:text-gray-400 dark:hover:text-gray-100"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {show ? (
            <>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
              <path d="M9.9 4.24A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" />
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
