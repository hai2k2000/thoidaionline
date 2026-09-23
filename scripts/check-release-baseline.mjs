import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const canonicalBaseline = "e501652e969900b97938acccd8f998df4e5d1873";
try {
  if (existsSync(".git")) {
    execFileSync("git", ["merge-base", "--is-ancestor", canonicalBaseline, "HEAD"], { stdio: "ignore" });
  } else {
    const releaseBaseline = readFileSync("RELEASE_BASELINE_COMMIT", "utf8").trim();
    if (releaseBaseline !== canonicalBaseline) throw new Error("packaged baseline mismatch");
  }
} catch {
  console.error(`release baseline check failed: HEAD must descend from ${canonicalBaseline}`);
  process.exit(1);
}
console.log(`release-baseline: PASS (${canonicalBaseline})`);
