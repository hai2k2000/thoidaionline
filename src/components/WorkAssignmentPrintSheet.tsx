import type { TaskDetailDto } from "@/lib/taskContracts";
import { buildWorkAssignmentPrintModel } from "@/lib/taskPrintModel";
import { journalismLabels } from "@/lib/journalismUi.mjs";
import PrintActions from "./PrintActions";

const formatPrintDate = (value: string) => {
  if (value === "—") return value;
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const Field = ({ label, value }: { label: string; value: string }) => <div className="print-box"><dt>{label}</dt><dd>{value || "—"}</dd></div>;

export default function WorkAssignmentPrintSheet({ task }: { task: TaskDetailDto }) {
  const model = buildWorkAssignmentPrintModel(task);
  return <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 print:min-h-0 print:bg-white print:p-0">
    <div className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
      <a href={`/tasks/${task.id}`} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại công việc</a>
      <PrintActions />
    </div>
    <article className="print-sheet mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] shadow-lg print:max-w-none print:shadow-none">
      <header className="print-header border-b-2 border-slate-900 pb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Tạp chí Thời Đại</p>
        <h1 className="mt-2 text-2xl font-bold tracking-wide">PHIẾU GIAO VIỆC</h1>
        <p className="mt-1 text-sm font-semibold text-slate-700">{model.department}</p>
      </header>

      <section className="print-section mt-5">
        <h2>Thông tin giao việc</h2>
        <dl className="print-grid mt-3">
          <Field label="Ngày giao" value={formatPrintDate(model.assignedDate)} />
          <Field label="Hạn hoàn thành" value={formatPrintDate(model.deadline)} />
          <Field label="Người giao việc" value={model.assigner} />
          <Field label="Người nhận việc" value={model.primaryAssignee} />
          <Field label="Người phối hợp" value={model.collaborators.join(", ") || "—"} />
        </dl>
      </section>

      <section className="print-section mt-5">
        <h2>Nội dung công việc</h2>
        <dl className="print-content-grid mt-3">
          <Field label="Tên công việc" value={model.title} />
          <div className="print-box"><dt>Mô tả</dt><dd className="whitespace-pre-wrap">{model.description}</dd></div>
          <div className="print-box"><dt>Yêu cầu</dt>{model.requirements.length ? <dd><ol className="list-decimal space-y-1 pl-5">{model.requirements.map((item, index) => <li key={index}>{item}</li>)}</ol></dd> : <dd>—</dd>}</div>
          <div className="print-box"><dt>Ghi chú</dt><dd className="whitespace-pre-wrap">{model.notes}</dd></div>
        </dl>
      </section>

      {model.journalism ? <section className="print-section mt-5">
        <h2>Thông tin nghiệp vụ báo chí</h2>
        <dl className="print-grid mt-3">
          <Field label={journalismLabels.topic} value={model.journalism.topics.join(", ") || "—"} />
          <Field label={journalismLabels.series} value={model.journalism.series} />
          <Field label="Ngày dự kiến xuất bản" value={formatPrintDate(model.journalism.plannedPublicationDate)} />
          <Field label={journalismLabels.publicationStatus} value={model.journalism.publicationStatus} />
        </dl>
      </section> : null}

      <section className="signature-grid mt-14">
        <div><h2>NGƯỜI GIAO VIỆC</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.assigner}</strong></div>
        <div><h2>NGƯỜI NHẬN VIỆC</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.primaryAssignee}</strong></div>
        <div><h2>NGƯỜI PHỐI HỢP</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.collaborators.join(", ") || "—"}</strong></div>
      </section>
    </article>
  </main>;
}
