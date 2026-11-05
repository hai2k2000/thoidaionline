import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('WebView export bridge preserves blob filename and defers immediate revocation', async () => {
  const source = readFileSync('mobile/thoidai_work_flutter/lib/main.dart', 'utf8');
  const script = source.match(/source: r'''([\s\S]*?)'''/)[1];
  const calls = [], timers = [], revoked = [];
  class Anchor { click() { calls.push('native-click'); } }
  const context = { URL: { revokeObjectURL: (url) => revoked.push(url) }, HTMLAnchorElement: Anchor, Map, setTimeout: (fn, ms) => timers.push([fn, ms]), document: { addEventListener() {} }, window: { flutter_inappwebview: { callHandler: (...args) => calls.push(args) } } };
  vm.runInNewContext(script, context);
  const anchor = new Anchor(); anchor.href = 'blob:https://thoidai.online/test'; anchor.download = 'report.docx'; anchor.click();
  context.URL.revokeObjectURL(anchor.href);
  assert.deepEqual(calls, [['tdBlobDownload', anchor.href, 'report.docx']]);
  assert.equal(revoked.length, 0);
  assert.equal(context.window.__tdExportNames.get(anchor.href), 'report.docx');
  timers.forEach(([fn, ms]) => { assert.equal(ms, 60000); fn(); });
  assert.deepEqual(revoked, [anchor.href]);
  assert.match(source, /source == null \|\| !isInternalUrl\(source\)/);
  assert.match(source, /size > 100 \* 1024 \* 1024/);
});
