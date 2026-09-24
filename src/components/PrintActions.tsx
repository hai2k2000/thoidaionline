"use client";

import { useEffect } from "react";
import { sanitizePrintFilenameTitle } from "@/lib/taskPrintModel";

export default function PrintActions({ documentTitle }: { documentTitle: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = sanitizePrintFilenameTitle(documentTitle);
    return () => { document.title = previousTitle; };
  }, [documentTitle]);

  return <div className="print:hidden flex flex-wrap gap-2" aria-label="Tác vụ in phiếu">
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700">In phiếu</button>
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50">Save / Export PDF</button>
  </div>;
}
