import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { contentDisposition } from "./contentDisposition.mjs";
import { taskPrintDocxFilename } from "./taskPrintDocxExport.ts";

test("contentDisposition produces safe ASCII fallback and RFC 5987 filename", () => {
  const value = contentDisposition('Giao việc - Sửa video sinh nhật.docx');
  assert.equal(value, "attachment; filename=\"Giao viec - Sua video sinh nhat.docx\"; filename*=UTF-8''Giao%20vi%E1%BB%87c%20-%20S%E1%BB%ADa%20video%20sinh%20nh%E1%BA%ADt.docx");
  assert.ok([...value].every((char) => char.charCodeAt(0) <= 255));
});

test("contentDisposition handles đ, quotes, CRLF, empty and long names", () => {
  assert.equal(contentDisposition('Đặng "A\\B"\r\n.docx'), "attachment; filename=\"Dang AB.docx\"; filename*=UTF-8''%C4%90%E1%BA%B7ng%20AB.docx");
  assert.equal(contentDisposition("\r\n"), 'attachment; filename="download"; filename*=UTF-8\'\'download');
  const value = contentDisposition(`${"x".repeat(300)}.pdf`);
  assert.match(value, /filename="x+\.pdf"/);
  assert.ok(value.length < 1200);
});

test("API routes use the shared disposition helper for interpolated filenames", () => {
  const routeFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "route.ts") routeFiles.push(path);
    }
  };
  walk("src/app/api");
  for (const path of routeFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /filename=\"\$\{/);
  }
});

test("print DOCX response headers accept Vietnamese titles and keep the DOCX MIME and extension", () => {
  const source = readFileSync("src/app/api/tasks/[id]/print/docx/route.ts", "utf8");
  const responseStatement = source.slice(source.lastIndexOf("return new Response"), source.lastIndexOf("}"));
  const respond = new Function("contentDisposition", "taskPrintDocxFilename", "model", "buffer", responseStatement);
  for (const title of ["Giao việc - Sửa video sinh nhật", "", "đ".repeat(1000)]) {
    const response = respond(contentDisposition, taskPrintDocxFilename, { title }, new Uint8Array([80, 75]));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    for (const value of response.headers.values()) assert.ok([...value].every((char) => char.charCodeAt(0) <= 255));
    assert.match(response.headers.get("Content-Disposition"), /\.docx"; filename\*=UTF-8''.*\.docx$/);
  }
});

test("inline disposition and RFC 5987 reserved characters are safe", () => {
  const header = contentDisposition("đ Đ (a)'*!?.pdf", { inline: true });
  assert.match(header, /^inline; filename="d D _a_.pdf";/);
  assert.match(header, /%28a%29%27%2A%21%3F\.pdf$/);
  assert.doesNotThrow(() => new Headers({ "Content-Disposition": contentDisposition("\ud800.pdf") }));
  assert.equal(contentDisposition(""), 'attachment; filename="download"; filename*=UTF-8\'\'download');
});
