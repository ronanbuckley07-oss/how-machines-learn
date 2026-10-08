import { createPlot, scale, drawGrid, cssVar, withAlpha, HAND, MONO_SMALL, label } from '../../../lib/canvas.js';
import { h, button, segmented, readout, note } from '../../../lib/ui.js';
import { normalPdf, normalCdf, mean, std } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';
import '../../../chapters/07-closing/chapter.css';

const DAYS = 2520;                 // ten years of trading days
const SD = 0.2 / Math.sqrt(252);   // every model is tuned to the same 20% yearly volatility

const MODELS = {
  gbm: { label: 'Black–Scholes (normal)', make: (rng) => Array.from({ length: DAYS }, () => SD * rng.normal()) },
  jumps: {
    label: 'Normal + sudden jumps',
    make: (rng) => {
      const lam = 5 / 252, mJ = -0.03, sJ = 0.04, sDiff = Math.sqrt(SD * SD - lam * (mJ * mJ + sJ * sJ));
      return Array.from({ length: DAYS }, () => sDiff * rng.normal() + (rng() < lam ? mJ + sJ * rng.normal() : 0));
    },
  },
  garch: {
    label: 'Volatility clustering (GARCH)',
    make: (rng) => {
      const a = 0.08, b = 0.9, w = SD * SD * (1 - a - b);
      let v = SD * SD, prev = 0;
      return Array.from({ length: DAYS }, () => { v = w + a * prev * prev + b * v; prev = Math.sqrt(v) * rng.normal(); return prev; });
    },
  },
};

const GLOSS = [
  ['data', 'random walk', 'Steps of ±Δx; with Δx = √Δt it becomes Brownian motion.', 'sde-walk'],
  ['model', 'Brownian motion', 'Continuous, nowhere smooth, with W(t+s) − W(t) normal with variance s.', 'sde-walk'],
  ['data', 'quadratic variation', 'Σ(ΔW)² → t. The shorthand is (dW)² = dt.', 'sde-variation'],
  ['learn', "Itô's lemma", 'The chain rule plus ½ f″ dt, because (dW)² doesn\'t vanish.', 'sde-ito'],
  ['error', 'volatility drag', 'The typical (median) growth is μ − σ²/2, below the average μ.', 'sde-gbm'],
  ['model', 'Black–Scholes', 'Option price = discounted average payoff with the stock drifting at r.', 'sde-options'],
  ['learn', 'delta hedging', 'Hold ∂C/∂S shares to cancel the dW risk of an option.', 'sde-options'],
  ['error', 'fat tails', 'Real returns have far more extreme days than the normal model predicts.', 'sde-reality'],
];
const READ = [
  ['MIT OpenCourseWare 18.S096', 'https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/', 'Free lectures: Topics in Mathematics with Applications in Finance, including stochastic calculus and Black–Scholes.', 'course'],
  ["Itô's lemma on Wikipedia", 'https://en.wikipedia.org/wiki/It%C3%B4%27s_lemma', 'Statements, derivations and lots of worked examples, including geometric Brownian motion.', 'reference'],
  ['Black–Scholes model on Wikipedia', 'https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model', 'The PDE, the formula, the Greeks and the model\'s known limitations.', 'reference'],
  ['Shreve, Stochastic Calculus for Finance I & II', null, 'The standard textbook pair: discrete models first, then continuous time. Rigorous but friendly.', 'book'],
  ['Hull, Options, Futures, and Other Derivatives', null, 'The practitioner\'s classic, with far less proof and far more markets.', 'book'],
];

