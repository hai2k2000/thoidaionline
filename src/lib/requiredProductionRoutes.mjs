import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REQUIRED_PRODUCTION_ROUTES = [
  { sourcePath: "src/app/api/work-schedule/personal/route.ts", routePath: "/api/work-schedule/personal" },
  { sourcePath: "src/app/api/work-schedule/route.ts", routePath: "/api/work-schedule" },
  { sourcePath: "src/app/api/online-work/route.ts", routePath: "/api/online-work" },
  { sourcePath: "src/app/api/online-work-schedule/route.ts", routePath: "/api/online-work-schedule" },
  { sourcePath: "src/app/api/auth/session/route.ts", routePath: "/api/auth/session" },
  { sourcePath: "src/app/api/work-schedule/events/route.ts", routePath: "/api/work-schedule/events" },
  { sourcePath: "src/app/api/tasks/assign/route.ts", routePath: "/api/tasks/assign" },
  { sourcePath: "src/app/api/tasks/journalism/assign/route.ts", routePath: "/api/tasks/journalism/assign" },
  { sourcePath: "src/app/journalism/tasks/page.tsx", routePath: "/journalism/tasks" },
  { sourcePath: "src/app/api/tasks/[id]/journalism/route.ts", routePath: "/api/tasks/[id]/journalism" },
  { sourcePath: "src/app/api/tasks/[id]/journalism/publication/route.ts", routePath: "/api/tasks/[id]/journalism/publication" },
  { sourcePath: "src/app/api/journalism/calendar/route.ts", routePath: "/api/journalism/calendar" },
  { sourcePath: "src/app/api/journalism/calendar/[id]/route.ts", routePath: "/api/journalism/calendar/[id]" },
];

export function missingRequiredProductionRoutes(root = process.cwd()) {
  return REQUIRED_PRODUCTION_ROUTES
    .filter(({ sourcePath }) => !existsSync(join(root, sourcePath)))
    .map(({ sourcePath }) => sourcePath);
}

export function missingRequiredArtifactRoutes(root = process.cwd()) {
  const manifestPath = join(root, ".next", "server", "app-paths-manifest.json");
  if (!existsSync(manifestPath)) return REQUIRED_PRODUCTION_ROUTES.map(({ routePath }) => routePath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return REQUIRED_PRODUCTION_ROUTES
    .filter(({ sourcePath, routePath }) => !Object.hasOwn(manifest, `${routePath}/${sourcePath.endsWith("/route.ts") ? "route" : "page"}`))
    .map(({ routePath }) => routePath);
}
