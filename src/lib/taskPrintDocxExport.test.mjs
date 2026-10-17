import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import JSZip from "jszip";
import { exportTaskPrintDocx, exportTaskPrintDocxBatch, exportTaskPrintDocxZip, taskPrintDocxFilename } from "./taskPrintDocxExport.ts";

const model = { id: "task-1", assignedDate: "2026-10-17T00:00:00Z", taskType: "Công việc thường", department: "Phòng Nội dung", assignmentSourceLabel: "Được giao", assignerLabel: "NGƯỜI GIAO VIỆC", assigner: "Nguyễn Văn A", primaryAssignee: "Trần Văn B", collaborators: ["Lê Văn C"], title: "Tổng hợp tin tuần", description: "Tổng hợp nội dung", requirements: ["Đúng hạn"], deadline: "2026-10-20", priority: "Cao", notes: "—", journalism: null };

test("task DOCX export has editable Word content", async () => {
  assert.equal(taskPrintDocxFilename("Tin: tuần / 1"), "Tin_tuần_1.docx");
  const zip = await JSZip.loadAsync(await exportTaskPrintDocx(model));
  const xml = await zip.file("word/document.xml").async("string");
  for (const value of ["PHIẾU GIAO VIỆC", "Tổng hợp tin tuần", "Nguyễn Văn A", "Đúng hạn", "XÁC NHẬN"]) assert.match(xml, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(xml, /Ã|áº|á»/);
});

test("task DOCX route is protected and returns Word content", () => {
  const source = readFileSync(new URL("../app/api/tasks/[id]/print/docx/route.ts", import.meta.url), "utf8");
  assert.match(source, /getSessionUser/);
  assert.match(source, /loadPrintableTask/);
  assert.ok(source.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  assert.match(source, /taskPrintDocxFilename/);
});

test("batch DOCX export creates separate pages for selected tasks", async () => {
  const zip = await JSZip.loadAsync(await exportTaskPrintDocxBatch([model, { ...model, title: "Nhiệm vụ thứ hai" }]));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /Nhiệm vụ thứ hai/);
  assert.match(xml, /w:type="page"/);
});

test("batch DOCX route validates selection and checks each task through printable access", () => {
  const source = readFileSync(new URL("../app/api/tasks/bulk-print/docx/route.ts", import.meta.url), "utf8");
  assert.match(source, /loadPrintableTask/);
  assert.match(source, /ids\.length > 50/);
  assert.match(source, /exportTaskPrintDocxZip/);
  assert.ok(source.includes("application/zip"));
});

test("bulk export creates one DOCX file per selected task and disambiguates duplicate titles", async () => {
  const archive = await JSZip.loadAsync(await exportTaskPrintDocxZip([model, { ...model, title: model.title }]));
  const names = Object.keys(archive.files).filter((name) => name.endsWith(".docx"));
  assert.deepEqual(names, ["Tổng_hợp_tin_tuần.docx", "Tổng_hợp_tin_tuần_2.docx"]);
  for (const name of names) {
    const docx = await JSZip.loadAsync(await archive.file(name).async("nodebuffer"));
    assert.match(await docx.file("word/document.xml").async("string"), /PHIẾU GIAO VIỆC/);
  }
});
