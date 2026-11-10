/* eslint-disable @next/next/no-img-element -- Private files use authenticated same-origin URLs. */
"use client";
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { filePreviewKind, parsePreviewCsv, readPreviewBytes } from '@/lib/filePreview.mjs';

const OfficeFilePreview = dynamic(() => import('@/components/OfficeFilePreview'), { ssr: false, loading: () => <p role="status">Đang mở tệp…</p> });
const button = 'min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50';
export type PreviewFile = { url: string; downloadUrl?: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null };
type Props = PreviewFile & { onClose: () => void; onPrevious?: () => void; onNext?: () => void; position?: string };

function TextPreview({ url, csv }: { url: string; csv: boolean }) {
  const [state, setState] = useState<{ text?: string; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { credentials: 'same-origin', signal: controller.signal })
      .then(response => readPreviewBytes(response, 2 * 1024 * 1024, true))
      .then(bytes => { if (!controller.signal.aborted) setState({ text: new TextDecoder().decode(bytes) }); })
      .catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => controller.abort();
  }, [url]);
  if (state.error) return <p role="alert">Không mở được tệp. Vui lòng thử lại.</p>;
  if (state.text === undefined) return <p role="status">Đang tải…</p>;
  const rows = csv ? parsePreviewCsv(state.text) : [];
  return <><p className="mb-2 text-xs text-slate-500">Xem tối đa 2 MB{csv ? ', 1000 hàng và 50 cột' : ''}.</p>{csv ? <div className="overflow-auto"><table aria-label="Nội dung CSV" className="min-w-full border-collapse text-sm"><tbody>{rows.map((row: string[], r: number) => <tr key={r}>{row.map((cell, c) => <td key={c} className="whitespace-pre-wrap border px-2 py-1 align-top">{cell}</td>)}</tr>)}</tbody></table></div> : <pre className="whitespace-pre-wrap break-words text-sm">{state.text}</pre>}</>;
}

function FileContent(file: PreviewFile) {
  const kind = filePreviewKind(file);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const ready = () => setStatus('ready');
  const error = () => setStatus('error');
  if (!kind || ((kind === 'docx' || kind === 'xlsx') && (file.sizeBytes ?? 0) > 15 * 1024 * 1024)) return <p role="status" className="p-6 text-sm">Không xem trước được loại tệp này</p>;
  if (kind === 'docx' || kind === 'xlsx') return <OfficeFilePreview {...file} />;
  if (kind === 'text' || kind === 'csv') return <TextPreview url={file.url} csv={kind === 'csv'} />;
  return <div className="flex h-full min-h-0 flex-col gap-2">
    {status === 'loading' && <p role="status">Đang tải…</p>}
    {status === 'error' && <p role="alert">Không mở được tệp. Vui lòng thử lại.</p>}
    {kind === 'pdf' && <iframe className="min-h-[60vh] w-full flex-1 border-0" src={file.url} title={file.fileName} onLoad={ready} onError={error} />}
    {kind === 'image' && <img className="mx-auto min-h-0 max-w-full flex-1 object-contain" src={file.url} alt={file.fileName} onLoad={ready} onError={error} />}
    {kind === 'video' && <video className="min-h-0 w-full flex-1" controls preload="metadata" src={file.url} onLoadedMetadata={ready} onError={error} />}
    {kind === 'audio' && <audio className="w-full" controls preload="metadata" src={file.url} onLoadedMetadata={ready} onError={error} />}
  </div>;
}

export default function FilePreviewDialog({ onClose, onPrevious, onNext, position, ...file }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const kind = filePreviewKind(file);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Native modal dialogs make the background inert and trap focus, including media/iframes.
    dialog.showModal(); closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={`Xem ${file.fileName}`} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 text-slate-900 backdrop:bg-slate-950/70 sm:m-auto sm:h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:rounded-xl">
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b p-3"><h2 className="min-w-0 break-words font-semibold">{file.fileName}</h2><button type="button" ref={closeRef} className={button} onClick={onClose}>Đóng</button></header>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3"><FileContent key={file.url} {...file} /></div>
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        {position && <><button type="button" className={button} disabled={!onPrevious} onClick={onPrevious} aria-label="Tệp trước">Trước</button><span role="status" className="text-sm">{position}</span><button type="button" className={button} disabled={!onNext} onClick={onNext} aria-label="Tệp tiếp theo">Sau</button></>}
        {file.downloadUrl && <a className={button} href={file.downloadUrl} download>Tải về</a>}
        {file.downloadUrl && kind && kind !== 'docx' && kind !== 'xlsx' && <a className={button} href={file.url} target="_blank" rel="noopener noreferrer">Mở trong tab mới</a>}
      </footer>
    </div>
  </dialog>;
}

export function FilePreviewList({ files, selectedUrl, onSelect, onClose }: { files: PreviewFile[]; selectedUrl: string; onSelect: (url: string) => void; onClose: () => void }) {
  const index = files.findIndex(file => file.url === selectedUrl);
  if (index < 0) return null;
  return <FilePreviewDialog {...files[index]} onClose={onClose} position={files.length > 1 ? `${index + 1} / ${files.length}` : undefined} onPrevious={index > 0 ? () => onSelect(files[index - 1].url) : undefined} onNext={index < files.length - 1 ? () => onSelect(files[index + 1].url) : undefined} />;
}
