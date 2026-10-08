import { createPlot, cssVar, HAND } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { softmax } from '../../lib/stats.js';
import { reducedMotion } from '../../lib/motion.js';

// Toy 2D embeddings (picked by hand) for a short sentence.
const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'warm', 'mat'];
const EMB = [[0.2, -1], [1.6, 0.9], [-0.4, 1.7], [0.1, -1.2], [0.2, -1], [1.2, 1.4], [1.7, 0.6]];

/** Cover picture: a real attention pattern. Each word in turn asks a query; arcs show its softmax weights. */
export function mountLlmHero(host) {
  let t = 0;
  const plot = createPlot(host, {
    fill: true,
    draw(ctx, w, h) {
      const n = WORDS.length, gap = (w - 40) / (n - 1), base = h * 0.78;
      const qi = Math.floor(t) % n;
      // query vector rotates a little over time so the weights visibly change
      const ang = Math.sin(t * 0.7) * 0.6;
      const q = EMB[qi].map((v, i) => v * 1.4 + (i ? Math.sin(ang) : Math.cos(ang)) * 0.6);
      const scores = EMB.map((k) => (q[0] * k[0] + q[1] * k[1]) / Math.SQRT2);
      const wts = softmax(scores);
      const x = (i) => 20 + i * gap;
      const model = cssVar('--model');
      for (let j = 0; j < n; j++) {
        if (j === qi) continue;
        const x0 = x(qi), x1 = x(j), mid = (x0 + x1) / 2, rise = Math.min(h * 0.62, Math.abs(x1 - x0) * 0.55 + 20);
        ctx.strokeStyle = model; ctx.globalAlpha = 0.15 + 0.85 * wts[j]; ctx.lineWidth = 1 + 14 * wts[j]; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, base - 18); ctx.quadraticCurveTo(mid, base - 18 - rise, x1, base - 18); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      WORDS.forEach((wd, i) => {
        ctx.font = (i === qi ? '700 ' : '') + HAND(Math.max(18, Math.min(30, gap * 0.4)));
        ctx.fillStyle = i === qi ? cssVar('--data') : cssVar('--ink');
        ctx.fillText(wd, x(i), base + 10);
        ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = cssVar('--ink-3');
        if (i !== qi) ctx.fillText(`${Math.round(wts[i] * 100)}%`, x(i), base + 30);
      });
      ctx.textAlign = 'left';
    },
  });
  plot.canvas.setAttribute('role', 'img');
  plot.canvas.setAttribute('aria-label', 'A sentence with arcs showing how much each word attends to the others.');
  if (reducedMotion()) return;
  createLoop(host, (dt) => { t += dt * 0.5; plot.draw(); }, { scaled: false }).play();
}
