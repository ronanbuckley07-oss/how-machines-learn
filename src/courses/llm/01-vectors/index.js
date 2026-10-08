import { createPlot, scale, drawGrid, onDrag, cssVar, HAND, MONO_SMALL } from '../../../lib/canvas.js';
import { h, button, slider, readout, note, fmt } from '../../../lib/ui.js';
import { setTex } from '../../../lib/math.js';
import { trainBPE, encode } from '../../../ml/bpe.js';
import { FABLES } from '../../../ml/fables.js';
import './chapter.css';

const MAX_MERGES = 300;

export default {
  id: 'llm-vectors',
  title: 'Words become vectors',
  tab: 'Vectors',
  blurb: 'Tokens, embeddings and the dot product',
  sims: false,
  mount(root) {
    // ---------------- tokens ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>A language model never sees letters or words. Step one is always the same: chop the text into pieces called
      <span class="term term--data">tokens</span>, and give each piece a number. Most modern models build their list of tokens
      with a simple greedy recipe called <strong>byte-pair encoding</strong>:</p>
      <ol>
        <li>Start with every single character as its own token.</li>
        <li>Find the pair of neighbouring tokens that appears most often in a big pile of text.</li>
        <li>Glue that pair into one new token, and repeat.</li>
      </ol>
      <p>Below, the recipe has been run on the fables from the first notebook. Slide the number of merges and watch common words
      fuse into single tokens, while rare words stay in pieces.</p>` }));
    root.append(note('try typing a word that isn\'t in the fables'));
    const merges = trainBPE(FABLES, MAX_MERGES);
    const tokLab = h('div', { class: 'lab' });
    root.append(tokLab);
    const input = h('input', { class: 'text-input', type: 'text', value: 'The tortoise laughed at the robot.', 'aria-label': 'Text to tokenize', spellcheck: 'false' });
    const chips = h('div', { class: 'tokens', 'aria-live': 'polite' });
    const lastMerge = h('p', { class: 'caption' });
    const nTok = readout('Tokens', 'data'), perTok = readout('Characters per token', 'model'), vocab = readout('Vocabulary size', 'learn');
    let k = 120;
    const mergeSl = slider({ label: 'Merges', min: 0, max: merges.length, step: 1, value: k, format: (v) => String(v), accent: 'var(--learn)', onInput: (v) => { k = v; renderTokens(); } });
    tokLab.append(input, h('div', { class: 'controls' }, mergeSl.el), chips, h('div', { class: 'readouts' }, nTok.el, perTok.el, vocab.el), lastMerge);
    input.addEventListener('input', renderTokens);
    const baseVocab = new Set(FABLES.toLowerCase()).size;
    function renderTokens() {
      const toks = encode(input.value, merges, k);
      chips.replaceChildren(...toks.map((t, i) => h('span', { class: `tok tok--${i % 4}`, title: JSON.stringify(t) }, t.replace(/ /g, '·'))));
      nTok.set(String(toks.length));
      perTok.set(toks.length ? fmt(input.value.length / toks.length, 2) : '–');
      vocab.set(String(baseVocab + k));
      lastMerge.textContent = k ? `Merge #${k} glued "${merges[k - 1].a.replace(/ /g, '·')}" + "${merges[k - 1].b.replace(/ /g, '·')}" (seen ${merges[k - 1].count} times). A dot · marks a space.` : 'No merges yet: every character is its own token. A dot · marks a space.';
    }
    renderTokens();

    root.append(h('div', { class: 'prose', html: `
      <p>Real models do exactly this on terabytes of text and stop at a vocabulary of around 50,000 to 200,000 tokens.
      That's why they can handle words they have never seen: they just fall back to smaller pieces.</p>
      <p>Each token then gets looked up in a giant table called the <span class="term term--model">embedding matrix</span>.
      Row \\(i\\) of the table is a list of \\(d\\) numbers, a <strong>vector</strong>, that stands for token \\(i\\):</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      <div class="mathbox__label">the lookup</div>
      \\[ E \\in \\mathbb{R}^{V \\times d}, \\qquad \\mathbf{x} = E[\\,\\text{token id}\\,] \\in \\mathbb{R}^{d} \\]
      <p class="caption">\\(V\\) is the vocabulary size and \\(d\\) the vector length: 768 in GPT-2, 12,288 in GPT-3.
      The numbers in \\(E\\) start out random and are learned during training (chapter 5).</p>` }));

    // ---------------- dot product ----------------
    root.append(h('div', { class: 'prose', html: `
      <p>Why vectors? Because geometry gives us a way to measure how <em>related</em> two tokens are. Training pushes tokens that
      appear in similar places to point in similar directions. The tool that measures "pointing the same way" is the
      <span class="term term--model">dot product</span>, and it is the single most important operation inside an LLM.</p>
      <p>Drag the tips of the two arrows. (Real embeddings have hundreds of dimensions; two is enough to see what's going on.)</p>` }));
    root.append(note('drag the arrow tips', { right: true }));
    const lab = h('div', { class: 'lab' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'llm-side' });
    grid.append(left, right);
    const v = { a: [2, 1], b: [0.6, 2.2] };
    let drag = null, sx, sy;
    const plot = createPlot(left, {
      aspect: 0.8, min: 280, max: 480,
      draw(ctx, w, hgt) {
        const R = 3.2 * Math.max(1, w / hgt);
        sx = scale(-R, R, 0, w); sy = scale(-3.2, 3.2, hgt, 0);
        drawGrid(ctx, sx, sy, { xTicks: [-3, -2, -1, 1, 2, 3], yTicks: [-3, -2, -1, 1, 2, 3], w, h: hgt, labels: false });
        ctx.strokeStyle = cssVar('--ink-3'); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(w, sy(0)); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), hgt); ctx.stroke();
        // projection of b onto a
        const la = Math.hypot(...v.a) || 1;
        const t = (v.a[0] * v.b[0] + v.a[1] * v.b[1]) / (la * la);
        const p = [v.a[0] * t, v.a[1] * t];
        const learn = cssVar('--learn');
        ctx.setLineDash([5, 4]); ctx.strokeStyle = learn; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(v.b[0]), sy(v.b[1])); ctx.lineTo(sx(p[0]), sy(p[1])); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 6; ctx.strokeStyle = learn; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(p[0]), sy(p[1])); ctx.stroke(); ctx.globalAlpha = 1;
        // angle arc
        const a0 = Math.atan2(v.a[1], v.a[0]), b0 = Math.atan2(v.b[1], v.b[0]);
        let d = b0 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctx.strokeStyle = cssVar('--ink-2'); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx(0), sy(0), 34, -a0, -(a0 + d), d > 0); ctx.stroke();
        ctx.font = HAND(20); ctx.fillStyle = cssVar('--ink-2');
        ctx.fillText('θ', sx(0) + 40 * Math.cos(a0 + d / 2) - 4, sy(0) - 40 * Math.sin(a0 + d / 2) + 6);
        arrow(ctx, v.a, cssVar('--data'), 'a');
        arrow(ctx, v.b, cssVar('--model'), 'b');
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Two draggable arrows a and b, with the shadow of b on a.');
    function arrow(ctx, [x, y], col, label) {
      const X = sx(x), Y = sy(y), ang = Math.atan2(Y - sy(0), X - sx(0));
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(X - 8 * Math.cos(ang), Y - 8 * Math.sin(ang)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 14 * Math.cos(ang - 0.4), Y - 14 * Math.sin(ang - 0.4)); ctx.lineTo(X - 14 * Math.cos(ang + 0.4), Y - 14 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(X, Y, 9, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--ink'); ctx.globalAlpha = 0.25; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = '700 ' + HAND(26); ctx.fillText(label, X + 10, Y - 10);
    }
    onDrag(plot.canvas, {
      down(p) {
        const da = Math.hypot(p.x - sx(v.a[0]), p.y - sy(v.a[1])), db = Math.hypot(p.x - sx(v.b[0]), p.y - sy(v.b[1]));
        if (Math.min(da, db) > 32) return false;
        drag = da < db ? 'a' : 'b';
      },
      move(p) { v[drag] = [round(sx.invert(p.x)), round(sy.invert(p.y))]; update(); },
      up() { drag = null; },
    });
    const round = (x) => Math.max(-3, Math.min(3, Math.round(x * 10) / 10));

    const formula = h('div', { class: 'formula' });
    const dotOut = readout('a · b', 'learn'), cosOut = readout('cos θ', 'model'), angOut = readout('angle', 'data');
    const verdict = h('p', { class: 'llm-say', 'aria-live': 'polite' });
    right.append(formula, h('div', { class: 'readouts' }, dotOut.el, cosOut.el, angOut.el), verdict,
      h('div', { class: 'controls' },
        button('Same way', () => { v.b = [round(v.a[0] * 1.3), round(v.a[1] * 1.3)]; update(); }),
        button('At right angles', () => { v.b = [round(-v.a[1]), round(v.a[0])]; update(); }),
        button('Opposite', () => { v.b = [round(-v.a[0]), round(-v.a[1])]; update(); })));
    function update() {
      const [a1, a2] = v.a, [b1, b2] = v.b;
      const d = a1 * b1 + a2 * b2, la = Math.hypot(a1, a2), lb = Math.hypot(b1, b2);
      const c = la && lb ? d / (la * lb) : 0;
      const f = (x) => (x < 0 ? `(${x.toFixed(1)})` : x.toFixed(1));
      setTex(formula, `\\begin{aligned} \\mathbf a\\cdot\\mathbf b &= a_1 b_1 + a_2 b_2 \\\\ &= ${f(a1)}\\cdot${f(b1)} + ${f(a2)}\\cdot${f(b2)} = \\mathbf{${d.toFixed(2)}} \\\\ \\cos\\theta &= \\frac{\\mathbf a\\cdot\\mathbf b}{\\lVert\\mathbf a\\rVert\\,\\lVert\\mathbf b\\rVert} = \\frac{${d.toFixed(2)}}{${la.toFixed(2)}\\times${lb.toFixed(2)}} = ${c.toFixed(2)} \\end{aligned}`, true);
      dotOut.set(d.toFixed(2)); cosOut.set(c.toFixed(2)); angOut.set(`${Math.round(Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI)}°`);
      verdict.textContent = c > 0.8 ? 'Pointing nearly the same way: a big positive dot product. In an LLM, "these are closely related".'
        : c > 0.2 ? 'Somewhat aligned: positive, but smaller.'
        : c > -0.2 ? 'Roughly at right angles: the dot product is near zero. "Nothing to do with each other."'
        : 'Pointing opposite ways: negative. "Actively opposed".';
      plot.draw();
    }
    update();

    root.append(h('div', { class: 'prose', html: `
      <p>The purple bar is the <strong>shadow</strong> of \\(\\mathbf b\\) on \\(\\mathbf a\\). The dot product is that shadow's length
      times the length of \\(\\mathbf a\\), which is why it can be written two ways:</p>` }));
    root.append(h('div', { class: 'mathbox', html: `
      \\[ \\mathbf a \\cdot \\mathbf b \\quad=\\quad \\sum_{i=1}^{d} a_i b_i \\quad=\\quad \\lVert \\mathbf a \\rVert \\, \\lVert \\mathbf b \\rVert \\cos\\theta \\]
      <p class="caption">Left: the recipe a computer uses (multiply matching entries, add them up). Right: what it means
      geometrically. Dividing out the lengths gives the <strong>cosine similarity</strong>, which only cares about direction.</p>` }));
    root.append(h('details', { class: 'deeper', html: `
      <summary>go deeper: why this scales to huge models</summary>
      <p>A dot product of two \\(d\\)-dimensional vectors costs \\(d\\) multiplications and \\(d-1\\) additions. Multiplying
      a matrix by a vector is just many dot products side by side, and multiplying two matrices is many of those. Graphics chips
      can do trillions of these per second, which is the whole reason today's language models are practical. Almost every
      step in the chapters ahead is "a lot of dot products, then something simple".</p>` }));
    (window.__ml ??= {}).llm1 = { merges, encode: (t, n) => encode(t, merges, n), vectors: v, update };
  },
};
