"use client";

import { createContext, useContext, type ReactNode } from "react";

const ReleaseVersionContext = createContext("B\u1ea3n dev");

export function ReleaseVersionProvider({ label, children }: { label: string; children: ReactNode }) {
  return <ReleaseVersionContext.Provider value={label}>{children}</ReleaseVersionContext.Provider>;
}

export function ReleaseVersionLabel({ className }: { className?: string }) {
  return <span className={className} title={"Phi\u00ean b\u1ea3n \u0111ang ch\u1ea1y"}>{useContext(ReleaseVersionContext)}</span>;
}
