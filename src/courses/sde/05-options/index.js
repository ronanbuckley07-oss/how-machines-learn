import { createPlot, scale, drawGrid, cssVar, withAlpha, HAND, MONO_SMALL, label } from '../../../lib/canvas.js';
import { createLoop, stepper } from '../../../lib/loop.js';
import { createTimeline } from '../../../lib/timeline.js';
import { h, button, slider, readout, note } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { bsCall } from '../../../ml/sde.js';
import { normalCdf, mean, std, histogram } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';

const S0 = 100;
const PATHS_PER_SEC = 400;      // × the sim speed
const MAX_PATHS = 40000;
const FREQS = [[4, 'quarterly'], [12, 'monthly'], [52, 'weekly'], [252, 'daily'], [1008, '4× a day']];

export default {
  id: 'sde-options',
  title: 'Pricing an option: Black–Scholes',
  tab: 'Options',
  blurb: 'Monte Carlo pricing, the formula, and hedging away the risk',
  mount(root) {
    const cfg = { K: 105, sigma: 0.25, T: 1, r: 0.04 };
    root.append(h('div', { class: 'prose', html: `
      <p>A <strong>call option</strong> is the right, but not the obligation, to buy a stock at a fixed <em>strike</em> price \\(K\\)
      on a future date \\(T\\). If the stock ends above \\(K\\) you buy cheap and pocket the difference; if not, you walk away. So it pays</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ \\text{payoff} = \\max(S_T - K,\\ 0) \\]
      <p class="caption">What's that worth <em>today</em>? A natural guess: the average payoff over all possible futures, discounted
      back to today. The surprise of Black–Scholes is <em>which</em> average: one where the stock drifts at the risk-free interest
      rate \\(r\\), whatever its real expected return \\(\\mu\\) is. The hedging lab below shows why.</p>` }));
    root.append(note('press play to simulate thousands of possible futures'));

    // ---------------- Monte Carlo vs formula ----------------
    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--even' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'sde-side' });
    grid.append(left, right);
    let rng = makeRng(1), n = 0, sum = 0, sum2 = 0, finals = [];
    const payPlot = createPlot(left, {
      aspect: 0.7, min: 240, max: 380,
      draw(ctx, w, hgt) {
        const sx = scale(30, 230, 34, w - 10), py = scale(0, 125, hgt - 24, 10);
        drawGrid(ctx, sx, py, { xTicks: [50, 100, 150, 200], yTicks: [25, 50, 75, 100], w, h: hgt });
        // histogram of simulated final prices (scaled to fit)
        if (finals.length) {
          const H = histogram(finals, 30, 230, 50), mx = Math.max(...H.counts);
          H.counts.forEach((c, i) => { ctx.fillStyle = withAlpha('--data', 0.35); const x0 = sx(30 + i * H.width), x1 = sx(30 + (i + 1) * H.width); const hh = (c / mx) * (hgt - 60); ctx.fillRect(x0, hgt - 24 - hh, x1 - x0 - 1, hh); });
        }
        ctx.strokeStyle = cssVar('--ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(30), py(0)); ctx.lineTo(sx(cfg.K), py(0)); ctx.lineTo(sx(230), py(230 - cfg.K)); ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(cfg.K), 10); ctx.lineTo(sx(cfg.K), hgt - 24); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = HAND(19);
        label(ctx, 'payoff max(S−K, 0)', sx(150), py(100) , cssVar('--ink'));
        label(ctx, `strike K = ${cfg.K}`, sx(cfg.K) + 6, 26, cssVar('--ink-2'));
        label(ctx, 'where the stock ends (simulated)', 40, hgt - 30, cssVar('--data'));
      },
    });
    payPlot.canvas.setAttribute('role', 'img');
    payPlot.canvas.setAttribute('aria-label', 'The call option payoff as a function of the final stock price, over a histogram of simulated final prices.');

    const mcOut = readout('Monte Carlo price', 'data'), bsOut = readout('Black–Scholes formula', 'model'), ciOut = readout('± 95% range', 'learn'), nOut = readout('futures simulated', 'data');
    const bsTex = h('div', { class: 'formula' });
    right.append(h('div', { class: 'readouts' }, mcOut.el, ciOut.el), h('div', { class: 'readouts' }, bsOut.el, nOut.el), bsTex);
    const sl = {};
    const mk = (k, label_, min, max, step, fmt, accent) => (sl[k] = slider({ label: label_, min, max, step, value: cfg[k], format: fmt, accent, onInput: (v) => { cfg[k] = v; restart(); } })).el;
    const playBtn = button('Simulate futures', () => toggle(), { primary: true, icon: '▶' });
    lab.append(h('div', { class: 'controls' }, playBtn, button('Start over', () => restart(), { icon: '↺' })),
      h('div', { class: 'controls sde-sliders' },
        mk('K', 'Strike K', 60, 160, 1, (v) => `$${v}`),
        mk('sigma', 'Volatility σ', 0.05, 0.8, 0.01, (v) => `${Math.round(v * 100)}%`, 'var(--error)'),
        mk('T', 'Years to expiry', 0.1, 3, 0.1, (v) => v.toFixed(1)),
        mk('r', 'Interest rate r', 0, 0.1, 0.005, (v) => `${(v * 100).toFixed(1)}%`)));
    const tl = createTimeline(lab, {
      title: 'time machine: the estimate settling as more futures are simulated',
      unit: 'path',
      series: [{ key: 'mc', label: 'estimate', color: '--data' }, { key: 'bs', label: 'formula', color: '--model', dash: true }],
      onScrubStart: () => loop.pause(),
      onView: () => {},
    });
    const take = stepper(PATHS_PER_SEC);
    const loop = createLoop(lab, (dt) => {
      const k = Math.min(take(dt), MAX_PATHS - n);
      const disc = Math.exp(-cfg.r * cfg.T), a = (cfg.r - cfg.sigma ** 2 / 2) * cfg.T, b = cfg.sigma * Math.sqrt(cfg.T);
      for (let i = 0; i < k; i++) {
        const ST = S0 * Math.exp(a + b * rng.normal());       // risk-neutral drift r
        const x = disc * Math.max(ST - cfg.K, 0);
        sum += x; sum2 += x * x; n++;
        if (finals.length < 6000) finals.push(ST);
      }
      if (k) tl.record(n, { mc: sum / n, bs: bsCall(S0, cfg.K, cfg.T, cfg.r, cfg.sigma).price }, { n });
      paint();
      if (n >= MAX_PATHS) return false;
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Simulate futures', p ? '❚❚' : '▶'));
    function toggle() { if (loop.playing) loop.pause(); else { if (n >= MAX_PATHS) restart(); loop.play(); } }
    function restart() { loop.pause(); rng = makeRng(1 + Math.floor(Math.random() * 1e6)); n = 0; sum = 0; sum2 = 0; finals = []; tl.reset(); paint(); }
    function paint() {
      const bs = bsCall(S0, cfg.K, cfg.T, cfg.r, cfg.sigma);
      bsOut.set(`$${bs.price.toFixed(3)}`);
      if (n > 1) {
        const m = sum / n, se = Math.sqrt(Math.max(0, sum2 / n - m * m) / n);
        mcOut.set(`$${m.toFixed(3)}`); ciOut.set(`±$${(1.96 * se).toFixed(3)}`);
      } else { mcOut.set('–'); ciOut.set('–'); }
      nOut.set(n.toLocaleString());
      setTex(bsTex, `\\begin{aligned} C &= S_0\\,N(d_1) - K e^{-rT} N(d_2) \\\\ &= 100 \\times ${normalCdf(bs.d1).toFixed(3)} - ${cfg.K} e^{-${cfg.r.toFixed(3)}\\times ${cfg.T.toFixed(1)}} \\times ${normalCdf(bs.d2).toFixed(3)} = ${bs.price.toFixed(3)} \\\\ d_{1,2} &= \\frac{\\ln(S_0/K) + (r \\pm \\tfrac12\\sigma^2)T}{\\sigma\\sqrt T} = ${bs.d1.toFixed(3)},\\ ${bs.d2.toFixed(3)} \\end{aligned}`, true);
      payPlot.draw();
    }
    paint();
    root.append(h('div', { class: 'prose', html: `
      <p>The simulated average closes in on the formula, and the 95% range shrinks like \\(1/\\sqrt{n}\\) (four times the futures
      for twice the precision). \\(N(\\cdot)\\) is the bell-curve cumulative probability. The formula is simply that same average,
      worked out exactly with calculus instead of dice.</p>` }));

    // ---------------- delta hedging ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>Now the deep part. Why the risk-free rate, and not the stock's real expected return? Because a bank that <em>sells</em> the
      option can cancel its risk. Each moment it holds \\(\\Delta = \\partial C/\\partial S = N(d_1)\\) shares of the stock, so that if the
      stock ticks up, the gain on the shares offsets the loss on the option. Itô's lemma applied to \\(C(t, S_t)\\) shows the random
      \\(dW\\) parts cancel exactly; what's left is riskless, so it must earn the risk-free rate, and that pins down the price.</p>
      <p>Test it. Below, the bank sells the option for the Black–Scholes price, then hedges as the stock moves, rebalancing at a
      chosen frequency. Each dot is one possible future; it shows how much money the bank is left with at the end.</p>` }));
    root.append(note('rebalance more often and watch the spread collapse', { right: true }));
    const labH = h('div', { class: 'lab' });
    root.append(labH);
    let fIdx = 2, muReal = 0.12, results = [];
    const hPlot = createPlot(labH, {
      aspect: 0.32, min: 180, max: 280,
      draw(ctx, w, hgt) {
        const sx = scale(-12, 12, 10, w - 10);
        drawGrid(ctx, sx, (v) => v, { xTicks: [-10, -5, 0, 5, 10], yTicks: [], w, h: hgt, labels: false });
        ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3'); ctx.textAlign = 'center';
        for (const t of [-10, -5, 0, 5, 10]) ctx.fillText(`${t >= 0 ? '+' : '−'}$${Math.abs(t)}`, sx(t), hgt - 6);
        ctx.textAlign = 'left';
        if (!results.length) return;
        const H = histogram(results, -12, 12, 96), mx = Math.max(...H.counts);
        H.counts.forEach((c, i) => { ctx.fillStyle = withAlpha('--error', 0.6); const x0 = sx(-12 + i * H.width), x1 = sx(-12 + (i + 1) * H.width); const hh = (c / mx) * (hgt - 40); ctx.fillRect(x0, hgt - 20 - hh, x1 - x0 - 0.5, hh); });
        ctx.strokeStyle = cssVar('--ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(0), 6); ctx.lineTo(sx(0), hgt - 20); ctx.stroke();
        ctx.font = HAND(19); label(ctx, 'bank\'s profit or loss at expiry', 12, 22, cssVar('--ink-2'));
      },
    });
    hPlot.canvas.setAttribute('role', 'img');
    hPlot.canvas.setAttribute('aria-label', 'Histogram of the hedger\'s final profit or loss across many simulated futures.');
    const fSl = slider({ label: 'Rebalance', min: 0, max: FREQS.length - 1, step: 1, value: fIdx, format: (v) => FREQS[v][1], accent: 'var(--learn)', onInput: (v) => { fIdx = v; hedge(); } });
    const muSl = slider({ label: 'Stock\'s real drift μ', min: -0.2, max: 0.4, step: 0.01, value: muReal, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { muReal = v; hedge(); } });
    const pnlMean = readout('average result', 'model'), pnlSd = readout('spread (std dev)', 'error'), unhedged = readout('spread if not hedged', 'error');
    labH.append(h('div', { class: 'controls' }, fSl.el, muSl.el), h('div', { class: 'readouts' }, pnlMean.el, pnlSd.el, unhedged.el),
      h('p', { class: 'caption' }, '600 simulated futures with the same strike, volatility and rate as above. The bank charges the Black–Scholes price, keeps cash in the bank at rate r, and holds Δ shares, adjusted at each rebalance.'));
    function hedge() {
      const steps = Math.max(1, Math.round(FREQS[fIdx][0] * cfg.T)), dt = cfg.T / steps;
      const rngH = makeRng(77);
      const out = [], naked = [];
      for (let p = 0; p < 600; p++) {
        let S = S0;
        const c0 = bsCall(S, cfg.K, cfg.T, cfg.r, cfg.sigma);
        let delta = c0.delta, cash = c0.price - delta * S;
        for (let i = 1; i <= steps; i++) {
          S *= Math.exp((muReal - cfg.sigma ** 2 / 2) * dt + cfg.sigma * Math.sqrt(dt) * rngH.normal());   // the REAL-world stock
          cash *= Math.exp(cfg.r * dt);
          const tLeft = cfg.T - i * dt;
          const nd = i === steps ? 0 : bsCall(S, cfg.K, tLeft, cfg.r, cfg.sigma).delta;
          if (i < steps) { cash -= (nd - delta) * S; delta = nd; }
        }
        const payoff = Math.max(S - cfg.K, 0);
        out.push(cash + delta * S - payoff);
        naked.push(c0.price * Math.exp(cfg.r * cfg.T) - payoff);
      }
      results = out;
      pnlMean.set(`${mean(out) >= 0 ? '+' : '−'}$${Math.abs(mean(out)).toFixed(2)}`); pnlSd.set(`$${std(out).toFixed(2)}`); unhedged.set(`$${std(naked).toFixed(2)}`);
      hPlot.draw();
    }
    hedge();
    // keep the hedging lab in sync with the option settings above
    for (const k of Object.keys(sl)) sl[k].input.addEventListener('input', hedge);

    root.append(h('div', { class: 'prose', html: `
      <p>Two things to see. First, the spread of outcomes shrinks as hedging gets more frequent, roughly like
      \\(1/\\sqrt{\\text{rebalances}}\\): with continuous hedging it would be zero, and the option is a perfectly replicable bundle of
      stock and cash. Second, move the stock's real drift \\(\\mu\\): the average result barely changes. The price didn't need to
      know \\(\\mu\\) at all. That is the Black–Scholes insight, and the reason it won a Nobel prize.</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">the Black–Scholes equation (what the formula solves)</div>
      \\[ \\frac{\\partial C}{\\partial t} + r S \\frac{\\partial C}{\\partial S} + \\tfrac12 \\sigma^2 S^2 \\frac{\\partial^2 C}{\\partial S^2} = r C \\]
      <p class="caption">From Itô's lemma on \\(C(t, S_t)\\), plus "a perfectly hedged portfolio earns the risk-free rate".
      The \\(\\tfrac12\\sigma^2 S^2 C_{SS}\\) term is Itô's correction again, now putting a price on volatility.</p>` }));
    (window.__ml ??= {}).sde5 = { get n() { return n; }, mc: () => sum / n, bs: () => bsCall(S0, cfg.K, cfg.T, cfg.r, cfg.sigma).price, get playing() { return loop.playing; }, hedgeSd: () => std(results), hedgeMean: () => mean(results), setFreq: (i) => { fIdx = i; fSl.set(i); hedge(); }, setMu: (v) => { muReal = v; muSl.set(v); hedge(); } };
  },
};
