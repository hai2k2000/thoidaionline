import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { assertReleaseLineage, parseReleaseLineage } from "./release-lineage.mjs";

const legacyBaseline = "e501652e969900b97938acccd8f998df4e5d1873";`r`nconst canonicalBaseline = legacyBaseline;
const readValue = (name, fallback = "") => process.env[name] || fallback;
const readFileValue = (file, key) => {
  if (!existsSync(file)) return "";
  return parseReleaseLineage(readFileSync(file, "utf8"))[key] || "";
};
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const hasGit = existsSync(".git");
let candidateCommit = "";
let currentProductionCommit = readValue("THOIDAI_CURRENT_PRODUCTION_COMMIT", readFileValue("CURRENT_PRODUCTION_COMMIT", "commit") || readFileValue("/opt/releases/thoidai-work/current/.release-meta", "commit") || legacyBaseline);
let integrationCommit = "";
let candidateBranch = "";
let candidateDescendsFromProduction = false;
let integrationContainsProduction = false;

try {
  if (hasGit) {
    candidateCommit = git(["rev-parse", "HEAD"]);
    candidateBranch = readValue("THOIDAI_RELEASE_BRANCH", git(["branch", "--show-current"]));
    const integrationBranch = readValue("THOIDAI_INTEGRATION_BRANCH", "integration/production");
    integrationCommit = git(["rev-parse", integrationBranch]);
    execFileSync("git", ["merge-base", "--is-ancestor", currentProductionCommit, candidateCommit], { stdio: "ignore" });
    candidateDescendsFromProduction = true;
    execFileSync("git", ["merge-base", "--is-ancestor", currentProductionCommit, integrationCommit], { stdio: "ignore" });
    integrationContainsProduction = true;
    assertReleaseLineage({
      candidateCommit,
      currentProductionCommit,
      integrationCommit,
      candidateBranch,
      candidateDescendsFromProduction,
      integrationContainsProduction,
    });
    console.log("release-lineage: PASS (production=" + currentProductionCommit + ", integration=" + integrationCommit + ", branch=" + candidateBranch + ")");
  } else {
    const baseline = readFileValue("RELEASE_BASELINE_COMMIT", legacyBaseline);
    currentProductionCommit = readValue("THOIDAI_CURRENT_PRODUCTION_COMMIT", readFileValue("PRODUCTION_PARENT_COMMIT", baseline));
    integrationCommit = readValue("THOIDAI_INTEGRATION_COMMIT", readFileValue("INTEGRATION_BASELINE_COMMIT", currentProductionCommit));
    candidateCommit = readValue("THOIDAI_ARTIFACT_SOURCE_COMMIT", readFileValue(".release-meta", "commit"));
    candidateBranch = readFileValue(".release-meta", "integration_branch") || "integration/production";
    if (!candidateCommit) throw new Error("packaged artifact source commit missing");
    assertReleaseLineage({
      candidateCommit,
      currentProductionCommit,
      integrationCommit,
      candidateBranch,
      candidateDescendsFromProduction: true,
      integrationContainsProduction: true,
    });
    console.log("release-lineage: PASS (packaged production=" + currentProductionCommit + ", integration=" + integrationCommit + ")");
  }
} catch (error) {
  console.error("release lineage check failed: " + error.message);
  process.exit(1);
}





