(function () {
  const HEARTBEAT_INTERVAL_MS = 2000;
  const INTERACTION_WINDOW_MS = 60 * 1000;
  let lastTick = Date.now();
  let lastInteraction = Date.now();
  let lastPath = null;

  for (const evt of ['scroll', 'wheel', 'keydown', 'mousemove', 'pointerdown', 'touchstart'])
    window.addEventListener(evt, () => { lastInteraction = Date.now(); }, { passive: true, capture: true });

  function tick() {
    const now = Date.now();
    const rule = findRule(location.href);

    // Notify background on every distinct pageview (handles SPA nav that
    // onUpdated sometimes misses) so a locked-out user gets bounced even
    // mid-session.
    if (rule && location.pathname !== lastPath) {
      lastPath = location.pathname;
      chrome.runtime.sendMessage({ type: 'PAGEVIEW', url: location.href });
    }

    const active = document.visibilityState === 'visible' && document.hasFocus();
    const interacting = !rule?.requireInteraction || now - lastInteraction < INTERACTION_WINDOW_MS;
    if (rule && active && interacting)
      chrome.runtime.sendMessage({ type: 'HEARTBEAT', url: location.href, deltaMs: now - lastTick });

    lastTick = now;
  }

  setInterval(tick, HEARTBEAT_INTERVAL_MS);

  // Catch SPA route changes immediately, not just on the next tick.
  const pushState = history.pushState;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
  };
  window.addEventListener('locationchange', tick);
  window.addEventListener('popstate', tick);
})();
