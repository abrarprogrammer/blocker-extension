// Shared by background.js, content.js and popup.js.
// requireInteraction: only count time while the user is actually scrolling/typing/moving,
// so a tab left open in the foreground doesn't burn through the budget.
const RULES = [
  {
    id: 'shorts',
    label: 'YouTube Shorts',
    limitMs: 5 * 60 * 1000,
    lockMs: 2 * 60 * 60 * 1000,
    idleResetMs: 90 * 1000,
    requireInteraction: false,
    matches: (url) => url.hostname === 'www.youtube.com' && url.pathname.startsWith('/shorts/')
  },
  {
    id: 'social',
    label: 'Instagram / X',
    limitMs: 10 * 60 * 1000,
    lockMs: 20 * 60 * 1000,
    idleResetMs: 3 * 60 * 1000,
    requireInteraction: true,
    matches: (url) => /(^|\.)(instagram|x|twitter)\.com$/.test(url.hostname)
  }
];

function findRule(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return RULES.find((r) => r.matches(url)) || null;
}

function stateKey(rule) {
  return `state_${rule.id}`;
}
