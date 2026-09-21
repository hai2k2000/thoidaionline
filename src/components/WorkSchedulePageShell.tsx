"use client";

import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";

type Person = {
  id: string;
  full_name: string;
  roles?: { code?: string } | null;
  job_titles?: { code?: string } | null;
};

type Row = {
  id: string;
  work_date: string;
  end_date: string;
  plan_type: "work" | "business" | "event";
  start_time: string | null;
  end_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  participant_ids: string[];
  created_by: string;
  schedule_scope: "personal" | "organization" | null;
  approval_status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | null;
  approver?: { full_name?: string } | null;
  reviewer?: { full_name?: string } | null;
  reviewed_at: string | null;
  review_note: string | null;
  workflow_revision: number;
  creator?: { full_name?: string } | null;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

const role = (person: Person) =>
  person.roles?.code === "tong_bien_tap"
    ? "Tổng biên tập"
    : person.roles?.code === "pho_tong_bien_tap"
      ? "Phó Tổng biên tập"
      : person.job_titles?.code?.startsWith("truong_phong")
        ? "Trưởng phòng"
        : person.job_titles?.code?.startsWith("phong_vien")
          ? "Phóng viên"
          : "Nhân sự";

const approvalLabel = (status: Row["approval_status"]) => status === "PENDING_APPROVAL"
  ? "Chờ phê duyệt"
  : status === "REJECTED" ? "Từ chối" : "Đã duyệt";

export default function WorkSchedulePageShell({
  people,
  currentUserId,
  approvalActorId,
  userLabel,
  scheduleScope = "all",
  title = "Lịch công tác",
  description = "Lịch toàn cơ quan · TBT · Phó TBT · Trưởng phòng · Phóng viên",
}: {
  people: Person[];
  currentUserId?: string;
  approvalActorId?: string;
  userLabel: string;
  scheduleScope?: "all" | "self";
  title?: string;
  description?: string;
}) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(iso(new Date()));
  const [selected, setSelected] = useState(people.map((person) => person.id));
  const [viewAll, setViewAll] = useState(scheduleScope === "all");
  const [personQuery, setPersonQuery] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [approvalRows, setApprovalRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [month, setMonth] = useState(anchor.slice(0, 7));
  const [week, setWeek] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [planType, setPlanType] = useState<"business" | "event">("business");

  const weeks = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(year, monthNumber - 1, 1, 12);
    const last = new Date(year, monthNumber, 0, 12);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const output: { start: Date; end: Date }[] = [];

    for (
      let date = new Date(start);
      date <= last || output.length < 5;
      date.setDate(date.getDate() + 7)
    ) {
      const end = new Date(date);
      end.setDate(date.getDate() + 6);
      output.push({ start: new Date(date), end });
    }

    return output;
  }, [month]);

  const range = useMemo(() => {
    if (period === "day") {
      const date = new Date(`${anchor}T12:00:00`);
      return { from: iso(date), to: iso(date), days: [date] };
    }

    const start =
      period === "month"
        ? new Date(weeks[week]?.start ?? new Date())
        : new Date(`${anchor}T12:00:00`);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return {
      from: iso(start),
      to: iso(end),
      days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
      }),
    };
  }, [anchor, period, week, weeks]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const endpoint = viewAll ? "/api/work-schedule" : "/api/work-schedule/personal";
    const query = viewAll ? `?from=${range.from}&to=${range.to}` : `?from=${range.from}&to=${range.to}&scope=self`;
    fetch(`${endpoint}${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setRows(body.rows ?? []))
      .catch((error) => { if (error?.name !== "AbortError") setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range.from, range.to, retryToken, viewAll]);

  useEffect(() => {
    if (scheduleScope !== "all") return;
    fetch("/api/work-schedule/personal?scope=approval")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setApprovalRows(body.rows ?? []))
      .catch(() => setApprovalRows([]));
  }, [retryToken, scheduleScope]);

  useEffect(() => {
    setViewAll(scheduleScope === "all");
  }, [scheduleScope]);

  const filteredPeople = useMemo(() => {
    const query = personQuery.trim().toLocaleLowerCase("vi-VN");
    if (!query) return people;
    return people.filter((person) =>
      `${person.full_name} ${role(person)}`.toLocaleLowerCase("vi-VN").includes(query),
    );
  }, [people, personQuery]);

  const displayedPeople = viewAll || !currentUserId
    ? people.filter((person) => selected.includes(person.id))
    : people.filter((person) => person.id === currentUserId);
  const selectedCount = displayedPeople.length;
  const names = (ids: string[]) =>
    ids
      .map((id) => people.find((person) => person.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");

  const selectAll = () => setSelected(people.map((person) => person.id));
  const clearAll = () => setSelected([]);
  const createPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateBusy(true);
    setCreateMessage("");
    const form = new FormData(event.currentTarget);
    const workDate = String(form.get("workDate") ?? "");
    const personalMode = scheduleScope === "self";
    const payload = {
      planType,
      workDate,
      endDate: planType === "event" ? workDate : form.get("endDate"),
      startTime: form.get("startTime"),
      endTime: form.get("endTime"),
      title: form.get("title"),
      location: form.get("location"),
      notes: form.get("notes"),
      participantIds: personalMode ? [currentUserId] : selected,
      ...(editingRow ? { id: editingRow.id, ...(personalMode ? { workflowRevision: editingRow.workflow_revision } : {}) } : {}),
    };
    try {
      const endpoint = personalMode ? "/api/work-schedule/personal" : "/api/work-schedule";
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      setCreateMessage(personalMode ? "Đã gửi kế hoạch chờ phê duyệt." : "Đã lưu lịch công tác.");
      event.currentTarget.reset();
      setEditingRow(null);
      setTimeout(() => setCreateOpen(false), 500);
      setRetryToken((value) => value + 1);
    } catch {
      setCreateMessage("Không thể tạo kế hoạch. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setCreateBusy(false);
    }
  };
  const deletePlan = async (id: string) => {
    if (!window.confirm("Xóa kế hoạch này?")) return;
    const endpoint = scheduleScope === "self" ? "/api/work-schedule/personal" : "/api/work-schedule";
    const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setRetryToken((value) => value + 1);
  };
  const reviewPlan = async (row: Row, action: "approve" | "reject") => {
    const note = action === "reject" ? window.prompt("Lý do từ chối (bắt buộc):", "")?.trim() ?? "" : "";
    if (action === "reject" && note.length < 3) return;
    const response = await fetch("/api/work-schedule/personal", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, action, note, workflowRevision: row.workflow_revision }),
    });
    if (response.ok) setRetryToken((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <AppNav currentPath="/work-schedule" userLabel={userLabel} onLogout={() => {}} />
        <main className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              Lịch làm việc
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-600">{description}</p>
          </header>

          <section className="mt-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              {period === "day" ? (
                <label className="text-sm font-semibold">
                  Ngày
                  <input
                    type="date"
                    value={anchor}
                    onChange={(event) => setAnchor(event.target.value)}
                    className="ml-2 rounded border px-3 py-2 font-normal"
                  />
                </label>
              ) : (
                <>
                  <label className="text-sm font-semibold">
                    Năm
                    <select
                      value={month.slice(0, 4)}
                      onChange={(event) => setMonth(`${event.target.value}-${month.slice(5, 7)}`)}
                      className="ml-2 rounded border px-3 py-2 font-normal"
                    >
                      {[2025, 2026, 2027].map((year) => (
                        <option key={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Tháng
                    <select
                      value={month.slice(5, 7)}
                      onChange={(event) => setMonth(`${month.slice(0, 4)}-${event.target.value}`)}
                      className="ml-2 rounded border px-3 py-2 font-normal"
                    >
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index} value={String(index + 1).padStart(2, "0")}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Tuần
                    <select
                      value={week}
                      onChange={(event) => {
                        const nextWeek = Number(event.target.value);
                        setWeek(nextWeek);
                        setAnchor(iso(weeks[nextWeek].start));
                        setPeriod("week");
                      }}
                      className="ml-2 rounded border px-3 py-2 font-normal"
                    >
                      {weeks.map((item, index) => (
                        <option key={index} value={index}>
                          Tuần {index + 1} ({String(item.start.getDate()).padStart(2, "0")}/
                          {String(item.start.getMonth() + 1).padStart(2, "0")} - {String(item.end.getDate()).padStart(2, "0")}/
                          {String(item.end.getMonth() + 1).padStart(2, "0")})
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setAnchor(iso(new Date()));
                  setPeriod("day");
                }}
                className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Hôm nay
              </button>
            </div>

            {viewAll || currentUserId ? <div className="mt-5 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{viewAll ? "Kế hoạch toàn cơ quan" : "Kế hoạch của tôi"}</h2>
                    <span
                      role="status"
                      aria-live="polite"
                      className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800"
                    >
                      {viewAll ? `${selectedCount}/${people.length} đã chọn` : "Mặc định"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{viewAll ? "Hiển thị kế hoạch của nhân sự đang hoạt động." : "Chỉ hiển thị kế hoạch có liên quan đến bạn."}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { setPlanType("business"); setCreateMessage(""); setCreateOpen(true); }} className="min-h-10 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700">Tạo kế hoạch</button>
                  <button
                    type="button"
                    onClick={() => { setViewAll((current) => !current); setPeopleOpen(false); }}
                    className="min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                  >
                    {viewAll ? "Kế hoạch của tôi" : "Kế hoạch toàn cơ quan"}
                  </button>
                  {viewAll ? <button type="button" onClick={() => setPeopleOpen((current) => !current)} aria-expanded={peopleOpen} aria-controls="work-schedule-people-panel" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">{peopleOpen ? "Ẩn bộ lọc" : "Lọc nhân sự"}</button> : null}
                </div>
              </div>

              {peopleOpen ? (
                <div
                  id="work-schedule-people-panel"
                  className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-600">
                      Bỏ chọn một người sẽ ẩn người đó khỏi bảng.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAll}
                        disabled={selectedCount === people.length}
                        className="min-h-10 rounded-lg border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        disabled={selectedCount === 0}
                        className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <label className="mt-3 block text-xs font-semibold text-slate-700">
                    Tìm nhân sự
                    <input
                      type="search"
                      value={personQuery}
                      onChange={(event) => setPersonQuery(event.target.value)}
                      placeholder="Nhập tên hoặc chức danh…"
                      className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>

                  <div className="mt-3 grid max-h-56 grid-cols-1 gap-x-5 gap-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredPeople.length ? (
                      filteredPeople.map((person) => (
                        <label
                          key={person.id}
                          className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm transition hover:bg-orange-50"
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5 shrink-0 accent-orange-600 focus:ring-2 focus:ring-orange-500"
                            checked={selected.includes(person.id)}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(person.id)
                                  ? current.filter((id) => id !== person.id)
                                  : [...current, person.id],
                              )
                            }
                          />
                          <span className="min-w-0 truncate" title={person.full_name}>
                            {person.full_name}
                          </span>
                          <em className="shrink-0 text-xs not-italic text-slate-500">
                            ({role(person)})
                          </em>
                        </label>
                      ))
                    ) : (
                      <p className="col-span-full px-2 py-3 text-sm text-slate-500">
                        Không tìm thấy nhân sự phù hợp.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div> : null}
          </section>
          {scheduleScope === "all" && approvalRows.length ? <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <h2 className="font-bold text-amber-950">Kế hoạch cá nhân chờ phê duyệt</h2>
            <div className="mt-3 grid gap-2">
              {approvalRows.filter((row) => row.created_by !== approvalActorId).map((row) => <article key={row.id} className="rounded-lg border bg-white p-3 text-sm">
                <p className="font-semibold">{row.title}</p>
                <p className="text-slate-600">{row.work_date} {row.start_time?.slice(0, 5)}-{row.end_time?.slice(0, 5)} · {row.creator?.full_name ?? ""}</p>
                <div className="mt-2 flex gap-2"><button type="button" onClick={() => void reviewPlan(row, "approve")} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Duyệt</button><button type="button" onClick={() => void reviewPlan(row, "reject")} className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Từ chối</button></div>
              </article>)}
            </div>
          </section> : null}

          {loading ? <p className="mt-3 rounded-xl border bg-white p-5 text-sm text-slate-600 shadow-sm">Đang tải lịch công tác...</p> : null}
          {!loading && loadError ? <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>Không tải được lịch công tác. Dữ liệu cũ được giữ nguyên để tránh hiển thị nhầm là lịch trống.</span><button type="button" onClick={() => setRetryToken((value) => value + 1)} className="rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold">Thử lại</button></div> : null}
          {!loadError ? <section className="table-scroll mt-3 rounded-xl border bg-white shadow-sm">
            <table className="work-schedule-table data-table w-full min-w-[1290px] border-collapse text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-56" />
                {range.days.map((date) => (
                  <col key={`column-${iso(date)}`} className="w-36" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b bg-slate-100 text-center">
                  <th scope="col" className="w-14 min-w-14 p-2">STT</th>
                  <th scope="col" className="w-56 min-w-56 p-2 text-left">Họ và tên</th>
                  {range.days.map((date, index) => (
                    <th scope="col" key={iso(date)} className="min-w-[145px] p-2">
                      {["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"][index]}
                      <br />
                      <span className="font-normal">
                        ({String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedPeople
                  .map((person, index) => (
                    <tr key={person.id} className="border-b align-top">
                      <td className="p-2 text-center">{index + 1}</td>
                      <td className="whitespace-nowrap p-2 font-semibold">
                        {person.full_name}
                        <span className="block text-xs font-normal text-slate-500">{role(person)}</span>
                      </td>
                      {range.days.map((date) => (
                        <td key={iso(date)} className="p-1">
                          {rows
                            .filter(
                              (row) =>
                                row.work_date <= iso(date) && row.end_date >= iso(date) && row.participant_ids.includes(person.id),
                            )
                            .map((row) => (
                              <article
                                key={row.id}
                                className="mb-1 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-2 text-xs text-orange-950"
                              >
                                <b>{row.start_time ? `${row.start_time.slice(0, 5)}${row.end_time ? `-${row.end_time.slice(0, 5)}` : ""}` : ""}</b>
                                <p className="font-semibold">{row.plan_type === "business" ? "Công tác: " : row.plan_type === "event" ? "Sự kiện: " : ""}{row.title}</p>
                                {row.location ? <p>{row.location}</p> : null}
                                <p>{names(row.participant_ids)}</p>
                                {!viewAll ? <div className="mt-2 space-y-1">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${row.approval_status === "REJECTED" ? "bg-red-100 text-red-700" : row.approval_status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{approvalLabel(row.approval_status)}</span>
                                  {row.approval_status === "PENDING_APPROVAL" ? <p className="text-amber-800">Kế hoạch chưa có hiệu lực cho đến khi được duyệt.</p> : null}
                                  {row.approver?.full_name ? <p>Người duyệt dự kiến: {row.approver.full_name}</p> : null}
                                  {row.reviewer?.full_name ? <p>Người duyệt: {row.reviewer.full_name}</p> : null}
                                  {row.reviewed_at ? <p>Thời gian duyệt: {new Date(row.reviewed_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p> : null}
                                  {row.approval_status === "REJECTED" && row.review_note ? <p className="text-red-700">Lý do từ chối: {row.review_note}</p> : null}
                                </div> : null}
                                {currentUserId && row.created_by === currentUserId ? <div className="mt-2 flex gap-2"><button type="button" onClick={() => { setPlanType(row.plan_type === "event" ? "event" : "business"); setEditingRow(row); setCreateMessage(""); setCreateOpen(true); }} className="rounded border border-orange-300 bg-white px-2 py-1 text-[11px] font-semibold text-orange-700">Sửa kế hoạch</button><button type="button" onClick={() => void deletePlan(row.id)} className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-semibold text-red-700">Xóa kế hoạch</button></div> : null}
                              </article>
                            ))}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </section> : null}
          {createOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-plan-title" onClick={(event) => { if (event.target === event.currentTarget) { setEditingRow(null); setCreateOpen(false); } }}>
            <form key={editingRow?.id ?? "new"} onSubmit={createPlan} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between"><h2 id="create-plan-title" className="text-lg font-semibold">{editingRow ? "Sửa kế hoạch cá nhân" : "Tạo kế hoạch cá nhân"}</h2><button type="button" onClick={() => { setEditingRow(null); setCreateOpen(false); }} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng">×</button></div>
              <p className="mt-1 text-sm text-slate-600">Kế hoạch mới và kế hoạch đã duyệt sau khi sửa sẽ chuyển sang Chờ phê duyệt. Kế hoạch chờ duyệt chưa có hiệu lực.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Loại kế hoạch<select name="planType" value={planType} onChange={(event) => setPlanType(event.target.value as "business" | "event")} className="mt-1 min-h-11 w-full rounded border px-3 py-2"><option value="business">Đi công tác</option><option value="event">Sự kiện</option></select></label>
                <label className="text-sm font-medium">Tiêu đề<input name="title" required maxLength={500} defaultValue={editingRow?.title ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
                <label className="text-sm font-medium">{planType === "event" ? "Ngày sự kiện" : "Từ ngày"}<input name="workDate" type="date" required defaultValue={editingRow?.work_date ?? iso(new Date())} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
                {planType === "business" ? <label className="text-sm font-medium">Đến ngày<input name="endDate" type="date" required defaultValue={editingRow?.end_date ?? iso(new Date())} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label> : null}
                <label className="text-sm font-medium">Từ giờ<input name="startTime" type="time" required={scheduleScope === "self" || planType === "event"} defaultValue={editingRow?.start_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
                <label className="text-sm font-medium">Đến giờ<input name="endTime" type="time" required={scheduleScope === "self" || planType === "event"} defaultValue={editingRow?.end_time?.slice(0, 5) ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
              </div>
              <label className="mt-3 block text-sm font-medium">Địa điểm<input name="location" maxLength={500} defaultValue={editingRow?.location ?? ""} className="mt-1 min-h-11 w-full rounded border px-3 py-2" /></label>
              <label className="mt-3 block text-sm font-medium">Ghi chú<textarea name="notes" maxLength={2000} defaultValue={editingRow?.notes ?? ""} className="mt-1 min-h-20 w-full rounded border px-3 py-2" /></label>
              {createMessage ? <p role="status" className="mt-2 text-sm text-slate-700">{createMessage}</p> : null}
              <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setEditingRow(null); setCreateOpen(false); }} className="rounded border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={createBusy} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{createBusy ? "Đang lưu..." : editingRow ? "Cập nhật kế hoạch" : "Lưu kế hoạch"}</button></div>
            </form>
          </div> : null}
        </main>
      </div>
    </div>
  );
}
