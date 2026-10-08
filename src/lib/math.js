import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

/** Typeset every \( inline \) and \[ display \] formula inside an element. */
export function renderMath(el) {
  renderMathInElement(el, {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
  });
}

/** A single formula as an element, e.g. tex('e^{x}') or tex('\\sum_i x_i', true). */
export function tex(src, display = false) {
  const el = document.createElement(display ? 'div' : 'span');
  katex.render(src, el, { displayMode: display, throwOnError: false });
  return el;
}

/** Re-render a formula into an existing element (cheap enough to call on every slider move). */
export function setTex(el, src, display = false) {
  katex.render(src, el, { displayMode: display, throwOnError: false });
}
