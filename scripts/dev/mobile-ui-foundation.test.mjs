import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = join(import.meta.dirname, "../..");
const read = (relative) => readFileSync(join(root, relative), "utf8");
const globals = read("src/app/globals.css");
function sourceFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(css|tsx|ts|jsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [relative] : [];
  });
}

const protectedFilterBlock = `/* Keep each filter as an explicit flex item so popover triggers cannot stretch the bar. */
.task-filter-bar > [data-filter-item] { flex: 0 1 6.5rem; min-width: 6.5rem; }
.task-filter-bar > .task-filter-search { flex: 1 1 9rem; min-width: 8rem; }
.task-filter-bar > .task-filter-actions { flex: 0 0 auto; min-width: 0; }
.task-filter-bar select { text-overflow: ellipsis; }
.task-filter-actions { display: flex; gap: 0.5rem; }
@media (max-width: 639px) {
  .task-filter-bar > [data-filter-item], .task-filter-bar > .task-filter-search { flex: 1 1 100%; }
  .task-filter-bar > .task-filter-actions { flex: 1 1 100%; }
  .task-filter-actions > button, .task-filter-actions > a { flex: 1 1 0%; }
}`;

// Since 64f0fe6 the card rule no longer sets position itself; a :not(.fixed, .absolute, …)
// companion rule does, so floating panels keep their own positioning.
const protectedPanelRule = `:where(.rounded-xl.border.bg-white, .rounded-2xl.border.bg-white, .rounded-lg.border.bg-white) {
  border-color: #e2e8f0 !important;
  border-width: 1px;
  background: #ffffff !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}`;

test("globals exposes the mobile foundation tokens", () => {
  for (const token of [
    "--color-brand:", "--color-brand-strong:", "--color-brand-ink:",
    "--color-surface:", "--color-surface-muted:", "--color-border:",
    "--color-text:", "--color-text-muted:", "--color-success:",
    "--color-success-soft:", "--color-warning:", "--color-warning-soft:",
    "--color-danger:", "--color-danger-soft:", "--color-info:",
    "--color-info-soft:", "--radius-control:", "--radius-card:", "--radius-sheet:",
  ]) assert.ok(globals.includes(token), `Missing theme token: ${token}`);
  for (const token of ["brand", "brand-strong", "brand-ink", "surface", "surface-muted", "border", "text", "text-muted", "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft"]) {
    assert.match(globals, new RegExp(`--${token}: #[0-9a-f]{6};`));
    assert.ok(globals.includes(`--color-${token}: var(--${token});`));
  }
  for (const [name, size] of [["control", "0.5"], ["card", "0.75"], ["sheet", "1.5"]]) {
    assert.ok(globals.includes(`--radius-${name}: ${size}rem;`));
  }
  assert.match(globals, /--brand-red: var\(--brand\);/);
  assert.match(globals, /--brand-red-dark: var\(--brand-strong\);/);
});

test("small text utilities are removed outside print-only source", () => {
  const violations = sourceFiles("src").flatMap((file) => [...read(file).matchAll(/(?:[\w-]+:)*text-\[(?:10|11)px\]/g)]
    .filter(([utility]) => !utility.startsWith("print:"))
    .map(([utility]) => `${file}: ${utility}`));
  assert.deepEqual(violations, []);
});

