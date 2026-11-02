const departmentOnlyRecordTypes = new Set(["danh_ba_nghiep_vu", "ngoai_ngu_danh_ba_doi_tac"]);

export function isDepartmentOnlyRecordType(code) {
  return departmentOnlyRecordTypes.has(code);
}
