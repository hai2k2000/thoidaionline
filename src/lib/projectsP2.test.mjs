import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read = path => readFileSync(path, 'utf8');
test('project form skips department flow and restricts reviewers to project leads', () => {
 const source = read('src/components/CanonicalAssignmentForm.tsx');
 assert.match(source, /projectMode/);
 assert.match(source, /projectMode\.leads\.map/);
 assert.match(source, /reviewerId: projectMode \? reviewerId : assigneeId/);
 assert.match(source, /projectMode \? people : people\.filter/);
 assert.match(source, /projectRecipientControls/);
});
test('project navigation depends on membership or create permission', async () => {
 const source = read('src/components/phase2Navigation.ts').replace('"../lib/journalismUiHidden.mjs"', JSON.stringify(new URL('./journalismUiHidden.mjs', import.meta.url).href)).replace(/import .*workReportsPause.ts";/, 'const WORK_REPORTS_PAUSED = false; const PAUSED_WORK_REPORT_NAV_IDS = [];').replace('"../lib/collaboratorRole.mjs"', JSON.stringify(new URL('./collaboratorRole.mjs', import.meta.url).href));
 const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const {getPhase2Navigation} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
 const shows = access => getPhase2Navigation({roleCode:'ctv', ...access}).primary.some(i => i.id === 'projects');
 assert.equal(shows({}), false); assert.equal(shows({hasProjectMembership:true}), true); assert.equal(shows({canCreateProject:true}), true);
 assert.equal(shows({roleCode:'admin',canCreateProject:false,hasProjectMembership:false}), true);
 assert.equal(shows({roleCode:'tong_bien_tap',canCreateProject:false,hasProjectMembership:false}), false);
});
test('project badge is linked and included on task detail and desktop/mobile lists', () => {
 const badge = read('src/components/ProjectBadge.tsx');
 assert.match(badge, /\/projects\/\$\{projectId\}/);
 assert.match(badge, /projectName/);
 assert.match(read('src/components/TaskDetailShell.tsx'), /<ProjectBadge/);
 assert.ok((read('src/components/TaskCenterShell.tsx').match(/<ProjectBadge/g) ?? []).length >= 2);
 assert.match(read('src/lib/taskRepository.ts'), /project:projects!tasks_project_id_fkey\(name\)/);
});
test('project UI keeps task upload separate and retry never creates another task',()=>{
 const source=read('src/components/ProjectDetailShell.tsx');
 assert.match(source,/members\.filter\(m=>m\.staff_users\?\.active\)/);
 assert.match(source,/if\(createdTask\) return/);
 assert.match(source,/\/api\/tasks\/\$\{taskId\}\/attachments/);
 assert.match(source,/upload\(createdTask,attachment\)/);
 assert.match(source,/setCreatedTask\(result.task.id\)/);
});
test('project detail puts tasks before members and collapses members by default',()=>{
 const source=read('src/components/ProjectDetailShell.tsx');
 assert.ok(source.indexOf('Công việc trong dự án') < source.indexOf('Thành viên ('));
 assert.match(source,/<details[^>]*>\s*<summary[^>]*>[^<]*Thành viên/);
 const membersDetails=source.match(/<details([^>]*)>\s*<summary[^>]*>Thành viên[^]*?<\/details>/)?.[0];
 assert.ok(membersDetails);
 assert.doesNotMatch(membersDetails.split('>')[0],/\bopen\b/);
 assert.match(membersDetails,/m\.role==='lead'\|\|m\.role==='deputy'/);
 assert.match(membersDetails,/\$\{name\(m\.user_id\)\}/);
 assert.match(membersDetails,/isLead&&options\?<form/);
 assert.match(source,/searchParams\.get\("tab"\)==="library"/);
});
