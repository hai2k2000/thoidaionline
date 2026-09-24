"use client";

import Link from "next/link";
import AppNav from "@/components/AppNav";
import { journalismReportingHref } from "@/lib/journalismReportingFilters.mjs";
import { journalismPublicationStatusLabels, journalismTaskStatusLabels, journalismVerificationStatusLabels } from "@/lib/journalismUi.mjs";
import type { JournalismReportingQuery } from "@/lib/journalismReportingRepository";
import type { JournalismReportingResult } from "@/lib/journalismReportingRepository";

const verificationLabels: Record<string, string> = journalismVerificationStatusLabels;
const statusLabels: Record<string, string> = journalismTaskStatusLabels;
const publicationLabels: Record<string, string> = journalismPublicationStatusLabels;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00+07:00`)) : "—";

type Props = {
  userLabel: string;
  query: JournalismReportingQuery;
  data: JournalismReportingResult | null;
  error: boolean;
};

export default function JournalismReportingDashboard({ userLabel, query, data, error }: Props) {
  const options = data ? {
    departments: data.byDepartment.filter((row) => row.id !== "unassigned"),
    assignees: data.byAssignee.filter((row) => row.id !== "unassigned"),
    topics: data.byTopic,
    series: data.bySeries,
  } : { departments: [], assignees: [], topics: [], series: [] };
  const clearHref = journalismReportingHref({ ...query, departmentId: null, assigneeId: null, topicId: null, seriesId: null, status: null, publicationStatus: null, verificationStatus: null });
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath="/journalism/reports" userLabel={userLabel} />
      <main className="min-w-0 flex-1 space-y-3">
        <header className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Báo cáo nghiệp vụ báo chí · Nội bộ</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Báo cáo nghiệp vụ báo chí</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Tổng hợp từ công việc nghiệp vụ báo chí, báo cáo xuất bản thủ công và lịch sử xác minh trong Thời Đại Work. Đây là dữ liệu nội bộ, không phải xác nhận từ hệ thống bên ngoài.</p></header>
        <form method="get" action="/journalism/reports" className="grid gap-3 rounded-xl border bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Công việc tạo từ<input name="from" type="date" defaultValue={query.fromDate} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Công việc tạo đến<input name="to" type="date" defaultValue={query.toDate} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Phòng ban<select name="department" defaultValue={query.departmentId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả trong phạm vi được xem</option>{options.departments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Người phụ trách<select name="assignee" defaultValue={query.assigneeId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả</option>{options.assignees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Chủ đề<select name="topic" defaultValue={query.topicId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả</option>{options.topics.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Loạt bài<select name="series" defaultValue={query.seriesId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả</option>{options.series.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Trạng thái công việc<select name="status" defaultValue={query.status ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Trạng thái xuất bản<select name="publicationStatus" defaultValue={query.publicationStatus ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả</option>{Object.entries(publicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Xác minh<select name="verificationStatus" defaultValue={query.verificationStatus ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="">Tất cả báo cáo đã ghi nhận</option>{Object.entries(verificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex items-end gap-2"><button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Lọc</button><Link href={clearHref} className="rounded-lg border px-4 py-2 font-semibold">Đặt lại</Link></div>
        </form>
        <p className="text-xs text-slate-500">Khoảng thời gian chính dựa trên ngày tạo công việc nghiệp vụ báo chí: {date(query.fromDate)} – {date(query.toDate)}.</p>
        {error ? <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">Không thể tải báo cáo trong phạm vi dữ liệu được phép xem.</section> : null}
        {!error && data ? <>
          {data.truncated ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Dữ liệu vượt giới hạn truy vấn an toàn {(5000).toLocaleString("vi-VN")} Task; toàn bộ chỉ số và bảng đang hiển thị phần dữ liệu đầu. Hãy thu hẹp khoảng thời gian.</p> : null}
          <section aria-label="Chỉ số tổng quan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><Kpi label="Tổng công việc nghiệp vụ báo chí" value={data.totalTasks} /><Kpi label="Đã ghi nhận xuất bản" value={data.reportedPublications} hint="Có báo cáo xuất bản thủ công" /><Kpi label="Chưa ghi nhận xuất bản" value={data.unreportedTasks} /><Kpi label="Đã xác minh" value={data.verificationVerified} /><Kpi label="Chưa xác minh" value={data.verificationUnverified} /><Kpi label="Bị từ chối" value={data.verificationRejected} /><Kpi label="Cần xác minh lại" value={data.verificationStale} /><Kpi label="Quá hạn" value={data.overdue} /></section>
          <div className="grid items-start gap-3 xl:grid-cols-2"><ReportTable title="Theo người phụ trách" headers={["Người phụ trách", "Công việc", "Báo cáo", "Đã xác minh", "Từ chối", "Cần xác minh lại", "Quá hạn"]} rows={data.byAssignee.map((row) => [row.name, row.tasks, row.reports, row.verified, row.rejected, row.stale, row.overdue])} empty="Chưa có dữ liệu người phụ trách trong phạm vi này." /><ReportTable title="Theo phòng ban" headers={["Phòng ban", "Công việc", "Báo cáo", "Đã xác minh", "Từ chối", "Cần xác minh lại", "Quá hạn"]} rows={data.byDepartment.map((row) => [row.name, row.tasks, row.reports, row.verified, row.rejected, row.stale, row.overdue])} empty="Chưa có dữ liệu phòng ban trong phạm vi này." /></div>
          <div className="grid items-start gap-3 xl:grid-cols-2"><ReportTable title="Theo Chủ đề" headers={["Chủ đề", "Công việc", "Báo cáo", "Đã xác minh"]} rows={data.byTopic.map((row) => [row.name, row.tasks, row.reports, row.verified])} empty="Chưa có Chủ đề trong phạm vi này." /><ReportTable title="Theo Loạt bài" headers={["Loạt bài", "Công việc", "Báo cáo", "Đã xác minh"]} rows={data.bySeries.map((row) => [row.name, row.tasks, row.reports, row.verified])} empty="Chưa có Loạt bài trong phạm vi này." /></div>
          <section className="rounded-xl border bg-white p-3 shadow-sm"><h2 className="text-lg font-bold">Xuất bản gần đây</h2><p className="mt-1 text-xs text-slate-500">Tối đa 15 báo cáo, sắp xếp theo thời gian xuất bản.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm"><thead><tr className="border-b text-left text-slate-600"><th className="p-2">Thời gian</th><th className="p-2">Công việc</th><th className="p-2">Tiêu đề</th><th className="p-2">Người ghi nhận</th><th className="p-2">Xác minh</th><th className="p-2">Liên kết</th></tr></thead><tbody>{data.recentPublications.map((row) => <tr key={row.taskId} className="border-b last:border-0"><td className="p-2 whitespace-nowrap">{date(row.publishedAt)}</td><td className="p-2"><Link href={`/tasks/${row.taskId}`} className="font-semibold text-orange-700 underline">{row.taskTitle}</Link></td><td className="p-2">{row.publishedTitle}</td><td className="p-2">{row.reporter}</td><td className="p-2">{verificationLabels[row.verificationStatus]}</td><td className="p-2"><a href={row.url} target="_blank" rel="noreferrer" className="break-all text-emerald-800 underline">Mở URL</a></td></tr>)}</tbody></table>{!data.recentPublications.length ? <p className="p-5 text-center text-sm text-slate-500">Chưa có báo cáo xuất bản trong khoảng thời gian này.</p> : null}</div></section>
          <section className="rounded-xl border bg-white p-3 shadow-sm"><h2 className="text-lg font-bold">Cần chú ý</h2><p className="mt-1 text-xs text-slate-500">Danh sách chỉ đọc; thao tác xử lý vẫn thực hiện ở chi tiết công việc.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.attention.map((row) => <Link key={`${row.kind}-${row.taskId}`} href={`/tasks/${row.taskId}`} className="rounded-lg border p-3 transition hover:border-orange-300 hover:bg-orange-50"><span className="text-xs font-semibold text-amber-700">{row.label}</span><span className="mt-1 block font-semibold">{row.taskTitle}</span></Link>)}</div>{!data.attention.length ? <p className="p-5 text-center text-sm text-slate-500">Không có mục cần chú ý.</p> : null}</section>
        </> : null}
      </main>
    </div>
  </div>;
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) { return <div className="rounded-xl border bg-white p-3 shadow-sm"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString("vi-VN")}</dd>{hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}</div>; }
function ReportTable({ title, headers, rows, empty }: { title: string; headers: string[]; rows: Array<Array<string | number>>; empty: string }) { return <section className="rounded-xl border bg-white p-3 shadow-sm"><h2 className="text-lg font-bold">{title}</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] border-collapse text-sm"><thead><tr className="border-b text-left text-slate-600">{headers.map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`p-2 ${cellIndex > 0 ? "text-center" : "font-semibold"}`}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length ? <p className="p-5 text-center text-sm text-slate-500">{empty}</p> : null}</div></section>; }
