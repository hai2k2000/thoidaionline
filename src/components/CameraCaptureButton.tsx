"use client";

import { useRef } from "react";

export default function CameraCaptureButton({ onCapture, disabled = false }: {
  onCapture: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <span className="inline-flex max-w-full">
    <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M8 5 6 8H3v12h18V8h-3l-2-3H8Z"/><circle cx="12" cy="13" r="3.5"/></svg>
      {"Ch\u1ee5p \u1ea3nh"}
    </button>
    <input ref={inputRef} type="file" accept="image/*" capture="environment" disabled={disabled} hidden aria-label={"Ch\u1ee5p \u1ea3nh"} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file && !disabled) void onCapture(file);
    }} />
  </span>;
}
