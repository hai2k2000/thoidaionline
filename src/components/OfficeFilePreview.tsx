"use client";
import { useEffect, useMemo, useState } from 'react';
import type { Workbook } from 'exceljs';
import { filePreviewKind, readPreviewBytes } from '@/lib/filePreview.mjs';
import { sanitizeOfficeHtml } from '@/lib/officePreviewSanitize.mjs';

const MAX_BYTES = 15 * 1024 * 1024;
export default function OfficeFilePreview({ url, fileName, mimeType, sizeBytes }: { url: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null }) {
  const kind = filePreviewKind({ fileName, mimeType });
  const [state, setState] = useState<{ loading: boolean; error?: string; html?: string; warnings?: number; workbook?: Workbook }>({ loading: true });
  const [sheet, setSheet] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        if (!['docx', 'xlsx'].includes(kind || '') || (sizeBytes != null && sizeBytes > MAX_BYTES)) throw new Error('large');
        const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) throw new Error('fetch');
        const bytes = await readPreviewBytes(response, MAX_BYTES);
        if (bytes.byteLength > MAX_BYTES) throw new Error('large');
        if (controller.signal.aborted) return;
        if (kind === 'docx') {
          const mammoth = (await import('mammoth')).default;
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
          if (!controller.signal.aborted) setState({ loading: false, html: sanitizeOfficeHtml(result.value), warnings: result.messages.length });
        } else {
          const ExcelJS = (await import('exceljs')).default;
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(bytes);
          if (!controller.signal.aborted) setState({ loading: false, workbook: wb });
        }
      } catch (error) { if (!controller.signal.aborted) setState({ loading: false, error: error instanceof Error && error.message === 'large' ? 'large' : 'open' }); }
    })();
    return () => controller.abort();
  }, [sizeBytes, kind, url]);
  const workbook = state.workbook;
  const active = workbook?.worksheets?.[sheet];
  const rows = useMemo(() => {
    if (!active) return [];
    const values: string[][] = [];
    for (let r = 1; r <= Math.min(active.rowCount, 1000); r++) {
      const row: string[] = [];
      for (let c = 1; c <= Math.min(active.columnCount, 50); c++) row.push(active.getCell(r, c).text ?? '');
      values.push(row);
    }
    return values;
  }, [active]);
  if (state.loading) return <p role="status" className="p-6 text-sm text-slate-600">Đang mở tệp…</p>;
  if (state.error) return <p role="alert" className="p-6 text-sm text-slate-600">{state.error === 'large' ? 'Không xem trước được loại tệp này' : 'Không mở được tệp. Vui lòng thử lại.'}</p>;
  if (kind === 'docx') return <div className="h-full overflow-auto"><iframe className="h-full min-h-[60vh] w-full border-0" sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#172033;padding:1rem}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #cbd5e1;padding:.35rem .5rem}img{max-width:100%;height:auto}</style></head><body>${state.html}</body></html>`} title={fileName} />{state.warnings ? <p className="p-2 text-xs text-slate-500">Một số định dạng có thể hiển thị khác bản gốc</p> : null}</div>;
  return <div className="flex h-full min-h-0 flex-col"><div className="flex gap-2 overflow-x-auto border-b p-2">{workbook?.worksheets.map((ws, index) => <button key={ws.id} className="min-h-11 focus-visible:ring-2 whitespace-nowrap rounded border px-3 py-1 text-sm" onClick={() => setSheet(index)} aria-pressed={index === sheet}>{ws.name}</button>)}</div><div className="min-h-0 flex-1 overflow-auto"><table className="min-w-full border-collapse text-sm"><thead className="sticky top-0 bg-slate-100"><tr>{rows[0]?.map((_, i) => <th key={i} className="border px-2 py-1 text-left">{i + 1}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((value, c) => <td key={c} className="border px-2 py-1 align-top">{value}</td>)}</tr>)}</tbody></table>{(active && (active.rowCount > 1000 || active.columnCount > 50)) && <p className="p-2 text-xs text-slate-500">Đã rút gọn còn tối đa 1000 hàng × 50 cột.</p>}</div></div>;
}
