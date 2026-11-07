import { readFile } from "node:fs/promises";
import { join } from "node:path";

let releaseBuild;
let releaseLabel;
export async function getReleaseBuild() {
  if (releaseBuild) return releaseBuild;
  try {
    const build = (await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
    if (!build) throw new Error("Missing build ID");
    releaseBuild = build;
    return build;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return "development";
  }
}

export async function getReleaseLabel() {
  if (releaseLabel) return releaseLabel;
  if (process.env.NODE_ENV !== "production") {
    releaseLabel = "B\u1ea3n dev";
    return releaseLabel;
  }
  if (process.env.THOIDAI_APP_VERSION) {
    releaseLabel = `v${process.env.THOIDAI_APP_VERSION}`;
    return releaseLabel;
  }
  let build = "development";
  try {
    build = (await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim() || build;
  } catch {}
  releaseLabel = `B\u1ea3n ${build.slice(0, 7)}`;
  return releaseLabel;
}
