import { mountLlmHero } from './hero.js';
import vectors from './01-vectors/index.js';
import softmax from './02-softmax/index.js';
import attention from './03-attention/index.js';
import transformer from './04-transformer/index.js';
import training from './05-training/index.js';
import scale from './06-scale/index.js';

export default {
  id: 'llm',
  title: 'The math inside an LLM',
  sub: 'what a chatbot actually computes, one formula at a time',
  level: 'algebra helps',
  time: 'about 60 minutes',
  spine: '#1f4fd1',
  blurb: 'Tokens, vectors, softmax and attention, built up until you can follow a transformer end to end.',
  lede: `Large language models look like magic, but underneath they are a surprisingly short list of maths ideas,
    repeated billions of times. This notebook walks through each one with real numbers you can poke at: dot products,
    softmax, attention, the transformer block, and how training tunes it all.`,
  key: [
    ['--data', 'orange is input: tokens and their vectors'],
    ['--model', 'blue is what the model computes'],
    ['--error', 'red is loss: how wrong a prediction was'],
    ['--learn', 'purple is learning and attention weights'],
  ],
  hero: mountLlmHero,
  heroCaption: 'real attention weights, recomputed every frame ↑',
  chapters: [vectors, softmax, attention, transformer, training, scale],
};
