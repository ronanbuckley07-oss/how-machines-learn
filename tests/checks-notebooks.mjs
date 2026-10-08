// Checks for the hub and the LLM and stochastic-calculus notebooks. Each asserts real maths, not just "it renders".
import { openTab } from './checks.mjs';

const set = (loc, v) => loc.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
const ml = (page, f) => page.evaluate(f);

export default {
  async hub(page, ok) {
    await page.evaluate(() => { location.hash = ''; });
    await page.waitForTimeout(300);
    const books = await page.locator('.notebook').count();
    ok(books === 3, `the hub shows ${books} notebooks`);
    await page.locator('.notebook', { hasText: 'inside an LLM' }).click();
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => location.hash) === '#llm' && await page.locator('#llm-cover').isVisible(), 'clicking a notebook opens its cover');
    await page.evaluate(() => { location.hash = 'what-is-a-model'; });
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => location.hash) === '#ml/what-is-a-model', 'old single-notebook links redirect into the right notebook');
  },

  async llm(page, ok, vp) {
    let sec = await openTab(page, 'llm-vectors');
    const t = await ml(page, () => [window.__ml.llm1.encode('The tortoise laughed.', 0).length, window.__ml.llm1.encode('The tortoise laughed.', 200).length]);
    ok(t[0] === 21 && t[1] < 6, `BPE: 21 character tokens shrink to ${t[1]} after 200 merges`);
    ok(/3\.40/.test(await sec.locator('.formula').first().textContent()), 'the dot product formula shows the live numbers');

    sec = await openTab(page, 'llm-softmax');
    const p = await ml(page, () => window.__ml.llm2.probs());
    ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'softmax probabilities sum to 1');
    const l0 = await ml(page, () => window.__ml.llm2.loss());
    for (let i = 0; i < 3; i++) await sec.getByRole('button', { name: /take one learning step/i }).click();
    const l1 = await ml(page, () => window.__ml.llm2.loss());
    ok(l1 < l0 * 0.7, `three gradient steps cut the cross-entropy (${l0.toFixed(3)} → ${l1.toFixed(3)})`);
    await ml(page, () => window.__ml.llm2.setT(0.3));
    const sharp = Math.max(...await ml(page, () => window.__ml.llm2.probs()));
    ok(sharp > 0.8, `low temperature makes softmax decisive (top p = ${sharp.toFixed(2)})`);

    sec = await openTab(page, 'llm-attention');
    const w = await ml(page, () => window.__ml.llm3.weights());
    ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9 && w[1] > 0.4, `attention weights sum to 1; "it" mostly attends to "cat" (${(w[1] * 100).toFixed(0)}%)`);
    const masked = await sec.locator('.att-heat__cell.is-masked').count();
    ok(masked === 15, `causal mask hides the 15 future cells of a 6×6 matrix (${masked})`);
    await ml(page, () => window.__ml.llm3.setDim(256));
    const [raw, sc] = await ml(page, () => window.__ml.llm3.spread());
    ok(Math.abs(raw / 16 - 1) < 0.1 && Math.abs(sc - 1) < 0.1, `random dot products spread like √d (${raw.toFixed(1)} ≈ 16), scaled ones ≈ 1 (${sc.toFixed(2)})`);

    sec = await openTab(page, 'llm-transformer');
    const tf = await ml(page, () => window.__ml.llm4.api.last);
    ok(tf.A.every((r) => Math.abs(r.reduce((a, b) => a + b, 0) - 1) < 1e-9) && tf.A[0][1] === 0 && Math.abs(tf.probs.reduce((a, b) => a + b, 0) - 1) < 1e-9,
      'transformer block: attention rows sum to 1, masked entries are 0, output probabilities sum to 1');
    await sec.locator('select').first().selectOption('2');
    const tf2 = await ml(page, () => window.__ml.llm4.api.last);
    ok(JSON.stringify(tf2.probs) !== JSON.stringify(tf.probs), 'changing an input word recomputes the whole block');

    sec = await openTab(page, 'llm-training');
    const before = await ml(page, () => window.__ml.llm5.loss());
    await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
    await page.waitForFunction(() => !window.__ml.llm5.playing, null, { timeout: 60000 });
    const r = await ml(page, () => {
      const E = window.__ml.llm5.embeddings(), C = ' abcdefghijklmnopqrstuvwxyz.';
      const idx = (s) => [...s].map((c) => C.indexOf(c));
      const centroid = (ix) => [0, 1].map((k) => ix.reduce((a, i) => a + E[i][k], 0) / ix.length);
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const V = idx('aeiou'), cV = centroid(V), K = idx('bcdfgklmnprst'), cK = centroid(K);
      const spread = (ix, c) => ix.reduce((a, i) => a + dist(E[i], c), 0) / ix.length;
      return { loss: window.__ml.llm5.loss(), best: window.__ml.llm5.best, sep: dist(cV, cK), vowelSpread: spread(V, cV) };
    });
    ok(r.loss < before - 0.8 && r.loss < 2.45, `training lowers the loss (${before.toFixed(2)} → ${r.loss.toFixed(2)}, best possible ${r.best.toFixed(2)})`);
    ok(r.sep > r.vowelSpread, `vowels cluster together, apart from consonants (gap ${r.sep.toFixed(2)} > vowel spread ${r.vowelSpread.toFixed(2)})`);
    await page.locator('#llm-training .lab').screenshot({ path: `shots/llm-training-${vp.name}.png` });

    sec = await openTab(page, 'llm-scale');
    await ml(page, () => window.__ml.llm6.setPreset('gpt3'));
    const N = await ml(page, () => window.__ml.llm6.api.N);
    ok(Math.abs(N / 175e9 - 1) < 0.01, `GPT-3 preset gives ${(N / 1e9).toFixed(1)}B weights`);
    const t0 = await ml(page, () => window.__ml.llm6.text.length);
    await sec.getByRole('button', { name: /pick the next letter/i }).click();
    ok(await ml(page, () => window.__ml.llm6.text.length) === t0 + 1, 'sampling adds one letter at a time');
  },

  async sde(page, ok, vp) {
    let sec = await openTab(page, 'sde-walk');
    const s1 = await ml(page, () => window.__ml.sde1.spread());
    ok(Math.abs(s1 - 1) < 0.15, `Δx = 1/√n: spread at t = 1 is ${s1.toFixed(3)} ≈ 1`);
    await ml(page, () => window.__ml.sde1.setMode('lin'));
    const s2 = await ml(page, () => window.__ml.sde1.spread());
    ok(s2 < 0.1, `Δx = 1/n collapses the spread to ${s2.toFixed(3)}`);
    await ml(page, () => window.__ml.sde1.setMode('sqrt'));
    await sec.getByRole('button', { name: /play time/i }).click();
    await page.waitForFunction(() => !window.__ml.sde1.playing, null, { timeout: 30000 });
    ok(await ml(page, () => window.__ml.sde1.t) === 1, 'playing time runs the walk to t = 1');

    sec = await openTab(page, 'sde-variation');
    const ser = await ml(page, () => window.__ml.sde2.series());
    const last = ser[ser.length - 1];
    ok(Math.abs(last.qv - 1) < 0.06 && last.tv > 50, `Σ(ΔW)² → ${last.qv.toFixed(3)} while Σ|ΔW| = ${last.tv.toFixed(0)} keeps growing`);

    sec = await openTab(page, 'sde-ito');
    await ml(page, () => window.__ml.sde3.setM(14));
    let e = await ml(page, () => window.__ml.sde3.errors());
    ok(Math.abs(e.naive + 1) < 0.08 && Math.abs(e.ito) < 0.03, `W²: chain rule misses by ${e.naive.toFixed(3)} (≈ −t), Itô by ${e.ito.toFixed(3)}`);
    await ml(page, () => window.__ml.sde3.setPoint('mid'));
    e = await ml(page, () => window.__ml.sde3.errors());
    ok(Math.abs(e.naive) < 0.03, `midpoint (Stratonovich) sums make the plain chain rule work (error ${e.naive.toFixed(3)})`);
    await ml(page, () => { window.__ml.sde3.setPoint('left'); window.__ml.sde3.setF('exp'); });
    e = await ml(page, () => window.__ml.sde3.errors());
    ok(Math.abs(e.ito) < Math.abs(e.naive) / 5, `eᵂ: Itô error ${e.ito.toFixed(3)} vs chain rule ${e.naive.toFixed(3)}`);

    sec = await openTab(page, 'sde-gbm');
    const g = await ml(page, () => { const v = window.__ml.sde4.values().slice().sort((a, b) => a - b); return { med: v[Math.floor(v.length / 2)], below: v.filter((x) => x < 100).length / v.length }; });
    ok(Math.abs(g.med / 100 - 1) < 0.2 && Math.abs(g.below - 0.5) < 0.08, `μ = 8%, σ = 40%: median after 10 years ≈ $100 ($${g.med.toFixed(0)}), ${Math.round(g.below * 100)}% end below start`);
    await page.locator('#sde-gbm .lab').screenshot({ path: `shots/sde-gbm-${vp.name}.png` });

    sec = await openTab(page, 'sde-options');
    await sec.getByRole('button', { name: /simulate futures/i }).click();
    await page.waitForFunction(() => window.__ml.sde5.n >= 20000, null, { timeout: 60000 });
    await sec.getByRole('button', { name: /pause/i }).first().click();
    const o = await ml(page, () => ({ mc: window.__ml.sde5.mc(), bs: window.__ml.sde5.bs() }));
    ok(Math.abs(o.mc - o.bs) < 0.4, `Monte Carlo $${o.mc.toFixed(3)} agrees with Black–Scholes $${o.bs.toFixed(3)}`);
    await ml(page, () => window.__ml.sde5.setFreq(0));
    const sdQ = await ml(page, () => window.__ml.sde5.hedgeSd());
    await ml(page, () => window.__ml.sde5.setFreq(4));
    const sdD = await ml(page, () => window.__ml.sde5.hedgeSd());
    ok(sdD < sdQ / 4, `hedging more often shrinks the risk ($${sdQ.toFixed(2)} quarterly → $${sdD.toFixed(2)} at 4× a day)`);
    const m1 = await ml(page, () => (window.__ml.sde5.setMu(-0.15), window.__ml.sde5.hedgeMean()));
    const m2 = await ml(page, () => (window.__ml.sde5.setMu(0.35), window.__ml.sde5.hedgeMean()));
    ok(Math.abs(m1) < 0.3 && Math.abs(m2) < 0.3, `hedged result doesn't depend on the stock's real drift (${m1.toFixed(2)}, ${m2.toFixed(2)})`);

    sec = await openTab(page, 'sde-reality');
    const n = await ml(page, () => window.__ml.sde6.stats());
    await ml(page, () => window.__ml.sde6.setModel('garch'));
    const gs = await ml(page, () => window.__ml.sde6.stats());
    await ml(page, () => window.__ml.sde6.setModel('jumps'));
    const js = await ml(page, () => window.__ml.sde6.stats());
    ok(Math.abs(n.kurt - 3) < 0.4 && gs.kurt > 3.5 && js.kurt > 4, `kurtosis: normal ${n.kurt.toFixed(1)}, GARCH ${gs.kurt.toFixed(1)}, jumps ${js.kurt.toFixed(1)}`);
    ok(js.tails > n.tails && Math.abs(js.sd / n.sd - 1) < 0.15, `jumps: same volatility, ${js.tails} days beyond 4σ vs ${n.tails} for normal`);
  },
};
