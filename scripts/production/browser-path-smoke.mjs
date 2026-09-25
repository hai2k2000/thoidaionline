const baseUrl = (process.env.THOIDAI_SMOKE_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const cookie = process.env.THOIDAI_SMOKE_COOKIE || "";
const bearer = process.env.THOIDAI_SMOKE_BEARER || "";

if (!cookie && !bearer) {
  console.error("authenticated browser-path smoke credentials are unavailable");
  process.exit(2);
}

const headers = {
  accept: "text/html,application/xhtml+xml,application/json;q=0.9",
  ...(cookie ? { cookie } : {}),
  ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
};

const paths = [
  "/tasks",
  "/tasks?journalism=exclude",
  "/tasks?journalism=only",
  "/tasks?journalism=exclude&approvalQueue=assignment",
  "/tasks?journalism=exclude&approvalQueue=completion",
  "/tasks?scope=all&journalism=exclude&assignmentSource=&department=&from=&to=&deadline=&state=",
];

const failures = [];
for (const path of paths) {
  const response = await fetch(`${baseUrl}${path}`, { headers, redirect: "manual" });
  const body = await response.text();
  if (response.status !== 200) {
    failures.push(`${path}: expected 200, got ${response.status}`);
    continue;
  }
  if (body.includes("Không thể tải danh sách công việc.")) {
    failures.push(`${path}: rendered task-list error state`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`browser-task-list-path: PASS (${paths.length})`);
