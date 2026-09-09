"use client";

import { useState, type ChangeEvent } from "react";

type Props = {
  id?: string;
  name?: string;
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
  id,
  name,
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
        id={id}
        name={name}
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
        className="absolute inset-y-0 right-0 min-w-11 rounded px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {visible ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}
