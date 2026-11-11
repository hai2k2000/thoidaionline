import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as preview from './filePreview.mjs';

test('viewer detects every supported MIME and extension, and rejects active/legacy formats', async () => {
  const { filePreviewKind } = await import('./filePreview.mjs');
  const groups = {
    pdf: [['application/pdf', 'pdf']],
    image: ['png', 'jpeg', 'gif', 'webp', 'avif'].map(ext => [`image/${ext}`, ext]),
    video: [['video/mp4', 'mp4'], ['video/webm', 'webm'], ['video/ogg', 'ogv'], ['video/quicktime', 'mov']],
    audio: [['audio/mpeg', 'mp3'], ['audio/ogg', 'ogg'], ['audio/wav', 'wav'], ['audio/flac', 'flac']],
    text: [['text/plain', 'txt']], csv: [['text/csv', 'csv']],
    docx: [['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']],
    xlsx: [['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx']],
  };
  for (const [kind, pairs] of Object.entries(groups)) for (const [mimeType, ext] of pairs) {
    assert.equal(filePreviewKind({ mimeType, fileName: 'file' }), kind);
    assert.equal(filePreviewKind({ mimeType: 'application/octet-stream', fileName: `file.${ext.toUpperCase()}` }), kind);
  }
  for (const ext of ['doc', 'xls', 'html', 'svg', 'xml', 'js', 'zip']) assert.equal(filePreviewKind({ fileName: `file.${ext}` }), null);
  assert.equal(filePreviewKind({ mimeType: 'text/html', fileName: 'file.pdf' }), null);
});

test('CSV handles quoted separators, escaped quotes and multiline cells, with row/column caps', async () => {
  const { parsePreviewCsv } = await import('./filePreview.mjs');
  assert.deepEqual(parsePreviewCsv('a,"b,c"\r\n"line\n2","a""b"'), [['a', 'b,c'], ['line\n2', 'a"b']]);
  assert.equal(parsePreviewCsv('a,b,c\n1,2,3\n4,5,6', 2, 2).length, 2);
  assert.deepEqual(parsePreviewCsv('a,b,c', 2, 2), [['a', 'b']]);
});

test('shared response headers never inline active MIME or unsafe extension', async () => {
  const { fileResponseHeaders } = await import('./fileResponseHeaders.mjs');
  for (const mimeType of ['text/html', 'image/svg+xml', 'application/xml', 'text/javascript', 'audio/x+xml']) {
    const headers = fileResponseHeaders({ fileName: 'file', mimeType }, 'inline');
    assert.match(headers.get('content-disposition'), /^attachment;/);
    assert.equal(headers.get('content-type'), 'application/octet-stream');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('cache-control'), 'private, no-store');
  }
  assert.match(fileResponseHeaders({ fileName: 'bad.svg', mimeType: 'image/png' }, 'inline').get('content-disposition'), /^attachment;/);
  assert.match(fileResponseHeaders({ fileName: 'file.png', mimeType: 'image/png' }, 'inline').get('content-security-policy'), /sandbox/);
});

test('explicit inline requests resolve generic MIME only through the safe extension allowlist', async () => {
  const { fileResponseHeaders } = await import('./fileResponseHeaders.mjs');
  for (const [extension, mime] of [['pdf', 'application/pdf'], ['png', 'image/png'], ['mp4', 'video/mp4'], ['ogg', 'audio/ogg']]) {
    const file = { fileName: `file.${extension}`, mimeType: 'application/octet-stream' };
    const headers = fileResponseHeaders(file, 'inline');
    assert.equal(headers.get('content-type'), mime);
    assert.match(headers.get('content-disposition'), /^inline;/);
    assert.equal(fileResponseHeaders(file, 'attachment').get('content-type'), 'application/octet-stream');
  }
  for (const extension of ['svg', 'html', 'xml', 'js', 'docx', 'zip']) assert.match(fileResponseHeaders({ fileName: `file.${extension}` }, 'inline').get('content-disposition'), /^attachment;/);
});

test('bounded reads cancel oversized Office downloads and truncate text without retaining more bytes', async () => {
  for (const truncate of [false, true]) {
    let cancelled = false;
    const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } }));
    if (truncate) assert.equal((await preview.readPreviewBytes(response, 10, true)).byteLength, 10);
    else await assert.rejects(preview.readPreviewBytes(response, 10), /large/);
    assert.equal(cancelled, true);
  }
  assert.equal(new TextDecoder().decode(await preview.readPreviewBytes(new Response('hello'), 5)), 'hello');
  await assert.rejects(preview.readPreviewBytes(new Response('forbidden', { status: 403 }), 10), /preview_unavailable/);
});

function viewerComponents() {
  const require = createRequire(import.meta.url);
  const source = readFileSync('src/components/FilePreviewDialog.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const dependencies = {
    'next/dynamic': { __esModule: true, default: () => () => React.createElement('p', null, 'Office') },
    '@/lib/filePreview.mjs': preview,
  };
  const testModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => dependencies[name] ?? require(name), testModule, testModule.exports);
  return testModule.exports;
}

test('viewer hides download for preview-only, shows fallback, and renders list navigation boundaries', () => {
  const { default: Dialog, FilePreviewList } = viewerComponents();
  const file = { url: '/file?mode=preview', fileName: 'old.doc', mimeType: 'application/msword' };
  const render = props => renderToStaticMarkup(React.createElement(Dialog, { ...file, onClose() {}, ...props }));
  const previewOnly = render({});
  assert.ok(previewOnly.includes('Không xem trước được loại tệp này'));
  assert.doesNotMatch(previewOnly, /download=|target="_blank"/);
  assert.match(render({ downloadUrl: '/download' }), /href="\/download" download=""/);
  assert.ok(render({ fileName: 'large.docx', mimeType: null, sizeBytes: 16 * 1024 * 1024 }).includes('Không xem trước được loại tệp này'));
  const files = [file, { ...file, url: '/second', fileName: 'second.pdf', mimeType: 'application/pdf' }];
  const html = renderToStaticMarkup(React.createElement(FilePreviewList, { files, selectedUrl: file.url, onSelect() {}, onClose() {} }));
  assert.match(html, /disabled="" aria-label="Tệp trước"/);
  assert.match(html, /1 \/ 2/);
  assert.match(html, /aria-label="Tệp tiếp theo"/);
  const second = renderToStaticMarkup(React.createElement(FilePreviewList, { files, selectedUrl: '/second', onSelect() {}, onClose() {} }));
  assert.match(second, /src="\/second" title="second.pdf"/);
  assert.match(second, /disabled="" aria-label="Tệp tiếp theo"/);
});
