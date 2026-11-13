import assert from "node:assert/strict";
import test from "node:test";

import { shouldRememberLoginDefault } from "./installApp.mjs";

test("remember login defaults on for APK, installed PWA, and off for normal browsers", () => {
  assert.equal(shouldRememberLoginDefault({ userAgent: "Mozilla ThoidaiWorkApp/1.0" }), true);
  assert.equal(shouldRememberLoginDefault({ standalone: true }), true);
  assert.equal(shouldRememberLoginDefault({ iosStandalone: true }), true);
  assert.equal(shouldRememberLoginDefault({ userAgent: "Mozilla/5.0" }), false);
});
