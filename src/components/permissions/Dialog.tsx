"use client";
import { useEffect } from "react";
export default function Dialog({ title, children, onClose, fullScreen = false }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    fullScreen?: boolean;
}) {
    useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape")
        onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
    return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
  <div role="dialog" aria-modal="true" aria-labelledby="permission-dialog-title" className={`w-full max-w-lg bg-white p-5 shadow-2xl sm:rounded-3xl ${fullScreen ?
  "h-full max-w-none sm:h-auto" : "rounded-t-3xl"}`}><div className="flex items-center justify-between"><h2 id="permission-dialog-title" className="text-lg font-bold">{title}</h2>
  <button type="button" onClick={onClose} aria-label="Đóng" className="text-2xl text-slate-500">×</button></div>{children}</div></div>;
}

