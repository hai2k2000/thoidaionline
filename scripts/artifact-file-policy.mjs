import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export function isEnvironmentFileName(name) {
  return /^\.env(?:\.|$)/i.test(name);
}

export async function removePackagedEnvironmentFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (isEnvironmentFileName(entry.name)) {
      await rm(path, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      await removePackagedEnvironmentFiles(path);
    }
  }
}
