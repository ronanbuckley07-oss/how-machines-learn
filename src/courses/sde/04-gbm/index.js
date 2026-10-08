import { createPlot, scale, drawGrid, cssVar, withAlpha, HAND, MONO_SMALL, label } from '../../../lib/canvas.js';
import { createLoop } from '../../../lib/loop.js';
import { createTimeline } from '../../../lib/timeline.js';
import { h, button, slider, readout, note, segmented } from '../../../lib/ui.js';
import { normalCdf, mean, median } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';

const S0 = 100, PER_YEAR = 52, DRAWN = 70, SECONDS = 8;

export default {
  id: 'sde-gbm',
  title: 'A model for stock prices',
  tab: 'Stock paths',
  blurb: 'Geometric Brownian motion and the volatility drag',
  mount(root) {
    const cfg = { mu: 0.08, sigma: 0.4, T: 10, N: 600 };
    let seed = 1, paths = [], steps = 0, tCur = 0, logScale = true;

    root.append(h('div', { class: 'prose', html: `
      <p>A stock doesn't move by fixed amounts: a \\$10 stock and a \\$1,000 stock don't both wiggle by a dollar. Returns
      (percentage changes) are what look random. The standard model, used by Black, Scholes and Merton, says each instant's
      return is a steady drift \\(\\mu\\) plus a random kick scaled by the <span class="term term--error">volatility</span> \\(\\sigma\\):</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">geometric Brownian motion</div>
      \\[ \\frac{dS_t}{S_t} \\,=\\, \\mu\\,dt \\,+\\, \\sigma\\,dW_t \\]
      <p class="caption">\\(\\mu\\) is the expected return per year, \\(\\sigma\\) the volatility per year (about 0.15 to 0.2 for a broad
      index, 0.3 to 0.6 for a single tech stock).</p>` }));
    root.append(h('div', { class: 'prose', html: `
      <p>Apply Itô's lemma (last chapter) to \\(f(S) = \\log S\\), where \\(f' = 1/S\\) and \\(f'' = -1/S^2\\):</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ d\\log S_t = \\frac{1}{S_t}\\,dS_t - \\frac12\\,\\frac{1}{S_t^{2}}\\,\\sigma^{2} S_t^{2}\\,dt = \\Big(\\mu - \\tfrac12\\sigma^{2}\\Big)\\,dt + \\sigma\\, dW_t \\]
      \\[ \\Longrightarrow\\qquad S_T = S_0 \\exp\\!\\Big( \\big(\\mu - \\tfrac12 \\sigma^2\\big) T + \\sigma W_T \\Big) \\]
      <p class="caption">That \\(-\\tfrac12\\sigma^2\\) is Itô's correction, and it has a famous consequence. Simulate and see.</p>` }));
    root.append(note('press play. then crank the volatility up'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid sde-grid' });
    lab.append(grid);
    const left = h('div'), right = h('div');
    grid.append(left, right);
    const range = () => { const m = (cfg.mu - cfg.sigma ** 2 / 2) * cfg.T, s = cfg.sigma * Math.sqrt(cfg.T); return [S0 * Math.exp(m - 2.6 * s), S0 * Math.exp(m + 2.6 * s)]; };
    const yScale = (hgt) => {
      let [lo, hi] = range();
      if (logScale) { const ly = scale(Math.log(Math.max(lo, 0.5)), Math.log(hi), hgt - 22, 10); return (v) => ly(Math.log(Math.max(v, 0.01))); }
      return scale(0, hi, hgt - 22, 10);
    };
    const plot = createPlot(left, {
      aspect: 0.62, min: 260, max: 460,
      draw(ctx, w, hgt) {
        const sx = scale(0, cfg.T, 40, w - 10), sy = yScale(hgt);
        drawGrid(ctx, sx, (v) => v, { xTicks: [], yTicks: [], w, h: hgt });
        // price gridlines
        ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3'); ctx.strokeStyle = 'rgba(34,32,28,0.1)'; ctx.lineWidth = 1;
        const [lo, hi] = range();
        for (const p of [10, 25, 50, 100, 200, 400, 800, 1600, 3200]) if (p > lo * 0.8 && p < hi) { ctx.beginPath(); ctx.moveTo(36, sy(p)); ctx.lineTo(w, sy(p)); ctx.stroke(); ctx.fillText(`$${p}`, 2, sy(p) + 4); }
        ctx.textAlign = 'center';
        for (let y = 0; y <= cfg.T; y += cfg.T > 10 ? 5 : cfg.T > 4 ? 2 : 1) ctx.fillText(`${y}y`, sx(y), hgt - 6);
        ctx.textAlign = 'left';
        const upto = Math.floor(tCur * PER_YEAR);
        ctx.save(); ctx.beginPath(); ctx.rect(36, 0, w, hgt - 20); ctx.clip();
        for (let k = 0; k < Math.min(DRAWN, paths.length); k++) {
          const p = paths[k];
          ctx.strokeStyle = k < 2 ? cssVar('--data') : withAlpha('--data', 0.25); ctx.lineWidth = k < 2 ? 2 : 1;
          ctx.beginPath(); for (let i = 0; i <= upto; i++) { const x = sx(i / PER_YEAR), y = sy(p[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        }
        // theory: mean and median
        const th = (g, dash) => { ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 2.5; ctx.setLineDash(dash); ctx.beginPath(); for (let i = 0; i <= 100; i++) { const t = (i / 100) * cfg.T; i ? ctx.lineTo(sx(t), sy(S0 * Math.exp(g * t))) : ctx.moveTo(sx(0), sy(S0)); } ctx.stroke(); ctx.setLineDash([]); };
        th(cfg.mu, [7, 5]); th(cfg.mu - cfg.sigma ** 2 / 2, []);
        ctx.restore();
        ctx.font = HAND(19);
        label(ctx, 'average (theory)', sx(cfg.T) - 118, sy(S0 * Math.exp(cfg.mu * cfg.T)) - 10, cssVar('--model'));
        label(ctx, 'median (theory)', sx(cfg.T) - 110, sy(S0 * Math.exp((cfg.mu - cfg.sigma ** 2 / 2) * cfg.T)) + 22, cssVar('--model'));
        ctx.strokeStyle = cssVar('--learn'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(tCur), 4); ctx.lineTo(sx(tCur), hgt - 22); ctx.stroke();
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Simulated stock price paths, with the theoretical average and median growth curves.');
    const hist = createPlot(right, {
      aspect: 1.6, min: 260, max: 460,
      draw(ctx, w, hgt) {
        const sy = yScale(hgt), vals = values(), [lo, hi] = range();
        const nb = 36, edges = Array.from({ length: nb + 1 }, (_, i) => (logScale ? Math.exp(Math.log(Math.max(lo, 0.5)) + (i / nb) * (Math.log(hi) - Math.log(Math.max(lo, 0.5)))) : (i / nb) * hi));
        const counts = new Array(nb).fill(0);
        for (const v of vals) { let i = edges.findIndex((e) => e > v) - 1; if (i >= 0 && i < nb) counts[i]++; }
        const max = Math.max(...counts, 1);
        counts.forEach((c, i) => { ctx.fillStyle = withAlpha('--data', 0.55); const y0 = sy(edges[i]), y1 = sy(edges[i + 1]); ctx.fillRect(6, y1, (c / max) * (w - 20), y0 - y1 - 1); });
        // theory density in the same bins (lognormal), scaled to the same peak area
        if (tCur > 0) {
          const m = Math.log(S0) + (cfg.mu - cfg.sigma ** 2 / 2) * tCur, s = cfg.sigma * Math.sqrt(tCur);
          const prob = edges.slice(0, -1).map((e, i) => normalCdf((Math.log(edges[i + 1]) - m) / s) - normalCdf((Math.log(Math.max(e, 1e-9)) - m) / s));
          const scaleP = vals.length / max;
          ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 2.5; ctx.beginPath();
          prob.forEach((p, i) => { const x = 6 + p * scaleP * (w - 20), y = (sy(edges[i]) + sy(edges[i + 1])) / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.stroke();
        }
        ctx.setLineDash([4, 4]); ctx.strokeStyle = cssVar('--ink'); ctx.beginPath(); ctx.moveTo(0, sy(S0)); ctx.lineTo(w, sy(S0)); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = HAND(18); label(ctx, 'start $100', w - 80, sy(S0) - 6, cssVar('--ink-2'));
        label(ctx, `prices after ${tCur.toFixed(1)} years`, 8, hgt - 6, cssVar('--ink-3'));
      },
    });
    hist.canvas.setAttribute('role', 'img');
    hist.canvas.setAttribute('aria-label', 'Histogram of simulated prices at the current time, with the lognormal distribution predicted by theory.');

    const sl = {};
    const mk = (k, label_, min, max, step, fmt, accent) => (sl[k] = slider({ label: label_, min, max, step, value: cfg[k], format: fmt, accent, onInput: (v) => { cfg[k] = v; regen(); } })).el;
    const playBtn = button('Play', () => toggle(), { primary: true, icon: '▶' });
    const newBtn = button('New simulation', () => { seed++; regen(); }, { icon: '⤨' });
    const scaleSeg = segmented([[true, 'log price axis'], [false, 'plain axis']], true, (v) => { logScale = v; draw(); }, 'Price axis');
    const meanOut = readout('average price', 'data'), medOut = readout('median price', 'data'), belowOut = readout('ended below $100', 'error');
    const theoryLine = h('p', { class: 'sde-say', 'aria-live': 'polite' });
    lab.append(
      h('div', { class: 'controls' }, playBtn, newBtn, scaleSeg.el),
      h('div', { class: 'controls sde-sliders' },
        mk('mu', 'Drift μ', -0.1, 0.3, 0.01, (v) => `${Math.round(v * 100)}%/yr`, 'var(--model)'),
        mk('sigma', 'Volatility σ', 0.05, 0.9, 0.01, (v) => `${Math.round(v * 100)}%/yr`, 'var(--error)'),
        mk('T', 'Years', 1, 20, 1, (v) => String(v)),
        mk('N', 'Simulated stocks', 50, 2000, 50, (v) => String(v))),
      h('div', { class: 'readouts', style: 'margin-top:10px' }, meanOut.el, medOut.el, belowOut.el), theoryLine);

    const tl = createTimeline(lab, {
      title: 'time machine: average vs median price over the years',
      unit: 'week',
      series: [{ key: 'mean', label: 'average', color: '--data' }, { key: 'median', label: 'median', color: '--error' }],
      maxPoints: 400,
      onScrubStart: () => loop.pause(),
      onView: (st) => { tCur = st.t; draw(); },
    });
    const loop = createLoop(lab, (dt) => {
      tCur = Math.min(cfg.T, tCur + (dt * cfg.T) / SECONDS);
      const v = values();
      tl.record(Math.floor(tCur * PER_YEAR), { mean: mean(v), median: median(v) }, { t: tCur });
      draw();
      if (tCur >= cfg.T) return false;
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Play', p ? '❚❚' : '▶'));
    function toggle() {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) tCur = past.state.t;
      else if (tCur >= cfg.T) { tCur = 0; tl.reset(); tl.record(0, { mean: S0, median: S0 }, { t: 0 }, true); }
      loop.play();
    }
    function values() { const i = Math.min(steps, Math.floor(tCur * PER_YEAR)); return paths.map((p) => p[i]); }
    function regen() {
      loop.pause();
      const rng = makeRng(seed * 31 + 7);
      steps = cfg.T * PER_YEAR;
      const dt = 1 / PER_YEAR, a = (cfg.mu - cfg.sigma ** 2 / 2) * dt, b = cfg.sigma * Math.sqrt(dt);
      paths = Array.from({ length: cfg.N }, () => { const p = new Float32Array(steps + 1); p[0] = S0; for (let i = 1; i <= steps; i++) p[i] = p[i - 1] * Math.exp(a + b * rng.normal()); return p; });
      tCur = cfg.T;
      tl.reset();
      for (let i = 0; i <= steps; i += Math.max(1, Math.floor(steps / 120))) { const v = paths.map((p) => p[i]); tl.record(i, { mean: mean(v), median: median(v) }, { t: i / PER_YEAR }, true); }
      draw();
    }
    function draw() {
      const v = values(), t = tCur;
      const thMean = S0 * Math.exp(cfg.mu * t), thMed = S0 * Math.exp((cfg.mu - cfg.sigma ** 2 / 2) * t);
      const thBelow = t > 0 ? normalCdf(-((cfg.mu - cfg.sigma ** 2 / 2) * Math.sqrt(t)) / cfg.sigma) : 0;
      meanOut.set(`$${mean(v).toFixed(0)}`); medOut.set(`$${median(v).toFixed(0)}`);
      belowOut.set(`${Math.round((v.filter((x) => x < S0).length / v.length) * 100)}%`);
      theoryLine.innerHTML = `Theory after ${t.toFixed(1)} years: average <strong>$${thMean.toFixed(0)}</strong> (grows at μ = ${Math.round(cfg.mu * 100)}%/yr),
        median <strong>$${thMed.toFixed(0)}</strong> (grows at μ − σ²/2 = ${(Math.abs((cfg.mu - cfg.sigma ** 2 / 2) * 100) < 0.05 ? 0 : (cfg.mu - cfg.sigma ** 2 / 2) * 100).toFixed(1)}%/yr),
        <strong>${Math.round(thBelow * 100)}%</strong> chance of ending below where it started.` +
        (Math.abs(mean(v) / thMean - 1) > 0.08 ? ' The simulated average wanders more than the median: it hinges on a few huge winners, so it needs far more samples to pin down.' : '');
      plot.draw(); hist.draw();
    }
    regen();

    root.append(h('div', { class: 'prose', html: `
      <p>With the defaults (8% drift, 40% volatility) the <em>average</em> stock grows 8% a year, yet the <em>median</em> stock
      grows at \\(\\mu - \\tfrac12\\sigma^2 = 8\\% - 8\\% = 0\\%\\): the typical stock goes nowhere, and about half end below where
      they started. The average is propped up by a handful of enormous winners. This gap is called
      <span class="term term--error">volatility drag</span>, and it's the \\(-\\tfrac12\\sigma^2\\) from Itô's lemma made visible.</p>
      <p>It's also why diversifying helps so much: a portfolio of many stocks has lower volatility than any single one, so less of
      its expected return gets eaten by the drag.</p>` }));
    root.append(h('details', { class: 'deeper', html: `
      <summary>go deeper: the lognormal distribution</summary>
      <p>Because \\(\\log S_T\\) is a constant plus \\(\\sigma W_T\\), it's normally distributed with mean
      \\(\\log S_0 + (\\mu - \\tfrac12\\sigma^2)T\\) and variance \\(\\sigma^2 T\\). So \\(S_T\\) is <strong>lognormal</strong>: skewed, with a long right tail,
      and never negative (a stock can't fall below zero). On the log price axis the histogram is a symmetric bell; switch to the
      plain axis to see the skew. Its mean is \\(S_0 e^{\\mu T}\\) and its median is \\(S_0 e^{(\\mu - \\sigma^2/2)T}\\).</p>` }));
    (window.__ml ??= {}).sde4 = { cfg, values, get t() { return tCur; }, regen, get playing() { return loop.playing; }, set: (k, v) => { cfg[k] = v; sl[k].set(v); regen(); } };
  },
};
