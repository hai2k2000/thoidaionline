const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function lastDayOfMonth(month: string): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error("invalid month");

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}
