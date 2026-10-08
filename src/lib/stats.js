/** Small numeric helpers shared by the LLM and stochastic-calculus notebooks. */

export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
export const variance = (xs) => { const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1 || 1); };
export const std = (xs) => Math.sqrt(variance(xs));
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

export const normalPdf = (x, mu = 0, sigma = 1) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

/** Standard normal CDF via a high-accuracy erf approximation (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Softmax with optional temperature, numerically stable. */
export function softmax(z, T = 1) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp((v - m) / T));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** Histogram: returns { edges, counts, width } over [lo, hi) with n bins (out-of-range values are dropped). */
export function histogram(xs, lo, hi, n) {
  const counts = new Array(n).fill(0);
  const width = (hi - lo) / n;
  for (const x of xs) { const i = Math.floor((x - lo) / width); if (i >= 0 && i < n) counts[i]++; }
  return { counts, width, lo, hi, n };
}

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
