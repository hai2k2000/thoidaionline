import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { createDispatcher } from "./dispatcher.mjs";
import { createPushScheduler } from "./scheduler.mjs";

const state = globalThis as typeof globalThis & { thoidaiPushLoop?: ReturnType<typeof setInterval>; thoidaiPushScheduler?: ReturnType<typeof createPushScheduler> };
export function startPushDispatcher() {
  if (process.env.PUSH_DISPATCH_ENABLED !== "1") return;
  if (state.thoidaiPushLoop) return;
  const dispatch = createDispatcher(serverSupabase);
  state.thoidaiPushScheduler = createPushScheduler({ dispatch, enabled: () => process.env.PUSH_DISPATCH_ENABLED === "1" });
  state.thoidaiPushLoop = setInterval(() => { void state.thoidaiPushScheduler?.tick(); }, 15_000);
  state.thoidaiPushLoop.unref();
}
export { kickPushDispatcher } from "./kick.mjs";
