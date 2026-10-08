import { createPlot, scale, drawGrid, dot, cssVar, HAND, MONO_SMALL } from '../../../lib/canvas.js';
import { createTimeline } from '../../../lib/timeline.js';
import { h, button, slider, segmented, readout, note } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { softmax } from '../../../lib/stats.js';
import './chapter.css';

const WORDS = ['mat', 'floor', 'sofa', 'moon', 'banana'];
const START = [2.0, 1.4, 0.9, -0.5, -2.0];

export default {
  id: 'llm-softmax',
  title: 'From scores to probabilities',
  tab: 'Softmax',
  blurb: 'Softmax, temperature, cross-entropy and its gradient',
  sims: false,
  mount(root) {
    const z = [...START];
    let T = 1, target = 0, step = 0;

    root.append(h('div', { class: 'prose', html: `
      <p>At the very end of its calculation, a language model produces one number for <em>every</em> token in its vocabulary.
      These raw scores are called <span class="term term--model">logits</span>. Bigger means "more likely to come next", but they
      aren't probabilities yet: they can be negative and they don't add up to 1.</p>
      <p>The function that fixes this is called <span class="term term--model">softmax</span>. It does two things: make every score
      positive by raising \\(e\\) to its power, then divide by the total so everything sums to 1.</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">softmax, with a temperature \\(T\\)</div>
      \\[ p_i \\quad=\\quad \\frac{e^{z_i / T}}{\\sum_{j} e^{z_j / T}} \\]` }));
    root.append(note('the context is "the cat sat on the ___". drag the scores'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'sm-side' });
    grid.append(left, right);

    // rows: word | logit slider | probability bar
    const rows = WORDS.map((w, i) => {
      const sl = slider({ label: w, min: -5, max: 8, step: 0.1, value: z[i], format: (v) => v.toFixed(1), accent: 'var(--model)', onInput: (v) => { z[i] = v; update(); } });
      const fill = h('span', { class: 'sm-bar__fill' });
      const pct = h('span', { class: 'sm-bar__pct' });
      const grad = h('span', { class: 'sm-grad', title: 'gradient of the loss for this logit' });
      const row = h('div', { class: 'sm-row' }, sl.el, h('span', { class: 'sm-bar' }, fill), pct, grad);
      left.append(row);
      return { sl, fill, pct, grad, row };
    });
    const tSl = slider({ label: 'Temperature T', min: 0.2, max: 3, step: 0.05, value: 1, accent: 'var(--learn)', onInput: (v) => { T = v; update(); } });
    left.append(h('div', { class: 'controls' }, tSl.el));
    const arith = h('div', { class: 'formula sm-arith' });
    left.append(h('p', { class: 'caption' }, 'The arithmetic, live:'), arith);

    // right: the loss
    const targetSeg = segmented(WORDS.map((w, i) => [i, w]), 0, (i) => { target = i; tl.reset(); step = 0; record(true); update(); }, 'Which word really came next');
    right.append(h('p', { class: 'sm-label' }, 'In the training text, the next word really was:'), targetSeg.el);
    const lossOut = readout('Loss  −log p', 'error'), pOut = readout('p(correct word)', 'model');
    right.append(h('div', { class: 'readouts', style: 'margin-top:10px' }, pOut.el, lossOut.el));
    const curve = createPlot(right, {
      aspect: 0.7, min: 190, max: 280,
      draw(ctx, w, hgt) {
        const sx = scale(0, 1, 34, w - 12), sy = scale(0, 5, hgt - 26, 10);
        drawGrid(ctx, sx, sy, { xTicks: [0.25, 0.5, 0.75, 1], yTicks: [1, 2, 3, 4], w, h: hgt });
        ctx.strokeStyle = cssVar('--error'); ctx.lineWidth = 2.5; ctx.beginPath();
        for (let k = 1; k <= 200; k++) { const p = k / 200; const y = Math.min(5, -Math.log(p)); k === 1 ? ctx.moveTo(sx(p), sy(y)) : ctx.lineTo(sx(p), sy(y)); }
        ctx.stroke();
        const p = softmax(z, T)[target];
        dot(ctx, sx(p), sy(Math.min(5, -Math.log(p))), 7, cssVar('--error'));
        ctx.font = HAND(19); ctx.fillStyle = cssVar('--ink-3');
        ctx.fillText('probability given to the right word →', 40, hgt - 30 > 40 ? hgt - 32 : 40);
        ctx.fillText('↑ loss', 38, 24);
      },
    });
    curve.canvas.setAttribute('role', 'img');
    curve.canvas.setAttribute('aria-label', 'The curve minus log p, with a dot at the current probability of the correct word.');
    const gradTex = h('div', { class: 'formula' });
    const stepBtn = button('Take one learning step', () => { learnStep(); }, { primary: true, icon: '↓' });
    const resetBtn = button('Reset scores', () => { START.forEach((v, i) => (z[i] = v)); tl.reset(); step = 0; record(true); update(); }, { icon: '↺' });
    right.append(gradTex, h('div', { class: 'controls' }, stepBtn, resetBtn));

    const tl = createTimeline(lab, {
      title: 'time machine: loss after each learning step',
      onView: (st) => { st.z.forEach((v, i) => (z[i] = v)); update(); },
    });
    const record = (force) => tl.record(step, { loss: -Math.log(softmax(z, T)[target]) }, { z: [...z] }, force);

    function learnStep() {
      const past = tl.rewindHere();
      if (past) { past.state.z.forEach((v, i) => (z[i] = v)); step = past.step; }
      const p = softmax(z, T);
      // dL/dz_i = (p_i - y_i) / T ; learning rate 1
      for (let i = 0; i < z.length; i++) z[i] = Math.max(-5, Math.min(8, z[i] - (p[i] - (i === target ? 1 : 0)) / T));
      step++;
      record();
      update();
    }

    function update() {
      const p = softmax(z, T);
      const e = z.map((v) => Math.exp(v / T));
      const S = e.reduce((a, b) => a + b, 0);
      rows.forEach((r, i) => {
        r.sl.set(z[i]);
        r.fill.style.width = `${p[i] * 100}%`;
        r.pct.textContent = `${(p[i] * 100).toFixed(p[i] < 0.1 ? 1 : 0)}%`;
        const g = (p[i] - (i === target ? 1 : 0)) / T;
        r.grad.textContent = Math.abs(g) < 0.005 ? '·' : g > 0 ? '↓' : '↑';
        r.grad.style.opacity = String(Math.min(1, 0.25 + Math.abs(g)));
        r.row.classList.toggle('is-target', i === target);
      });
      const f = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
      setTex(arith, `\\begin{array}{lrrr} & z_i/T & e^{z_i/T} & p_i \\\\ \\hline ${WORDS.map((w, i) => `\\text{${w}} & ${(z[i] / T).toFixed(2)} & ${f(e[i])} & ${p[i].toFixed(3)}`).join(' \\\\ ')} \\\\ \\hline \\text{total} & & ${f(S)} & 1.000 \\end{array}`, true);
      const pt = p[target];
      pOut.set(pt.toFixed(3)); lossOut.set((-Math.log(pt)).toFixed(3));
      setTex(gradTex, `\\frac{\\partial L}{\\partial z_i} = \\frac{p_i - y_i}{T} \\quad\\Rightarrow\\quad \\frac{\\partial L}{\\partial z_{\\text{${WORDS[target]}}}} = ${((pt - 1) / T).toFixed(3)}`, true);
      curve.draw();
    }
    record(true);
    update();

    root.append(h('div', { class: 'prose', html: `
      <p>Things to notice:</p>
      <ul>
        <li><strong>Only differences matter.</strong> Add the same amount to every score and the probabilities don't move, because
        \\(e^{z+c} = e^c e^{z}\\) and the \\(e^c\\) cancels top and bottom.</li>
        <li><strong>Temperature</strong> divides every score before the exponential. Low \\(T\\) exaggerates the gaps (the top word takes
        almost everything); high \\(T\\) flattens them. This is the same "temperature" setting chatbots expose.</li>
        <li><strong>The loss</strong> for one prediction is \\(L = -\\log p_{\\text{correct}}\\), called <span class="term term--error">cross-entropy</span>.
        Giving the right word probability 1 costs nothing; giving it 0.01 costs \\(-\\log 0.01 \\approx 4.6\\).</li>
      </ul>
      <p>The purple arrows next to each score show which way gradient descent will push it. The gradient has a famously tidy form:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ L = -\\log p_t, \\qquad \\frac{\\partial L}{\\partial z_i} = \\frac{1}{T}\\big(p_i - y_i\\big), \\qquad y_i = \\begin{cases}1 & i = t \\\\ 0 & \\text{otherwise}\\end{cases} \\]
      <p class="caption">Push the correct word's score up by how much probability it's missing, and push every other word down by
      how much probability it wrongly grabbed. Every training step of every LLM starts with exactly this formula.</p>` }));
    root.append(h('details', { class: 'deeper', html: `
      <summary>go deeper: deriving the gradient</summary>
      <p>Take \\(T=1\\). Write \\(L = -\\log p_t = -z_t + \\log \\sum_j e^{z_j}\\). Differentiate with respect to \\(z_i\\):
      the first term gives \\(-1\\) if \\(i=t\\) and 0 otherwise, which is \\(-y_i\\). The second gives
      \\(e^{z_i} / \\sum_j e^{z_j} = p_i\\). Add them: \\(\\partial L/\\partial z_i = p_i - y_i\\).</p>
      <p>Over a whole training set the model minimises the <em>average</em> of these losses. Its exponential,
      \\(e^{\\bar L}\\), is called <strong>perplexity</strong>: roughly how many tokens the model is torn between at each step.
      The fable model in the first notebook was torn between about 115 words; strong LLMs get single digits on ordinary text.</p>` }));
    (window.__ml ??= {}).llm2 = { z, get target() { return target; }, learnStep, loss: () => -Math.log(softmax(z, T)[target]), probs: () => softmax(z, T), setT: (v) => { T = v; tSl.set(v); update(); } };
  },
};
