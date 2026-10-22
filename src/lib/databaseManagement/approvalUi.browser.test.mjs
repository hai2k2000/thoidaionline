import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "/tmp/thoidai-approval-browser/node_modules/playwright/index.mjs";

test("preserves stale workflow error after reloading the changed record", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "approver-1", full_name: "Người kiểm thử", role_name: "Người kiểm thử", active: true, permissions: {}, rbacPermissions: ["record.approve"] } }) });
    if (url.pathname === "/api/database/catalog") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categories: [], recordTypes: [], forms: [] }) });
    if (url.pathname === "/api/database/records/rec-1" && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ record: { record: { id: "rec-1", category_id: "cat", record_type_id: "type", record_code: "HS-1", title: "Hồ sơ thử nghiệm", summary: null, status: "pending_review", metadata: {} }, canApprove: true, canSubmit: false, approvedBy: null, files: [], externalLinks: [], keywords: [], history: [] } }) });
    if (url.pathname === "/api/database/records/rec-1/workflow" && request.method() === "POST") return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "stale_record" }) });
    return route.continue();
  });
  await page.goto("http://127.0.0.1:3411/database/records/rec-1");
  await page.getByRole("button", { name: "Phê duyệt hồ sơ" }).click();
  await page.getByText("Hồ sơ đã thay đổi trạng thái. Hãy tải lại trước khi thao tác.", { exact: true }).waitFor();
  assert.equal(await page.getByText("Hồ sơ đã thay đổi trạng thái. Hãy tải lại trước khi thao tác.", { exact: true }).count(), 1);
  await browser.close();
});
