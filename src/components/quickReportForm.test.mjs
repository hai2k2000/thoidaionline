import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { taskAttachmentMetadata, TASK_ATTACHMENT_MAX_BYTES } from '../lib/taskAttachmentPolicy.mjs';

function load(fetch) {
  const states = [], refs = [], pushes = []; let cursor = 0, refCursor = 0;
  const jsx = (type, props) => ({ type, props });
  const require = name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
    };
    if (name === 'next/navigation') return { useRouter: () => ({ push: path => pushes.push(path), refresh() {}, back() {} }), useSearchParams: () => new URLSearchParams('returnTo=/attendance') };
    if (name.endsWith('taskAttachmentPolicy.mjs')) return { taskAttachmentMetadata, TASK_ATTACHMENT_MAX_BYTES };
    if (name.endsWith('TaskAttachmentUploader')) return evaluate('TaskAttachmentUploader.tsx');
    if (name.endsWith('ActionFeedbackProvider') || name.endsWith('CameraCaptureButton') || name.endsWith('actionFeedback')) return {};
    throw new Error(name);
  };
  function evaluate(file) {
    const context = { exports: {}, require, fetch, FormData, crypto: globalThis.crypto };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
    return context.exports;
  }
  const component = evaluate('QuickReportForm.tsx').default;
  return { pushes, render() { cursor = refCursor = 0; return component(); } };
}
function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
function text(node) { if (node == null) return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(text).join(' '); return text(node.props?.children); }
const button = (ui, label) => nodes(ui).find(n => n.type === 'button' && text(n).includes(label));
function select(h, files, index = 0) {
  const input = nodes(h.render()).filter(n => n.type === 'input' && n.props.type === 'file')[index];
  assert.ok(input, 'file picker is present');
  input.props.onChange({ target: { files, value: 'selected' } });
}
const file = name => new File(['content'], name);
const tick = () => new Promise(resolve => setImmediate(resolve));
const created = () => Response.json({ tasks: [{ ordinal: 2, id: 'task-two' }, { ordinal: 1, id: 'task-one' }] }, { status: 201 });

test('picker validates types, empty files, size and cumulative count; chips can be removed', () => {
  const h = load();
  select(h, [file('bad.exe'), new File([], 'empty.pdf'), { name: 'big.pdf', size: TASK_ATTACHMENT_MAX_BYTES + 1 }]);
  assert.match(text(h.render()), /định dạng|Định dạng/);
  assert.match(text(h.render()), /rỗng/);
  assert.match(text(h.render()), /10 MB/);
  select(h, ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'].map(ext => file(`ok.${ext}`)));
  select(h, Array.from({ length: 5 }, (_, i) => file(`extra${i}.pdf`)));
  assert.match(text(h.render()), /tối đa 10 tệp/i);
  assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label']?.startsWith('Xóa tệp ')).length, 10);
  assert.match(text(h.render()), /KB/);
  nodes(h.render()).find(n => n.props?.['aria-label'] === 'Xóa tệp ok.pdf').props.onClick();
  assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label']?.startsWith('Xóa tệp ')).length, 9);
});

test('create precedes sequential uploads, maps ordinals and navigates only after success', async () => {
  const calls = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = load(async (url, init) => {
    calls.push([url, init]);
    if (calls.length === 1) return created();
    if (calls.length === 2) await gate;
    return Response.json({});
  });
  select(h, [file('first.pdf'), file('second.png')]);
  button(h.render(), '+ Thêm việc').props.onClick();
  select(h, [file('third.xlsx')], 1);
  const save = button(h.render(), 'Lưu 2 việc');
  save.props.onClick(); save.props.onClick();
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(h.pushes.length, 0);
  assert.match(text(h.render()), /Đang tải tệp \(1\/3\)/);
  assert.equal(nodes(h.render()).find(n => n.type === 'fieldset').props.disabled, true);
  assert.equal(JSON.parse(calls[0][1].body).rows[0].files, undefined);
  release(); await tick(); await tick();
  assert.deepEqual(calls.map(([url]) => url), ['/api/tasks/quick-report', '/api/tasks/task-one/attachments', '/api/tasks/task-one/attachments', '/api/tasks/task-two/attachments']);
  assert.deepEqual(calls.slice(1).map(([, init]) => init.body.get('file').name), ['first.pdf', 'second.png', 'third.xlsx']);
  assert.deepEqual(h.pushes, ['/attendance']);
});

test('partial failure keeps created tasks, continues uploads and waits for acknowledgement', async () => {
  const calls = [];
  const h = load(async (url, init) => {
    calls.push([url, init.method]);
    if (calls.length === 1) return created();
    if (calls.length === 2) return new Response('denied', { status: 403 });
    if (calls.length === 3) throw new Error('network');
    return Response.json({});
  });
  select(h, [file('denied.pdf'), file('offline.pdf'), file('ok.pdf')]);
  button(h.render(), 'Lưu 1 việc').props.onClick(); await tick(); await tick();
  assert.equal(calls.length, 4);
  assert.ok(calls.every(([, method]) => method === 'POST'));
  assert.equal(h.pushes.length, 0);
  const ui = h.render();
  assert.match(text(ui), /denied.pdf.*quyền/);
  assert.match(text(ui), /offline.pdf.*kết nối/);
  assert.equal(button(ui, 'Lưu 1 việc').props.disabled, true);
  assert.equal(nodes(ui).find(n => n.type === 'a' && text(n) === 'Mở công việc để đính kèm lại').props.href, '/tasks/task-one');
  button(ui, 'Đã hiểu').props.onClick();
  assert.deepEqual(h.pushes, ['/attendance']);
});

test('create failure does not upload or navigate and permits another save', async () => {
  const calls = [];
  const h = load(async url => { calls.push(url); return Response.json({ error: { message: 'Không thể lưu' } }, { status: 400 }); });
  select(h, [file('a.pdf')]);
  button(h.render(), 'Lưu 1 việc').props.onClick(); await tick();
  assert.deepEqual(calls, ['/api/tasks/quick-report']);
  assert.equal(h.pushes.length, 0);
  assert.equal(button(h.render(), 'Lưu 1 việc').props.disabled, false);
});

test('missing task id after creation reports unuploaded files without creating again', async () => {
  const calls = [];
  const h = load(async url => { calls.push(url); return Response.json({ tasks: [] }, { status: 201 }); });
  select(h, [file('missing.pdf')]);
  button(h.render(), 'Lưu 1 việc').props.onClick(); await tick();
  assert.deepEqual(calls, ['/api/tasks/quick-report']);
  assert.match(text(h.render()), /missing.pdf.*Không tìm thấy/);
  assert.equal(button(h.render(), 'Lưu 1 việc').props.disabled, true);
  assert.equal(h.pushes.length, 0);
});

test('no attachment preserves existing quick-report navigation', async () => {
  const calls = [];
  const h = load(async url => { calls.push(url); return created(); });
  button(h.render(), 'Lưu 1 việc').props.onClick(); await tick();
  assert.deepEqual(calls, ['/api/tasks/quick-report']);
  assert.deepEqual(h.pushes, ['/attendance']);
});
