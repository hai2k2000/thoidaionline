export function validateDepartmentTarget(row) {
  if (!row) return { ok: false, code: "department_not_found" };
  if (row.active !== true) return { ok: false, code: "inactive_department" };
  return { ok: true };
}

export function selectableHistoricalOptions(rows, currentId) {
  return rows
    .filter((row) => row.active === true || row.id === currentId)
    .map((row) => ({
      ...row,
      selectable: row.active === true,
      historical: row.active !== true,
    }));
}
