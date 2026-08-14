import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getPasswordResetDisabledReason,
  passwordResetMessage,
} from "./adminPasswordResetUi.ts";

const usersPageSource = readFileSync(
  new URL("../app/users/page.tsx", import.meta.url),
  "utf8",
);

test("reset eligibility explains inactive, missing-email and submitting states", () => {
  assert.equal(getPasswordResetDisabledReason({ active: false, email: "employee@example.invalid" }, false), "Không thể đặt lại mật khẩu cho tài khoản đã khóa.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: null }, false), "Nhân viên chưa có email đăng ký.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: "employee@example.invalid" }, true), "Đang gửi liên kết đặt lại mật khẩu.");
  assert.equal(getPasswordResetDisabledReason({ active: true, email: "employee@example.invalid" }, false), null);
});

test("API error codes map to stable Vietnamese messages", () => {
  assert.equal(passwordResetMessage("email_missing"), "Nhân viên chưa có email đăng ký.");
  assert.equal(passwordResetMessage("user_inactive"), "Không thể đặt lại mật khẩu cho tài khoản đã khóa.");
  assert.equal(passwordResetMessage("reset_email_sent"), "Đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 60 phút.");
  assert.equal(passwordResetMessage("network_error"), "Không thể gửi liên kết đặt lại mật khẩu.");
  assert.equal(passwordResetMessage("unknown"), "Không thể gửi liên kết đặt lại mật khẩu.");
});

test("users page contains admin-only reset confirmation and accessible toast", () => {
  assert.match(usersPageSource, /Đặt lại mật khẩu/);
  assert.match(usersPageSource, /\/api\/auth\/admin-reset/);
  assert.match(usersPageSource, /resetState\s*===\s*["']confirming["']/);
  assert.match(usersPageSource, /resetState\s*===\s*["']submitting["']/);
  assert.match(usersPageSource, /role=\{resetState\s*===\s*["']error["']\s*\?\s*["']alert["']\s*:\s*["']status["']\}/);
  assert.match(usersPageSource, /email đã đăng ký/);
  assert.match(usersPageSource, /isAdmin\s*\?/);
  assert.match(usersPageSource, /aria-labelledby=["']password-reset-title["']/);
});

test("users page posts only userId and prevents duplicate or closing submits", () => {
  assert.match(usersPageSource, /if\s*\(!selected\s*\|\|\s*!isAdmin\s*\|\|\s*resetState\s*===\s*["']submitting["']\)\s*return/);
  assert.match(usersPageSource, /fetch\(["']\/api\/auth\/admin-reset["']/);
  assert.match(usersPageSource, /method:\s*["']POST["']/);
  assert.match(usersPageSource, /cache:\s*["']no-store["']/);
  assert.match(usersPageSource, /body:\s*JSON\.stringify\(\{\s*userId:\s*selected\.id\s*\}\)/);
  assert.match(usersPageSource, /resetState\s*!==\s*["']submitting["']/);
  assert.match(usersPageSource, /Đang gửi\.\.\./);
  assert.match(usersPageSource, /finally\s*\{/);
});

test("users page clears reset state and keeps exact email out of confirmation", () => {
  const clearCalls = usersPageSource.match(/clearPasswordResetState\(\)/g) ?? [];
  assert.ok(clearCalls.length >= 2);
  const confirmationStart = usersPageSource.indexOf('resetState === "confirming"');
  const confirmationEnd = usersPageSource.indexOf('onClick={() => void submitPasswordReset()}', confirmationStart);
  assert.ok(confirmationStart >= 0 && confirmationEnd > confirmationStart);
  const confirmationSource = usersPageSource.slice(confirmationStart, confirmationEnd);
  assert.match(confirmationSource, /selected\.full_name/);
  assert.match(confirmationSource, /email đã đăng ký/);
  assert.doesNotMatch(confirmationSource, /selected\.email/);
});
