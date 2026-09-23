import { existsSync } from "node:fs";
import { missingRequiredArtifactRoutes, missingRequiredProductionRoutes } from "../src/lib/requiredProductionRoutes.mjs";

const missingSource = missingRequiredProductionRoutes();
if (missingSource.length) {
  console.error(`required source routes missing:\n- ${missingSource.join("\n- ")}`);
  process.exit(1);
}
if (existsSync(".next/server/app-paths-manifest.json")) {
  const missingArtifact = missingRequiredArtifactRoutes();
  if (missingArtifact.length) {
    console.error(`required artifact routes missing:\n- ${missingArtifact.join("\n- ")}`);
    process.exit(1);
  }
}
console.log("required-route-manifest: PASS");
