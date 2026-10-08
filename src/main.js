import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import { h } from './lib/ui.js';
import { reducedMotion } from './lib/motion.js';
import { renderMath } from './lib/math.js';
import { SPEEDS, getSpeed, setSpeed, onSpeedChange, speedLabel } from './lib/speed.js';
import { mountHub } from './hub.js';

import ml from './courses/ml.js';
import llm from './courses/llm/index.js';
import sde from './courses/sde/index.js';

/**
 * Notebooks ("courses") on the hub. Each has a cover and chapters; each chapter
 * exports { id, title, tab, blurb, mount(el) } and optionally kicker / sims:false.
 * Routes: #  (hub)   #ml  (a notebook's cover)   #ml/what-is-a-model  (a chapter)
 */
const courses = [ml, llm, sde];
const byId = new Map(courses.map((c) => [c.id, c]));

const tablist = document.querySelector('.tabs');
const courseLabel = document.querySelector('.masthead__course');
const pagesEl = document.getElementById('pages');
const pages = new Map();       // section id -> { el, title }

// ---------- page builders (each page is built the first time it's opened, then kept) ----------
function hubPage() {
  const el = h('section', { class: 'page hub', id: 'hub', tabindex: '-1' });
  pagesEl.append(el);
  mountHub(el, courses);
  return { el, title: 'Field Notes' };
}

function coverPage(course) {
  const list = h('ol', {}, course.chapters.map((ch, i) => h('li', {}, h('a', { href: `#${course.id}/${ch.id}` },
    h('span', { class: 'n' }, ch.kicker ? '✳' : String(i + 1)), h('span', { class: 't' }, ch.title),
    h('span', { class: 'dots', 'aria-hidden': 'true' }), h('span', { class: 'd' }, ch.blurb)))));
  const heroHost = h('div', { class: 'polaroid__frame' });
  const el = h('section', { class: 'page', id: `${course.id}-cover`, role: 'tabpanel', 'aria-labelledby': `tab-${course.id}-cover`, tabindex: '-1' },
    h('div', { class: 'cover' },
      h('div', {},
        h('h1', { html: `${course.title}<svg class="squiggle" viewBox="0 0 420 22" aria-hidden="true"><path d="M3 14 C 40 4, 70 20, 110 11 S 180 4, 220 13 S 300 20, 340 9 S 400 8, 417 12" fill="none" stroke="${course.spine}" stroke-width="4" stroke-linecap="round"/></svg>` }),
        h('p', { class: 'cover__sub' }, course.sub),
        h('p', { class: 'cover__lede', html: course.lede }),
        course.key ? h('ul', { class: 'key', 'aria-label': 'Colour key used in this notebook' },
          course.key.map(([c, t]) => h('li', {}, h('i', { style: `background:var(${c})` }), t))) : null,
        h('a', { class: 'btn btn--primary', href: `#${course.id}/${course.chapters[0].id}` }, 'Start with chapter 1 →')),
      h('figure', { class: 'polaroid' }, heroHost, h('figcaption', {}, course.heroCaption))),
    h('div', { class: 'contents' }, h('h2', {}, "What's inside"), list));
  pagesEl.append(el);
  course.hero(heroHost);
  renderMath(el);
  return { el, title: course.title };
}

function chapterPage(course, i) {
  const ch = course.chapters[i];
  const body = h('div', { class: 'chapter__body' });
  const el = h('section', { class: 'page chapter', id: ch.id, role: 'tabpanel', 'aria-labelledby': `tab-${ch.id}`, tabindex: '-1' },
    h('div', { class: 'chapter__num' }, ch.kicker ?? `chapter ${i + 1}`),
    h('h2', {}, ch.title),
    body);
  pagesEl.append(el);
  ch.mount(body);        // mounted while visible so canvases can measure themselves
  renderMath(el);
  const prev = i === 0 ? { href: `#${course.id}`, title: 'Cover' } : { href: `#${course.id}/${course.chapters[i - 1].id}`, title: course.chapters[i - 1].title };
  const next = course.chapters[i + 1];
  el.append(h('nav', { class: 'pager', 'aria-label': 'Chapter navigation' },
    h('a', { class: 'prev', href: prev.href }, h('small', {}, '← back'), h('span', {}, prev.title)),
    next ? h('a', { class: 'next', href: `#${course.id}/${next.id}` }, h('small', {}, 'next up →'), h('span', {}, next.title))
      : h('a', { class: 'next', href: '#' }, h('small', {}, 'all done →'), h('span', {}, 'Back to the notebooks'))));
  return { el, title: ch.title };
}

