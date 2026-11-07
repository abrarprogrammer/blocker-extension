(function () {
  const HEARTBEAT_INTERVAL_MS = 2000;
  let lastTick = Date.now();
  let lastPath = null;

  function onShorts() {
    return location.pathname.startsWith('/shorts/');
  }

  function tick() {
    const now = Date.now();

    // Notify background on every distinct shorts pageview (handles SPA nav
    // that onUpdated sometimes misses) so a locked-out user gets bounced
    // even mid-session.
    if (onShorts() && location.pathname !== lastPath) {
      lastPath = location.pathname;
      chrome.runtime.sendMessage({ type: 'SHORTS_PAGEVIEW' });
    }

    if (onShorts() && document.visibilityState === 'visible' && document.hasFocus()) {
      const delta = now - lastTick;
      chrome.runtime.sendMessage({ type: 'SHORTS_HEARTBEAT', deltaMs: delta });
    }

    lastTick = now;
  }

  setInterval(tick, HEARTBEAT_INTERVAL_MS);

  // Catch YouTube's SPA route changes immediately, not just on the next tick.
  const pushState = history.pushState;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
  };
  window.addEventListener('locationchange', tick);
  window.addEventListener('popstate', tick);
})();
