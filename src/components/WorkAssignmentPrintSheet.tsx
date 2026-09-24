import type { TaskDetailDto } from "@/lib/taskContracts";
import type { ReactNode } from "react";
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

const CalendarIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="print-icon" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M7 3.5v3M17 3.5v3M3.5 9h17" /></svg>;
const UserIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="print-icon" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.8-3.4 3-5.2 6.5-5.2s5.7 1.8 6.5 5.2" /></svg>;
const GroupIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="print-icon" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="2.8" /><circle cx="16.5" cy="9" r="2.2" /><path d="M3.8 19.7c.7-3.3 2.4-5 5.2-5s4.5 1.7 5.2 5M14 15.2c2.8.2 4.5 1.7 5.2 4.5" /></svg>;
const FileIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="print-icon" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M8.5 12h7M8.5 15.5h7" /></svg>;
const Field = ({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) => <div className="print-box"><dt><span className="print-field-label">{icon}{label}</span></dt><dd>{value || "—"}</dd></div>;
const SectionHeading = ({ number, children }: { number: string; children: ReactNode }) => <div className="print-section-heading"><span className="section-number">{number}</span><h2>{children}</h2></div>;

export default function WorkAssignmentPrintSheet({ task }: { task: TaskDetailDto }) {
  const model = buildWorkAssignmentPrintModel(task);
  return <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 print:min-h-0 print:bg-white print:p-0">
    <div className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
      <a href={`/tasks/${task.id}`} className="text-sm font-semibold text-orange-700 hover:underline">← Quay lại công việc</a>
      <PrintActions documentTitle={model.title} />
    </div>
    <article className="print-sheet mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] shadow-lg print:max-w-none print:shadow-none">
      <header className="print-header pb-4 text-center">
        <p className="print-publication" aria-label="Tạp chí Thời Đại">TẠP CHÍ THỜI ĐẠI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[0.12em]">PHIẾU GIAO VIỆC</h1>
        <p className="mt-1 text-sm font-semibold text-slate-700">{model.department}</p>
      </header>

      <section data-section="assignment" className="print-section-frame mt-5">
        <SectionHeading number="1">THÔNG TIN GIAO VIỆC</SectionHeading>
        <dl className="print-grid mt-3">
          <Field label="Ngày giao" value={formatPrintDate(model.assignedDate)} icon={<CalendarIcon />} />
          <Field label="Hạn hoàn thành" value={formatPrintDate(model.deadline)} icon={<CalendarIcon />} />
          <Field label="Người giao việc" value={model.assigner} icon={<UserIcon />} />
          <Field label="Người nhận việc" value={model.primaryAssignee} icon={<UserIcon />} />
          <div className="print-box print-field-full"><dt><span className="print-field-label"><GroupIcon />Người phối hợp (nếu có)</span></dt><dd>{model.collaborators.join(", ") || "—"}</dd></div>
        </dl>
      </section>

      <section data-section="content" className="print-section-frame mt-5">
        <SectionHeading number="2">NỘI DUNG CÔNG VIỆC</SectionHeading>
        <dl className="print-content-grid mt-3">
          <Field label="Tên công việc" value={model.title} icon={<FileIcon />} />
          <div className="print-box"><dt><span className="print-field-label"><FileIcon />Mô tả</span></dt><dd className="whitespace-pre-wrap">{model.description}</dd></div>
          <div className="print-box"><dt><span className="print-field-label"><FileIcon />Yêu cầu</span></dt>{model.requirements.length ? <dd><ol className="list-decimal space-y-1 pl-5">{model.requirements.map((item, index) => <li key={index}>{item}</li>)}</ol></dd> : <dd>—</dd>}</div>
          <div className="print-box"><dt><span className="print-field-label"><FileIcon />Ghi chú</span></dt><dd className="whitespace-pre-wrap">{model.notes}</dd></div>
        </dl>
        {model.journalism ? <div className="journalism-print-details">
          <h3>THÔNG TIN NGHIỆP VỤ BÁO CHÍ</h3>
          <dl className="print-grid mt-3">
            <Field label={journalismLabels.topic} value={model.journalism.topics.join(", ") || "—"} />
            <Field label={journalismLabels.series} value={model.journalism.series} />
            <Field label="Ngày dự kiến xuất bản" value={formatPrintDate(model.journalism.plannedPublicationDate)} />
            <Field label={journalismLabels.publicationStatus} value={model.journalism.publicationStatus} />
          </dl>
        </div> : null}
      </section>

      <section data-section="confirmation" className="signature-panel mt-8">
        <SectionHeading number="3">XÁC NHẬN</SectionHeading>
        <div className="signature-grid mt-4">
          <div><h2>NGƯỜI GIAO VIỆC</h2><p>(Ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.assigner}</strong></div>
          <div><h2>NGƯỜI NHẬN VIỆC</h2><p>(Ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.primaryAssignee}</strong></div>
          <div><h2>NGƯỜI PHỐI HỢP</h2><p>(Ký, ghi rõ họ tên)</p><div className="signature-space" /><strong>{model.collaborators.join(", ") || "—"}</strong></div>
        </div>
      </section>
    </article>
  </main>;
}
