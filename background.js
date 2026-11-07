// ---- Config ----
const WATCH_LIMIT_MS = 5 * 60 * 1000;      // 5 minutes of shorts before lockout
const LOCK_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hour lock
const IDLE_RESET_MS = 90 * 1000;             // gap with no heartbeat = "stopped watching", reset counter
const SHORTS_URL_RE = /^https:\/\/www\.youtube\.com\/shorts\//;

// ---- Storage helpers ----
async function getState() {
  const d = await chrome.storage.local.get(['accumulatedMs', 'lastHeartbeat', 'lockUntil']);
  return {
    accumulatedMs: d.accumulatedMs || 0,
    lastHeartbeat: d.lastHeartbeat || 0,
    lockUntil: d.lockUntil || 0
  };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
}

async function isLocked() {
  const { lockUntil } = await getState();
  return Date.now() < lockUntil;
}

// ---- Heartbeats from content script (only sent while actively viewing a Short) ----
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'SHORTS_HEARTBEAT') {
    handleHeartbeat(msg.deltaMs, sender.tab?.id);
  }
  if (msg?.type === 'GET_STATUS') {
    // handled via async response in popup.js using a promise-based call instead
  }
});

async function handleHeartbeat(deltaMs, tabId) {
  const now = Date.now();
  const state = await getState();

  // Safety net: if somehow a heartbeat arrives while locked, kill the tab.
  if (now < state.lockUntil) {
    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
    return;
  }

  // If there was a real gap since the last heartbeat, the user stopped
  // watching shorts in between — don't let stale progress carry over.
  let accumulatedMs = state.accumulatedMs;
  if (state.lastHeartbeat && now - state.lastHeartbeat > IDLE_RESET_MS) {
    accumulatedMs = 0;
  }

  accumulatedMs += deltaMs;

  if (accumulatedMs >= WATCH_LIMIT_MS) {
    const lockUntil = now + LOCK_DURATION_MS;
    await setState({ accumulatedMs: 0, lastHeartbeat: 0, lockUntil });
    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
    return;
  }

  await setState({ accumulatedMs, lastHeartbeat: now });
}

// ---- Enforce the lock on navigation ----
// Fires on the very start of navigation, before the page finishes loading.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url || !SHORTS_URL_RE.test(url)) return;

  if (await isLocked()) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
});

// Some navigations (SPA route changes on youtube.com) don't trigger onUpdated
// with a new url reliably in all Chrome versions, so also catch it via the
// webNavigation-free fallback: content script pings on every shorts pageview.
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg?.type === 'SHORTS_PAGEVIEW' && sender.tab?.id) {
    if (await isLocked()) {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }
  }
});
