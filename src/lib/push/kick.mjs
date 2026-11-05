// Shared by instrumentation and request bundles in the same Node process.
export function kickPushDispatcher() {
  if (process.env.PUSH_DISPATCH_ENABLED === '1') globalThis.thoidaiPushScheduler?.kick();
}
