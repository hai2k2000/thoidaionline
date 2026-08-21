import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("notification API is session-scoped and supports marking read", () => {
  const route = read("../app/api/notifications/route.ts");
  assert.match(route, /requireReadActor/);
  assert.match(route, /requireMutationActor/);
  assert.match(route, /notificationRepository\.markRead/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("notification repository covers assignments deadlines comments and changes", () => {
  const source = read("./notificationRepository.ts");
  for (const table of ["task_assignees", "task_comments", "task_status_events", "task_deadline_history", "user_notification_reads"]) assert.match(source, new RegExp(table));
  for (const kind of ["assignment", "deadline", "comment", "status", "deadline_change"]) assert.match(source, new RegExp(`kind: "${kind}"`));
  assert.match(source, /user_id\.is\.null,user_id\.neq/);
  assert.match(source, /\.neq\("actor_id", userId\)/);
});

test("AppNav renders the notification bell with unread and read controls", () => {
  const nav = read("../components/AppNav.tsx");
  const bell = read("../components/NotificationBell.tsx");
  assert.equal((nav.match(/<NotificationBell \/>/g) ?? []).length, 1);
  assert.match(bell, /unreadCount/);
  assert.match(bell, /Đánh dấu tất cả đã đọc/);
  assert.match(bell, /setInterval\(load, 60000\)/);
});
