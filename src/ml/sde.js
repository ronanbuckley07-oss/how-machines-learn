import { normalCdf } from '../lib/stats.js';

/** A Brownian motion path on [0, T] sampled at n+1 equally spaced times. */
export function brownian(rng, n, T = 1) {
  const W = new Float64Array(n + 1), s = Math.sqrt(T / n);
  for (let i = 1; i <= n; i++) W[i] = W[i - 1] + s * rng.normal();
  return W;
}

/**
 * Geometric Brownian motion, dS = mu S dt + sigma S dW, stepped with its exact solution
 * S(t+dt) = S(t) exp((mu - sigma^2/2) dt + sigma sqrt(dt) Z), so there's no discretisation error.
 */
export function gbmPath(rng, steps, T, mu, sigma, S0 = 100) {
  const S = new Float64Array(steps + 1), dt = T / steps, a = (mu - 0.5 * sigma * sigma) * dt, b = sigma * Math.sqrt(dt);
  S[0] = S0;
  for (let i = 1; i <= steps; i++) S[i] = S[i - 1] * Math.exp(a + b * rng.normal());
  return S;
}

/** Black–Scholes price and delta of a European call. */
export function bsCall(S, K, T, r, sigma) {
  if (T <= 0) return { price: Math.max(S - K, 0), delta: S > K ? 1 : 0, d1: NaN, d2: NaN };
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / sq, d2 = d1 - sq;
  return { price: S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2), delta: normalCdf(d1), d1, d2 };
}
