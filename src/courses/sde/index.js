import { mountSdeHero } from './hero.js';
import walk from './01-walk/index.js';
import variation from './02-variation/index.js';
import ito from './03-ito/index.js';
import gbm from './04-gbm/index.js';
import options from './05-options/index.js';
import reality from './06-reality/index.js';

export default {
  id: 'sde',
  title: 'Stochastic calculus & the stock market',
  sub: 'the maths of randomness, and how it prices risk',
  level: 'calculus helps',
  time: 'about 60 minutes',
  spine: '#2a7a4b',
  blurb: 'Random walks, Brownian motion, Itô\'s lemma and Black–Scholes, simulated live on thousands of fake stocks.',
  lede: `Ordinary calculus breaks when things jiggle randomly. Stochastic calculus fixes it, and in doing so explains why
    volatility drags returns down and how options are priced. Every chart here is a fresh simulation, checked against the theory as you watch.`,
  key: [
    ['--data', 'orange is simulation: random paths'],
    ['--model', 'blue is theory: what the formulas predict'],
    ['--error', 'red is the gap, risk or loss'],
    ['--learn', 'purple marks time and the next random kick'],
  ],
  hero: mountSdeHero,
  heroCaption: '40 simulated stocks, with the average path in blue ↑',
  chapters: [walk, variation, ito, gbm, options, reality],
};
