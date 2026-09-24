"use client";

export default function PrintActions() {
  return <div className="print:hidden flex flex-wrap gap-2" aria-label="Tác vụ in phiếu">
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700">In phiếu</button>
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50">Save / Export PDF</button>
  </div>;
}