export default {
  id: 'sde-reality',
  title: 'What real markets do differently',
  tab: 'Real markets',
  blurb: 'Fat tails, jumps, volatility clustering, and where to go next',
  sims: false,
  mount(root) {
    let model = 'gbm', seed = 3, R = [];

    root.append(h('div', { class: 'prose', html: `
      <p>Everything so far assumed the Black–Scholes world: returns are normal, volatility is constant, and prices never jump.
      Real markets break all three. Here are ten years of simulated daily returns from three models, all tuned to the
      <strong>same</strong> 20% yearly volatility. Switch between them and look at the tails.</p>` }));
    root.append(note('compare the three models, especially the far left of the histogram'));
    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const series = createPlot(lab, {
      aspect: 0.3, min: 170, max: 260,
      draw(ctx, w, hgt) {
        if (!R.length) return;
        const sx = scale(0, DAYS, 30, w - 6), sy = scale(-0.12, 0.12, hgt - 18, 6);
        drawGrid(ctx, sx, sy, { xTicks: [], yTicks: [-0.1, -0.05, 0, 0.05, 0.1], w, h: hgt, labels: false });
        ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3');
        for (const v of [-0.1, -0.05, 0.05, 0.1]) ctx.fillText(`${v > 0 ? '+' : ''}${v * 100}%`, 0, sy(v) + 4);
        ctx.strokeStyle = withAlpha('--data', 0.9); ctx.lineWidth = Math.max(0.6, (w - 36) / DAYS);
        ctx.beginPath(); R.forEach((r, i) => { ctx.moveTo(sx(i), sy(0)); ctx.lineTo(sx(i), sy(Math.max(-0.12, Math.min(0.12, r)))); }); ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 1.2;
        for (const k of [-4, 4]) { ctx.beginPath(); ctx.moveTo(30, sy(k * SD)); ctx.lineTo(w, sy(k * SD)); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.font = HAND(18); label(ctx, '10 years of daily returns · dashed: ±4 standard deviations', 36, 22, cssVar('--ink-2'));
        ctx.textAlign = 'center'; ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3');
        for (let y = 0; y <= 10; y += 2) ctx.fillText(`${y}y`, sx(y * 252), hgt - 4);
        ctx.textAlign = 'left';
      },
    });
    series.canvas.setAttribute('role', 'img');
    series.canvas.setAttribute('aria-label', 'Ten years of simulated daily returns as thin bars.');
    const hist = createPlot(lab, {
      aspect: 0.42, min: 200, max: 320,
      draw(ctx, w, hgt) {
        if (!R.length) return;
        const z = R.map((r) => r / SD);
        const lo = -8, hi = 8, nb = 64, bw = (hi - lo) / nb;
        const counts = new Array(nb).fill(0);
        for (const v of z) { const i = Math.floor((Math.max(lo, Math.min(hi - 1e-9, v)) - lo) / bw); counts[i]++; }
        // log-scale density: tails become visible
        const ly = (d) => Math.log10(Math.max(d, 1e-6));
        const sx = scale(lo, hi, 36, w - 8), sy = scale(-5.2, 0, hgt - 22, 8);
        drawGrid(ctx, sx, sy, { xTicks: [-8, -6, -4, -2, 0, 2, 4, 6, 8], yTicks: [], w, h: hgt, labels: false });
        ctx.font = MONO_SMALL; ctx.fillStyle = cssVar('--ink-3'); ctx.textAlign = 'center';
        for (const t of [-8, -4, 0, 4, 8]) ctx.fillText(`${t}σ`, sx(t), hgt - 6);
        ctx.textAlign = 'left';
        for (const p of [0, -2, -4]) ctx.fillText(p === 0 ? '1' : `10${p === -2 ? '⁻²' : '⁻⁴'}`, 2, sy(p) + 4);
        counts.forEach((c, i) => {
          if (!c) return;
          const d = c / (z.length * bw);
          const x0 = sx(lo + i * bw), x1 = sx(lo + (i + 1) * bw);
          ctx.fillStyle = Math.abs(lo + (i + 0.5) * bw) > 4 ? cssVar('--error') : withAlpha('--data', 0.6);
          ctx.fillRect(x0, sy(ly(d)), x1 - x0 - 1, sy(-5.2) - sy(ly(d)));
        });
        ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 2.5; ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 200; i++) { const x = lo + ((hi - lo) * i) / 200; const y = ly(normalPdf(x)); if (y < -5.2) { started = false; continue; } started ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)); started = true; }
        ctx.stroke();
        ctx.font = HAND(18); label(ctx, 'how often each size of day happens (log scale) · blue: the normal curve', 40, 22, cssVar('--ink-2'));
      },
    });
    hist.canvas.setAttribute('role', 'img');
    hist.canvas.setAttribute('aria-label', 'Histogram of daily returns in standard deviations on a log scale, against the normal curve.');
    const seg = segmented(Object.entries(MODELS).map(([k, m]) => [k, m.label]), model, (k) => { model = k; regen(); }, 'Return model');
    const kurtOut = readout('kurtosis (normal = 3)', 'error'), tailOut = readout('days beyond ±4σ', 'error'), expOut = readout('normal model expects', 'model'), worstOut = readout('worst day', 'data');
    const say = h('p', { class: 'sde-say', 'aria-live': 'polite' });
    lab.append(h('div', { class: 'controls' }, seg.el, button('Another ten years', () => { seed++; regen(); }, { icon: '⤨' })),
      h('div', { class: 'readouts', style: 'margin-top:10px' }, kurtOut.el, tailOut.el, expOut.el, worstOut.el), say);
    function regen() {
      R = MODELS[model].make(makeRng(seed * 101 + model.length));
      const m = mean(R), s = std(R);
      const kurt = R.reduce((a, r) => a + ((r - m) / s) ** 4, 0) / R.length;
      const tails = R.filter((r) => Math.abs(r) > 4 * SD).length;
      const expected = DAYS * 2 * (1 - normalCdf(4));
      const worst = Math.min(...R);
      kurtOut.set(kurt.toFixed(1)); tailOut.set(String(tails)); expOut.set(expected.toFixed(2)); worstOut.set(`${(worst * 100).toFixed(1)}%`);
      const zWorst = -worst / SD;
      const everyYears = 1 / (normalCdf(-zWorst) * 252);
      say.textContent = model === 'gbm'
        ? 'Normal returns: extreme days are vanishingly rare, and the bars follow the blue curve all the way out.'
        : `The worst day was ${zWorst.toFixed(1)} standard deviations. A normal model says a day that bad happens about once every ${everyYears > 1e6 ? 'never (more than a million years)' : `${Math.round(everyYears).toLocaleString()} years`}. ` +
          (model === 'garch' ? 'Notice the calm stretches and the stormy stretches in the series above: volatility comes in clusters.' : 'Notice the sudden spikes: most days are calm, then the price gaps.');
      series.draw(); hist.draw();
    }
    regen();

    root.append(h('div', { class: 'prose', html: `
      <p>Real stock returns look much more like the last two models than the first. Extreme days are rare but nowhere near as rare
      as the bell curve says (the famous example is 19 October 1987, when the Dow Jones fell about 22% in a single day), and
      turbulent periods cluster together. Statisticians call this <span class="term term--error">fat tails</span>, measured by a
      kurtosis above 3.</p>
      <p>Practitioners don't throw Black–Scholes away. They use it as a common language and patch it: the volatility you'd need to
      plug in to match real option prices changes with the strike (the "volatility smile"), and models with jumps or random,
      clustering volatility (like the GARCH model above, or the Heston model) price options more realistically. The stochastic
      calculus you've learned is exactly the toolkit those models are built with.</p>` }));

    root.append(h('h3', { class: 'ch7-h' }, 'What you learned in this notebook'));
    root.append(h('div', { class: 'glossary' }, GLOSS.map(([role, term, def, id]) =>
      h('a', { class: `gloss gloss--${role}`, href: `#sde/${id}` }, h('span', { class: 'gloss__term' }, term), h('span', { class: 'gloss__def' }, def)))));
    root.append(h('h3', { class: 'ch7-h' }, 'Where to learn more'));
    root.append(h('div', { class: 'links' }, READ.map(([t, url, d, tag]) => h(url ? 'a' : 'div', url ? { class: 'link-card', href: url, target: '_blank', rel: 'noopener' } : { class: 'link-card' },
      h('span', { class: 'link-card__tag' }, tag), h('span', { class: 'link-card__title' }, t), h('span', { class: 'link-card__desc' }, d)))));
    root.append(h('div', { class: 'callout callout--honest', html: '<strong>Not financial advice.</strong> Every price on these pages is simulated for teaching. Real markets have fees, taxes, liquidity limits and risks no model captures, and nothing here is a recommendation to buy or sell anything.' }));
    (window.__ml ??= {}).sde6 = { setModel: (k) => seg.set(k, true), stats: () => { const m = mean(R), s = std(R); return { kurt: R.reduce((a, r) => a + ((r - m) / s) ** 4, 0) / R.length, tails: R.filter((r) => Math.abs(r) > 4 * SD).length, sd: s }; } };
  },
};
