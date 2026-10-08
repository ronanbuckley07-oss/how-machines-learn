import { createPlot, scale, drawGrid, dot, cssVar, withAlpha, HAND, MONO_SMALL } from '../../../lib/canvas.js';
import { h, button, slider, readout, note } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { brownian } from '../../../ml/sde.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';

const FINE = 1 << 14;   // the path is sampled 16,384 times on [0, 1]

export default {
  id: 'sde-variation',
  title: 'A path with infinite wiggle',
  tab: 'Wiggles',
  blurb: 'Self-similarity, and why (dW)² = dt',
  sims: false,
  mount(root) {
    let seed = 2, W = brownian(makeRng(seed), FINE, 1);
    let zoom = 0, m = 8;

    root.append(h('div', { class: 'prose', html: `
      <p>Brownian motion is continuous (no jumps) but extraordinarily rough. Zoom in on any piece and, after stretching the
      vertical axis by \\(\\sqrt{\\text{zoom}}\\), it looks statistically identical to the whole. It never smooths out into a line,
      so it has no slope anywhere: \\(W_t\\) is <strong>nowhere differentiable</strong>. Ordinary calculus can't be used on it.</p>` }));
    root.append(note('zoom in. it never gets smoother'));

    // ---------------- zoom lab ----------------
    const labZ = h('div', { class: 'lab' });
    root.append(labZ);
    const zPlot = createPlot(labZ, {
      aspect: 0.42, min: 220, max: 380,
      draw(ctx, w, hgt) {
        const width = 1 / 2 ** zoom, t0 = 0.5 - width / 2;
        const i0 = Math.floor(t0 * FINE), i1 = Math.ceil((t0 + width) * FINE);
        let lo = Infinity, hi = -Infinity;
        for (let i = i0; i <= i1; i++) { lo = Math.min(lo, W[i]); hi = Math.max(hi, W[i]); }
        const c = (lo + hi) / 2, half = 1.6 * Math.sqrt(width);       // vertical range shrinks like sqrt(width)
        const sx = scale(t0, t0 + width, 8, w - 8), sy = scale(c - half, c + half, hgt - 18, 8);
        drawGrid(ctx, sx, sy, { xTicks: [], yTicks: [], w, h: hgt });
        ctx.strokeStyle = cssVar('--data'); ctx.lineWidth = 1.6; ctx.beginPath();
        const stepI = Math.max(1, Math.floor((i1 - i0) / (w * 2)));
        for (let i = i0; i <= i1; i += stepI) { const x = sx(i / FINE), y = sy(W[i]); i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.font = HAND(19); ctx.fillStyle = cssVar('--ink-3');
        ctx.fillText(`showing t from ${t0.toFixed(4)} to ${(t0 + width).toFixed(4)} · vertical range ±${half.toFixed(3)}`, 12, hgt - 4);
      },
    });
    zPlot.canvas.setAttribute('role', 'img');
    zPlot.canvas.setAttribute('aria-label', 'A Brownian path, zoomed around the middle, with the vertical axis rescaled.');
    const zSl = slider({ label: 'Zoom', min: 0, max: 10, step: 1, value: 0, accent: 'var(--learn)', format: (v) => `${2 ** v}×`, onInput: (v) => { zoom = v; zPlot.draw(); } });
    labZ.append(h('div', { class: 'controls' }, zSl.el, button('New path', () => { seed++; W = brownian(makeRng(seed), FINE, 1); zPlot.draw(); qv(); }, { icon: '⤨' })));

    // ---------------- quadratic variation ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>So how rough is it, exactly? Chop \\([0, 1]\\) into \\(n\\) pieces and add up how far the path moves in each, two ways:
      the plain distances \\(\\sum |\\Delta W|\\), and the <em>squared</em> distances \\(\\sum (\\Delta W)^2\\). For any smooth curve,
      the first settles to a finite length and the second shrinks to zero. Brownian motion does something very different.</p>` }));
    root.append(note('slide n up and watch the two sums', { right: true }));
    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--even' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'sde-side' });
    grid.append(left, right);
    let series = [];
    const sumPlot = createPlot(left, {
      aspect: 0.75, min: 240, max: 400,
      draw(ctx, w, hgt) {
        // log scale on y, so "settles at 1" and "keeps growing" are both visible
        const top = Math.max(4, ...series.map((s) => s.tv)) * 1.4;
        const sx = scale(1, 14, 38, w - 14), ly = scale(Math.log10(0.4), Math.log10(top), hgt - 26, 10), sy = (v) => ly(Math.log10(Math.max(v, 1e-3)));
        drawGrid(ctx, sx, ly, { xTicks: [2, 4, 6, 8, 10, 12, 14], yTicks: [], w, h: hgt, labels: false });
        ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3');
        for (const v of [1, 10, 100]) if (v < top) { ctx.fillText(String(v), 6, sy(v) + 4); ctx.strokeStyle = 'rgba(34,32,28,0.12)'; ctx.beginPath(); ctx.moveTo(30, sy(v)); ctx.lineTo(w, sy(v)); ctx.stroke(); }
        ctx.textAlign = 'center';
        for (const k of [2, 6, 10]) ctx.fillText(`n=${(2 ** k).toLocaleString()}`, sx(k), hgt - 8);
        ctx.textAlign = 'right'; ctx.fillText('n=16,384', w - 6, hgt - 8);
        ctx.textAlign = 'left';
        const line = (key, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash(dash); ctx.beginPath(); series.forEach((s, i) => (i ? ctx.lineTo(sx(s.k), sy(s[key])) : ctx.moveTo(sx(s.k), sy(s[key])))); ctx.stroke(); ctx.setLineDash([]); };
        // theory: E sum|dW| = sqrt(2n/pi), and the sum of squares -> 1
        ctx.strokeStyle = cssVar('--model'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.8; ctx.beginPath();
        for (let k = 1; k <= 14; k += 0.1) { const y = Math.sqrt((2 * 2 ** k) / Math.PI); k === 1 ? ctx.moveTo(sx(k), sy(y)) : ctx.lineTo(sx(k), sy(y)); }
        ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx(1), sy(1)); ctx.lineTo(sx(14), sy(1)); ctx.stroke(); ctx.setLineDash([]);
        line('tv', cssVar('--error'), []);
        line('qv', cssVar('--data'), []);
        const cur = series.find((s) => s.k === m);
        if (cur) { dot(ctx, sx(m), sy(cur.tv), 6, cssVar('--error')); dot(ctx, sx(m), sy(cur.qv), 6, cssVar('--data')); }
        ctx.font = HAND(19);
        ctx.fillStyle = cssVar('--error'); ctx.fillText('Σ|ΔW| keeps growing', sx(5), sy(series[8]?.tv ?? 1) - 16);
        ctx.fillStyle = cssVar('--data'); ctx.fillText('Σ(ΔW)² → 1', sx(9.5), sy(1) + 22);
      },
    });
    sumPlot.canvas.setAttribute('role', 'img');
    sumPlot.canvas.setAttribute('aria-label', 'Total variation grows without bound while quadratic variation settles at 1 as the partition gets finer.');
    const mSl = slider({ label: 'Pieces n', min: 1, max: 14, step: 1, value: m, format: (v) => (2 ** v).toLocaleString(), onInput: (v) => { m = v; qv(); } });
    const tvOut = readout('Σ |ΔW|', 'error'), qvOut = readout('Σ (ΔW)²', 'data');
    const runPlot = createPlot(right, {
      aspect: 0.75, min: 200, max: 320,
      draw(ctx, w, hgt) {
        const sx = scale(0, 1, 30, w - 10), sy = scale(0, 1.3, hgt - 22, 10);
        drawGrid(ctx, sx, sy, { xTicks: [0, 0.5, 1], yTicks: [0.5, 1], w, h: hgt });
        ctx.strokeStyle = cssVar('--model'); ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(1), sy(1)); ctx.stroke(); ctx.setLineDash([]);
        const n = 2 ** m, step = FINE / n;
        ctx.strokeStyle = cssVar('--data'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx(0), sy(0));
        let acc = 0;
        for (let i = 1; i <= n; i++) { acc += (W[i * step] - W[(i - 1) * step]) ** 2; ctx.lineTo(sx(i / n), sy(acc)); }
        ctx.stroke();
        ctx.font = HAND(19); ctx.fillStyle = cssVar('--model'); ctx.fillText('the line y = t', sx(0.55), sy(0.42));
        ctx.fillStyle = cssVar('--ink-3'); ctx.fillText('running Σ(ΔW)² up to time t', 36, 24);
      },
    });
    runPlot.canvas.setAttribute('role', 'img');
    runPlot.canvas.setAttribute('aria-label', 'Running sum of squared increments against time, hugging the line y equals t.');
    right.append(h('div', { class: 'readouts' }, qvOut.el, tvOut.el));
    lab.append(h('div', { class: 'controls' }, mSl.el));
    function qv() {
      series = [];
      for (let k = 1; k <= 14; k++) {
        const n = 2 ** k, step = FINE / n;
        let q = 0, t = 0;
        for (let i = 1; i <= n; i++) { const d = W[i * step] - W[(i - 1) * step]; q += d * d; t += Math.abs(d); }
        series.push({ k, qv: q, tv: t });
      }
      const cur = series[m - 1];
      tvOut.set(cur.tv.toFixed(2)); qvOut.set(cur.qv.toFixed(3));
      sumPlot.draw(); runPlot.draw();
    }
    qv();

    root.append(h('div', { class: 'prose', html: `
      <p>The total distance travelled blows up (like \\(\\sqrt{n}\\), the dashed blue curve; note the log scale), so the path has <em>infinite length</em>
      on any interval. But the sum of squares settles down to exactly the elapsed time, and the running sum hugs the line \\(y = t\\).
      This is called the <span class="term term--data">quadratic variation</span>, and it's the single most important fact in
      stochastic calculus.</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">quadratic variation</div>
      \\[ \\sum_{i=1}^{n} \\big(W_{t_i} - W_{t_{i-1}}\\big)^2 \\,\\xrightarrow[n\\to\\infty]{}\\, t \\qquad\\text{written in shorthand as}\\qquad (dW_t)^2 = dt \\]
      <p class="caption">Why: each \\((\\Delta W)^2\\) has mean \\(\\Delta t\\) and variance \\(2\\Delta t^2\\). Add \\(n\\) of them:
      the mean is \\(n\\Delta t = t\\), but the variance is \\(2n\\Delta t^2 = 2t\\,\\Delta t \\to 0\\). The randomness averages out,
      leaving something perfectly predictable.</p>` }));
    root.append(h('div', { class: 'prose', html: `
      <p>For a smooth function, \\((dx)^2\\) is "second order small" and gets thrown away in ordinary calculus. For Brownian
      motion, \\((dW)^2\\) is the same size as \\(dt\\) and <strong>can't</strong> be thrown away. The next chapter shows what that does to the chain rule.</p>` }));
    (window.__ml ??= {}).sde2 = { series: () => series, setM: (k) => { m = k; mSl.set(k); qv(); } };
  },
};
