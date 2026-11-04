import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_COLUMNS, parseAssetSheet, validateAssetRows } from './assetExcelSpec.mjs';
const row = (values = {}, row_number = 2) => ({ row_number, values: { asset_name: 'Máy tính', category: 'Thiết bị', ...values } });
const options = { departments: [{ id: 'd', name: 'Phòng Kế toán', active: true }], users: [{ id: 'u', full_name: 'Nguyễn An', username: 'an', email: 'an@test.vn', department_id: 'd', active: true }], locations: [{ id: 'l', name: 'Kho', active: true }], existingCodes: [] };
test('headers normalize accents, case, stars and ignore extra columns; blank rows skipped', () => {
  const headers = ASSET_COLUMNS.map(c => c.header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/\*/g, '').toUpperCase());
  const result = parseAssetSheet([headers.concat('extra'), ['', 'Máy', 'Thiết bị'], [], ['', '', '', '', '', '', '', '', '', '', '', 'ignored']]);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].row_number, 2); assert.equal(result.errors.length, 0);
});
test('defaults and normalized tracking/condition map correctly', () => {
  const result = validateAssetRows([row(), row({ tracking_mode: ' THEO LO ', quantity: 3, condition_status: 'dang sua chua' }, 3)], options);
  assert.equal(result.valid_count, 2); assert.equal(result.resolved[0].tracking_mode, 'individual'); assert.equal(result.resolved[0].quantity, 1); assert.equal(result.resolved[0].condition_status, 'normal'); assert.equal(result.resolved[1].tracking_mode, 'lot'); assert.equal(result.resolved[1].condition_status, 'under_service');
});
test('rejects duplicate codes, existing codes, missing department and individual quantity', () => {
  const result = validateAssetRows([row({ asset_code: 'A', quantity: 2 }), row({ asset_code: 'A', assignee: 'an' }, 3), row({ asset_code: 'B' }, 4)], { ...options, existingCodes: ['B'] });
  assert.equal(result.ok, false); assert.deepEqual([...new Set(result.errors.map(e => e.row_number))], [2, 3, 4]);
});
test('resolves active names and person aliases only within department', () => {
  const result = validateAssetRows([row({ department: 'phong ke toan', assignee: 'AN@TEST.VN', location: 'kho' })], options);
  assert.equal(result.ok, true); assert.equal(result.resolved[0].department_id, 'd'); assert.equal(result.resolved[0].assignee_id, 'u'); assert.equal(result.resolved[0].location_id, 'l');
  for (const values of [{ department: 'Không có' }, { location: 'Không có' }, { department: 'Phòng Kế toán', assignee: 'Không có' }]) assert.equal(validateAssetRows([row(values, 7)], options).errors[0].row_number, 7);
  assert.equal(validateAssetRows([row({ department: 'Phòng Kế toán', assignee: 'an' })], { ...options, users: [{ ...options.users[0], department_id: 'other' }] }).ok, false);
});
test('enforces 1000 nonblank rows and required headers', () => {
  assert.equal(validateAssetRows(Array.from({ length: 1000 }, (_, i) => row({}, i + 2)), options).ok, true);
  assert.equal(validateAssetRows(Array.from({ length: 1001 }, (_, i) => row({}, i + 2)), options).ok, false);
  assert.ok(parseAssetSheet([['Tên tài sản *']]).errors.length);
});
test('all tracking and condition labels accept accents and casing, invalid values fail', () => {
  for (const [label, expected] of [['binh thuong', 'normal'], [' CẦN BẢO TRÌ ', 'needs_maintenance'], ['dang sua chua', 'under_service'], ['HỎNG', 'broken']]) {
    const result = validateAssetRows([row({ tracking_mode: 'CA THE', condition_status: label })], options);
    assert.equal(result.ok, true); assert.equal(result.resolved[0].condition_status, expected);
  }
  for (const values of [{ tracking_mode: 'invalid' }, { condition_status: 'invalid' }, { quantity: 0 }, { quantity: 1.5 }, { quantity: 'abc' }, { asset_name: '' }, { category: '' }]) assert.equal(validateAssetRows([row(values)], options).ok, false);
});
test('inactive or ambiguous options fail instead of guessing; shared department resolves without person', () => {
  const shared = validateAssetRows([row({ department: 'PHONG KE TOAN' })], options);
  assert.equal(shared.ok, true); assert.equal(shared.resolved[0].assignee_id, null);
  for (const key of ['departments', 'users', 'locations']) {
    const input = row({ department: 'Phòng Kế toán', assignee: 'An', location: 'Kho' });
    assert.equal(validateAssetRows([input], { ...options, [key]: options[key].map(o => ({ ...o, active: false })) }).ok, false);
    assert.equal(validateAssetRows([input], { ...options, [key]: [...options[key], { ...options[key][0], id: 'duplicate' }] }).ok, false);
  }
});
test('malformed row values are rejected and blank rows do not count', () => {
  assert.equal(validateAssetRows([null], options).ok, false);
  assert.equal(validateAssetRows([row({ asset_name: { formula: 'bad' } })], options).ok, false);
  const result = validateAssetRows([{ row_number: 2, values: {} }, row({}, 5)], options);
  assert.equal(result.valid_count, 1);
});
