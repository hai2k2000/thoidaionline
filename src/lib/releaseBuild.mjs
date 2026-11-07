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
  try {
    const metadata = await readFile(join(process.cwd(), ".release-meta"), "utf8");
    const commit = metadata.match(/^commit=(.+)$/m)?.[1]?.trim();
    const createdAt = metadata.match(/^created_at=(.+)$/m)?.[1]?.trim();
    if (!commit || !createdAt) throw new Error("Incomplete release metadata");
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(createdAt));
    releaseLabel = `B\u1ea3n ${date} \u00b7 ${commit.slice(0, 7)}`;
    return releaseLabel;
  } catch {
    let build = "development";
    try {
      build = (await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim() || build;
    } catch {}
    releaseLabel = `B\u1ea3n ${build.slice(0, 7)}`;
    return releaseLabel;
  }
}
