export function summarizeParticipants(names, limit = 5) {
  const safeLimit = Math.max(0, limit);
  return { names: names.slice(0, safeLimit), remaining: Math.max(0, names.length - safeLimit) };
}

export function splitCellEvents(rows, max = 3) {
  const safeMax = Math.max(0, max);
  return { visible: rows.slice(0, safeMax), overflow: rows.slice(safeMax) };
}
