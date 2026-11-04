"use client";

import { useState } from "react";
import ParticipantSelector, { type ParticipantPanel } from "@/components/ParticipantSelector";
import { taskListHref } from "@/lib/taskFilters.mjs";
import type { TaskListQuery } from "@/lib/taskContracts";

type Person = { id: string; fullName: string; username: string; departmentName: string };

export default function PersonFilter({ query, basePath, people }: { query: TaskListQuery; basePath: string; people: Person[] }) {
  const [open, setOpen] = useState<ParticipantPanel | null>(null);
  const selected = people.find((person) => person.id === query.personId);
  const navigate = (personId: string | null) => {
    window.location.href = taskListHref(query, {personId, page: 1}).replace(/^\/tasks/, basePath);
  };
  return <div className="grid min-w-0 gap-1">
    <ParticipantSelector label="Nhân sự" name="personPicker" people={people} selected={query.personId ? [query.personId] : []}
      onChange={(ids) => navigate(ids.find((id) => id !== query.personId) ?? null)}
      empty="Không có nhân sự phù hợp." panel="collaborator" openPanel={open} setOpenPanel={setOpen} />
    {query.personId ? <div className="flex items-center gap-2">
      <input type="hidden" name="personId" value={query.personId} />
      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs text-orange-900">{selected?.fullName ?? "Nhân sự đã chọn"}</span>
      <button type="button" onClick={() => navigate(null)} aria-label="Xóa bộ lọc nhân sự" className="px-2 text-sm font-bold">×</button>
    </div> : null}
  </div>;
}
