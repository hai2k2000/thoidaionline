import type React from "react";
import { MobileCard, MobileCardList } from "@/components/mobile/MobileCardList";

export type ReportTableCardRow = { id: string; title: string; meta: Array<{ label: string; value: React.ReactNode }>; status?: React.ReactNode; children?: React.ReactNode };
export function ReportTableCards({ ariaLabel, empty, rows }: { ariaLabel: string; empty: string; rows: ReportTableCardRow[] }) {
  return <MobileCardList ariaLabel={ariaLabel} empty={empty}>{rows.map((row) => <MobileCard key={row.id} title={row.title} maxMeta={row.meta.length} status={row.status} meta={row.meta}>{row.children}</MobileCard>)}</MobileCardList>;
}
