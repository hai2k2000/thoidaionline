import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

for (const file of ["../components/TaskListReportDialog.tsx", "./taskListReportDocx.ts", "./taskListReport.mjs"]) {
  test(`${file} preserves Vietnamese report text`, () => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.notEqual(source.charCodeAt(0), 0xfeff);
    if (file !== "./taskListReport.mjs") {
      for (const label of ["Tên công việc", "Kết quả/Ghi chú", "Không có công việc."]) assert.ok(source.includes(label), label);
    }
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JS);
    const visit = node => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
        assert.doesNotMatch(node.text, /[A-Za-zÀ-ỹ]\?[a-zà-ỹ]/);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (file.endsWith("tsx")) assert.ok(source.includes("Bảng ${section.title}"));
  });
}
