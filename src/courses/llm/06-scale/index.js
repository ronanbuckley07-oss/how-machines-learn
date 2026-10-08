import { createLoop, stepper } from '../../../lib/loop.js';
import { h, button, slider, readout, note, segmented } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { CharModel, charCounts, CHARS } from '../../../ml/charmodel.js';
import { FABLES } from '../../../ml/fables.js';
import { makeRng } from '../../../lib/rng.js';
import './chapter.css';

const PRESETS = {
  tiny: { label: 'Chapter 4 toy', L: 1, d: 4, V: 6, ctx: 3, D: 3 },
  gpt2: { label: 'GPT-2 small', L: 12, d: 768, V: 50257, ctx: 1024, D: 9e9 },
  llama: { label: 'Llama 2 7B', L: 32, d: 4096, V: 32000, ctx: 4096, D: 2e12 },
  gpt3: { label: 'GPT-3', L: 96, d: 12288, V: 50257, ctx: 2048, D: 3e11 },
};

export default {
  id: 'llm-scale',
  title: 'Writing, one token at a time',
  tab: 'Scale',
  blurb: 'Sampling, temperature, top-k, and what "175 billion" means',
  mount(root) {
    // ---------------- sampling ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>A trained model only ever answers one question: <em>given the text so far, how likely is each next token?</em> To write,
      it runs in a loop. Predict, pick one token, add it to the text, and predict again. This is called
      <span class="term term--model">autoregressive</span> generation:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ x_{t+1} \\sim p_\\theta\\big(\\,\\cdot \\mid x_1, \\dots, x_t\\big), \\qquad t = 1, 2, 3, \\dots \\]
      <p class="caption">The "\\(\\sim\\)" means <em>sample from</em>: roll weighted dice. How you roll them matters a lot.</p>` }));
    root.append(note('step through the loop yourself, one letter at a time'));

    // a slightly bigger letter model (8 numbers per letter), trained right here on the fables
    const model = new CharModel(charCounts(FABLES), { d: 8, seed: 5 });
    for (let i = 0; i < 600; i++) model.step(1);

    const lab = h('div', { class: 'lab' });
    root.append(lab);
    let text = 'the lion ', T = 0.8, topK = 0;
    const rng = makeRng(9);
    const out = h('div', { class: 'gen-text', 'aria-live': 'polite' });
    const bars = h('div', { class: 'gen-bars' });
    const tSl = slider({ label: 'Temperature', min: 0.1, max: 2, step: 0.05, value: T, accent: 'var(--learn)', onInput: (v) => { T = v; render(); } });
    const kSeg = segmented([[0, 'all letters'], [5, 'top 5'], [2, 'top 2'], [1, 'top 1 (greedy)']], 0, (v) => { topK = v; render(); }, 'Top-k');
    const stepBtn = button('Pick the next letter', () => { pick(); }, { primary: true, icon: '⚄' });
    const autoBtn = button('Keep writing', () => (loop.playing ? loop.pause() : loop.play()), { icon: '▶' });
    const resetBtn = button('Start over', () => { loop.pause(); text = 'the lion '; render(); }, { icon: '↺' });
    lab.append(out, h('p', { class: 'gen-label' }, 'what it expects next (after temperature and top-k)'), bars,
      h('div', { class: 'controls' }, stepBtn, autoBtn, resetBtn), h('div', { class: 'controls' }, tSl.el, kSeg.el));

    function dist() {
      const c = CHARS.indexOf(text[text.length - 1]);
      let p = model.probs(c < 0 ? 0 : c, T).map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      if (topK) { p = p.slice(0, topK); const s = p.reduce((a, b) => a + b[0], 0); p = p.map(([v, i]) => [v / s, i]); }
      return p;
    }
    let lastPick = -1;
    function pick() {
      const p = dist();
      let r = rng(), k = 0;
      for (; k < p.length - 1; k++) { r -= p[k][0]; if (r <= 0) break; }
      lastPick = p[k][1];
      text += CHARS[lastPick];
      if (text.length > 400) text = text.slice(-400);
      render();
    }
    const steps = stepper(8);
    const loop = createLoop(lab, (dt) => { for (let i = steps(dt); i > 0; i--) pick(); });
    loop.onChange((p) => autoBtn.setLabel(p ? 'Pause' : 'Keep writing', p ? '❚❚' : '▶'));
    function render() {
      out.replaceChildren(h('span', {}, text.slice(0, -1)), h('mark', {}, text.slice(-1)), h('span', { class: 'gen-caret' }, '▍'));
      const p = dist().slice(0, 8);
      bars.replaceChildren(...p.map(([v, i]) => h('div', { class: 'gen-bar' },
        h('span', { class: 'gen-bar__c' }, CHARS[i] === ' ' ? '␣' : CHARS[i]),
        h('span', { class: 'gen-bar__t' }, h('span', { class: 'gen-bar__f', style: `width:${v * 100}%` })),
        h('span', { class: 'gen-bar__n' }, `${(v * 100).toFixed(0)}%`))));
    }
    render();
    root.append(h('div', { class: 'prose', html: `
      <p><strong>Greedy</strong> decoding (always take the top choice) gets stuck repeating itself. <strong>Temperature</strong>
      (chapter 2) and <strong>top-k</strong> (throw away all but the \\(k\\) likeliest tokens, then renormalise) are the everyday dials
      for trading reliability against variety. Chatbots use the same dials, just over a vocabulary of ~100,000 tokens instead of 28 letters.</p>
      <p>This letter model only sees the previous letter, so it writes word-shaped noise. Swap it for a stack of transformer blocks that
      can attend to thousands of previous tokens, scale everything up, and the same loop writes essays. Which brings us to scale.</p>` }));

    // ---------------- scale ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>Using the \\(12d^2\\) count from chapter 4, the number of weights in a GPT-style model is roughly</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ N \\,\\approx\\, \\underbrace{12\\,L\\,d^{2}}_{L \\text{ blocks}} \\,+\\, \\underbrace{V d}_{\\text{embeddings}} \\,+\\, \\underbrace{n_{\\text{ctx}}\\, d}_{\\text{positions}} \\]
      <p class="caption">Writing one token costs about \\(2N\\) arithmetic operations (a multiply and an add per weight). Training on
      \\(D\\) tokens costs about \\(6ND\\): the forward pass plus a backward pass that's roughly twice as expensive.</p>` }));
    root.append(note('try the presets, then build your own', { right: true }));
    const labS = h('div', { class: 'lab' });
    root.append(labS);
    const cfg = { ...PRESETS.gpt2 };
    const sl = {};
    const WIDTHS = [4, 32, 64, 128, 256, 512, 768, 1024, 1536, 2048, 3072, 4096, 5120, 6144, 8192, 12288, 16384];
    const mk = (k, label, min, max, step, fmt) => (sl[k] = slider({ label, min, max, step, value: cfg[k], format: fmt, onInput: (v) => { cfg[k] = k === 'D' ? 10 ** v : k === 'd' ? WIDTHS[v] : v; presetSeg.set(null); calc(); } })).el;
    const presetSeg = segmented(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), 'gpt2', (k) => { Object.assign(cfg, PRESETS[k]); syncSliders(); calc(); }, 'Model presets');
    labS.append(h('div', { class: 'controls' }, presetSeg.el),
      h('div', { class: 'controls sc-grid' },
        mk('L', 'Blocks L', 1, 120, 1, (v) => String(v)),
        mk('d', 'Width d', 0, WIDTHS.length - 1, 1, (v) => WIDTHS[v].toLocaleString()),
        mk('V', 'Vocabulary V', 6, 256000, 1, (v) => Math.round(v).toLocaleString()),
        mk('D', 'Training tokens D', 0, 13.5, 0.05, (v) => short(10 ** v))));
    function syncSliders() { sl.L.set(cfg.L); sl.d.set(WIDTHS.indexOf(cfg.d)); sl.V.set(cfg.V); sl.D.set(Math.log10(cfg.D)); }
    syncSliders();
    const nOut = readout('Weights N', 'model'), memOut = readout('Memory (16-bit)', 'data'), tokOut = readout('Ops per token', 'learn'), trOut = readout('Training ops 6ND', 'error');
    const compare = h('p', { class: 'sc-compare' });
    const calcTex = h('div', { class: 'formula' });
    const ladder = h('div', { class: 'sc-ladder' });
    labS.append(h('div', { class: 'readouts' }, nOut.el, memOut.el, tokOut.el, trOut.el), calcTex, compare, ladder);
    function calc() {
      const d = Math.round(cfg.d);
      const N = 12 * cfg.L * d * d + cfg.V * d + cfg.ctx * d;
      nOut.set(short(N)); memOut.set(bytes(2 * N)); tokOut.set(short(2 * N)); trOut.set(short(6 * N * cfg.D));
      setTex(calcTex, `N \\approx 12 \\times ${cfg.L} \\times ${d.toLocaleString()}^2 + ${Math.round(cfg.V).toLocaleString()} \\times ${d.toLocaleString()} + ${cfg.ctx.toLocaleString()} \\times ${d.toLocaleString()} \\approx ${texSci(N)}`, true);
      const laptopYears = (6 * N * cfg.D) / 1e12 / 3.15e7;
      compare.innerHTML = `Training on a laptop doing a trillion operations per second would take <strong>${duration(laptopYears)}</strong>.
        Printed at 10 numbers per line and 50 lines per page, the weights would fill <strong>${short(N / 500)} pages</strong>.`;
      const all = [...Object.values(PRESETS).map((p) => [p.label, 12 * p.L * p.d * p.d + p.V * p.d + p.ctx * p.d]), ['yours', N]];
      const lo = 1, hi = Math.log10(Math.max(...all.map((a) => a[1])) * 3);
      ladder.replaceChildren(...all.map(([lbl, n]) => h('div', { class: 'sc-row' + (lbl === 'yours' ? ' is-yours' : '') },
        h('span', { class: 'sc-row__l' }, lbl), h('span', { class: 'sc-row__t' }, h('span', { class: 'sc-row__f', style: `width:${Math.max(1, (Math.log10(Math.max(n, 10)) - lo) / (hi - lo) * 100)}%` })),
        h('span', { class: 'sc-row__n' }, short(n)))), h('p', { class: 'caption' }, 'Bar lengths are on a log scale: each step of the same length is 10× more weights.'));
      api.N = N;
    }
    const api = {};
    calc();
    root.append(h('div', { class: 'prose', html: `
      <p>Plug in GPT-3's published shape (96 blocks, width 12,288, trained on 300 billion tokens) and the formula gives 175 billion
      weights and about \\(3 \\times 10^{23}\\) operations, which matches the published figures. Every one of those operations is a
      piece of maths you've now seen: dot products, softmax, attention, layer norm, a small network, and gradient descent nudging
      every weight to be a little less surprised by the next token.</p>` }));
    root.append(h('div', { class: 'callout callout--honest', html: `<strong>What this notebook left out.</strong> Real models add
      multi-head attention, learned positions or rotary position encodings, the Adam optimiser, mixed-precision arithmetic, and a
      second training phase (instruction tuning and reinforcement learning from human feedback) that turns a text predictor into a
      helpful assistant. The core maths is what you've seen here.` }));
    (window.__ml ??= {}).llm6 = { api, get text() { return text; }, pick, cfg, calc, setPreset: (k) => presetSeg.set(k, true) };
  },
};

function short(n) {
  const u = [[1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [v, s] of u) if (n >= v) return `${(n / v).toFixed(n / v < 10 ? 1 : 0)} ${s}`;
  return Math.round(n).toLocaleString();
}
const texSci = (n) => { const e = Math.floor(Math.log10(n)); return `${(n / 10 ** e).toFixed(2)} \\times 10^{${e}}`; };
function sci(n) { if (n < 1e6) return Math.round(n).toLocaleString(); const e = Math.floor(Math.log10(n)); return `${(n / 10 ** e).toFixed(1)}×10^${e}`.replace('^', '').replace(/10(\d+)$/, (m, p) => `10${sup(p)}`); }
const sup = (s) => s.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
function bytes(b) { const u = [[1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB']]; for (const [v, s] of u) if (b >= v) return `${(b / v).toFixed(1)} ${s}`; return `${b} bytes`; }
function duration(y) {
  if (y > 1) return `${short(y)} years`;
  const s = y * 3.15e7;
  if (s > 86400) return `${(s / 86400).toFixed(0)} days`;
  if (s > 3600) return `${(s / 3600).toFixed(0)} hours`;
  if (s > 1) return `${s.toFixed(0)} seconds`;
  return 'less than a second';
}
