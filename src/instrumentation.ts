export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.PUSH_DISPATCH_ENABLED !== "1"
    || process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PRIVATE_BUILD_WORKER === "1"
    || process.argv.some(arg => arg === "build")) return;
  const { startPushDispatcher } = await import("@/lib/push/runtime");
  startPushDispatcher();
}
