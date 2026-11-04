import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('Excel UI permission gates and lazy library loading', () => {
  const page = read('src/app/assets/page.tsx');
  assert.match(page, /import\("exceljs"\)/);
  assert.match(page, /hasPermission\("asset.view"\).*hasPermission\("asset.manage"\).*Xuất Excel/);
  assert.match(page, /hasPermission\("asset.manage"\)[\s\S]*Tải file mẫu[\s\S]*Nhập từ Excel/);
  assert.match(page, /filteredRows\.map/);
});
test('bulk import is authorized, same origin, uncached and audited', () => {
  const route = read('src/app/api/assets/bulk-import/route.ts');
  for (const pattern of [/isSameOriginRequest\(\)/, /canManageAssets\(actor\)/, /toAssetRepositoryActor/, /no-store/, /validateAssetRows/, /api_asset_bulk_import/, /logServerAudit/, /bulk_import/]) assert.match(route, pattern);
});
test('bulk RPC is restricted, transactional and serializes generated codes', () => {
  const sql = read('supabase/migrations/20261104100000_asset_bulk_import.sql');
  for (const pattern of [/security definer/i, /set search_path = public, pg_temp/i, /asset_actor_can_manage\(p_actor_id\)/, /pg_advisory_xact_lock/, /asset_validate_destination/, /revoke all on function public.api_asset_bulk_import\(uuid, jsonb\) from public, anon, authenticated/, /grant execute on function public.api_asset_bulk_import\(uuid, jsonb\) to service_role/]) assert.match(sql, pattern);
  for (const path of ['scripts/package-standalone.mjs', 'scripts/verify-standalone-artifact.mjs', 'scripts/standalone-packaging.test.mjs']) assert.ok(read(path).includes('20261104100000_asset_bulk_import.sql'));
});
