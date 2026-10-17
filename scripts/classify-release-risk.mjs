import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());
const commit = process.env.THOIDAI_RISK_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const base = process.env.THOIDAI_RISK_BASE || process.env.THOIDAI_CURRENT_PRODUCTION_COMMIT || "";
const evidencePath = process.env.THOIDAI_RISK_TEST_EVIDENCE || "";
const files = base && /^[0-9a-f]{40}$/i.test(base)
  ? execFileSync("git", ["diff", "--name-only", `${base}..${commit}`], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean)
  : [];

const highRisk = /(^|\/)(api|auth|security|rbac|permission|permissions|session|middleware|supabase|migration|migrations|deploy|scripts)(\/|$)|route\.(m?[jt]sx?|ts)$|repository|package(-lock)?\.json$|next\.config|\.env/i;
const lowRisk = /^(public\/|src\/content\/|src\/components\/|src\/app\/[^/]+\/page\.(?:tsx?|jsx?))|\.(css|scss|md|txt|svg|png|jpe?g|webp)$/i;
const lowRiskCandidate = files.length > 0 && files.every((file) => lowRisk.test(file) && !highRisk.test(file));
const evidence = evidencePath && existsSync(resolve(root, evidencePath)) ? readFileSync(resolve(root, evidencePath), "utf8") : "";
const testsPass = evidence.includes(`commit=${commit}`) && evidence.includes("status=PASS");
const riskClass = lowRiskCandidate && testsPass ? "low" : "high";
const reason = riskClass === "low" ? "allowlisted-ui-content-with-automated-test-evidence" : "high-risk-or-missing-classification-evidence";

console.log(`risk_class=${riskClass}`);
console.log(`risk_test_evidence=${testsPass ? "automated-tests-pass" : "missing-or-invalid"}`);
console.log(`risk_reason=${reason}`);
console.log(`risk_files=${files.join(",")}`);
