import { readFile } from "node:fs/promises";
import { join } from "node:path";

let releaseBuild;
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
