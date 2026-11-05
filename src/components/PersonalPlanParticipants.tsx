"use client";

import { useMemo, useState } from "react";
import { sortStaffRows } from "@/lib/staffOrdering";
import { outOfListEventMembers } from "@/lib/workScheduleEventAccess";

type Person = {
  id: string;
  full_name: string;
  job_titles?: { code?: string; name?: string } | null;
  departments?: { name?: string; code?: string } | null;
};

export default function PersonalPlanParticipants({ people, selected, onChange, disabled }: {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    const grouped = new Map<string, Person[]>();
    for (const person of sortStaffRows(people)) {
      const department = person.departments?.name ?? "Chưa xác định phòng ban";
      const label = `${person.full_name} ${person.job_titles?.name ?? person.job_titles?.code ?? ""} ${department}`;
      if (query && !label.toLocaleLowerCase("vi").includes(query)) continue;
      grouped.set(department, [...(grouped.get(department) ?? []), person]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [people, search]);
  const outside = outOfListEventMembers(selected, people);
  return <fieldset disabled={disabled} className="mt-3 rounded border p-3">
    <legend className="px-1 text-sm font-semibold">Chọn nhân sự · đã chọn {selected.length}</legend>
    {outside.length ? <div className="mb-3 flex flex-wrap gap-2">{outside.map((id) => <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-100 pl-3 text-sm text-amber-950">
      <span className="break-all">{id} · ngoài danh sách</span>
      <button type="button" aria-label={`Xóa thành viên ${id} ngoài danh sách`} onClick={() => onChange(selected.filter((member) => member !== id))} className="min-h-11 min-w-11 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500">×</button>
    </span>)}</div> : null}
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc chức danh" aria-label="Tìm nhân sự" className="mb-3 min-h-10 w-full rounded border px-3 py-2 text-sm" />
    <div className="grid gap-3">{groups.map(([department, members]) => <div key={department}>
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">{department}</h4>
      <div className="grid gap-2 sm:grid-cols-2">{members.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={selected.includes(person.id)} onChange={() => onChange(selected.includes(person.id) ? selected.filter((id) => id !== person.id) : [...selected, person.id])} />
        <span>{person.full_name}<span className="ml-1 text-xs text-slate-500">({person.job_titles?.name ?? person.job_titles?.code ?? "Nhân sự"})</span></span>
      </label>)}</div>
    </div>)}</div>
  </fieldset>;
}
