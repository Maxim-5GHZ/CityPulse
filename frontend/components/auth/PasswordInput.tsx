'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

const INPUT_CLS =
  'block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 pl-10 pr-11 text-zinc-100 ' +
  'placeholder:text-zinc-500 outline-none backdrop-blur-md transition-colors ' +
  'focus:border-white/30 focus:bg-white/10 focus:ring-2 focus:ring-white/10';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minLength?: number;
  /** По умолчанию true — как раньше. */
  required?: boolean;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = 'Введите пароль',
  minLength,
  required = true,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-zinc-500" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className={INPUT_CLS}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}