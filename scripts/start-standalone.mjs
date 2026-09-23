import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
for (const name of [".env.local", ".env.production"]) {
  const path = join(root, name);
  if (existsSync(path) && typeof process.loadEnvFile === "function") process.loadEnvFile(path);
}
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--hostname" && args[index + 1]) process.env.HOSTNAME = args[++index];
  else if (args[index] === "--port" && args[index + 1]) process.env.PORT = args[++index];
}
const child = spawn(process.execPath, [join(root, "server.js")], { cwd: root, env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 1));
