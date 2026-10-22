import { execFileSync } from "node:child_process";

const profile = process.env.THOIDAI_DEPLOYMENT_PROFILE || "default-local-to-target";
execFileSync(process.execPath, ["scripts/check-required-routes.mjs"], { stdio: "inherit" });
if (profile !== "thoidai-work-vps-first") {
  execFileSync(process.execPath, ["scripts/check-release-baseline.mjs"], { stdio: "inherit" });
} else {
  console.log("prebuild-profile: PASS (VPS-FIRST skips cross-machine lineage)");
}
