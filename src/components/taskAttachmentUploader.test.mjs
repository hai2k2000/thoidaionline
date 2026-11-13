import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/taskAttachmentPolicy.mjs';
const { TASK_ATTACHMENT_MAX_BYTES } = policy;

function load(fetch = async () => Response.json({ attachment: { id: 'a' } })) {
  const notices = [], states = [], refs = []; let cursor = 0, refCursor = 0, refreshes = 0;
  const jsx = (type, props) => ({ type, props });
  const context = { exports: {}, FormData, fetch, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
      useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
    };
    if (name === 'next/navigation') return { useRouter: () => ({ refresh() { refreshes++; } }) };
    if (name.endsWith('ActionFeedbackProvider')) return { useActionFeedback: () => ({ notify: (...v) => notices.push(v) }) };
    if (name.endsWith('taskAttachmentPolicy.mjs')) return policy;
    if (name.endsWith('actionFeedback')) return { errorMessage: (e, fallback) => e?.message || fallback, responseErrorMessage: async (_, fallback) => fallback };
    if (name.endsWith('TaskLinkAttacher')) return { default: 'TaskLinkAttacher' };
    if (name.endsWith('CameraCaptureButton')) return { default: 'CameraCaptureButton' };
    throw new Error(name);
  } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./TaskAttachmentUploader.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return { ...context.exports, notices, refs, get refreshes() { return refreshes; }, render(props = {}) { cursor = 0; refCursor = 0; return context.exports.default({ taskId: 'task', ...props }); } };
}
function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
const input = ui => nodes(ui).find(n => n.type === 'input');
const camera = ui => nodes(ui).find(n => n.type === 'CameraCaptureButton');

test('captured photos use the existing upload, size validation and permission guard', async () => {
  const calls = [];
  const ui = load(async (url, init) => { calls.push({ url, file: init.body.get('file') }); return Response.json({ attachment: { id: 'photo' } }); });
  await camera(ui.render()).props.onCapture(new File(['photo'], 'camera.jpg', { type: 'image/jpeg' }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/tasks/task/attachments');
  assert.equal(calls[0].file.name, 'camera.jpg');
  assert.equal(ui.refreshes, 1);
  await camera(ui.render()).props.onCapture({ name: 'large.jpg', type: 'image/jpeg', size: TASK_ATTACHMENT_MAX_BYTES + 1 });
  assert.equal(calls.length, 1);
  assert.ok(ui.notices.some(([kind, text]) => kind === 'error' && text.includes('10 MB')));
  const disabled = camera(ui.render({ disabled: true }));
  assert.equal(disabled.props.disabled, true);
  await disabled.props.onCapture(new File(['photo'], 'denied.jpg', { type: 'image/jpeg' }));
  assert.equal(calls.length, 1);
});
test('precheck matches server MIME fallback and size boundaries', async () => {
  const { validateTaskAttachment } = load();
  for (const type of ['', 'application/octet-stream', 'application/pdf']) assert.equal(await validateTaskAttachment(new File(['x'], 'report.pdf', { type })), null);
  assert.match(await validateTaskAttachment(new File(['x'], 'bad.exe')), /định dạng|Định dạng/);
  assert.match(await validateTaskAttachment({ name: 'a.pdf', type: 'application/pdf', size: 0 }), /rỗng/);
  assert.equal(await validateTaskAttachment({ name: 'a.pdf', type: 'application/pdf', size: TASK_ATTACHMENT_MAX_BYTES }), null);
  assert.match(await validateTaskAttachment({ name: 'a.pdf', type: 'application/pdf', size: TASK_ATTACHMENT_MAX_BYTES + 1 }), /10 MB/);
});
test('selection uploads sequentially, continues after network failure, refreshes and resets', async () => {
  const calls = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  const ui = load(async (url, init) => { calls.push([url, init.method, init.body.get('file').name]); if (calls.length === 1) { await gate; throw new Error('network'); } return Response.json({ attachment: { id: 'a' } }); });
  const uploads = [];
  const first = input(ui.render({ onUploaded: a => uploads.push(a) }));
  ui.refs[0].current = { value: 'selected' };
  const pending = first.props.onChange({ target: { files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1); assert.equal(input(ui.render()).props.disabled, true);
  release(); await pending; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['/api/tasks/task/attachments', 'POST', 'a.pdf'], ['/api/tasks/task/attachments', 'POST', 'b.pdf']]);
  assert.equal(uploads.length, 1); assert.equal(ui.refreshes, 1); assert.equal(ui.refs[0].current.value, '');
  assert.ok(ui.notices.some(([kind, text]) => kind === 'success' && text === 'Đã tải lên b.pdf'));
});
test('HTTP errors have Vietnamese messages including non-JSON proxy errors', () => {
  const { uploadErrorMessage } = load();
  for (const [status, pattern] of [[400, /Chấp nhận/], [403, /quyền/], [413, /10 MB/], [415, /định dạng|Định dạng/], [500, /thử lại/], [503, /thử lại/]]) assert.match(uploadErrorMessage(status), pattern);
});
