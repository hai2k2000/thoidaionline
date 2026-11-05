import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { createDispatcher } from "./dispatcher.mjs";

const state = globalThis as typeof globalThis & { thoidaiPushLoop?: ReturnType<typeof setInterval> };
export function startPushDispatcher() {
  if (state.thoidaiPushLoop) return;
  const dispatch = createDispatcher(serverSupabase);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await dispatch(); } catch { console.warn("Push dispatcher tick failed; retrying later."); }
    finally { running = false; }
  };
  state.thoidaiPushLoop = setInterval(() => { void tick(); }, 15_000);
  state.thoidaiPushLoop.unref();
}
