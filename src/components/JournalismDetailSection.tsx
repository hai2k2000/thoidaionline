import type { JournalismTaskDetailDto } from "@/lib/taskContracts";
import {
  formatJournalismDate,
  journalismPublicationStatusClass,
  journalismPublicationStatusLabel,
  safeJournalismArticleUrl,
  journalismWorkKindLabel,
} from "@/lib/journalismUi.mjs";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words whitespace-pre-wrap text-sm font-medium text-slate-800">{value}</dd>
  </div>
);

export default function JournalismDetailSection({ journalism }: { journalism: JournalismTaskDetailDto }) {
  const articleUrl = safeJournalismArticleUrl(journalism.article_url);
  return (
    <section aria-label="Nghiệp vụ báo chí" className="rounded-xl border bg-white p-3.5 shadow-sm">
      <h2 className="mb-2 text-base font-bold sm:text-lg">Nghiệp vụ báo chí</h2>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Field label="Loại nghiệp vụ" value={journalismWorkKindLabel(journalism.work_kind)} />
        <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Trạng thái xuất bản</dt>
          <dd className={`mt-0.5 inline-flex rounded-full border px-2 py-1 text-sm font-semibold ${journalismPublicationStatusClass(journalism.publication_status)}`}>
            {journalismPublicationStatusLabel(journalism.publication_status)}
          </dd>
        </div>
        {journalism.planned_publication_at ? <Field label="Dự kiến xuất bản" value={formatJournalismDate(journalism.planned_publication_at)} /> : null}
        {journalism.published_at ? <Field label="Đã xuất bản lúc" value={formatJournalismDate(journalism.published_at)} /> : null}
        {journalism.location ? <Field label="Địa điểm" value={journalism.location} /> : null}
        {articleUrl ? <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">URL bài đã xuất bản</dt><dd className="mt-0.5 break-all text-sm font-medium"><a href={articleUrl} target="_blank" rel="noreferrer" className="text-orange-700 underline">{articleUrl}</a></dd></div> : null}
        {journalism.editorial_notes ? <div className="sm:col-span-2"><Field label="Ghi chú biên tập" value={journalism.editorial_notes} /></div> : null}
      </dl>
    </section>
  );
}
