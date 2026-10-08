import { createPlot, scale, drawGrid, onDrag, dot, cssVar, cssRgb, HAND, MONO_SMALL } from '../../../lib/canvas.js';
import { h, slider, segmented, readout, note, button } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { softmax, histogram, std } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import './chapter.css';

// Toy 2D key vectors (picked by hand so the picture is readable). In this toy, each word's value vector equals its key.
const SENT = ['the', 'cat', 'chased', 'the', 'mouse', 'because', 'it'];
const KEYS = [[-0.4, -1.7], [1.9, 1.3], [-1.7, 1.2], [-0.2, -1.9], [2.3, 0.3], [-2.0, -0.6], [0.6, -0.5]];
// For the full matrix: toy 2D embeddings for a short sentence.
const SENT2 = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
const EMB2 = [[-0.3, -1.2], [1.5, 0.8], [-1.1, 1.3], [-0.9, -0.9], [-0.25, -1.25], [1.2, 1.1]];

export default {
  id: 'llm-attention',
  title: 'Attention: who should I listen to?',
  tab: 'Attention',
  blurb: 'Queries, keys, values and the attention matrix',
  sims: false,
  mount(root) {
    root.append(h('div', { class: 'prose', html: `
      <p>Here's the problem attention solves. In <em>"the cat chased the mouse because <strong>it</strong> was hungry"</em>,
      the vector for <em>it</em> on its own knows nothing about cats. To be useful, it needs to <strong>pull in information from the
      right earlier words</strong>.</p>
      <p>Attention does this with three vectors per token, each made by multiplying the token's embedding by a learned matrix:</p>
      <ul>
        <li>a <span class="term term--learn">query</span> \\(\\mathbf q\\): "what am I looking for?"</li>
        <li>a <span class="term term--data">key</span> \\(\\mathbf k\\): "what do I contain?"</li>
        <li>a <span class="term term--model">value</span> \\(\\mathbf v\\): "what I'll hand over if you pick me".</li>
      </ul>
      <p>The query of <em>it</em> is dotted with every key (chapter 1), the scores go through softmax (chapter 2), and the result is a
      weighted average of the values. Drag the purple query arrow and watch.</p>` }));
    root.append(note('drag the purple arrow. longer arrows = sharper focus'));

    // ---------------- Part A: one query ----------------
    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'att-side' });
    grid.append(left, right);
    const q = [1.3, 0.9];
    let sx, sy, weights = [], out = [0, 0];
    const d = 2;
    const plot = createPlot(left, {
      aspect: 0.8, min: 280, max: 480,
      draw(ctx, w, hgt) {
        const R = 3.2 * Math.max(1, w / hgt);
        sx = scale(-R, R, 0, w); sy = scale(-3.2, 3.2, hgt, 0);
        drawGrid(ctx, sx, sy, { xTicks: [-3, -2, -1, 1, 2, 3], yTicks: [-3, -2, -1, 1, 2, 3], w, h: hgt, labels: false });
        ctx.strokeStyle = cssVar('--ink-3'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(w, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), hgt); ctx.stroke();
        const learn = cssVar('--learn'), data = cssVar('--data'), model = cssVar('--model');
        // keys, haloed by their attention weight
        KEYS.forEach((k, j) => {
          ctx.beginPath(); ctx.arc(sx(k[0]), sy(k[1]), 6 + 34 * Math.sqrt(weights[j] || 0), 0, Math.PI * 2);
          ctx.fillStyle = learn; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
          // line from each key to the output, thickness = weight
          ctx.strokeStyle = model; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.5 + 8 * (weights[j] || 0);
          ctx.beginPath(); ctx.moveTo(sx(k[0]), sy(k[1])); ctx.lineTo(sx(out[0]), sy(out[1])); ctx.stroke(); ctx.globalAlpha = 1;
          dot(ctx, sx(k[0]), sy(k[1]), 5, data);
          ctx.font = HAND(20); ctx.fillStyle = cssVar('--ink');
          ctx.fillText(SENT[j], sx(k[0]) + 8, sy(k[1]) + (j === 3 ? 18 : -8));
        });
        // query arrow
        const X = sx(q[0]), Y = sy(q[1]), ang = Math.atan2(Y - sy(0), X - sx(0));
        ctx.strokeStyle = learn; ctx.fillStyle = learn; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(X - 8 * Math.cos(ang), Y - 8 * Math.sin(ang)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 15 * Math.cos(ang - 0.4), Y - 15 * Math.sin(ang - 0.4)); ctx.lineTo(X - 15 * Math.cos(ang + 0.4), Y - 15 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
        ctx.font = '700 ' + HAND(22); ctx.fillText('q', X - 22, Y - 6);
        // output: a star at the weighted average of the values
        star(ctx, sx(out[0]), sy(out[1]), 11, model);
        ctx.fillStyle = model; ctx.font = '700 ' + HAND(20); ctx.fillText('output', sx(out[0]) - 18, sy(out[1]) + 28);
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Key vectors for each word, a draggable query arrow, and the attention output as a star.');
    onDrag(plot.canvas, {
      down: (p) => { if (Math.hypot(p.x - sx(q[0]), p.y - sy(q[1])) > 34) return false; },
      move: (p) => { q[0] = clamp(sx.invert(p.x)); q[1] = clamp(sy.invert(p.y)); updateA(); },
    });
    const clamp = (x) => Math.max(-3, Math.min(3, Math.round(x * 10) / 10));

    const bars = h('div', { class: 'att-bars' });
    const formula = h('div', { class: 'formula' });
    right.append(h('p', { class: 'att-label' }, 'how much "it" listens to each word'), bars, formula);
    function updateA() {
      const s = KEYS.map((k) => (q[0] * k[0] + q[1] * k[1]) / Math.sqrt(d));
      weights = softmax(s);
      out = [0, 1].map((c) => weights.reduce((acc, wt, j) => acc + wt * KEYS[j][c], 0));
      bars.replaceChildren(...SENT.map((wd, j) => h('div', { class: 'att-bar' },
        h('span', { class: 'att-bar__w' }, wd), h('span', { class: 'att-bar__t' }, h('span', { class: 'att-bar__f', style: `width:${weights[j] * 100}%` })),
        h('span', { class: 'att-bar__n' }, `${(weights[j] * 100).toFixed(0)}%`))));
      const top = weights.map((wt, j) => [wt, j]).sort((a, b) => b[0] - a[0])[0][1];
      setTex(formula, `\\begin{aligned} s_j &= \\frac{\\mathbf q\\cdot\\mathbf k_j}{\\sqrt{d}} \\quad\\text{e.g. } s_{\\text{${SENT[top]}}} = \\frac{${q[0].toFixed(1)}\\cdot${KEYS[top][0]} + ${q[1].toFixed(1)}\\cdot${KEYS[top][1]}}{\\sqrt 2} = ${s[top].toFixed(2)} \\\\ w_j &= \\operatorname{softmax}(s)_j \\\\ \\text{output} &= \\textstyle\\sum_j w_j \\mathbf v_j = (${out[0].toFixed(2)},\\ ${out[1].toFixed(2)}) \\end{aligned}`, true);
      plot.draw();
    }
    updateA();

    root.append(h('div', { class: 'prose', html: `
      <p>The output (the blue star) is a <strong>blend</strong> of everyone's values, pulled toward the words with high weight.
      Point the query at <em>cat</em> and the star lands near <em>cat</em>: the vector for <em>it</em> now carries cat-information.
      Make the arrow longer and the softmax gets more decisive, because every score is multiplied up.</p>
      <p>In a real model nobody hand-picks these arrows. The matrices \\(W_Q, W_K, W_V\\) that produce queries, keys and values are
      learned by gradient descent, and they end up encoding things like "pronouns look for nouns".</p>` }));

    // ---------------- Part B: the full matrix ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>Every token does this at once. Stack the queries into a matrix \\(Q\\) (one row per token), the keys into \\(K\\) and the
      values into \\(V\\), and the whole thing becomes three matrix multiplications:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">attention, all tokens at once</div>
      \\[ \\operatorname{Attention}(Q,K,V) = \\operatorname{softmax}\\!\\Big(\\frac{QK^{\\top}}{\\sqrt{d}} + M\\Big)\\,V \\]
      <p class="caption">\\(QK^{\\top}\\) is a table of every query dotted with every key. \\(M\\) is the <strong>causal mask</strong>:
      \\(-\\infty\\) wherever a token would be looking at a <em>later</em> token, which becomes a weight of exactly 0 after softmax.
      Chatbots need it, because when predicting the next word you're not allowed to peek at it.</p>` }));
    root.append(note('turn the query matrix and watch the pattern change', { right: true }));
    const labB = h('div', { class: 'lab' });
    root.append(labB);
    let theta = 0.6, causal = true;
    const heat = h('div', { class: 'att-heat', role: 'table', 'aria-label': 'Attention weights: rows are queries, columns are keys' });
    const thSl = slider({ label: 'W_Q rotation', min: -3.14, max: 3.14, step: 0.01, value: theta, accent: 'var(--learn)', format: (v) => `${Math.round(v * 180 / Math.PI)}°`, onInput: (v) => { theta = v; updateB(); } });
    const maskSeg = segmented([[true, 'Causal mask on'], [false, 'Mask off']], true, (v) => { causal = v; updateB(); }, 'Causal mask');
    labB.append(h('div', { class: 'controls' }, thSl.el, maskSeg.el), heat,
      h('p', { class: 'caption' }, 'Row = the word asking (query). Column = the word being looked at (key). Each row adds up to 100%. Here the keys are the embeddings themselves and the queries are the embeddings rotated by W_Q.'));
    function updateB() {
      const c = Math.cos(theta), s = Math.sin(theta);
      const Q = EMB2.map(([x, y]) => [c * x - s * y, s * x + c * y]);
      const W = Q.map((qi, i) => softmax(EMB2.map((kj, j) => (causal && j > i ? -Infinity : (qi[0] * kj[0] + qi[1] * kj[1]) / Math.SQRT2))));
      const learn = cssRgb('--learn');
      heat.replaceChildren(
        h('div', { class: 'att-heat__row', role: 'row' }, h('span', { class: 'att-heat__corner' }, 'query ↓  key →'), SENT2.map((wd) => h('span', { class: 'att-heat__head', role: 'columnheader' }, wd))),
        ...W.map((row, i) => h('div', { class: 'att-heat__row', role: 'row' }, h('span', { class: 'att-heat__head', role: 'rowheader' }, SENT2[i]),
          row.map((v, j) => h('span', { class: 'att-heat__cell' + (causal && j > i ? ' is-masked' : ''), role: 'cell', style: `background: rgba(${learn},${0.08 + 0.85 * v}); color: ${v > 0.5 ? '#fff' : 'var(--ink)'}` },
            causal && j > i ? '–' : `${Math.round(v * 100)}`)))));
    }
    updateB();

    // ---------------- Part C: why divide by sqrt(d) ----------------
    root.append(h('details', { class: 'deeper', open: true, html: `
      <summary>go deeper: why divide by \\(\\sqrt d\\)?</summary>
      <p>If the entries of \\(\\mathbf q\\) and \\(\\mathbf k\\) are random with variance 1, their dot product is a sum of \\(d\\)
      independent terms, so its variance is \\(d\\) and its typical size is \\(\\sqrt d\\). With \\(d = 128\\) the scores would
      typically be around ±11, and softmax of numbers that far apart puts almost all the weight on one token, so gradients for
      every other token vanish. Dividing by \\(\\sqrt d\\) brings the spread back to about 1. Try it with real random vectors:</p>` }));
    const deeper = root.lastChild;
    const labC = h('div', { class: 'lab lab--small' });
    deeper.append(labC);
    let dim = 64, lastC = null;
    const dimSl = slider({ label: 'Dimension d', min: 1, max: 512, step: 1, value: dim, format: (v) => String(v), onInput: (v) => { dim = v; updateC(); } });
    const rawOut = readout('spread of q·k', 'error'), scOut = readout('spread of q·k / √d', 'model');
    const hist = createPlot(labC, {
      aspect: 0.35, min: 140, max: 220,
      draw(ctx, w, hgt) {
        if (!lastC) return;
        const { raw, sc } = lastC;
        const lo = -40, hi = 40, sxx = scale(lo, hi, 8, w - 8);
        const hr = histogram(raw, lo, hi, 80), hs = histogram(sc, lo, hi, 80);
        const max = Math.max(...hr.counts, ...hs.counts);
        const bw = (w - 16) / 80;
        hr.counts.forEach((c, i) => { ctx.fillStyle = cssVar('--error'); ctx.globalAlpha = 0.55; ctx.fillRect(8 + i * bw, hgt - 20 - (c / max) * (hgt - 30), bw - 1, (c / max) * (hgt - 30)); });
        hs.counts.forEach((c, i) => { ctx.fillStyle = cssVar('--model'); ctx.globalAlpha = 0.75; ctx.fillRect(8 + i * bw, hgt - 20 - (c / max) * (hgt - 30), bw - 1, (c / max) * (hgt - 30)); });
        ctx.globalAlpha = 1; ctx.fillStyle = cssVar('--ink-3'); ctx.font = MONO_SMALL; ctx.textAlign = 'center';
        for (const t of [-40, -20, 0, 20, 40]) ctx.fillText(String(t), sxx(t), hgt - 5);
        ctx.textAlign = 'left';
      },
    });
    hist.canvas.setAttribute('role', 'img');
    hist.canvas.setAttribute('aria-label', 'Histograms of raw and scaled dot products of random vectors.');
    labC.append(h('div', { class: 'controls' }, dimSl.el), h('div', { class: 'readouts' }, rawOut.el, scOut.el),
      h('p', { class: 'caption' }, 'Red: 2,000 dot products of random vectors. Blue: the same, divided by √d. Raw scores spread out like √d; scaled ones stay put.'));
    function updateC() {
      const rng = makeRng(dim * 7 + 1);
      const raw = [];
      for (let n = 0; n < 2000; n++) { let s = 0; for (let i = 0; i < dim; i++) s += rng.normal() * rng.normal(); raw.push(s); }
      const sc = raw.map((x) => x / Math.sqrt(dim));
      lastC = { raw, sc };
      rawOut.set(std(raw).toFixed(2)); scOut.set(std(sc).toFixed(2));
      hist.draw();
    }
    updateC();
    (window.__ml ??= {}).llm3 = { q, weights: () => weights, out: () => out, updateA, setTheta: (v) => { theta = v; thSl.set(v); updateB(); }, heat, spread: () => lastC && [std(lastC.raw), std(lastC.sc)], setDim: (v) => { dim = v; dimSl.set(v); updateC(); } };
  },
};

function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#22201c'; ctx.stroke();
}
