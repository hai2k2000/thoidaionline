#!/usr/bin/env bash
set -Eeuo pipefail

root=$(mktemp -d)
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$root"
}
trap cleanup EXIT

cat >"$root/server.mjs" <<'NODE'
import http from "node:http";

const expectedCookie = "thoidai_work_session=fake-secret";
const expectedBearer = "fake-bearer-token";
const server = http.createServer((request, response) => {
  const validCookie = request.headers.cookie === expectedCookie && !request.headers.authorization;
  const validBearer = request.headers.authorization === `Bearer ${expectedBearer}` && !request.headers.cookie;
  if (!validCookie && !validBearer) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (path === "/api/auth/session") return json(response, { user: { id: "smoke-user" } });
  if (path === "/api/permissions") return json(response, { permissions: [] });
  if (path === "/api/notifications") return json(response, { items: [], unreadCount: 0 });
  if (path === "/api/work-schedule/events") return json(response, { events: [] });
  if (path === "/api/work-schedule" || path === "/api/work-schedule/personal" || path === "/api/attendance") return json(response, { rows: [] });
  if (path.startsWith("/api/journalism/calendar")) return json(response, { calendar: [] });
  if (path.startsWith("/api/journalism/topics")) return json(response, { topics: [] });
  if (path.startsWith("/api/journalism/series")) return json(response, { series: [] });
  if (path.startsWith("/api/tasks")) return json(response, { tasks: [] });
  if (path.startsWith("/tasks")) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(path === "/tasks/assign" ? "CHỌN NGƯỜI NHẬN VIỆC" : "task page");
    return;
  }
  response.writeHead(404);
  response.end();
});
function json(response, body) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
server.listen(0, "127.0.0.1", () => console.log(server.address().port));
NODE

node "$root/server.mjs" >"$root/port" &
server_pid=$!
for _ in {1..50}; do
  [[ -s "$root/port" ]] && break
  sleep 0.02
done
port=$(<"$root/port")

set +e
output=$(printf 'cookie\nthoidai_work_session=fake-secret\n' | THOIDAI_SMOKE_BASE_URL="http://127.0.0.1:$port" bash scripts/production/run-authenticated-smoke.sh 2>&1)
status=$?
set -e
[[ "$status" -eq 0 ]] || { printf '%s\n' "$output" >&2; exit 1; }
[[ "$output" == *"authenticated identity: PASS"* ]]
[[ "$output" == *"permission catalog: PASS"* ]]
[[ "$output" == *"authenticated-contracts: PASS (13)"* ]]
[[ "$output" == *"browser-task-list-path: PASS (7)"* ]]
[[ "$output" != *"fake-secret"* ]]

set +e
bearer_output=$(printf 'bearer\nfake-bearer-token\n' | THOIDAI_SMOKE_BASE_URL="http://127.0.0.1:$port" bash scripts/production/run-authenticated-smoke.sh 2>&1)
bearer_status=$?
set -e
[[ "$bearer_status" -eq 0 ]] || { printf '%s\n' "$bearer_output" >&2; exit 1; }
[[ "$bearer_output" == *"authenticated-contracts: PASS (13)"* ]]
[[ "$bearer_output" != *"fake-bearer-token"* ]]

set +e
failed_output=$(printf 'bearer\nfake-secret\n' | THOIDAI_SMOKE_BASE_URL="http://127.0.0.1:$port" bash scripts/production/run-authenticated-smoke.sh 2>&1)
failed_status=$?
set -e
[[ "$failed_status" -ne 0 ]]
[[ "$failed_output" == *"session variables cleared"* ]]
[[ "$failed_output" != *"fake-secret"* ]]

echo "authenticated-smoke-handoff: PASS"
