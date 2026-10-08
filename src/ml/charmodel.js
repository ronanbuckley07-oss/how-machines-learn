/**
 * A tiny neural next-character model: each character gets a learned vector
 * (embedding) of length d, and the next-character scores are
 *     logits = E[c] · W + b,   p = softmax(logits)
 * It's trained by gradient descent on cross-entropy, exactly like an LLM's
 * last layer, just on characters and with no attention in between.
 * Training uses the bigram count table, so one step sees the whole text.
 */
export const CHARS = ' abcdefghijklmnopqrstuvwxyz.';

export function charCounts(text) {
  const V = CHARS.length, N = Array.from({ length: V }, () => new Float64Array(V));
  const clean = text.toLowerCase().replace(/[!?;:]/g, '.').replace(/[^a-z. ]+/g, ' ').replace(/ +/g, ' ');
  for (let i = 0; i + 1 < clean.length; i++) N[CHARS.indexOf(clean[i])][CHARS.indexOf(clean[i + 1])]++;
  return N;
}

export class CharModel {
  constructor(counts, { d = 2, seed = 1, rng } = {}) {
    this.N = counts; this.V = counts.length; this.d = d;
    this.rowN = counts.map((r) => r.reduce((a, b) => a + b, 0));
    this.total = this.rowN.reduce((a, b) => a + b, 0);
    let s = seed >>> 0;
    const rand = rng || (() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; });
    this.E = Array.from({ length: this.V }, () => Array.from({ length: d }, () => rand() * 1.0));
    this.W = Array.from({ length: d }, () => Array.from({ length: this.V }, () => rand() * 1.0));
    this.b = new Array(this.V).fill(0);
    this.vE = this.E.map((r) => r.map(() => 0)); this.vW = this.W.map((r) => r.map(() => 0)); this.vb = this.b.map(() => 0);
  }
  logits(a) { const e = this.E[a]; return this.b.map((bj, j) => { let z = bj; for (let k = 0; k < this.d; k++) z += e[k] * this.W[k][j]; return z; }); }
  probs(a, T = 1) { const z = this.logits(a); const m = Math.max(...z); const ex = z.map((v) => Math.exp((v - m) / T)); const S = ex.reduce((x, y) => x + y, 0); return ex.map((v) => v / S); }
  /** Average cross-entropy (nats per character) over the whole text. */
  loss() {
    let L = 0;
    for (let a = 0; a < this.V; a++) { if (!this.rowN[a]) continue; const p = this.probs(a); for (let j = 0; j < this.V; j++) if (this.N[a][j]) L -= this.N[a][j] * Math.log(p[j]); }
    return L / this.total;
  }
  /** One full-batch gradient step with momentum. */
  step(lr = 1, mom = 0.9) {
    const { V, d } = this;
    const gE = this.E.map((r) => r.map(() => 0)), gW = this.W.map((r) => r.map(() => 0)), gb = new Array(V).fill(0);
    for (let a = 0; a < V; a++) {
      if (!this.rowN[a]) continue;
      const p = this.probs(a);
      for (let j = 0; j < V; j++) {
        const g = (this.rowN[a] * p[j] - this.N[a][j]) / this.total;   // dL/dlogit = n_a p - counts
        gb[j] += g;
        for (let k = 0; k < d; k++) { gW[k][j] += this.E[a][k] * g; gE[a][k] += this.W[k][j] * g; }
      }
    }
    const upd = (P, Vv, G) => P.forEach((row, i) => (Array.isArray(row) ? row.forEach((_, k) => { Vv[i][k] = mom * Vv[i][k] - lr * G[i][k]; row[k] += Vv[i][k]; }) : (Vv[i] = mom * Vv[i] - lr * G[i], P[i] += Vv[i])));
    upd(this.E, this.vE, gE); upd(this.W, this.vW, gW); upd(this.b, this.vb, gb);
  }
  /** The lowest loss any bigram model could reach on this text (its conditional entropy). */
  bestLoss() {
    let L = 0;
    for (let a = 0; a < this.V; a++) for (let j = 0; j < this.V; j++) if (this.N[a][j]) L -= this.N[a][j] * Math.log(this.N[a][j] / this.rowN[a]);
    return L / this.total;
  }
  getState() { return { E: this.E.map((r) => [...r]), W: this.W.map((r) => [...r]), b: [...this.b] }; }
  setState(s) { this.E = s.E.map((r) => [...r]); this.W = s.W.map((r) => [...r]); this.b = [...s.b]; this.vE = this.E.map((r) => r.map(() => 0)); this.vW = this.W.map((r) => r.map(() => 0)); this.vb = this.b.map(() => 0); }
}
