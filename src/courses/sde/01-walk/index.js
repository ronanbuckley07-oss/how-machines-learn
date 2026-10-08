import { createPlot, scale, drawGrid, cssVar, withAlpha, HAND, MONO_SMALL } from '../../../lib/canvas.js';
import { createLoop } from '../../../lib/loop.js';
import { createTimeline } from '../../../lib/timeline.js';
import { h, button, slider, segmented, readout, note } from '../../../lib/ui.js';
import { normalPdf, std, mean, histogram } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import '../sde.css';

const NS = [4, 8, 16, 32, 64, 128, 256, 512, 1024];
const SECONDS_PER_RUN = 7;    // at 1× sim speed

export default {
  id: 'sde-walk',
  title: 'From coin flips to Brownian motion',
  tab: 'Random walk',
  blurb: 'Why randomness spreads out like the square root of time',
  mount(root) {
    let nIdx = 6, paths = 120, mode = 'sqrt', seed = 1, tCur = 1;
    let P = [];

    root.append(h('div', { class: 'prose', html: `
      <p>Stock prices jiggle. To do maths with jiggling we need a model of pure, structureless randomness moving through time.
      The simplest one: flip a coin every tick, step up if heads and down if tails. That's a <span class="term term--data">random walk</span>.</p>
      <p>Now shrink the ticks. Split one unit of time into \\(n\\) steps of length \\(\\Delta t = 1/n\\). How big should each step
      \\(\\Delta x\\) be? There turns out to be exactly one sensible answer. Try all three:</p>` }));
    root.append(note('switch the step size, then raise the number of steps'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid sde-grid' });
    lab.append(grid);
    const left = h('div'), right = h('div');
    grid.append(left, right);
    const Y = 3.2;
    const plot = createPlot(left, {
      aspect: 0.62, min: 260, max: 460,
      draw(ctx, w, hgt) {
        const sx = scale(0, 1, 30, w - 8), sy = scale(-Y, Y, hgt - 22, 10);
        drawGrid(ctx, sx, sy, { xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: [-3, -2, -1, 0, 1, 2, 3], w, h: hgt });
        const n = NS[nIdx], upto = Math.floor(tCur * n);
        // theory envelopes: ±sqrt(t) and ±2 sqrt(t)
        ctx.setLineDash([5, 4]); ctx.lineWidth = 1.8; ctx.strokeStyle = cssVar('--model');
        for (const k of [1, -1, 2, -2]) { ctx.beginPath(); for (let i = 0; i <= 100; i++) { const t = i / 100; i ? ctx.lineTo(sx(t), sy(k * Math.sqrt(t))) : ctx.moveTo(sx(t), sy(0)); } ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hgt - 20); ctx.clip();
        P.forEach((p, k) => {
          ctx.strokeStyle = k < 3 ? cssVar('--data') : withAlpha('--data', 0.22); ctx.lineWidth = k < 3 ? 2 : 1;
          ctx.beginPath();
          for (let i = 0; i <= upto; i++) { const x = sx(i / n), y = sy(p[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        });
        ctx.restore();
        ctx.strokeStyle = cssVar('--learn'); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(tCur), 6); ctx.lineTo(sx(tCur), hgt - 22); ctx.stroke();
        ctx.font = HAND(19); ctx.fillStyle = cssVar('--ink-3');
        ctx.fillText('time t →', w - 70, hgt - 26);
        ctx.fillStyle = cssVar('--model'); ctx.fillText('±√t and ±2√t', 36, 26);
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Many random walk paths over time, with dashed curves at plus and minus the square root of time.');
    const hist = createPlot(right, {
      aspect: 1.6, min: 260, max: 460,
      draw(ctx, w, hgt) {
        const sy = scale(-Y, Y, hgt - 22, 10);
        const vals = values();
        // bins line up with the grid of reachable positions (multiples of 2·Δx), so there are no empty gaps
        const n = NS[nIdx], dx = mode === 'one' ? 1 : mode === 'lin' ? 1 / n : 1 / Math.sqrt(n);
        const bw = 2 * dx * Math.max(1, Math.ceil(0.2 / (2 * dx)));
        const nb = Math.max(4, Math.min(64, Math.round((2 * Y) / bw)));
        const H = histogram(vals.map((v) => v + bw / 2), -Y, -Y + nb * bw, nb);
        const maxDen = 1 / Math.sqrt(2 * Math.PI * Math.max(tCur, 0.05));
        const sx = scale(0, maxDen * 1.15, 6, w - 6);
        const bh = sy(-Y) - sy(-Y + H.width);
        H.counts.forEach((c, i) => {
          const den = c / (vals.length * H.width);
          ctx.fillStyle = withAlpha('--data', 0.55); ctx.strokeStyle = cssVar('--ink'); ctx.lineWidth = 1;
          const y = sy(-Y + (i + 1) * H.width);
          ctx.fillRect(sx(0), y, sx(Math.min(den, maxDen * 1.15)) - sx(0), bh - 1);
        });
        if (mode === 'sqrt' && tCur > 0.01) {
          ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 2.5; ctx.beginPath();
          for (let i = 0; i <= 120; i++) { const x = -Y + (2 * Y * i) / 120; const d = normalPdf(x, 0, Math.sqrt(tCur)); i ? ctx.lineTo(sx(d), sy(x)) : ctx.moveTo(sx(d), sy(x)); }
          ctx.stroke();
          ctx.font = HAND(18); ctx.fillStyle = cssVar('--model'); ctx.fillText('bell curve, variance t', 8, 24);
        }
        ctx.font = HAND(18); ctx.fillStyle = cssVar('--ink-3'); ctx.fillText(`where paths are at t = ${tCur.toFixed(2)}`, 8, hgt - 6);
      },
    });
    hist.canvas.setAttribute('role', 'img');
    hist.canvas.setAttribute('aria-label', 'Sideways histogram of where the paths are at the current time, with the predicted bell curve.');

    const modeSeg = segmented([['one', 'Δx = 1'], ['lin', 'Δx = 1/n'], ['sqrt', 'Δx = 1/√n']], mode, (v) => { mode = v; regen(); }, 'Step size rule');
    const nSl = slider({ label: 'Steps n', min: 0, max: NS.length - 1, step: 1, value: nIdx, format: (v) => String(NS[v]), onInput: (v) => { nIdx = v; regen(); } });
    const pSl = slider({ label: 'Paths', min: 1, max: 300, step: 1, value: paths, format: (v) => String(v), onInput: (v) => { paths = v; regen(); } });
    const playBtn = button('Play time', () => toggle(), { primary: true, icon: '▶' });
    const newBtn = button('New coin flips', () => { seed++; regen(); }, { icon: '⤨' });
    const sdOut = readout('spread of paths now', 'data'), thOut = readout('theory √t', 'model'), varOut = readout('n · Δx²', 'learn');
    const say = h('p', { class: 'sde-say', 'aria-live': 'polite' });
    lab.append(h('div', { class: 'controls' }, modeSeg.el, playBtn, newBtn), h('div', { class: 'controls' }, nSl.el, pSl.el),
      h('div', { class: 'readouts', style: 'margin-top:10px' }, sdOut.el, thOut.el, varOut.el), say);

    const tl = createTimeline(lab, {
      title: 'time machine: spread of the paths as time passes',
      unit: 'tick',
      series: [{ key: 'sd', label: 'spread', color: '--data' }, { key: 'th', label: '√t', color: '--model', dash: true }],
      onScrubStart: () => loop.pause(),
      onView: (st) => { tCur = st.t; draw(); },
    });
    const loop = createLoop(lab, (dt) => {
      tCur = Math.min(1, tCur + dt / SECONDS_PER_RUN);
      const n = NS[nIdx];
      tl.record(Math.floor(tCur * n), { sd: std(values()), th: Math.sqrt(tCur) }, { t: tCur });
      draw();
      if (tCur >= 1) return false;
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Play time', p ? '❚❚' : '▶'));
    function toggle() {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) tCur = past.state.t;
      else if (tCur >= 1) { tCur = 0; tl.reset(); tl.record(0, { sd: 0, th: 0 }, { t: 0 }, true); }
      loop.play();
    }

    function values() { const n = NS[nIdx], i = Math.floor(tCur * n); return P.map((p) => p[i]); }
    function regen() {
      loop.pause();
      const n = NS[nIdx], dx = mode === 'one' ? 1 : mode === 'lin' ? 1 / n : 1 / Math.sqrt(n);
      const rng = makeRng(seed * 7919 + nIdx);
      P = Array.from({ length: paths }, () => { const p = new Float32Array(n + 1); for (let i = 1; i <= n; i++) p[i] = p[i - 1] + (rng() < 0.5 ? dx : -dx); return p; });
      tCur = 1;
      // rebuild the time machine for the finished run
      tl.reset();
      for (let i = 0; i <= n; i += Math.max(1, n / 64)) { const t = i / n, ii = Math.floor(i); tl.record(ii, { sd: paths > 1 ? std(P.map((p) => p[ii])) : 0, th: Math.sqrt(t) }, { t }, true); }
      draw();
    }
    function draw() {
      const n = NS[nIdx], dx = mode === 'one' ? 1 : mode === 'lin' ? 1 / n : 1 / Math.sqrt(n);
      sdOut.set(paths > 1 ? std(values()).toFixed(3) : '–');
      thOut.set(Math.sqrt(tCur).toFixed(3));
      varOut.set((n * dx * dx).toFixed(3));
      say.textContent = mode === 'one' ? `Steps of size 1: after ${n} steps the spread is about √${n} ≈ ${Math.sqrt(n).toFixed(0)}, so more steps = paths fly off to infinity. No limit.`
        : mode === 'lin' ? `Steps of size 1/n: the total spread is about 1/√n = ${(1 / Math.sqrt(n)).toFixed(3)}, so more steps = paths squash flat to zero. Randomness vanishes.`
        : 'Steps of size 1/√n: the spread at time t is √t no matter how many steps you use. This is the one rule with a sensible limit: Brownian motion.';
      plot.draw(); hist.draw();
    }
    regen();

    root.append(h('div', { class: 'prose', html: `
      <p>Here's why. Each step is \\(\\pm \\Delta x\\) with equal odds, so it has mean 0 and variance \\(\\Delta x^2\\). Independent
      variances add, so after \\(n\\) steps the position has variance \\(n\\,\\Delta x^2\\). For that to settle down to something
      finite and non-zero as \\(n\\) grows, we need \\(\\Delta x^2\\) to shrink like \\(1/n\\), which means \\(\\Delta x = \\sqrt{\\Delta t}\\).</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">the square-root rule</div>
      \\[ \\operatorname{Var}\\big(X_t\\big) = \\underbrace{\\tfrac{t}{\\Delta t}}_{\\text{steps}} \\cdot \\Delta x^{2} = t \\quad\\Longleftrightarrow\\quad \\Delta x = \\sqrt{\\Delta t} \\]
      <p class="caption">And by the central limit theorem, a sum of many small independent steps is normally distributed, whatever the
      individual steps look like. That's the blue bell curve.</p>` }));
    root.append(h('div', { class: 'prose', html: `
      <p>The limit is called <span class="term term--data">Brownian motion</span> (or a Wiener process), written \\(W_t\\). It's
      defined by three properties you've just watched: it starts at \\(W_0 = 0\\); its increments over non-overlapping time
      intervals are independent; and \\(W_{t+s} - W_t\\) is normal with mean 0 and variance \\(s\\). That last fact, randomness
      growing like \\(\\sqrt{t}\\) rather than \\(t\\), is the seed of everything strange in the rest of this notebook.</p>` }));
    (window.__ml ??= {}).sde1 = { setMode: (m) => modeSeg.set(m, true), setN: (i) => { nIdx = i; nSl.set(i); regen(); }, spread: () => std(values()), get t() { return tCur; }, get playing() { return loop.playing; }, timeline: tl };
  },
};
