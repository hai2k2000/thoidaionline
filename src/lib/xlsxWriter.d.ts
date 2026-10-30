export type XlsxCellStyle = { font?: { bold?: boolean; size?: number; color?: string }; fill?: string; alignment?: { horizontal?: string; vertical?: string }; border?: boolean };
export type XlsxCell = { value: string | number | null | undefined; style?: string };
export type XlsxSheet = { name?: string; columns: Array<{ width: number }>; rows: Array<{ height?: number; cells: XlsxCell[] }>; merges?: string[]; freeze?: { rows: number; columns: number }; styles?: Record<string, XlsxCellStyle> };
export function crc32(value: Buffer | Uint8Array | string): number;
export function escapeXml(value: unknown): string;
export function writeXlsx(sheet: XlsxSheet): Buffer;
