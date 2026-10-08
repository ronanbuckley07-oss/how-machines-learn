import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import { h } from './lib/ui.js';
import { mountHero } from './hero.js';
import { reducedMotion } from './lib/motion.js';

import ch1 from './chapters/01-model/index.js';
import ch2 from './chapters/02-descent/index.js';
import ch3 from './chapters/03-neuron/index.js';
import ch4 from './chapters/04-network/index.js';
import ch5 from './chapters/05-overfitting/index.js';
import ch6 from './chapters/06-next-word/index.js';
import ch7 from './chapters/07-closing/index.js';

// Reorder or add chapters here. Each exports { id, title, tab, blurb, mount(el) }.
const chapters = [ch1, ch2, ch3, ch4, ch5, ch6, ch7];

const tablist = document.querySelector('.tabs');
const pagesEl = document.getElementById('pages');
const cover = document.getElementById('start');
const pages = new Map([['start', { el: cover, mounted: true, title: 'Cover' }]]);
const order = ['start', ...chapters.map((c) => c.id)];

// ---- tabs ----
const tabs = new Map();
function addTab(id, num, label) {
  const t = h('a', { class: 'tab', role: 'tab', id: `tab-${id}`, href: `#${id}`, 'aria-controls': id, 'aria-selected': 'false', tabindex: '-1' },
    num != null ? h('span', { class: 'tab__num', 'aria-hidden': 'true' }, num) : null, label);
  tablist.append(t);
  tabs.set(id, t);
}
addTab('start', null, 'Cover');
chapters.forEach((ch, i) => addTab(ch.id, ch.kicker ? null : String(i + 1), ch.tab));

// Arrow keys move between tabs (standard tablist behaviour).
tablist.addEventListener('keydown', (e) => {
  const i = order.indexOf(current);
  const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : null;
  if (next == null) return;
  e.preventDefault();
  const id = order[(next + order.length) % order.length];
  location.hash = id;
  tabs.get(id).focus();
});

// ---- table of contents on the cover ----
const list = document.getElementById('contents-list');
chapters.forEach((ch, i) => list.append(h('li', {}, h('a', { href: `#${ch.id}` },
  h('span', { class: 'n' }, ch.kicker ? '✳' : String(i + 1)), h('span', { class: 't' }, ch.title),
  h('span', { class: 'dots', 'aria-hidden': 'true' }), h('span', { class: 'd' }, ch.blurb)))));

// ---- pages are built the first time they're opened, then kept (so experiments survive tab switches) ----
function ensurePage(id) {
  if (pages.has(id)) return pages.get(id);
  const i = chapters.findIndex((c) => c.id === id);
  const ch = chapters[i];
  const body = h('div', { class: 'chapter__body' });
  const el = h('section', { class: 'page chapter', id, role: 'tabpanel', 'aria-labelledby': `tab-${id}`, tabindex: '-1', hidden: true },
    h('div', { class: 'chapter__num' }, ch.kicker ?? `chapter ${i + 1}`),
    h('h2', {}, ch.title),
    body);
  pagesEl.append(el);
  const page = { el, title: ch.title };
  pages.set(id, page);
  el.hidden = false;           // mount while visible so canvases can measure themselves
  ch.mount(body);
  el.append(pager(i));
  return page;
}

function pager(i) {
  const prevId = order[i], nextCh = chapters[i + 1];
  const prevTitle = i === 0 ? 'Cover' : chapters[i - 1].title;
  return h('nav', { class: 'pager', 'aria-label': 'Chapter navigation' },
    h('a', { class: 'prev', href: `#${prevId}` }, h('small', {}, '← back'), h('span', {}, prevTitle)),
    nextCh ? h('a', { class: 'next', href: `#${nextCh.id}` }, h('small', {}, 'next up →'), h('span', {}, nextCh.title)) : null);
}

let current = null;
function route() {
  let id = decodeURIComponent(location.hash.slice(1)) || 'start';
  if (!order.includes(id)) id = 'start';
  if (id === current) return;
  const first = current == null;
  current = id;
  for (const [pid, p] of pages) if (pid !== id) p.el.hidden = true;
  const page = ensurePage(id);
  page.el.hidden = false;
  if (!reducedMotion()) { page.el.classList.remove('page-in'); void page.el.offsetWidth; page.el.classList.add('page-in'); }
  for (const [tid, t] of tabs) {
    const on = tid === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  tabs.get(id).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  document.title = id === 'start' ? 'How Machines Learn' : `${page.title} · How Machines Learn`;
  if (!first) { window.scrollTo(0, 0); page.el.focus({ preventScroll: true }); }
}
window.addEventListener('hashchange', route);
route();

mountHero(document.getElementById('hero-plot'));
