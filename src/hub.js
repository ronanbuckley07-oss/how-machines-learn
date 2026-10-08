import { h, note } from './lib/ui.js';

/** The home page: a desk of notebooks, one per course. */
export function mountHub(el, courses) {
  el.append(
    h('div', { class: 'hub__head' },
      h('h1', {}, 'Field notes'),
      h('p', { class: 'cover__sub' }, 'explorable notebooks on the maths behind modern technology'),
      h('p', { class: 'cover__lede' },
        'Each notebook is a set of short chapters you can poke at. Every chart, model and simulation is computed for real, live in your browser, so you can break things and watch what happens.')),
    note('pick a notebook to open it'),
    h('div', { class: 'desk' }, courses.map((c, i) =>
      h('a', { class: 'notebook', href: `#${c.id}`, style: `--spine:${c.spine}; --tilt:${[-1.5, 1, -0.5][i % 3]}deg` },
        h('span', { class: 'notebook__label' },
          h('span', { class: 'notebook__title' }, c.title),
          h('span', { class: 'notebook__sub' }, c.sub)),
        h('span', { class: 'notebook__doodle', html: DOODLES[c.id] || '', 'aria-hidden': 'true' }),
        h('span', { class: 'notebook__meta' },
          h('span', {}, `${c.chapters.length} chapters`), h('span', {}, c.level), h('span', {}, c.time)),
        h('span', { class: 'notebook__blurb' }, c.blurb)))),
  );
}

// Small hand-drawn sketches for each notebook cover.
const DOODLES = {
  ml: `<svg viewBox="0 0 120 70"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <path d="M8 58 C 40 50, 70 30, 112 10"/></g><g fill="currentColor">
    <circle cx="18" cy="50" r="4"/><circle cx="34" cy="56" r="4"/><circle cx="50" cy="40" r="4"/><circle cx="66" cy="38" r="4"/>
    <circle cx="80" cy="22" r="4"/><circle cx="98" cy="20" r="4"/></g></svg>`,
  llm: `<svg viewBox="0 0 120 70"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M14 50 Q 37 10, 60 50"/><path d="M14 50 Q 60 -8, 106 50"/><path d="M60 50 Q 83 22, 106 50" stroke-width="4"/></g>
    <g fill="currentColor"><rect x="6" y="52" width="16" height="10" rx="2"/><rect x="52" y="52" width="16" height="10" rx="2"/><rect x="98" y="52" width="16" height="10" rx="2"/></g></svg>`,
  sde: `<svg viewBox="0 0 120 70"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M6 40 L12 36 L16 42 L22 33 L27 37 L33 28 L37 34 L44 26 L48 31 L55 22 L60 30 L66 25 L71 33 L77 20 L82 27 L88 16 L93 22 L100 12 L105 19 L114 8"/>
    <path d="M6 40 L13 44 L18 41 L24 50 L30 46 L36 55 L42 49 L49 57 L55 52 L62 60 L69 54 L76 62 L84 56 L92 63 L100 58 L114 64" opacity=".55"/></g></svg>`,
};
