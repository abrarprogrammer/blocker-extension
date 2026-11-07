function fmt(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

chrome.storage.local.get(RULES.map(stateKey), (d) => {
  const now = Date.now();
  const container = document.getElementById('rules');

  for (const rule of RULES) {
    const state = d[stateKey(rule)] || {};
    const locked = now < (state.lockUntil || 0);

    const statusEl = document.createElement('div');
    const timeEl = document.createElement('div');

    if (locked) {
      statusEl.textContent = `${rule.label} locked. Time remaining:`;
      timeEl.textContent = fmt(state.lockUntil - now);
    } else {
      statusEl.textContent = `${rule.label} time (of ${fmt(rule.limitMs)}):`;
      timeEl.textContent = fmt(state.accumulatedMs || 0) + ' / ' + fmt(rule.limitMs);
    }
    statusEl.className = `row ${locked ? 'locked' : 'free'}`;
    timeEl.className = `big ${locked ? 'locked' : 'free'}`;

    container.append(statusEl, timeEl);
  }
});
