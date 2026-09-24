import type { TaskDetailDto } from "@/lib/taskContracts";
import { buildWorkAssignmentPrintModel } from "@/lib/taskPrintModel";
import { journalismLabels } from "@/lib/journalismUi.mjs";
import PrintActions from "./PrintActions";

const displayDate = (value: string) => {
  if (value === "—") return value;
  const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(parsed);
};

const Field = ({ label, value }: { label: string; value: string }) => <div className="print-field"><dt>{label}</dt><dd>{value || "—"}</dd></div>;

export default function WorkAssignmentPrintSheet({ task, userLabel }: { task: TaskDetailDto; userLabel: string }) {
  const model = buildWorkAssignmentPrintModel(task);
  return <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 print:min-h-0 print:bg-white print:p-0">
    <div className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
      <a href={`/tasks/${task.id}`} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại công việc</a>
      <PrintActions />
    </div>
    <article className="print-sheet mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] shadow-lg print:max-w-none print:shadow-none">
      <header className="border-b-2 border-slate-900 pb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">BÁO THỜI ĐẠI</p>
        <h1 className="mt-2 text-2xl font-bold tracking-wide">PHIẾU GIAO VIỆC</h1>
        <p className="mt-1 text-sm text-slate-600">Mã công việc: {model.id}</p>
      </header>

      <section className="print-section mt-5">
        <h2>Thông tin giao việc</h2>
        <dl className="print-grid mt-3">
          <Field label="Ngày giao" value={displayDate(model.assignedDate)} />
          <Field label="Loại công việc" value={model.taskType} />
          <Field label="Phòng ban" value={model.department} />
          <Field label="Mức độ ưu tiên" value={model.priority} />
          <Field label="Người giao việc" value={model.assigner} />
          <Field label="Người nhận việc" value={model.primaryAssignee} />
          <Field label="Người phối hợp" value={model.collaborators.join(", ") || "—"} />
          <Field label="Hạn hoàn thành" value={model.deadline} />
        </dl>
      </section>

      <section className="print-section mt-5">
        <h2>Nội dung công việc</h2>
        <dl className="mt-3 grid gap-3">
          <Field label="Tên công việc" value={model.title} />
          <div className="print-field"><dt>Mô tả</dt><dd className="whitespace-pre-wrap">{model.description}</dd></div>
          <div className="print-field"><dt>Yêu cầu</dt>{model.requirements.length ? <dd><ol className="list-decimal space-y-1 pl-5">{model.requirements.map((item, index) => <li key={index}>{item}</li>)}</ol></dd> : <dd>—</dd>}</div>
          <div className="print-field"><dt>Ghi chú</dt><dd className="whitespace-pre-wrap">{model.notes}</dd></div>
        </dl>
      </section>

      {model.journalism ? <section className="print-section mt-5">
        <h2>Thông tin nghiệp vụ báo chí</h2>
        <dl className="print-grid mt-3">
          <Field label={journalismLabels.topic} value={model.journalism.topics.join(", ") || "—"} />
          <Field label={journalismLabels.series} value={model.journalism.series} />
          <Field label="Ngày dự kiến xuất bản" value={displayDate(model.journalism.plannedPublicationDate)} />
          <Field label={journalismLabels.publicationStatus} value={model.journalism.publicationStatus} />
        </dl>
      </section> : null}

      <section className="signature-grid mt-14">
        <div><h2>NGƯỜI GIAO VIỆC</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.assigner}</strong></div>
        <div><h2>NGƯỜI NHẬN VIỆC</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.primaryAssignee}</strong></div>
        <div><h2>NGƯỜI PHỐI HỢP</h2><p>(ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.collaborators.join(", ") || "—"}</strong></div>
      </section>
      <footer className="mt-8 border-t pt-3 text-right text-xs text-slate-500">Phiếu được in từ Thời Đại Work · Người xem: {userLabel}</footer>
    </article>
  </main>;
}

