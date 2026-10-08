import { h, button, note, readout } from '../../../lib/ui.js';
import { tex } from '../../../lib/math.js';
import { softmax } from '../../../lib/stats.js';
import { makeRng } from '../../../lib/rng.js';
import './chapter.css';

const VOCAB = ['the', 'cat', 'dog', 'sat', 'ran', 'mat'];
const D = 4, HID = 8, T = 3;

// ---- the maths, written out ----
const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const layerNorm = (A) => A.map((r) => { const m = r.reduce((a, b) => a + b, 0) / r.length; const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length; return r.map((x) => (x - m) / Math.sqrt(v + 1e-5)); });
const gelu = (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
const randMat = (rng, r, c, s) => Array.from({ length: r }, () => Array.from({ length: c }, () => rng.normal() * s));

export default {
  id: 'llm-transformer',
  title: 'Inside a transformer block',
  tab: 'Transformer',
  blurb: 'Every matrix in one forward pass, with real numbers',
  sims: false,
  mount(root) {
    let seed = 3;
    const tokens = [0, 1, 3];   // "the cat sat"

    root.append(h('div', { class: 'prose', html: `
      <p>A transformer is a stack of identical <strong>blocks</strong>. Each block does two things: attention (tokens share information,
      chapter 3) and a small neural network applied to each token on its own (the first notebook's chapter 4). Around both, there are
      two bits of plumbing: <span class="term term--model">layer norm</span> and <span class="term term--model">residual connections</span>.</p>
      <p>Below is one complete block, with every matrix shown. It's tiny (3 tokens, vectors of length 4, a 6-word vocabulary) but it
      is exactly the same computation as a real model, just with smaller numbers. Change the input words and every number
      downstream is recomputed. Blue cells are positive, red cells negative.</p>
      <p>The weights here are <strong>random</strong> (untrained), so the final prediction is nonsense. That's the point of the next chapter.</p>` }));
    root.append(note('pick three words, then follow the numbers down'));

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const pickers = h('div', { class: 'tf-pickers' });
    const flow = h('div', { class: 'tf-flow' });
    const reroll = button('New random weights', () => { seed++; compute(); }, { icon: '⤨' });
    const paramOut = readout('Weights in this block', 'learn');
    lab.append(h('div', { class: 'controls' }, pickers, reroll), flow, h('div', { class: 'readouts', style: 'margin-top:14px' }, paramOut.el));

    tokens.forEach((t, pos) => {
      const sel = h('select', { class: 'tf-select', 'aria-label': `Word ${pos + 1}` }, VOCAB.map((w, i) => h('option', { value: i, selected: i === t }, w)));
      sel.addEventListener('change', () => { tokens[pos] = +sel.value; compute(); });
      pickers.append(sel);
    });

    function matEl(M, { rows, cols, max } = {}) {
      const m = max ?? Math.max(1e-6, ...M.flat().map(Math.abs));
      return h('div', { class: 'tf-mat', style: `grid-template-columns: ${rows ? 'auto ' : ''}repeat(${M[0].length}, minmax(2.6rem, 1fr))` },
        cols ? [rows ? h('span') : null, ...cols.map((c) => h('span', { class: 'tf-mat__h' }, c))] : null,
        M.map((r, i) => [rows ? h('span', { class: 'tf-mat__h tf-mat__r' }, rows[i]) : null,
          ...r.map((v) => h('span', { class: 'tf-mat__c', style: cellStyle(v, m) }, Number.isFinite(v) ? v.toFixed(2) : '−∞'))]).flat());
    }
    const cellStyle = (v, m) => {
      if (!Number.isFinite(v)) return 'background: repeating-linear-gradient(45deg, var(--paper-2) 0 4px, transparent 4px 8px); color: var(--ink-3)';
      const a = Math.min(1, Math.abs(v) / m) * 0.75;
      return `background: rgba(${v >= 0 ? '31,79,209' : '214,58,42'},${a.toFixed(3)}); color: ${a > 0.45 ? '#fff' : 'var(--ink)'}`;
    };
    function stage(num, title, formula, M, opts, explain) {
      return h('div', { class: 'tf-stage' },
        h('div', { class: 'tf-stage__text' },
          h('div', { class: 'tf-stage__num' }, num),
          h('div', { class: 'tf-stage__title' }, title),
          tex(formula, true),
          explain ? h('p', { class: 'caption', html: explain }) : null),
        h('div', { class: 'tf-stage__mat' }, matEl(M, opts), h('div', { class: 'tf-shape' }, `${M.length} × ${M[0].length}`)));
    }

    function compute() {
      const rng = makeRng(seed);
      const E = randMat(rng, VOCAB.length, D, 1), P = randMat(rng, T, D, 0.3);
      const Wq = randMat(rng, D, D, 0.6), Wk = randMat(rng, D, D, 0.6), Wv = randMat(rng, D, D, 0.6), Wo = randMat(rng, D, D, 0.5);
      const W1 = randMat(rng, D, HID, 0.5), W2 = randMat(rng, HID, D, 0.35);
      const words = tokens.map((t) => VOCAB[t]);
      const dims = ['d1', 'd2', 'd3', 'd4'];
      const X = tokens.map((t, i) => E[t].map((v, j) => v + P[i][j]));
      const Xn = layerNorm(X);
      const Q = matmul(Xn, Wq), K = matmul(Xn, Wk), V = matmul(Xn, Wv);
      const S = matmul(Q, transpose(K)).map((r, i) => r.map((v, j) => (j > i ? -Infinity : v / Math.sqrt(D))));
      const A = S.map((r) => softmax(r));
      const attn = matmul(matmul(A, V), Wo);
      const H = add(X, attn);
      const Hn = layerNorm(H);
      const Z = matmul(Hn, W1).map((r) => r.map(gelu));
      const Y = add(H, matmul(Z, W2));
      const logits = [Y[T - 1].map((_, j) => 0)].map(() => E.map((e) => e.reduce((s, v, k) => s + v * layerNorm([Y[T - 1]])[0][k], 0)));
      const probs = softmax(logits[0]);
      const cols = dims, rows = words;
      flow.replaceChildren(
        stage('1', 'Look up the vectors', 'X = E[\\text{tokens}] + P', X, { rows, cols },
          'Each word\'s embedding, plus a <strong>position</strong> vector so the model knows the order.'),
        stage('2', 'Layer norm', '\\hat x = \\frac{x - \\mu}{\\sqrt{\\sigma^2 + \\epsilon}}', Xn, { rows, cols },
          'Rescale each row to average 0 and spread 1, so numbers can\'t drift off to huge values as they pass through many blocks.'),
        h('div', { class: 'tf-trio' },
          stage('3a', 'Queries', 'Q = \\hat X W_Q', Q, { rows, cols }),
          stage('3b', 'Keys', 'K = \\hat X W_K', K, { rows, cols }),
          stage('3c', 'Values', 'V = \\hat X W_V', V, { rows, cols })),
        stage('4', 'Scores, with the causal mask', 'S = \\frac{QK^{\\top}}{\\sqrt d} + M', S, { rows, cols: words },
          'Row = query word, column = key word. Later words are masked to \\(-\\infty\\).'),
        stage('5', 'Attention weights', 'A = \\operatorname{softmax}(S)\\ \\text{row by row}', A, { rows, cols: words, max: 1 },
          'Each row adds up to 1. The first word can only look at itself.'),
        stage('6', 'Mix the values, then add back the input', 'H = X + (A V) W_O', H, { rows, cols },
          'The <strong>+ X</strong> is the residual connection: the block only has to learn a <em>change</em> to each vector, which makes deep stacks trainable.'),
        stage('7', 'Feed-forward network, on each token separately', 'Z = \\operatorname{GELU}(\\operatorname{LN}(H)\\,W_1)', Z, { rows, cols: Z[0].map((_, j) => `h${j + 1}`) },
          'Widen to 8 numbers (real models widen 4×), apply a smooth ReLU called GELU, then squeeze back down.'),
        stage('8', 'Block output', 'Y = H + Z W_2', Y, { rows, cols },
          'Same shape as the input. A real model feeds this into the next block, and the next, dozens of times.'),
        h('div', { class: 'tf-stage tf-stage--final' },
          h('div', { class: 'tf-stage__text' },
            h('div', { class: 'tf-stage__num' }, '9'),
            h('div', { class: 'tf-stage__title' }, `Predict the word after "${words.join(' ')}"`),
            tex('p = \\operatorname{softmax}\\big(\\operatorname{LN}(y_{\\text{last}})\\,E^{\\top}\\big)', true),
            h('p', { class: 'caption', html: 'Dot the last token\'s vector with every word\'s embedding (chapter 1), then softmax (chapter 2). Untrained, so the guess is random.' })),
          h('div', { class: 'tf-probs' }, VOCAB.map((w, i) => h('div', { class: 'tf-prob' },
            h('span', { class: 'tf-prob__w' }, w), h('span', { class: 'tf-prob__t' }, h('span', { class: 'tf-prob__f', style: `width:${probs[i] * 100}%` })),
            h('span', { class: 'tf-prob__n' }, `${(probs[i] * 100).toFixed(0)}%`))))),
      );
      const params = 4 * D * D + 2 * D * HID;
      paramOut.set(`${params} (+ ${VOCAB.length * D} embedding)`);
      api.last = { A, probs, Y };
    }
    const api = {};
    compute();

    root.append(h('div', { class: 'prose', html: `
      <p>Count the weights in one block: four \\(d \\times d\\) matrices for attention (\\(W_Q, W_K, W_V, W_O\\)) and two for the
      feed-forward network, which usually widens to \\(4d\\). That's</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ \\underbrace{4d^2}_{\\text{attention}} + \\underbrace{2 \\cdot d \\cdot 4d}_{\\text{feed-forward}} \\quad=\\quad 12\\,d^2 \\ \\text{ weights per block} \\]
      <p class="caption">GPT-2 small uses \\(d = 768\\) and 12 blocks: \\(12 \\times 12 \\times 768^2 \\approx 85\\) million weights,
      plus 39 million in the embedding table. Chapter 6 lets you play with these numbers.</p>` }));
    root.append(h('details', { class: 'deeper', html: `
      <summary>go deeper: multi-head attention</summary>
      <p>Real models split each \\(d\\)-dimensional query, key and value into \\(h\\) smaller pieces (<em>heads</em>) of size
      \\(d/h\\), run attention separately in each, and glue the results back together before \\(W_O\\). Each head can learn a
      different kind of relationship (one tracks the previous word, one matches pronouns to nouns, and so on). The total number
      of weights stays the same, which is why the \\(12d^2\\) count above still holds.</p>
      <p>Layer norm in real models also has two learned vectors, a scale \\(\\gamma\\) and a shift \\(\\beta\\):
      \\(\\operatorname{LN}(x) = \\gamma \\odot \\hat x + \\beta\\). They're left at 1 and 0 here to keep things readable.</p>` }));
    (window.__ml ??= {}).llm4 = { api, tokens, compute };
  },
};
