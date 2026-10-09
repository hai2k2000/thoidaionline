"use client";

import { useState } from "react";
import PersonalQuickReportSummary from "@/components/PersonalQuickReportSummary";
import QuickReportForm from "@/components/QuickReportForm";

export default function QuickReportWorkspace() {
  const [view, setView] = useState<"create" | "summary">("create");
  return <main className="min-h-screen bg-[#f4f1ea] px-3 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Quick Report"><button type="button" role="tab" aria-selected={view === "create"} onClick={() => setView("create")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === "create" ? "bg-orange-100 text-orange-800" : "bg-white text-slate-700"}`}>Báo việc phát sinh</button><button type="button" role="tab" aria-selected={view === "summary"} onClick={() => setView("summary")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === "summary" ? "bg-orange-100 text-orange-800" : "bg-white text-slate-700"}`}>Tổng hợp việc phát sinh</button></div>{view === "create" ? <QuickReportForm /> : <PersonalQuickReportSummary />}</div></main>;
}
