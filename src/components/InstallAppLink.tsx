"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { shouldShowInstallApp } from "@/lib/installApp.mjs";

function subscribe(onChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  return () => displayMode.removeEventListener("change", onChange);
}

function browserCanInstall() {
  return shouldShowInstallApp({ standalone: window.matchMedia("(display-mode: standalone)").matches, iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true, userAgent: navigator.userAgent });
}

export default function InstallAppLink({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const visible = useSyncExternalStore(subscribe, browserCanInstall, () => false);
  if (!user || !visible || !shouldShowInstallApp({ pathname })) return null;
  return <Link href="/app" className={`inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-white px-2.5 text-xs font-bold text-orange-700 ${mobile ? "" : "hidden lg:inline-flex"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" /></svg>Cài app</Link>;
}
