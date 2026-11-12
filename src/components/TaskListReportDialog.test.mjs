import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import JSZip from "jszip";
import * as report from "../lib/taskListReport.mjs";

function loadPreview() {
  const source = readFileSync(new URL("./TaskListReportDialog.tsx", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\r?\n/gm, "").replace("export default function", "function");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
  const dependencies = { React, Fragment: React.Fragment, ...report };
  return new Function(...Object.keys(dependencies), js + "\nreturn ReportPreview;")(...Object.values(dependencies));
}

test("report download shows the selected count and disables an empty or stale selection", () => {
  const file = new URL("./TaskListReportDialog.tsx", import.meta.url);
  assert.ok(existsSync(file), "The report picker dialog must exist");
  const source = readFileSync(file, "utf8");
  assert.match(source, /Tải DOCX \(\{selectedCount\} việc\)/);
  assert.match(source, /disabled=\{[^}]*selectedCount === 0[^}]*stale/);
  assert.match(source, /selectTaskListReportModel\(model, selectedIds\)/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /mobile-dialog-overlay/);
});

test("rendered preview omits an empty filter and shows the default next week with a handwritten blank", () => {
  const model = report.buildTaskListReportModel({ tasks: [], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: report.reportFilterLabel({ scope: "mine" }) });
  const html = renderToStaticMarkup(React.createElement(loadPreview(), { model }));
  assert.doesNotMatch(html, /Bộ lọc:|Phạm vi|Việc của tôi/);
  assert.match(html, /II\. Kế hoạch tuần sau/);
  assert.match(html, /aria-label="Bảng II\. Kế hoạch tuần sau"/);
  assert.equal((html.match(/<table\b/g) ?? []).length, 1);
  assert.deepEqual([...html.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map(match => match[1]), ["I. Công việc đã làm", "II. Kế hoạch tuần sau"]);
  assert.match(html, /\(Từ ngày 16\/11\/2026 đến ngày 22\/11\/2026\)/);
  assert.match(html, /………/);
});

test("HTML and DOCX render the same plan rows as escaped text after the work section", async () => {
  const { exportTaskListReportDocx } = await import("../lib/taskListReportDocx.ts");
  const model = report.planFromReportModel(report.buildTaskListReportModel({ tasks: [{ id: "cancelled", status: "cancelled", title: "Việc đã hủy" }], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "Phòng: Biên tập" }), {
    from: "2026-11-17", to: "2026-11-25", items: [
      { content: "Bài <img src=x onerror=alert(1)> & tin", assignee: "An & Bình", dueDate: "2026-11-20" },
      { content: "Nội dung tiếp theo", assignee: "", dueDate: "" },
    ],
  });
  const html = renderToStaticMarkup(React.createElement(loadPreview(), { model }));
  const xml = await (await JSZip.loadAsync(await exportTaskListReportDocx(model))).file("word/document.xml").async("string");
  for (const output of [html, xml]) {
    for (const value of ["Phòng: Biên tập", "I. Công việc đã làm", "II. Kế hoạch tuần sau", "(Từ ngày 17/11/2026 đến ngày 25/11/2026)", "Nội dung công việc", "Thời hạn", "Bài &lt;img src=x onerror=alert(1)&gt; &amp; tin", "An &amp; Bình", "20/11/2026", "Nội dung tiếp theo"]) assert.ok(output.includes(value), value);
    assert.doesNotMatch(output, /<img |………/);
    assert.doesNotMatch(output, /Việc đã hủy/);
    assert.ok(output.includes("Tổng: 0 công việc"));
    for (const heading of ["I. Đã hoàn thành", "II. Đang thực hiện", "III. Quá hạn", "V. Đã hủy"]) assert.ok(!output.includes(heading), heading);
    assert.ok(output.indexOf("I. Công việc đã làm") < output.indexOf("II. Kế hoạch tuần sau"));
    assert.ok(output.indexOf("II. Kế hoạch tuần sau") < output.indexOf("NGƯỜI LẬP"));
  }
});

test("multiline plan content keeps LF and CRLF breaks in preview and WordprocessingML", async () => {
  const { exportTaskListReportDocx } = await import("../lib/taskListReportDocx.ts");
  const model = report.planFromReportModel(report.buildTaskListReportModel({ tasks: [], from: "2026-11-09", to: "2026-11-15", userName: "An", filterLabel: "" }), {
    from: "2026-11-16", to: "2026-11-22", items: [{ content: "Dòng một\r\nDòng hai\nDòng ba", assignee: "", dueDate: "" }],
  });
  const html = renderToStaticMarkup(React.createElement(loadPreview(), { model }));
  assert.match(html, /<td[^>]*whitespace-pre-line[^>]*>Dòng một\r?\nDòng hai\nDòng ba<\/td>/);
  const xml = await (await JSZip.loadAsync(await exportTaskListReportDocx(model))).file("word/document.xml").async("string");
  assert.equal((xml.match(/<w:br\s*\/>/g) ?? []).length, 2);
  assert.match(xml, /Dòng một<\/w:t>[\s\S]*<w:br\s*\/>[\s\S]*Dòng hai<\/w:t>[\s\S]*<w:br\s*\/>[\s\S]*Dòng ba<\/w:t>/);
});