test("filled orange controls do not pair orange-600 with white text", () => {
  const violations = [];
  for (const file of sourceFiles("src")) {
    if (!/\.[jt]sx$/.test(file)) continue;
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      // Class helpers can return utility strings outside JSX attributes.
      if (ts.isStringLiteralLike(node) && /(?<![\w:-])bg-orange-600\b/.test(node.text) && /\btext-white\b/.test(node.text)) violations.push(file);
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className" && node.initializer) {
        const value = node.initializer.getText(ast);
        if (/(?<![\w:-])bg-orange-600\b/.test(value) && /\btext-white\b/.test(value)) violations.push(file);
        const tag = node.parent.parent.tagName?.getText(ast);
        if (["button", "a", "Link"].includes(tag) && /\bbg-orange-500\b/.test(value) && /\btext-white\b/.test(value)) violations.push(file);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.deepEqual(violations, []);
});

test("globals avoids transition all and keeps touch-friendly mobile selectors", () => {
  assert.doesNotMatch(globals, /transition:\s*all/);
  const item = globals.match(/\.mobile-bottom-item\s*\{([^}]+)\}/)[1];
  assert.ok(Number(item.match(/font-size:\s*([\d.]+)rem/)[1]) >= 0.75);
  assert.ok(Number(item.match(/line-height:\s*([\d.]+)/)[1]) >= 1.2);
  assert.match(item, /min-width: 2\.75rem/);
  assert.match(item, /min-height: 2\.75rem/);
  assert.match(globals, /\.mobile-app-bar :where\(button, a, summary\)\s*\{[^}]*min-width: 2\.75rem;[^}]*min-height: 2\.75rem;/);
  assert.match(globals, /main :where\(button, summary, a\[class\*="rounded"\], a\[role="button"\]\)/);
  assert.match(globals, /overflow-wrap:\s*break-word/);
  assert.match(globals, /\.mobile-fab-offset/);
  assert.doesNotMatch(globals, /\.fixed\.bottom-4\.right-4/);
  assert.match(read("src/components/HelpBot.tsx"), /mobile-fab-offset/);
});

test("protected layout blocks remain byte-identical", () => {
  // Git stores LF; Windows checkouts may use CRLF. No other bytes are normalized.
  const normalized = globals.replaceAll("\r\n", "\n");
  // Later rules may be appended after the block; only the block itself is protected.
  const filterStart = normalized.indexOf("/* Keep each filter");
  const filter = normalized.slice(filterStart, filterStart + protectedFilterBlock.length);
  assert.equal(filter, protectedFilterBlock);
  const panel = normalized.match(/:where\(\.rounded-xl\.border\.bg-white, \.rounded-2xl\.border\.bg-white, \.rounded-lg\.border\.bg-white\) \{[^}]*\}/)[0];
  assert.equal(panel, protectedPanelRule);
  const precedingCss = normalized.slice(0, normalized.indexOf(protectedPanelRule)).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal([...precedingCss].reduce((depth, char) => depth + (char === "{" ? 1 : char === "}" ? -1 : 0), 0), 0, "Panel rule must stay unlayered");
  assert.match(normalized, /:where\(\.rounded-xl\.border\.bg-white, \.rounded-2xl\.border\.bg-white, \.rounded-lg\.border\.bg-white\):not\(\.fixed, \.absolute, \.sticky[^)]*\) \{\n  position: relative;\n\}/);
  assert.match(globals, /main h1 \{ font-size: 1\.25rem; line-height: 1\.3; \}/);
});

test("primary and inactive navigation colors meet normal-text AA contrast", () => {
  function luminance(hex) {
    const rgb = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const color = globals.match(/\.mobile-bottom-item\s*\{[^}]*color: (#[\da-f]+);/)[1];
  const primary = globals.match(/--brand: (#[\da-f]+);/)[1];
  const footer = globals.match(/\.mobile-filter-footer button \{[^}]*background: (#[\da-f]+);/)[1];
  for (const value of [color, primary, footer]) assert.ok(1.05 / (luminance(value) + 0.05) >= 4.5, value);
});

test("login copy is concise and password visibility remains accessible", () => {
  const login = read("src/app/login/page.tsx");
  assert.doesNotMatch(login, /Dùng username/);
  assert.match(login, />Tài khoản\s*</);
  assert.match(login, /placeholder="Tên đăng nhập, email hoặc SĐT"/);
  assert.doesNotMatch(read("src/components/AuthShell.tsx"), />Tài khoản<\/p>/);
  const password = read("src/components/PasswordInput.tsx");
  assert.match(password, /min-h-11 min-w-11[^"\n]*text-sm/);
  assert.match(password, /aria-label=/);
  assert.match(password, /aria-pressed=\{visible\}/);
  assert.doesNotMatch(read("src/app/users/page.tsx"), /tạo user/i);
});
