"use client";

import { useState, type ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  className?: string;
};

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoComplete,
  minLength,
  maxLength,
  className = "w-full rounded border px-3 py-3",
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={`${className} pr-16`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
      />
      <button
        type="button"
        disabled={disabled}
        aria-pressed={visible}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {visible ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}
