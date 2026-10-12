import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());
const names = (process.env.THOIDAI_FORBIDDEN_ARTIFACT_ENV_NAMES || "SUPABASE_SERVICE_ROLE_KEY,SESSION_SECRET,ATTENDANCE_BRIDGE_TOKEN,RECURRENCE_RUNNER_SECRET,DATABASE_URL,SUPABASE_ACCESS_TOKEN")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const forbiddenNames = new Set(names);
const assignmentPattern = new RegExp(`(?:${names.map((name) => name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|")})\\s*[:=]\\s*([^\\s#,'\"]{8,})`, "i");
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (relative(root, path).replaceAll("\\", "/") === ".next/cache") continue;
      await scan(path);
      continue;
    }
    if (!stat.isFile()) continue;
    const bytes = await readFile(path);
    const relativePath = relative(root, path).replaceAll("\\", "/");
    if (/^\.env(?:\.|$)/i.test(entry.name)) throw new Error(`artifact contains environment file: ${relativePath}`);
    const text = bytes.toString("utf8");
    if (privateKeyPattern.test(text)) throw new Error(`artifact contains private key material: ${relativePath}`);
    const match = text.match(assignmentPattern);
    if (match) throw new Error(`artifact contains populated runtime secret assignment: ${relativePath}`);
    for (const name of forbiddenNames) {
      if (text.includes(name) && new RegExp(`${name}\\s*[:=]\\s*[^\\s#,'\"]+`, "i").test(text)) {
        throw new Error(`artifact contains runtime secret assignment: ${name} in ${relativePath}`);
      }
    }
  }
}

await scan(root);
console.log(`artifact-secret-scan: PASS (${names.length} secret names checked)`);
