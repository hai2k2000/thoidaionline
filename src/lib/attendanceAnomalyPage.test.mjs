import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
test("attendance page gates anomaly review by canManage", () => {
  assert.match(source, /effectiveCanManage.*Rà soát bất thường/s);
  assert.match(source, /AttendanceAnomalyReview/);
});
test("attendance anomaly panel includes the disclaimer", async () => {
  const panel = await readFile(new URL("../components/attendance/AttendanceAnomalyReview.tsx", import.meta.url), "utf8");
  assert.match(panel, /Kết quả chỉ là dấu hiệu cần đối chiếu/);
});
