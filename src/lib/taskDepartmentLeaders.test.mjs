import assert from 'node:assert/strict';
import test from 'node:test';

test('leader lookup recognizes active title or role deputies and deduplicates managed departments', async () => {
  const { departmentLeaderIds, isDepartmentDeputy } = await import('./taskDepartmentLeaders.mjs');
  assert.equal(isDepartmentDeputy({active: true, roles: {code: 'pho_truong_phong', active: true}}), true);
  assert.equal(isDepartmentDeputy({active: true, job_titles: {code: 'pho_truong_phong', active: true}}), true);
  assert.equal(isDepartmentDeputy({active: false, roles: {code: 'pho_truong_phong', active: true}}), false);
  assert.equal(isDepartmentDeputy({active: true, job_titles: {code: 'pho_truong_phong', active: false}}), false);
  const staff = {active: true, department_id: 'own', job_titles: {code: 'pho_truong_phong', active: true}};
  assert.deepEqual(departmentLeaderIds('leader', staff, [{id: 'own', active: true, manager_id: 'leader'}, {id: 'other', active: true, manager_id: 'leader'}, {id: 'inactive', active: false, manager_id: 'leader'}]), ['own', 'other']);
  assert.deepEqual(departmentLeaderIds('employee', {...staff, job_titles: null}, [{id: 'own', active: true, manager_id: 'leader'}]), []);
});

test('notification and scope consumers use the shared leader lookup', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync('src/lib/notificationRepository.ts', 'utf8'), /loadDepartmentLeaderIds/);
  assert.match(readFileSync('src/lib/taskRepository.ts', 'utf8'), /loadDepartmentLeaderIds/);
});
