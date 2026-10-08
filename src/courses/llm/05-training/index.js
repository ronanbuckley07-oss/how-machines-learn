import { createPlot, scale, drawGrid, cssVar, HAND } from '../../../lib/canvas.js';
import { createLoop, stepper } from '../../../lib/loop.js';
import { createTimeline } from '../../../lib/timeline.js';
import { h, button, slider, readout, note, segmented } from '../../../lib/ui.js';
import { CharModel, charCounts, CHARS } from '../../../ml/charmodel.js';
import { FABLES } from '../../../ml/fables.js';
import { makeRng } from '../../../lib/rng.js';
import './chapter.css';

const STEPS_PER_SEC = 30;    // × the sim speed
const MAX_STEPS = 1500;
const VOWELS = new Set('aeiou');

export default {
  id: 'llm-training',
  title: 'Training: getting less surprised',
  tab: 'Training',
  blurb: 'Watch a tiny model learn letter vectors from scratch',
  mount(root) {
    const counts = charCounts(FABLES);
    let seed = 3, model = new CharModel(counts, { d: 2, seed }), step = 0, lr = 0.12, showVowels = true, lastCheck = { step: 0, loss: Infinity }, done = false;
    const best = model.bestLoss(), uniform = Math.log(CHARS.length);

    root.append(h('div', { class: 'prose', html: `
      <p>So where do all those weights come from? They start random and get tuned by the same loop as everything in the first
      notebook: measure the error, compute the gradient, take a small step downhill.</p>
      <p>For a language model the error is the average cross-entropy from chapter 2, taken over every position in the training text.
      The model sees the text so far and is scored on how much probability it gave to what really came next:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">the training objective</div>
      \\[ \\mathcal L(\\theta) \\,=\\, -\\frac{1}{N}\\sum_{t=1}^{N} \\log p_\\theta\\big(x_{t+1} \\,\\big|\\, x_1, \\dots, x_t\\big) \\]
      <p class="caption">\\(\\theta\\) is every weight in the model. No labels are needed: the text itself says what came next,
      which is why LLMs can learn from the raw internet.</p>` }));
    root.append(h('div', { class: 'prose', html: `
      <p>Below, a deliberately tiny model learns to predict the next <em>letter</em> of the fables. Each of the 28 characters gets
      a learned vector with just <strong>two</strong> numbers, so we can plot them. The prediction is
      \\(p = \\operatorname{softmax}(E[c]\\,W + b)\\): an embedding lookup, a matrix multiply and softmax, the same final step as a
      real LLM. Press play and watch the letters move.</p>` }));
    root.append(note('press play, then look where the vowels end up'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'tr-side' });
    grid.append(left, right);

    let view = null;
    const plot = createPlot(left, {
      aspect: 0.8, min: 280, max: 480,
      draw(ctx, w, hgt) {
        const E = model.E;
        // keep a stable, slowly-adapting view so motion is readable
        const xs = E.map((e) => e[0]), ys = E.map((e) => e[1]);
        const target = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        view = view ? view.map((v, i) => v + (target[i] - v) * 0.15) : target;
        const pad = 0.5, [x0, x1, y0, y1] = view;
        const sx = scale(x0 - pad, x1 + pad, 0, w), sy = scale(y0 - pad, y1 + pad, hgt, 0);
        drawGrid(ctx, sx, sy, { xTicks: [-3, -2, -1, 0, 1, 2, 3], yTicks: [-3, -2, -1, 0, 1, 2, 3], w, h: hgt, labels: false });
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [...CHARS].forEach((c, i) => {
          const X = sx(E[i][0]), Y = sy(E[i][1]);
          const vow = showVowels && VOWELS.has(c);
          ctx.beginPath(); ctx.arc(X, Y, 15, 0, Math.PI * 2);
          ctx.fillStyle = vow ? cssVar('--data') : '#fffdf6'; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = cssVar('--ink'); ctx.stroke();
          ctx.fillStyle = vow ? '#fff' : cssVar('--ink'); ctx.font = '700 15px "IBM Plex Mono", monospace';
          ctx.fillText(c === ' ' ? '␣' : c, X, Y + 1);
        });
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Each character plotted at its learned two-number embedding.');
    left.append(h('p', { class: 'caption' }, '␣ is the space. Orange letters are vowels (the model is never told which letters are vowels).'));

    const stepOut = readout('Step', 'learn'), lossOut = readout('Loss (nats/char)', 'error'), pplOut = readout('Torn between', 'model');
    const scale1 = h('div', { class: 'tr-scale' });
    const sample = h('p', { class: 'tr-sample', 'aria-live': 'off' });
    right.append(h('div', { class: 'readouts' }, stepOut.el, lossOut.el, pplOut.el), scale1,
      h('p', { class: 'tr-label' }, 'a sample of its writing right now'), sample);

    const playBtn = button('Play', () => toggle(), { primary: true, icon: '▶' });
    const resetBtn = button('New random start', () => { seed++; reset(); }, { icon: '↺' });
    const lrSl = slider({ label: 'Learning rate', min: 0.05, max: 3, step: 0.05, value: lr, accent: 'var(--learn)', onInput: (v) => { lr = v; } });
    const vowSeg = segmented([[true, 'Colour vowels'], [false, 'No colours']], true, (v) => { showVowels = v; plot.draw(); }, 'Vowel colouring');
    lab.append(h('div', { class: 'controls' }, playBtn, resetBtn, vowSeg.el), h('div', { class: 'controls' }, lrSl.el));

    const tl = createTimeline(lab, {
      title: 'time machine: drag to rewind the training',
      maxPoints: 300,
      onScrubStart: () => loop.pause(),
      onView: (st) => { model.setState(st); refresh(); },
    });

    const steps = stepper(STEPS_PER_SEC);
    const loop = createLoop(lab, (dt) => {
      const n = Math.min(steps(dt), MAX_STEPS - step);
      for (let i = 0; i < n; i++) { model.step(lr); step++; }
      if (n) tl.record(step, { loss: model.loss() }, model.getState());
      // stop once the loss has levelled off (less than 0.001 better over the last 100 steps)
      if (step - lastCheck.step >= 100) { const L = model.loss(); if (lastCheck.loss - L < 1e-3) done = true; lastCheck = { step, loss: L }; }
      refresh(n > 0);
      if (step >= MAX_STEPS || done) return false;
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Play', p ? '❚❚' : '▶'));
    function toggle() {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) { model.setState(past.state); step = past.step; done = false; lastCheck = { step, loss: Infinity }; }
      if (step >= MAX_STEPS || done) reset();
      loop.play();
    }
    function reset() {
      loop.pause();
      model = new CharModel(counts, { d: 2, seed }); step = 0; view = null; done = false; lastCheck = { step: 0, loss: Infinity };
      tl.reset(); tl.record(0, { loss: model.loss() }, model.getState(), true);
      refresh(true);
    }

    let lastSample = -99;
    function refresh(newSample = true) {
      const L = model.loss();
      stepOut.set(String(step)); lossOut.set(L.toFixed(3)); pplOut.set(`${Math.exp(L).toFixed(1)} letters`);
      const pos = (v) => `${((uniform - v) / (uniform - best * 0.9)) * 100}%`;
      scale1.replaceChildren(
        h('div', { class: 'tr-scale__bar' },
          h('span', { class: 'tr-scale__mark', style: `left:${pos(uniform)}` }, h('i'), 'random guess 3.33'),
          h('span', { class: 'tr-scale__mark tr-scale__mark--best', style: `left:${pos(best)}` }, h('i'), `best possible ${best.toFixed(2)}`),
          h('span', { class: 'tr-scale__now', style: `left:${pos(L)}` })),
      );
      if (newSample && (step - lastSample >= 20 || step < lastSample || step === 0)) { lastSample = step; sample.textContent = generate(110); }
      plot.draw();
    }
    function generate(n) {
      const rng = makeRng(step + 17);
      let c = 0, s = '';
      for (let i = 0; i < n; i++) {
        const p = model.probs(c);
        let r = rng(), j = 0;
        for (; j < p.length - 1; j++) { r -= p[j]; if (r <= 0) break; }
        c = j; s += CHARS[c];
      }
      return s;
    }
    tl.record(0, { loss: model.loss() }, model.getState(), true);
    refresh(true);

    root.append(h('div', { class: 'prose', html: `
      <p>Nobody told the model what a vowel is. It discovered that vowels behave alike (they tend to be followed by the same kinds
      of letters) and the cheapest way to predict well was to give them similar vectors. That's the whole idea of embeddings,
      learned from scratch, in miniature. In a real LLM the same pressure puts <em>Paris</em> near <em>London</em> and
      <em>ran</em> near <em>walked</em>.</p>
      <p>The loss stalls at about 2.35, above the best possible 2.09 for a model that only sees one previous letter. Two numbers per
      letter simply aren't enough room; with 8 numbers the same model reaches 2.11. Bigger vectors, more context (attention),
      and more layers are what close the gap in real models.</p>` }));
    root.append(h('details', { class: 'deeper', html: `
      <summary>go deeper: the gradient that moved the letters</summary>
      <p>For one position with current character \\(a\\) and next character \\(t\\), the logits are \\(z = E_a W + b\\) and the
      loss is \\(-\\log p_t\\). From chapter 2, \\(\\partial L / \\partial z_j = p_j - y_j\\). The chain rule then gives</p>
      \\[ \\frac{\\partial L}{\\partial W_{kj}} = E_{a,k}\\,(p_j - y_j), \\qquad \\frac{\\partial L}{\\partial E_{a,k}} = \\sum_j W_{kj}\\,(p_j - y_j). \\]
      <p>Summing those over every position in the text and stepping against them is one training step. A real LLM does the same,
      except the chain rule runs back through dozens of transformer blocks (that's backpropagation), the text is split into random
      mini-batches, and the step size is adapted per weight by an optimiser called Adam.</p>` }));
    (window.__ml ??= {}).llm5 = { get step() { return step; }, get done() { return done; }, get playing() { return loop.playing; }, loss: () => model.loss(), best, embeddings: () => model.E, timeline: tl };
  },
};
