function fmt(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

chrome.storage.local.get(['accumulatedMs', 'lockUntil'], (d) => {
  const now = Date.now();
  const lockUntil = d.lockUntil || 0;
  const statusEl = document.getElementById('status');
  const timeEl = document.getElementById('timeval');

  if (now < lockUntil) {
    statusEl.textContent = 'Shorts locked. Time remaining:';
    statusEl.className = 'row locked';
    timeEl.textContent = fmt(lockUntil - now);
    timeEl.className = 'big locked';
  } else {
    const accumulated = d.accumulatedMs || 0;
    const limit = 5 * 60 * 1000;
    statusEl.textContent = 'Shorts watch time (of 5m):';
    statusEl.className = 'row free';
    timeEl.textContent = fmt(accumulated) + ' / ' + fmt(limit);
    timeEl.className = 'big free';
  }
});
