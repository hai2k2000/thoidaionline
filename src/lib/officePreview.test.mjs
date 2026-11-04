import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeOfficeHtml } from './officePreviewSanitize.mjs';
import { libraryOfficeKind } from './projectLibraryFile.ts';

test('sanitizer drops active markup and encoded script URLs, preserves document text and embedded images', () => {
  const html = sanitizeOfficeHtml('<script>alert(1)</script><p onclick="bad()">Hello</p><img src="data:image/png;base64,AAAA" onerror=bad()><a href="javascript:bad()">bad</a><a href="jav&#x61;script:bad()">encoded</a>');
  assert.doesNotMatch(html, /<script|onerror|onclick|javascript|jav&#x61;/i);
  assert.match(html, /Hello/);
  assert.match(html, /data:image\/png;base64,AAAA/);
});
test('Office kind recognizes MIME or extension while legacy and slides remain download only', () => {
  for (const kind of ['docx', 'xlsx']) assert.equal(libraryOfficeKind({mime_type:'application/octet-stream',file_name:`file.${kind.toUpperCase()}`,title:'file'}),kind);
  for (const kind of ['doc','xls','pptx']) assert.equal(libraryOfficeKind({mime_type:null,file_name:`file.${kind}`,title:'file'}),null);
});
test('Office preview contracts: lazy libraries, empty sandbox, bounded text tables, attachment fetch and abort', () => {
  const source = readFileSync('src/components/OfficePreview.tsx','utf8');
  const viewer = readFileSync('src/components/ProjectLibraryPreview.tsx','utf8');
  const library = readFileSync('src/components/ProjectLibrary.tsx','utf8');
  assert.match(viewer, /dynamic\(\(\) => import\('@\/components\/OfficePreview'\)/);
  for (const name of ['mammoth','exceljs']) {
    assert.match(source, new RegExp(`await import\\('${name}'\\)`));
    assert.doesNotMatch(library, new RegExp(`from ['"]${name}`));
  }
  assert.match(source, /sandbox=""/);
  assert.doesNotMatch(source, /allow-scripts|dangerouslySetInnerHTML/);
  assert.match(source, /getCell\(r, c\)\.text/);
  assert.match(source, /Math.min\(active.rowCount, 1000\)/);
  assert.match(source, /Math.min\(active.columnCount, 50\)/);
  assert.match(source, /15 \* 1024 \* 1024/);
  assert.match(source, /item.size_bytes > MAX_BYTES/);
  assert.match(source, /bytes.byteLength > MAX_BYTES/);
  assert.match(source, /disposition=attachment/);
  assert.match(source, /credentials: 'same-origin'/);
  assert.match(source, /return \(\) => controller.abort\(\)/);
  assert.match(viewer, /!isOffice&&<a/);
});
