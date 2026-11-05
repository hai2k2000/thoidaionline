export function createPushScheduler({ dispatch, enabled = () => Boolean(true), schedule = (fn, delay) => setTimeout(fn, delay), logger = console }) {
  let timer = null;
  let running = false;
  let pending = false;
  async function tick() {
    if (!enabled()) return;
    if (running) { pending = true; return; }
    running = true;
    try { await dispatch(); }
    catch { logger.warn?.('Push dispatcher tick failed; retrying later.'); }
    finally {
      running = false;
      if (pending) { pending = false; kick(); }
    }
  }
  function kick() {
    if (!enabled()) return;
    if (running) { pending = true; return; }
    if (timer) return;
    // Bound the first kick to 250ms: a steady stream of writes cannot starve it.
    timer = schedule(() => { timer = null; return tick(); }, 250);
    timer?.unref?.();
  }
  return { kick, tick };
}
