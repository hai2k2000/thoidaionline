"use client";

import { useRef, useState } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";

type Candidate = { taskId?: string; title: string; description?: string | null; assigneeId?: string | null; assigneeName?: string | null; mappingConfidence?: "HIGH" | "REVIEW" | "UNRESOLVED"; dueDate?: string | null; periodRelation: string; previousItemId?: string | null; carryOverReason?: string | null; existingTask?: { id: string; title: string; confidence: "HIGH" | "REVIEW" } | null };

export default function DepartmentPlanActions({ departmentId, period, plan, items }: { departmentId: string; period: DepartmentPlanPeriod; plan: DepartmentPlanRow | null; items: DepartmentPlanItemRow[] }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkExisting, setLinkExisting] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = async () => {
    setBusy(true); setMessage("");
    try {
      const query = new URLSearchParams({ departmentId, periodType: period.periodType, periodStart: period.periodStart });
      const response = await fetch(`/api/planning/department/candidates?${query}`);
      if (!response.ok) throw new Error("KhÃ´ng thá»ƒ quÃ©t cÃ´ng viá»‡c Ä‘á» xuáº¥t.");
      const data = await response.json() as { candidates: Candidate[] };
      setCandidates(data.candidates ?? []); setSelected((data.candidates ?? []).map((item) => item.taskId ?? item.title)); setOpen(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "KhÃ´ng thá»ƒ quÃ©t cÃ´ng viá»‡c Ä‘á» xuáº¥t."); }
    finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/planning/department/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId, periodType: period.periodType, periodStart: period.periodStart, items: candidates.filter((item) => selected.includes(item.taskId ?? item.title)).map((item) => ({ ...((item.taskId || (item.existingTask && linkExisting[item.title])) ? { taskId: item.taskId ?? item.existingTask!.id } : { title: item.title, description: item.description }), periodRelation: item.periodRelation, carryOverReason: item.carryOverReason })) }) });
      if (!response.ok) throw new Error("KhÃ´ng thá»ƒ táº¡o káº¿ hoáº¡ch ká»³ má»›i.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "KhÃ´ng thá»ƒ táº¡o káº¿ hoáº¡ch ká»³ má»›i."); setBusy(false); }
  };
  const close = async () => {
    if (!plan || !window.confirm("Chá»‘t ká»³ nÃ y vÃ  lÆ°u snapshot káº¿t quáº£?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/planning/department/${plan.id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: items.map((item) => ({ itemId: item.id, carryForward: item.work_status !== "completed" && item.work_status !== "cancelled" })) }) });
      if (!response.ok) throw new Error("KhÃ´ng thá»ƒ chá»‘t ká»³ káº¿ hoáº¡ch.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "KhÃ´ng thá»ƒ chá»‘t ká»³ káº¿ hoáº¡ch."); setBusy(false); }
  };
  const importWord = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData(); body.set("file", file); body.set("departmentId", departmentId); body.set("periodType", period.periodType); body.set("periodStart", period.periodStart);
      const response = await fetch("/api/planning/department/import", { method: "POST", body });
      if (!response.ok) throw new Error("KhÃ´ng thá»ƒ Ä‘á»c tÃ i liá»‡u Word.");
      const data = await response.json() as { candidates?: Candidate[] };
      setCandidates(data.candidates ?? []); setSelected((data.candidates ?? []).map((item) => item.taskId ?? item.title)); setLinkExisting({}); setOpen(true); setMessage("ÄÃ£ táº¡o báº£n xem trÆ°á»›c tá»« tÃ i liá»‡u Word. ChÆ°a lÆ°u dá»¯ liá»‡u.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "KhÃ´ng thá»ƒ Ä‘á»c tÃ i liá»‡u Word."); }
    finally { setBusy(false); }
  };
  return <>
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
      <button type="button" onClick={() => void preview()} disabled={busy} className="min-h-10 rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Äang xá»­ lÃ½â€¦" : "Táº¡o káº¿ hoáº¡ch ká»³ má»›i"}</button>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="min-h-10 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-900 disabled:opacity-50">Import káº¿ hoáº¡ch tá»« Word</button>
      <input ref={fileRef} hidden type="file" accept=".docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWord(file); event.currentTarget.value = ""; }} />
      {plan?.status !== "closed" && plan ? <button type="button" onClick={() => void close()} disabled={busy} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">Chá»‘t ká»³</button> : null}
      {message ? <span role="status" className="text-sm font-semibold text-slate-600">{message}</span> : null}
    </div>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Xem trÆ°á»›c káº¿ hoáº¡ch ká»³ má»›i"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Xem trÆ°á»›c káº¿ hoáº¡ch ká»³ má»›i</h2><p className="text-sm text-slate-500">Chá»n cÃ¡c cÃ´ng viá»‡c Ä‘á» xuáº¥t trÆ°á»›c khi lÆ°u.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm font-bold">ÄÃ³ng</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-2">Chá»n</th><th className="p-2">CÃ´ng viá»‡c</th><th className="p-2">Quan há»‡ ká»³</th><th className="p-2">NgÆ°á»i thá»±c hiá»‡n</th><th className="p-2">Khá»›p viá»‡c cÅ©</th><th className="p-2">Háº¡n</th></tr></thead><tbody>{candidates.map((item) => <tr key={item.taskId} className="border-b"><td className="p-2"><input type="checkbox" checked={selected.includes(item.taskId ?? item.title)} onChange={() => setSelected((current) => current.includes(item.taskId ?? item.title) ? current.filter((id) => id !== (item.taskId ?? item.title)) : [...current, item.taskId ?? item.title])} aria-label={`Chá»n ${item.title}`} /></td><td className="p-2 font-semibold">{item.title}</td><td className="p-2">{item.periodRelation === "LONG_RUNNING" ? "DÃ i háº¡n" : item.periodRelation === "CARRY_OVER" ? "Chuyá»ƒn tiáº¿p" : item.periodRelation === "RECURRING" ? "Äá»‹nh ká»³" : item.periodRelation === "IMPORTED" ? "Import" : "Má»›i"}</td><td className="p-2"><span>{item.assigneeName ?? "â€”"}</span>{item.mappingConfidence ? <small className={`ml-2 rounded-full px-2 py-0.5 font-bold ${item.mappingConfidence === "HIGH" ? "bg-emerald-100 text-emerald-800" : item.mappingConfidence === "REVIEW" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{item.mappingConfidence}</small> : null}</td><td className="p-2">{item.existingTask ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(linkExisting[item.title])} onChange={(event) => setLinkExisting((current) => ({ ...current, [item.title]: event.target.checked }))} /><span>{item.existingTask.confidence === "HIGH" ? "Khá»›p cao" : "Cáº§n xÃ¡c nháº­n"}: {item.existingTask.title}</span></label> : "Táº¡o má»›i"}</td><td className="p-2">{item.dueDate ?? "â€”"}</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setSelected(candidates.map((item) => item.taskId ?? item.title))} className="rounded-lg border px-3 py-2 text-sm font-semibold">Chá»n táº¥t cáº£</button><button type="button" disabled={busy} onClick={() => void create()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">XÃ¡c nháº­n táº¡o káº¿ hoáº¡ch</button></div></section></div> : null}
  </>;
}
