import { createPlot, scale, dot, cssVar } from './lib/canvas.js';
import { createLoop } from './lib/loop.js';
import { MLP } from './ml/mlp.js';
import { makeRng } from './lib/rng.js';
import { reducedMotion } from './lib/motion.js';

/**
 * Cover picture: orange data points drift slowly while a small neural
 * network (1 → 16 → 1) keeps re-fitting them in real time.
 */
export function mountHero(host) {
  const rng = makeRng(11);
  const N = 34;
  const xs = Array.from({ length: N }, (_, i) => -1 + (2 * i) / (N - 1) + (rng() - 0.5) * 0.04);
  const noise = xs.map(() => rng.normal() * 0.08);
  let t = 0;
  const target = (x) => 0.55 * Math.sin(2.6 * x + t) + 0.25 * Math.sin(5.1 * x - 0.7 * t);
  const net = new MLP([1, 16, 1], { output: 'linear', seed: 5 });
  let X = [], Y = [];
  const sample = () => { X = xs.map((x) => [x]); Y = xs.map((x, i) => [target(x) + noise[i]]); };
  sample();
  for (let i = 0; i < 1500; i++) net.step(X, Y, 0.05, 0.9);

  const plot = createPlot(host, {
    fill: true,
    draw(ctx, w, h) {
      const sx = scale(-1.08, 1.08, 14, w - 14);
      const sy = scale(-1.25, 1.25, h - 12, 12);
      const err = cssVar('--error'), model = cssVar('--model'), data = cssVar('--data');
      ctx.strokeStyle = err; ctx.lineWidth = 1.5;
      for (let i = 0; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(sx(xs[i]), sy(Y[i][0])); ctx.lineTo(sx(xs[i]), sy(net.predict1([xs[i]]))); ctx.stroke();
      }
      ctx.strokeStyle = model; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let px = 0; px <= 120; px++) {
        const x = -1.08 + (2.16 * px) / 120;
        const y = sy(net.predict1([x]));
        px ? ctx.lineTo(sx(x), y) : ctx.moveTo(sx(x), y);
      }
      ctx.stroke();
      for (let i = 0; i < N; i++) dot(ctx, sx(xs[i]), sy(Y[i][0]), 4.5, data);
    },
  });
  plot.canvas.setAttribute('role', 'img');
  plot.canvas.setAttribute('aria-label', 'A curve continuously re-fitting itself to drifting data points.');
  if (reducedMotion()) return;
  const loop = createLoop(host, (dt) => {
    t += dt * 0.35;
    sample();
    for (let i = 0; i < 4; i++) net.step(X, Y, 0.05, 0.9);
    plot.draw();
  }, { scaled: false });
  loop.play();
}
