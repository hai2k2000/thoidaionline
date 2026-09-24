import type { JournalismTaskListSummaryDto } from "@/lib/taskContracts";
import {
  formatJournalismDate,
  journalismLabels,
  journalismPublicationStatusClass,
  journalismPublicationStatusLabel,
  journalismWorkKindLabel,
} from "@/lib/journalismUi.mjs";

export default function JournalismSummary({ journalism }: { journalism: JournalismTaskListSummaryDto }) {
  return (
    <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50/60 px-2.5 py-2 text-xs text-slate-700">
      <div className="font-semibold text-orange-900">Nghiệp vụ báo chí</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span>{journalismWorkKindLabel(journalism.work_kind)}</span>
        <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${journalismPublicationStatusClass(journalism.publication_status)}`}>
          {journalismPublicationStatusLabel(journalism.publication_status)}
        </span>
      </div>
      {journalism.planned_publication_at ? <div className="mt-1 text-slate-600">{journalismLabels.plannedPublicationDate}: {formatJournalismDate(journalism.planned_publication_at)}</div> : null}
    </div>
  );
}
