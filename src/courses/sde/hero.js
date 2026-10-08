import { createPlot, scale, cssVar, withAlpha } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { makeRng } from '../../lib/rng.js';
import { reducedMotion } from '../../lib/motion.js';

/** Cover picture: a fan of simulated stock prices (geometric Brownian motion), drawn as time passes. */
export function mountSdeHero(host) {
  const rng = makeRng(21);
  const STEPS = 240, N = 40, mu = 0.08, sigma = 0.3, dt = 1 / 120;
  let paths = [], t = 0;
  const reset = () => {
    paths = Array.from({ length: N }, () => { const p = [100]; for (let i = 1; i <= STEPS; i++) p.push(p[i - 1] * Math.exp((mu - sigma * sigma / 2) * dt + sigma * Math.sqrt(dt) * rng.normal())); return p; });
    t = 0;
  };
  reset();
  const plot = createPlot(host, {
    fill: true,
    draw(ctx, w, h) {
      const sx = scale(0, STEPS, 14, w - 14), sy = scale(40, 230, h - 12, 12);
      const upto = Math.min(STEPS, Math.floor(t));
      ctx.setLineDash([4, 4]); ctx.strokeStyle = cssVar('--ink-3'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx(0), sy(100)); ctx.lineTo(sx(STEPS), sy(100)); ctx.stroke(); ctx.setLineDash([]);
      paths.forEach((p, k) => {
        ctx.strokeStyle = k === 0 ? cssVar('--data') : withAlpha('--data', 0.28); ctx.lineWidth = k === 0 ? 2.5 : 1.2;
        ctx.beginPath(); for (let i = 0; i <= upto; i++) i ? ctx.lineTo(sx(i), sy(p[i])) : ctx.moveTo(sx(0), sy(p[0])); ctx.stroke();
      });
      // expected value, S0 e^{mu t}
      ctx.strokeStyle = cssVar('--model'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= upto; i++) i ? ctx.lineTo(sx(i), sy(100 * Math.exp(mu * i * dt))) : ctx.moveTo(sx(0), sy(100));
      ctx.stroke();
    },
  });
  plot.canvas.setAttribute('role', 'img');
  plot.canvas.setAttribute('aria-label', 'Forty simulated stock price paths fanning out over time.');
  if (reducedMotion()) { t = STEPS; plot.draw(); return; }
  createLoop(host, (dt_) => { t += dt_ * 40; if (t > STEPS + 60) reset(); plot.draw(); }, { scaled: false }).play();
}
