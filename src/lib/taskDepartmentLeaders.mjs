const one = (value) => Array.isArray(value) ? value[0] : value;

export function isDepartmentDeputy(staff) {
  return staff?.active === true && [one(staff.roles), one(staff.job_titles)]
    .some((role) => role?.active === true && role.code?.toLowerCase() === 'pho_truong_phong');
}

export function departmentLeaderIds(userId, staff, departments) {
  return [...new Set(departments.filter((department) => department.active === true
    && (department.manager_id === userId || (isDepartmentDeputy(staff) && department.id === staff.department_id)))
    .map((department) => department.id))];
}

export async function loadDepartmentLeaderIds(db, userId) {
  const [staff, departments] = await Promise.all([
    db.from('staff_users').select('active,department_id,roles(code,active),job_titles(code,active)').eq('id', userId).maybeSingle(),
    db.from('departments').select('id,manager_id,active').eq('active', true),
  ]);
  if (staff.error || departments.error) return {data: [], error: staff.error ?? departments.error};
  return {data: departmentLeaderIds(userId, staff.data, departments.data ?? []), error: null};
}

export const hasGlobalPersonFilter = (roleCode) => ['admin', 'tong_bien_tap', 'pho_tong_bien_tap'].includes(roleCode);
