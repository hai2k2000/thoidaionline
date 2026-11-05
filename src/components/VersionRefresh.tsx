"use client";

import { useEffect, useState } from "react";
import { decideVersionRefresh, VERSION_CHECK_INTERVAL_MS } from "@/lib/versionRefresh.mjs";

const FIELD_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const STAMP_PREFIX = "thoidai:auto-reload:";

function hasDirtyInput(edited: Set<Element>) {
  if (document.activeElement?.closest(FIELD_SELECTOR)) return true;
  if (Array.from(edited).some((field) => field.isConnected)) return true;
  return Array.from(document.querySelectorAll(FIELD_SELECTOR)).some((element) => {
    if (element instanceof HTMLInputElement) return element.value !== element.defaultValue || element.checked !== element.defaultChecked || Boolean(element.files?.length);
    if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
    if (element instanceof HTMLSelectElement) return Array.from(element.options).some((option) => option.selected !== option.defaultSelected);
    return Boolean(element.textContent?.trim());
  });
}

export default function VersionRefresh({ build }: { build: string }) {
  const [banner, setBanner] = useState(false);
  useEffect(() => {
    let lastCheck = 0;
    let hiddenAt = document.hidden ? Date.now() : 0;
    let pending = false;
    let disposed = false;
    const edited = new Set<Element>();
    const markEdited = (event: Event) => {
      const field = event.target instanceof Element ? event.target.closest(FIELD_SELECTOR) : null;
      if (field) edited.add(field);
    };
    const check = async (resumedFromBackgroundMs = 0) => {
      const now = Date.now();
      if (pending || now - lastCheck < VERSION_CHECK_INTERVAL_MS) return;
      lastCheck = now;
      pending = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      // A service worker failure must not prevent release detection.
      if ("serviceWorker" in navigator) void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {});
      try {
        const response = await fetch("/api/version", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok || disposed) return;
        const value = await response.json() as { build?: unknown };
        if (disposed || typeof value.build !== "string" || !value.build || value.build.length > 200) return;
        const latestBuild = value.build;
        // If storage is unavailable, only a manual update is safe.
        let autoReloadStamp: string | null = latestBuild;
        try { autoReloadStamp = sessionStorage.getItem(STAMP_PREFIX + latestBuild); } catch { /* Conservative fallback. */ }
        const decision = decideVersionRefresh({ currentBuild: build, latestBuild, visible: !document.hidden, resumedFromBackgroundMs, dirtyForm: hasDirtyInput(edited), autoReloadStamp });
        if (decision === "reload") {
          try { sessionStorage.setItem(STAMP_PREFIX + latestBuild, latestBuild); } catch { setBanner(true); return; }
          location.reload();
        } else setBanner(decision === "banner");
      } catch { /* Offline checks are silent; the next lifecycle check retries. */ }
      finally { window.clearTimeout(timeout); pending = false; }
    };
    const onVisible = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const duration = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      void check(duration);
    };
    const onPageHide = () => { hiddenAt = Date.now(); };
    const onPageShow = () => { if (!document.hidden) onVisible(); };
    document.addEventListener("input", markEdited, true);
    document.addEventListener("change", markEdited, true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    const timer = window.setInterval(() => { if (!document.hidden) void check(); }, 10 * 60_000);
    void check();
    return () => { disposed = true; document.removeEventListener("input", markEdited, true); document.removeEventListener("change", markEdited, true); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pagehide", onPageHide); window.removeEventListener("pageshow", onPageShow); window.clearInterval(timer); };
  }, [build]);

  if (!banner) return null;
  return <aside role="status" aria-live="polite" className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg lg:inset-x-auto lg:right-5 lg:bottom-5"><span>Đã có phiên bản mới</span><div className="flex items-center gap-2"><button type="button" className="min-h-11 rounded-lg bg-orange-600 px-3 font-semibold" onClick={() => location.reload()}>Cập nhật</button><button type="button" aria-label="Đóng thông báo cập nhật" className="min-h-11 min-w-11 text-slate-200" onClick={() => setBanner(false)}>×</button></div></aside>;
}
