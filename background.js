importScripts('rules.js');

// ---- Storage helpers ----
async function getState(rule) {
  const key = stateKey(rule);
  const d = (await chrome.storage.local.get(key))[key] || {};
  return {
    accumulatedMs: d.accumulatedMs || 0,
    lastHeartbeat: d.lastHeartbeat || 0,
    lockUntil: d.lockUntil || 0
  };
}

async function setState(rule, state) {
  await chrome.storage.local.set({ [stateKey(rule)]: state });
}

async function isLocked(rule) {
  const { lockUntil } = await getState(rule);
  return Date.now() < lockUntil;
}

function closeTab(tabId) {
  chrome.tabs.remove(tabId).catch(() => {});
}

async function closeAllTabsFor(rule) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs)
    if (tab.url && findRule(tab.url) === rule) closeTab(tab.id);
}

// ---- Messages from content script ----
chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  const rule = msg?.url && findRule(msg.url);
  if (!tabId || !rule) return;

  if (msg.type === 'HEARTBEAT') handleHeartbeat(rule, msg.deltaMs, tabId);
  if (msg.type === 'PAGEVIEW') enforceLock(rule, tabId);
});

async function enforceLock(rule, tabId) {
  if (await isLocked(rule)) closeTab(tabId);
}

async function handleHeartbeat(rule, deltaMs, tabId) {
  const now = Date.now();
  const state = await getState(rule);

  // Safety net: if somehow a heartbeat arrives while locked, kill the tab.
  if (now < state.lockUntil) {
    closeTab(tabId);
    return;
  }

  // If there was a real gap since the last heartbeat, the user stopped
  // using the site in between — don't let stale progress carry over.
  let accumulatedMs = state.accumulatedMs;
  if (state.lastHeartbeat && now - state.lastHeartbeat > rule.idleResetMs) accumulatedMs = 0;

  accumulatedMs += deltaMs;

  if (accumulatedMs >= rule.limitMs) {
    await setState(rule, { accumulatedMs: 0, lastHeartbeat: 0, lockUntil: now + rule.lockMs });
    await closeAllTabsFor(rule);
    return;
  }

  await setState(rule, { ...state, accumulatedMs, lastHeartbeat: now });
}

// ---- Enforce the lock on navigation ----
// Fires on the very start of navigation, before the page finishes loading.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  const rule = url && findRule(url);
  if (rule) enforceLock(rule, tabId);
});
