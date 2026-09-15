const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["all", "pending", "approved", "rejected", "cancelled"]);

const pad = (value) => String(value).padStart(2, "0");

export const monthRange = (month) => {
  if (!MONTH.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
  if (!Number.isFinite(lastDay) || monthNumber < 1 || monthNumber > 12) return null;
  return { start: `${month}-01`, end: `${month}-${pad(lastDay)}` };
};

export const defaultLeaveRequestFilters = (now = new Date()) => ({
  timeScope: "month",
  month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
  status: "all",
});

export const parseMineLeaveFilters = (params, fallbackFrom, fallbackTo) => {
  const scope = params.get("mineScope") ?? "month";
  const status = params.get("mineStatus") ?? "all";
  if ((scope !== "month" && scope !== "all") || !STATUSES.has(status)) return null;
  if (scope === "all") return { from: null, to: null, status };
  const explicitFrom = params.get("mineFrom") ?? fallbackFrom;
  const explicitTo = params.get("mineTo") ?? fallbackTo;
  const range = monthRange(params.get("mineMonth") ?? "") ?? (DATE.test(explicitFrom ?? "") && DATE.test(explicitTo ?? "") ? { start: explicitFrom, end: explicitTo } : null);
  if (!range || range.start > range.end) return null;
  return { from: range.start, to: range.end, status };
};
