import { chromium } from "playwright-core";

const baseUrl = process.env.E2E_BASE_URL;
const executablePath = process.env.E2E_BROWSER_EXECUTABLE_PATH;
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_PASSWORD;
if (!baseUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("browser smoke requires localhost E2E_BASE_URL");
if (!executablePath) throw new Error("E2E_BROWSER_EXECUTABLE_PATH is required");
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
const failures = [];
let authenticatedFlowStarted = false;
// A first session probe is expected to be unauthorized before login; all other
// console errors remain failures, including errors after authentication starts.
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (!authenticatedFlowStarted && text.includes("401 (Unauthorized)")) return;
  failures.push(`console:${text}`);
});
page.on("pageerror", (error) => failures.push(`page:${error.message}`));
await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
await page.locator("#identifier").waitFor({ state: "visible" });
await page.getByRole("button", { name: "Đăng nhập" }).waitFor({ state: "visible" });
await page.locator("#identifier").fill(username);
await page.locator("#password").fill(password);
authenticatedFlowStarted = true;
const [loginResponse] = await Promise.all([
  page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/login"),
  page.getByRole("button", { name: "Đăng nhập" }).click(),
]);
if (loginResponse.status() !== 200) throw new Error(`browser login returned ${loginResponse.status()}`);
await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
await page.getByText("E2E Admin", { exact: false }).waitFor({ state: "visible", timeout: 15000 });
if (!["/tasks", "/assets", "/dashboard"].some((path) => page.url().includes(path))) throw new Error(`login did not reach authenticated page: ${page.url()}`);
await page.goto(`${baseUrl}/assets`, { waitUntil: "domcontentloaded" });
await page.getByText("Tài sản", { exact: false }).first().waitFor({ state: "visible" });
if (!(await page.getByText("Tài sản", { exact: false }).count())) throw new Error("asset page content missing");
await page.goto(`${baseUrl}/tasks/quick-report`, { waitUntil: "domcontentloaded" });
await page.getByText("Báo việc phát sinh", { exact: false }).first().waitFor({ state: "visible" });
if (!(await page.getByText("Báo việc phát sinh", { exact: false }).count())) throw new Error("quick report page content missing");
await browser.close();
if (failures.length) throw new Error(`browser errors: ${failures.join(" | ")}`);
console.log("isolated authenticated browser smoke: PASS (/login, /assets, /tasks/quick-report)");
