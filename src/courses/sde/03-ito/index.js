import { createPlot, scale, drawGrid, cssVar, HAND, MONO_SMALL, label } from '../../../lib/canvas.js';
import { h, button, slider, segmented, readout, note } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { brownian } from '../../../ml/sde.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';

const FINE = 1 << 14;
const FUNCS = {
  sq: { label: 'W²', tex: 'W^2', f: (w) => w * w, f1: (w) => 2 * w, f2: () => 2, f1t: '2W', f2t: '2' },
  cube: { label: 'W³', tex: 'W^3', f: (w) => w ** 3, f1: (w) => 3 * w * w, f2: (w) => 6 * w, f1t: '3W^2', f2t: '6W' },
  exp: { label: 'eᵂ', tex: 'e^{W}', f: Math.exp, f1: Math.exp, f2: Math.exp, f1t: 'e^{W}', f2t: 'e^{W}' },
  sin: { label: 'sin W', tex: '\\sin W', f: Math.sin, f1: Math.cos, f2: (w) => -Math.sin(w), f1t: '\\cos W', f2t: '-\\sin W' },
};

export default {
  id: 'sde-ito',
  title: "Itô's lemma: the chain rule, corrected",
  tab: 'Itô',
  blurb: 'Why the ordinary chain rule fails, checked numerically',
  sims: false,
  mount(root) {
    let seed = 5, W = brownian(makeRng(seed), FINE, 1), fk = 'sq', m = 10, point = 'left';

    root.append(h('div', { class: 'prose', html: `
      <p>In ordinary calculus, the chain rule says how a function of a changing quantity changes: \\(d f(x) = f'(x)\\,dx\\).
      It comes from a Taylor expansion where we drop \\((dx)^2\\) because it's negligibly small.</p>
      <p>Now let the quantity be Brownian motion. Expand \\(f(W)\\) the same way:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ \\Delta f \\,=\\, f'(W)\\,\\Delta W \\,+\\, \\tfrac12 f''(W)\\,(\\Delta W)^2 \\,+\\, \\dots \\]
      <p class="caption">Last chapter showed \\((\\Delta W)^2\\) adds up to \\(\\Delta t\\), not to zero. So the second term survives:</p>
      <div class="mathbox__label">Itô's lemma</div>
      \\[ d f(W_t) \\,=\\, f'(W_t)\\, dW_t \\,+\\, \\tfrac12\\, f''(W_t)\\, dt \\]` }));
    root.append(h('div', { class: 'prose', html: `
      <p>Don't take that on trust. Below, one Brownian path is fed through a function \\(f\\), and \\(f(W_t)\\) is rebuilt from
      the path's little steps in two ways: with the ordinary chain rule, and with Itô's extra term. Pick a function and compare.</p>` }));
    root.append(note('the orange curve is the truth. which rebuild follows it?'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid sde-grid' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'sde-side' });
    grid.append(left, right);
    let curves = null;
    const plot = createPlot(left, {
      aspect: 0.6, min: 260, max: 440,
      draw(ctx, w, hgt) {
        if (!curves) return;
        const all = [...curves.truth, ...curves.naive, ...curves.ito];
        let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08 || 1;
        const sx = scale(0, 1, 36, w - 10), sy = scale(lo - pad, hi + pad, hgt - 22, 10);
        drawGrid(ctx, sx, sy, { xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: [], w, h: hgt });
        const n = curves.truth.length - 1;
        const line = (arr, col, width, dash) => { ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath(); arr.forEach((v, i) => (i ? ctx.lineTo(sx(i / n), sy(v)) : ctx.moveTo(sx(0), sy(v)))); ctx.stroke(); ctx.setLineDash([]); };
        line(curves.truth, cssVar('--data'), 4.5, []);
        line(curves.naive, cssVar('--error'), 2, []);
        line(curves.ito, cssVar('--model'), 2.2, [6, 4]);
        ctx.font = HAND(19);
        const lab_ = (txt, col, arr) => label(ctx, txt, sx(1) - ctx.measureText(txt).width - 4, sy(arr[n]) + (arr === curves.naive ? 22 : -12), col);
        lab_('ordinary chain rule', cssVar('--error'), curves.naive);
        lab_(`true f(W)`, cssVar('--data'), curves.truth);
        ctx.fillStyle = cssVar('--ink-3'); ctx.fillText('time t →', 40, hgt - 26);
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'The true value of f of W over time, the ordinary chain rule reconstruction, and the Itô reconstruction.');
    const fSeg = segmented(Object.entries(FUNCS).map(([k, f]) => [k, f.label]), fk, (k) => { fk = k; compute(); }, 'Function f');
    const pSeg = segmented([['left', 'f′ at start of each step (Itô)'], ['mid', 'f′ at midpoint (Stratonovich)']], point, (v) => { point = v; compute(); }, 'Where to evaluate the slope');
    const mSl = slider({ label: 'Steps', min: 4, max: 14, step: 1, value: m, format: (v) => (2 ** v).toLocaleString(), onInput: (v) => { m = v; compute(); } });
    const formula = h('div', { class: 'formula' });
    const truthOut = readout('true f(W₁)', 'data'), naiveOut = readout('chain-rule error', 'error'), itoOut = readout('Itô error', 'model');
    const say = h('p', { class: 'sde-say', 'aria-live': 'polite' });
    right.append(formula, h('div', { class: 'readouts' }, truthOut.el, naiveOut.el, itoOut.el), say);
    lab.append(h('div', { class: 'controls' }, fSeg.el, button('New path', () => { seed++; W = brownian(makeRng(seed), FINE, 1); compute(); }, { icon: '⤨' })),
      h('div', { class: 'controls' }, pSeg.el), h('div', { class: 'controls' }, mSl.el),
      h('p', { class: 'caption' }, 'Orange: the true f(W_t). Red: f(0) + Σ f′(W)·ΔW, the ordinary chain rule. Dashed blue: the same plus Itô\'s term ½ Σ f″(W)·Δt.'));

    function compute() {
      const F = FUNCS[fk], n = 2 ** m, step = FINE / n, dt = 1 / n;
      const truth = [F.f(0)], naive = [F.f(0)], ito = [F.f(0)];
      for (let i = 1; i <= n; i++) {
        const a = W[(i - 1) * step], b = W[i * step], dW = b - a;
        const x = point === 'left' ? a : (a + b) / 2;
        naive.push(naive[i - 1] + F.f1(x) * dW);
        ito.push(ito[i - 1] + F.f1(x) * dW + 0.5 * F.f2(x) * dt);
        truth.push(F.f(b));
      }
      curves = { truth, naive, ito };
      const T = truth[n], eN = naive[n] - T, eI = ito[n] - T;
      truthOut.set(T.toFixed(3)); naiveOut.set(eN.toFixed(3)); itoOut.set(eI.toFixed(3));
      setTex(formula, `d\\big(${F.tex}\\big) = ${F.f1t}\\,dW + \\tfrac12\\cdot ${F.f2t}\\,dt`, true);
      say.textContent = point === 'left'
        ? (fk === 'sq' ? 'For W², the ordinary chain rule misses by almost exactly t (it ends about 1 below). Itô\'s term ½·2·dt = dt adds that back.' : 'The ordinary chain rule drifts away; adding ½ f″ dt puts it right on top of the truth. More steps make the match tighter.')
        : 'Evaluate the slope at the midpoint of each step and the ordinary chain rule works again, while Itô\'s extra term now overshoots. Which point you use matters, and that is unique to rough paths.';
      plot.draw();
    }
    compute();

    root.append(h('div', { class: 'prose', html: `
      <p>Why does the evaluation point matter? For a smooth curve the left end, midpoint or right end of a tiny step all give the
      same limit. For Brownian motion they don't, because the path moves by about \\(\\sqrt{\\Delta t}\\) within each step, which
      is huge compared to \\(\\Delta t\\). Finance uses the left point (Itô's convention) for a good reason: you must choose how
      many shares to hold <em>before</em> the price moves, not halfway through.</p>
      <p>The version you'll use most applies to any process with a drift and a random part, \\(dX = a\\,dt + b\\,dW\\):</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">Itô's lemma, general form</div>
      \\[ d f(t, X_t) = \\Big( \\frac{\\partial f}{\\partial t} + a\\,\\frac{\\partial f}{\\partial x} + \\tfrac12\\, b^{2}\\, \\frac{\\partial^{2} f}{\\partial x^{2}} \\Big)\\,dt \\,+\\, b\\,\\frac{\\partial f}{\\partial x}\\,dW_t \\]
      <p class="caption">Same idea: expand to second order and replace \\((dX)^2\\) by \\(b^2\\,dt\\), using
      \\((dW)^2 = dt\\), \\(dt\\,dW = 0\\) and \\((dt)^2 = 0\\). Next chapter we point this at a stock price.</p>` }));
    (window.__ml ??= {}).sde3 = { errors: () => { const n = curves.truth.length - 1; return { naive: curves.naive[n] - curves.truth[n], ito: curves.ito[n] - curves.truth[n] }; }, setF: (k) => fSeg.set(k, true), setPoint: (v) => pSeg.set(v, true), setM: (k) => { m = k; mSl.set(k); compute(); } };
  },
};
