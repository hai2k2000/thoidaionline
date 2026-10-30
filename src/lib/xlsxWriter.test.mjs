import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { crc32, writeXlsx } from "./xlsxWriter.mjs";

function unzipLocalEntries(buffer) {
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    files.set(name, method === 8 ? inflateRawSync(compressed).toString("utf8") : compressed.toString("utf8"));
    offset = dataStart + compressedSize;
  }
  return files;
}

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("xlsx writes formulas and print page setup", () => {
  const output = writeXlsx({ name: "10", columns: [{ width: 10 }], rows: [{ cells: [{ value: "", formula: "1+1", style: "formula" }] }], styles: { formula: { font: { name: "Times New Roman", size: 11, italic: true }, alignment: { horizontal: "center", wrapText: true }, border: true } }, pageSetup: { paperSize: 9, orientation: "landscape", fitToWidth: 1, fitToHeight: 0 } });
  const files = unzipLocalEntries(output);
  assert.match(files.get("xl/worksheets/sheet1.xml"), /<f>1\+1<\/f>/);
  assert.match(files.get("xl/worksheets/sheet1.xml"), /pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/);
  assert.match(files.get("xl/styles.xml"), /<i\/>/);
  assert.match(files.get("xl/styles.xml"), /wrapText="1"/);
});

test("xlsx contains required OOXML parts, styles, escaping and frozen panes", () => {
  const output = writeXlsx({
    name: "Chấm công",
    columns: [{ width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }],
    rows: [
      { height: 24, cells: [{ value: "BẢNG & <tháng>", style: "title" }, { value: "" }, { value: "" }, { value: "" }] },
      { cells: [{ value: "QT", style: "forgot" }, { value: "✓", style: "present" }, { value: "✗", style: "absent" }, { value: "x\u0001y" }] },
    ],
    merges: ["A1:D1"],
    freeze: { rows: 4, columns: 3 },
  });
  assert.equal(output.subarray(0, 2).toString(), "PK");
  const files = unzipLocalEntries(output);
  for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) assert.ok(files.has(name), name);
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /mergeCell ref="A1:D1"/);
  assert.match(sheet, /QT/);
  assert.match(sheet, /✓/);
  assert.match(sheet, /pane xSplit="3" ySplit="4" topLeftCell="D5" activePane="bottomRight" state="frozen"/);
  assert.match(sheet, /BẢNG &amp; &lt;tháng&gt;/);
  assert.doesNotMatch(sheet, /\u0001/);
  const styles = files.get("xl/styles.xml");
  for (const color of ["FF16A34A", "FFDC2626", "FFB45309", "FFF1F5F9"]) assert.match(styles, new RegExp(color));
});

// Excel refused the first production export ("We found a problem with some content"):
// element order, missing apply* flags and empty-string cells must stay fixed.
test("worksheet and styles follow the order and flags Excel requires", () => {
  const files = unzipLocalEntries(writeXlsx({
    name: "10",
    columns: [{ width: 5 }, { width: 5 }],
    rows: [{ cells: [{ value: 1, style: "boxed" }, { value: "", style: "boxed" }] }, { cells: [{ value: "", style: "boxed", formula: "B1-A1" }, { value: "x", style: "boxed" }] }],
    styles: { boxed: { font: { name: "Times New Roman", size: 12, bold: true, color: "FF16A34A" }, border: true } },
    freeze: { rows: 1, columns: 1 },
    pageSetup: { paperSize: 9, orientation: "landscape", fitToWidth: 1, fitToHeight: 0 },
  }));
  const sheet = files.get("xl/worksheets/sheet1.xml");
  const styles = files.get("xl/styles.xml");
  const order = ["<sheetPr", "<sheetViews", "<sheetFormatPr", "<cols", "<sheetData", "<pageMargins", "<pageSetup"].map((tag) => sheet.indexOf(tag));
  assert.ok(order.every((position) => position >= 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(sheet, /<sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/);
  assert.match(sheet, /<c r="B1" s="\d+"\/>/);
  assert.doesNotMatch(sheet, /<t><\/t>/);
  assert.match(styles, /<font><b\/><sz val="12"\/><color rgb="FF16A34A"\/><name val="Times New Roman"\/><\/font>/);
  assert.match(styles, /borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/);
});
