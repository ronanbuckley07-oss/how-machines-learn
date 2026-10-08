/**
 * One global "sim speed" multiplier shared by every training loop on the
 * page. Set from the corner control; remembered in this browser.
 */
export const SPEEDS = [0.25, 0.5, 1, 2, 4];
const KEY = 'hml-sim-speed';
const listeners = new Set();

let speed = 1;
try { const v = +localStorage.getItem(KEY); if (SPEEDS.includes(v)) speed = v; } catch { /* storage unavailable */ }

export const getSpeed = () => speed;

export function setSpeed(v) {
  if (!SPEEDS.includes(v) || v === speed) return;
  speed = v;
  try { localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
  listeners.forEach((f) => f(v));
}

export const onSpeedChange = (f) => listeners.add(f);

/** Label like "¼×" for a speed. */
export const speedLabel = (v) => ({ 0.25: '¼×', 0.5: '½×' }[v] || `${v}×`);
