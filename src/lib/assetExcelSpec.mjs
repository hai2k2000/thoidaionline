export const ASSET_SHEET = 'Danh sách tài sản';
export const TRACKING_MODES = { individual: 'Cá thể', lot: 'Theo lô' };
export const CONDITIONS = { normal: 'Bình thường', needs_maintenance: 'Cần bảo trì', under_service: 'Đang sửa chữa', broken: 'Hỏng' };
export const ASSET_COLUMNS = [
  ['asset_code', 'Mã tài sản', 20, 'Để trống để hệ thống tự sinh mã.'],
  ['asset_name', 'Tên tài sản *', 35, 'Bắt buộc nhập tên tài sản.'],
  ['category', 'Loại tài sản *', 25, 'Bắt buộc; nhập loại tài sản tự do.'],
  ['tracking_mode', 'Hình thức theo dõi', 22, 'Cá thể hoặc Theo lô; mặc định Cá thể.'],
  ['quantity', 'Số lượng', 14, 'Số nguyên từ 1; mặc định 1. Cá thể phải bằng 1.'],
  ['department', 'Phòng quản lý', 30, 'Tên phòng đang hoạt động; trống là chưa phân công.'],
  ['assignee', 'Người sử dụng', 30, 'Họ tên, tên đăng nhập hoặc email nhân viên đang hoạt động thuộc phòng; trống là tài sản dùng chung của phòng.'],
  ['location', 'Vị trí', 25, 'Tên vị trí đang hoạt động; có thể để trống.'],
  ['condition_status', 'Tình trạng', 22, 'Mặc định Bình thường.'],
  ['serial_number', 'Số serial', 24, 'Không bắt buộc.'],
  ['note', 'Ghi chú', 40, 'Không bắt buộc.'],
].map(([key, header, width, help]) => ({ key, header, width, help }));
export const normalizeExcelText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const headerKey = value => normalizeExcelText(value).replace(/\s*\*\s*$/, '');

export function parseAssetSheet(matrix) {
  const errors = [], rows = [], indices = new Map();
  (matrix[0] ?? []).forEach((value, index) => {
    const column = ASSET_COLUMNS.find(c => headerKey(c.header) === headerKey(value));
    if (column) {
      if (indices.has(column.key)) errors.push({ row_number: 1, message: `Cột ${column.header} bị lặp.` });
      indices.set(column.key, index);
    }
  });
  for (const key of ['asset_name', 'category']) if (!indices.has(key)) errors.push({ row_number: 1, message: `Thiếu cột ${ASSET_COLUMNS.find(c => c.key === key).header}.` });
  matrix.slice(1).forEach((cells, index) => {
    const values = Object.fromEntries(ASSET_COLUMNS.map(c => [c.key, text(cells[indices.get(c.key)])]));
    if (Object.values(values).some(Boolean)) rows.push({ row_number: index + 2, values });
  });
  if (rows.length > 1000) errors.push({ row_number: 1, message: 'Chỉ được nhập tối đa 1000 dòng dữ liệu.' });
  return { rows, errors };
}

export function validateAssetRows(input, { departments = [], users = [], locations = [], existingCodes = [] } = {}) {
  const errors = [], resolved = [], seen = new Set(), existing = new Set(existingCodes.map(c => text(c)));
  const fail = (row_number, message) => errors.push({ row_number, message });
  if (!Array.isArray(input) || !input.length || input.length > 1000) return { ok: false, valid_count: 0, resolved, errors: [{ row_number: 1, message: 'Cần từ 1 đến 1000 dòng dữ liệu.' }] };
  for (const row of input) {
    const n = Number.isInteger(row?.row_number) && row.row_number >= 2 ? row.row_number : 1;
    const start = errors.length;
    if (n === 1 || !row?.values || typeof row.values !== 'object' || Array.isArray(row.values)) { fail(n, 'Dòng dữ liệu không hợp lệ.'); continue; }
    const v = Object.fromEntries(ASSET_COLUMNS.map(c => [c.key, text(row.values[c.key])]));
    if (!Object.values(v).some(Boolean)) continue;
    for (const c of ASSET_COLUMNS) if (row.values[c.key] != null && typeof row.values[c.key] !== 'string' && typeof row.values[c.key] !== 'number') fail(n, `${c.header}: giá trị không hợp lệ.`);
    if (!v.asset_name) fail(n, 'Thiếu tên tài sản.');
    if (!v.category) fail(n, 'Thiếu loại tài sản.');
    const mapValue = (value, mapping, fallback) => value ? Object.keys(mapping).find(k => normalizeExcelText(mapping[k]) === normalizeExcelText(value)) : fallback;
    const tracking_mode = mapValue(v.tracking_mode, TRACKING_MODES, 'individual');
    const condition_status = mapValue(v.condition_status, CONDITIONS, 'normal');
    if (!tracking_mode) fail(n, 'Hình thức theo dõi phải là Cá thể hoặc Theo lô.');
    if (!condition_status) fail(n, 'Tình trạng không hợp lệ.');
    const quantity = v.quantity ? Number(v.quantity) : 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) fail(n, 'Số lượng phải là số nguyên từ 1 đến 2147483647.');
    else if (tracking_mode === 'individual' && quantity !== 1) fail(n, 'Tài sản Cá thể phải có số lượng bằng 1.');
    if (v.asset_code) {
      if (seen.has(v.asset_code)) fail(n, `Mã tài sản ${v.asset_code} bị trùng trong file.`);
      if (existing.has(v.asset_code)) fail(n, `Mã tài sản ${v.asset_code} đã tồn tại.`);
      seen.add(v.asset_code);
    }
    const resolve = (value, choices, label, fields = ['name']) => {
      if (!value) return null;
      const matches = choices.filter(c => c.active === true && fields.some(f => normalizeExcelText(c[f]) === normalizeExcelText(value)));
      if (matches.length !== 1) { fail(n, `${label} "${value}" ${matches.length ? 'trùng tên, cần dùng thông tin duy nhất' : 'không tồn tại hoặc không hoạt động'}.`); return null; }
      return matches[0].id;
    };
    const department_id = resolve(v.department, departments, 'Phòng quản lý');
    if (v.assignee && !v.department) fail(n, 'Có người sử dụng thì phải nhập phòng quản lý.');
    const assignee_id = v.assignee && department_id ? resolve(v.assignee, users.filter(u => u.department_id === department_id), 'Người sử dụng trong phòng', ['full_name', 'username', 'email']) : null;
    const location_id = resolve(v.location, locations, 'Vị trí');
    if (errors.length === start) resolved.push({ asset_code: v.asset_code || null, asset_name: v.asset_name, category: v.category, tracking_mode, quantity, department_id, assignee_id, location_id, condition_status, serial_number: v.serial_number || null, note: v.note || null });
  }
  if (!resolved.length && !errors.length) fail(1, 'Không có dòng dữ liệu để nhập.');
  return { ok: errors.length === 0, valid_count: resolved.length, errors, resolved };
}