// ---------- tabs for the open notebook ----------
let tabCourse = null;
const tabs = new Map();
function renderTabs(course) {
  if (tabCourse === course) return;
  tabCourse = course;
  tablist.replaceChildren();
  tabs.clear();
  courseLabel.hidden = !course;
  if (!course) return;
  courseLabel.textContent = course.title;
  const add = (pageId, href, num, label) => {
    const t = h('a', { class: 'tab', role: 'tab', id: `tab-${pageId}`, href, 'aria-controls': pageId, 'aria-selected': 'false', tabindex: '-1' },
      num != null ? h('span', { class: 'tab__num', 'aria-hidden': 'true' }, num) : null, label);
    tablist.append(t);
    tabs.set(pageId, t);
  };
  add(`${course.id}-cover`, `#${course.id}`, null, 'Cover');
  course.chapters.forEach((ch, i) => add(ch.id, `#${course.id}/${ch.id}`, ch.kicker ? null : String(i + 1), ch.tab));
}

// Arrow keys move between tabs (standard tablist behaviour).
tablist.addEventListener('keydown', (e) => {
  const list = [...tabs.values()];
  const i = list.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
  if (next == null) return;
  e.preventDefault();
  const t = list[(next + list.length) % list.length];
  location.hash = t.getAttribute('href');
  t.focus();
});

// ---------- sim speed control (bottom-right corner) ----------
const speedBox = (() => {
  const value = h('output', { class: 'speed__value', 'aria-live': 'polite' });
  const step = (dir) => setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(getSpeed()) + dir))]);
  const slower = h('button', { type: 'button', class: 'speed__btn', 'aria-label': 'Slower', onClick: () => step(-1) }, '−');
  const faster = h('button', { type: 'button', class: 'speed__btn', 'aria-label': 'Faster', onClick: () => step(1) }, '+');
  const box = h('div', { class: 'speed', role: 'group', 'aria-label': 'Simulation speed' },
    h('span', { class: 'speed__label' }, 'sim speed'), slower, value, faster);
  const paint = () => {
    const v = getSpeed();
    value.textContent = speedLabel(v);
    slower.disabled = v === SPEEDS[0];
    faster.disabled = v === SPEEDS[SPEEDS.length - 1];
  };
  onSpeedChange(paint);
  paint();
  document.body.append(box);
  return box;
})();

// ---------- routing ----------
function parse() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (!raw) return { course: null };
  // Old single-notebook links (#start, #what-is-a-model) still work.
  if (raw === 'start') return { redirect: '#ml' };
  const [cid, chid] = raw.split('/');
  if (!byId.has(cid)) {
    for (const c of courses) if (c.chapters.some((ch) => ch.id === raw)) return { redirect: `#${c.id}/${raw}` };
    return { course: null };
  }
  const course = byId.get(cid);
  const i = chid ? course.chapters.findIndex((ch) => ch.id === chid) : -1;
  return { course, index: i };
}

let current = null;
function route() {
  const r = parse();
  if (r.redirect) { history.replaceState(null, '', r.redirect); return route(); }
  const { course, index } = r;
  const id = !course ? 'hub' : index < 0 ? `${course.id}-cover` : course.chapters[index].id;
  if (id === current) return;
  const first = current == null;
  current = id;
  renderTabs(course || null);
  if (!pages.has(id)) pages.set(id, !course ? hubPage() : index < 0 ? coverPage(course) : chapterPage(course, index));
  for (const [pid, p] of pages) p.el.hidden = pid !== id;
  const page = pages.get(id);
  if (!reducedMotion()) { page.el.classList.remove('page-in'); void page.el.offsetWidth; page.el.classList.add('page-in'); }
  for (const [tid, t] of tabs) {
    const on = tid === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  tabs.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  speedBox.hidden = !course || index < 0 || course.chapters[index].sims === false;
  document.body.dataset.course = course ? course.id : 'hub';
  document.title = !course ? 'Field Notes' : index < 0 ? `${course.title} · Field Notes` : `${page.title} · ${course.title}`;
  // Always open a page at its top (the browser would otherwise jump to the #id under the sticky tab bar).
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  if (!first) page.el.focus({ preventScroll: true });
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('hashchange', route);
route();
