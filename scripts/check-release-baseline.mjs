import { execFileSync } from "node:child_process";

const canonicalBaseline = "e501652e969900b97938acccd8f998df4e5d1873";
try {
  execFileSync("git", ["merge-base", "--is-ancestor", canonicalBaseline, "HEAD"], { stdio: "ignore" });
} catch {
  console.error(`release baseline check failed: HEAD must descend from ${canonicalBaseline}`);
  process.exit(1);
}
console.log(`release-baseline: PASS (${canonicalBaseline})`);
