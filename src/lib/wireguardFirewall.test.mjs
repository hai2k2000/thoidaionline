import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const unit = readFileSync(new URL("../../deploy/systemd/vps-port-guard.service", import.meta.url), "utf8");
const script = readFileSync(new URL("../../deploy/systemd/vps-port-guard.sh", import.meta.url), "utf8");

test("port guard starts after WireGuard and preserves both management paths", () => {
  assert.match(unit, /After=.*wg-quick@wg0\.service/);
  assert.match(unit, /Wants=.*wg-quick@wg0\.service/);
  assert.match(script, /--dport 51820 -j ACCEPT/);
  assert.match(script, /-i wg0 .*--dport 24700 -j ACCEPT/);
  assert.match(script, /ip6tables[\s\S]*--dport 51820 -j DROP/);
  assert.match(script, /--dports 3000,3001,3100 -j DROP/);
  assert.match(script, /ctorigdstport \"\$port\" -j DROP/);
});
