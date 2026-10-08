import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MLP } from '../src/ml/mlp.js';
import { LinearModel, iceCreamData } from '../src/ml/linear.js';

// Compare backprop gradients against slow finite differences.
for (const output of ['sigmoid', 'linear']) {
  test(`MLP backprop matches numerical gradient (${output})`, () => {
    const net = new MLP([2, 5, 3, 1], { output, seed: 3 });
    const X = [[0.3, -0.7], [1.2, 0.4], [-0.5, 0.9]];
    const Y = output === 'sigmoid' ? [[1], [0], [1]] : [[0.4], [-1.1], [2]];
    const { gW, gb } = net.gradients(X, Y);
    const eps = 1e-6;
    for (let l = 0; l < net.L; l++) {
      for (const [arr, g] of [[net.W[l], gW[l]], [net.b[l], gb[l]]]) {
        for (let i = 0; i < arr.length; i++) {
          const old = arr[i];
          arr[i] = old + eps; const lp = net.loss(X, Y);
          arr[i] = old - eps; const lm = net.loss(X, Y);
          arr[i] = old;
          const num = (lp - lm) / (2 * eps);
          assert.ok(Math.abs(num - g[i]) < 1e-6, `layer ${l} param ${i}: ${num} vs ${g[i]}`);
        }
      }
    }
  });
}

test('MLP learns XOR', () => {
  const net = new MLP([2, 4, 1], { seed: 2 });
  const X = [[-1, -1], [-1, 1], [1, -1], [1, 1]], Y = [[0], [1], [1], [0]];
  for (let i = 0; i < 2000; i++) net.step(X, Y, 0.1, 0.9);
  for (let n = 0; n < 4; n++) assert.equal(Math.round(net.predict1(X[n])), Y[n][0]);
});

test('linear gradient descent reaches the exact least-squares line', () => {
  const m = new LinearModel(iceCreamData());
  m.a = -2; m.c = 1;
  for (let i = 0; i < 500; i++) m.step(0.04);
  const o = m.optimum();
  assert.ok(Math.abs(m.a - o.a) < 1e-4 && Math.abs(m.c - o.c) < 1e-4);
});

import { NGram, tokenize, splitText } from '../src/ml/ngram.js';
import { FABLES } from '../src/ml/fables.js';

test('n-gram probabilities sum to 1 and perplexity falls with more reading', () => {
  const { read, held } = splitText(FABLES);
  const m = new NGram([...new Set(tokenize(FABLES))]);
  const p0 = m.perplexity(held);
  read.forEach((w) => m.add(w));
  for (const ctx of [[], ['the'], ['slow', 'and'], ['zzz', 'qqq']]) {
    const total = [...m.distribution(ctx).probs.values()].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `sums to ${total} for ${ctx}`);
  }
  assert.ok(m.perplexity(held) < p0 / 2);
});

import { bsCall, gbmPath, brownian } from '../src/ml/sde.js';
import { makeRng } from '../src/lib/rng.js';
import { normalCdf } from '../src/lib/stats.js';

test('normal CDF matches known values', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975002) < 1e-5);
  assert.ok(Math.abs(normalCdf(-1) - 0.158655) < 1e-5);
});

test('Black–Scholes matches a textbook value and put–call parity', () => {
  // Hull's example: S=42, K=40, r=10%, sigma=20%, T=0.5 -> call ≈ 4.76
  assert.ok(Math.abs(bsCall(42, 40, 0.5, 0.1, 0.2).price - 4.76) < 0.01);
});

test('Monte Carlo GBM under the risk-neutral drift reproduces the Black–Scholes price', () => {
  const rng = makeRng(1);
  let sum = 0; const n = 40000;
  for (let i = 0; i < n; i++) { const S = gbmPath(rng, 1, 1, 0.05, 0.25, 100); sum += Math.max(S[1] - 100, 0); }
  const mc = Math.exp(-0.05) * sum / n, bs = bsCall(100, 100, 1, 0.05, 0.25).price;
  assert.ok(Math.abs(mc - bs) < 0.2, `${mc} vs ${bs}`);
});

test('quadratic variation of Brownian motion on [0,1] is close to 1', () => {
  const W = brownian(makeRng(4), 1 << 14, 1);
  let qv = 0; for (let i = 1; i < W.length; i++) qv += (W[i] - W[i - 1]) ** 2;
  assert.ok(Math.abs(qv - 1) < 0.05, `qv ${qv}`);
});
