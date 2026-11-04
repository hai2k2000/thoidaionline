import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
test('project detail uses a centered column while ordinary tasks retain the sidebar', () => {
  const text = source('TaskDetailShell.tsx');
  assert.match(text, /projectTask \? "mx-auto w-full max-w-4xl/);
  assert.match(text, /lg:grid-cols-\[minmax\(0,1fr\)_390px\]/);
  assert.match(text, /projectTask \? "space-y-4"/);
  assert.match(text, /Thư viện dự án/);
});
test('deadline presentation translates all classifier states', async () => {
  const { deadlineLabel } = await import('../lib/deadlinePresentation.mjs');
  for (const [state, label] of Object.entries({on_time:'Đúng hạn',due_soon:'Sắp đến hạn',overdue:'Quá hạn',no_deadline:'Không có hạn'})) assert.equal(deadlineLabel(state), label);
  assert.equal(deadlineLabel('unknown'), 'Chưa xác định');
  assert.doesNotMatch(source('TaskDetailShell.tsx'), /<span>\{deadlineState\}<\/span>/);
});
test('project task list has mobile cards and a desktop table', () => {
  const text = source('ProjectDetailShell.tsx');
  assert.match(text, /aria-label="Danh sách công việc trên điện thoại"/);
  assert.match(text, /hidden[^"\n]*md:block/);
  assert.match(text, /DeadlineChip/);
});
test('project assignment starts with recipient controls and an empty-state hint inside the form', () => {
  const text = source('CanonicalAssignmentForm.tsx');
  assert.match(text, /Chọn người nhận việc trước/);
  assert.ok(text.indexOf('{projectRecipientControls}', text.indexOf('<form onSubmit={submit}')) > 0);
});
