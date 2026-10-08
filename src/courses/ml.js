import { mountHero } from '../hero.js';
import ch1 from '../chapters/01-model/index.js';
import ch2 from '../chapters/02-descent/index.js';
import ch3 from '../chapters/03-neuron/index.js';
import ch4 from '../chapters/04-network/index.js';
import ch5 from '../chapters/05-overfitting/index.js';
import ch6 from '../chapters/06-next-word/index.js';
import ch7 from '../chapters/07-closing/index.js';

export default {
  id: 'ml',
  title: 'How machines learn',
  sub: 'a hands-on guide for curious humans',
  level: 'no maths needed',
  time: 'about 40 minutes',
  spine: '#d63a2a',
  blurb: 'Fit lines with your fingers, roll a ball downhill and teach a tiny network to untangle spirals.',
  lede: `No equations to memorise. You'll fit lines with your fingers, roll a ball downhill, wire up a neuron
    and teach a tiny network to tell spirals apart. Everything you see is a real model learning, live, right here in your browser.`,
  key: [
    ['--data', 'orange is data: what we actually saw'],
    ['--model', 'blue is the model: its best guess'],
    ['--error', 'red is error: how wrong the guess is'],
    ['--learn', 'purple is learning: the next nudge'],
  ],
  hero: mountHero,
  heroCaption: 'a real neural net, learning right now ↑',
  chapters: [ch1, ch2, ch3, ch4, ch5, ch6, ch7],
};
