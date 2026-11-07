import Link from "next/link";
import { MobileCard, MobileCardBadge, MobileCardList } from "@/components/mobile/MobileCardList";

export function JournalismReportCards({ title, headers, rows, empty }: { title: string; headers: string[]; rows: Array<Array<string | number>>; empty: string }) {
  return <MobileCardList ariaLabel={title} empty={empty}>{rows.map((row, index) => <MobileCard key={`${row[0]}-${index}`} title={row[0]} maxMeta={headers.length} meta={headers.slice(1).map((label, cellIndex) => ({ label, value: row[cellIndex + 1] }))} />)}</MobileCardList>;
}

export function JournalismPublicationCards({ rows, date, verificationLabels }: { rows: Array<{ taskId: string; publishedAt: string | null; taskTitle: string; publishedTitle: string; reporter: string; verificationStatus: string; url: string }>; date: (value: string | null) => string; verificationLabels: Record<string, string> }) {
  return <MobileCardList ariaLabel="Xuất bản gần đây" empty="Chưa có báo cáo xuất bản trong khoảng thời gian này.">{rows.map((row) => <MobileCard key={row.taskId} title={<Link href={`/tasks/${row.taskId}`} className="text-orange-700 underline">{row.taskTitle}</Link>} meta={[{ label: "Thời gian", value: date(row.publishedAt) }, { label: "Tiêu đề", value: row.publishedTitle }, { label: "Người ghi nhận", value: row.reporter }]} status={<MobileCardBadge tone="info">{verificationLabels[row.verificationStatus]}</MobileCardBadge>} footer={<a href={row.url} target="_blank" rel="noreferrer" className="text-emerald-800 underline">Mở URL</a>} />)}</MobileCardList>;
}
