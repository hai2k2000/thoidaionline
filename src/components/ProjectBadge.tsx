"use client";
import Link from "next/link";
export default function ProjectBadge({ projectId, projectName }: { projectId?: string | null; projectName?: string | null }) {
  if (!projectId) return null;
  return <Link href={`/projects/${projectId}`} onClick={(event) => event.stopPropagation()} className="ml-2 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">{projectName ?? "D\u1ef1 \u00e1n"}</Link>;
}
