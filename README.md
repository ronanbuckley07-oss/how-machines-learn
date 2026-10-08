# Field Notes: explorable maths notebooks

A small static site of hands-on notebooks, styled like a paper field notebook.
A **hub** page lists the notebooks; each one has a cover and a set of chapter
tabs. **Nothing is pre-recorded**: every loss, gradient, prediction, path and
price is computed live in the browser, in plain JavaScript (KaTeX is used only
to typeset formulas).

| Notebook | Chapters | What really runs |
|---|---|---|
| **How machines learn** (no maths needed) | models, gradient descent, a neuron, a network, overfitting, next-word guessing | linear regression, an MLP with backprop, least-squares polynomials, a smoothed trigram model |
| **The math inside an LLM** (algebra helps) | tokens and vectors, softmax and cross-entropy, attention, a transformer block, training, sampling and scale | a byte-pair-encoding tokenizer trained on the page, live dot products, softmax gradients, attention with a causal mask, a full transformer block forward pass with every matrix shown, a tiny next-letter model trained by gradient descent, a parameter/compute calculator that reproduces GPT-2 (124M) and GPT-3 (175B) |
| **Stochastic calculus & the stock market** (calculus helps) | random walks, quadratic variation, Itô's lemma, geometric Brownian motion, Black–Scholes and delta hedging, fat tails | Brownian paths, numerical checks of (dW)² = dt and of Itô's lemma, thousands of simulated stocks, Monte Carlo option pricing against the closed form, a delta-hedging simulation, GARCH and jump models |

Links look like `#` (hub), `#llm` (a notebook's cover) and `#llm/llm-attention`
(a chapter). Old single-notebook links such as `#what-is-a-model` still work.

### The time element

Every chapter that learns has a **time machine** under it (`src/lib/timeline.js`).
While a model trains, real snapshots of its parameters are recorded along with
the error. The reader can:

- **scrub** back to any moment and see the model exactly as it was,
- **replay** the whole run,
- **rewind and resume**: press play while looking at the past and training
  continues from that moment (e.g. rewind a diverging run in chapter 2 and pick
  a smaller step size).

Chapter 5's timeline is over *data collected* rather than training steps, and
chapter 6's is over *words read*, so they show how more data changes a model.

## Run it locally

Requires Node.js 18+.

```bash
git clone https://github.com/ronanbuckley07-oss/how-machines-learn.git
cd how-machines-learn
npm install
npm run dev        # http://localhost:5173
```

Production build (static files in `dist/`):

```bash
npm run build
npm run preview    # serve the built site at http://localhost:4173
```

## Tests

```bash
npm test           # unit tests: MLP gradient check, XOR, regression, n-gram
npm run check      # end-to-end: needs `npm run dev` running in another terminal
```

`npm run check` drives every chapter of every notebook in headless Chromium at desktop (1280px)
and phone (375px) widths. It drags handles, moves sliders and presses play,
then asserts real outcomes: gradient descent reaches the exact least-squares
line, a too-large learning rate diverges, the network classifies every point,
test error rises with complexity and falls with more data, scrubbing the
timeline restores earlier models. It also checks the sim-speed control really changes how fast things run, clicks through every tab (each shows only
its own page, back button and "next up" links work), checks there's no horizontal scroll,
no console errors, that touch targets are large enough, and that
`prefers-reduced-motion` is respected. Screenshots go to `shots/`.

It uses `playwright-core` with the Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` by default; point it at
another browser with `CHROMIUM=/path/to/chrome npm run check`, or at another
server with `URL=http://localhost:4173/ npm run check`.

## Deploy (free)

The build is a folder of static files (`dist/`), so it needs no server.

### Netlify (recommended)

`netlify.toml` already holds the settings, so there is nothing to type in:

1. Sign in at <https://app.netlify.com> (free) and choose **Add new site → Import an existing project**.
2. Pick **GitHub**, then this repository.
3. Netlify fills in build command `npm run build` and publish directory `dist` from `netlify.toml`. Click **Deploy**.

You get a URL like `https://<random-name>.netlify.app` (rename it under **Site configuration → Change site name**).
Every push to `main` redeploys automatically.

**Even quicker, no Git needed:** run `npm run build`, then drag the `dist` folder onto <https://app.netlify.com/drop>.

### Render

`render.yaml` defines a free static site: in Render choose **New → Blueprint** and pick this repository.
Static sites on Render don't sleep, unlike the free Node web services.

## Project structure

```
how-machines-learn/
  index.html               page shell, hero, colour key
  src/
    main.js                hub, notebook covers, tabs and hash routing; builds each page the first time it's opened
    hub.js                 the home page (a desk of notebooks)
    courses/               one module per notebook: ml.js, llm/, sde/ (each chapter in its own folder)
    hero.js                the cover's polaroid: a small network fitting drifting data, live
    styles/                tokens.css (colours, type), base.css, controls.css
    lib/
      timeline.js          the shared training timeline (record / scrub / replay / rewind)
      loop.js              requestAnimationFrame loop; pauses off-screen and in hidden tabs
      canvas.js            HiDPI canvas, scales, pointer dragging
      ui.js                sliders, buttons, segmented controls, readouts
      speed.js             the page-wide sim speed (corner control)
      math.js              KaTeX helpers: renderMath(), tex(), setTex()
      stats.js             mean/std, normal pdf and cdf, softmax, histograms
      rng.js, motion.js    seeded randomness, prefers-reduced-motion
    ml/                    the machine learning, no dependencies
      linear.js            linear regression + gradient descent
      mlp.js               neural network: forward pass, backprop, momentum SGD
      datasets.js          circles, four corners (XOR), spirals
      poly.js              polynomial least squares (Chebyshev features)
      ngram.js, fables.js  trigram next-word model and its training text
      bpe.js               byte-pair-encoding tokenizer
      charmodel.js         tiny next-character model (embeddings + softmax), trained by gradient descent
      sde.js               Brownian motion, geometric Brownian motion, Black–Scholes
    chapters/NN-name/      one folder per chapter: index.js + chapter.css
  tests/                   unit tests (node:test) and the Playwright end-to-end check
```

### Adding a notebook

A notebook is a module under `src/courses/` that exports
`{ id, title, sub, level, time, spine, blurb, lede, key, hero, heroCaption, chapters }`
(see `src/courses/llm/index.js`). Add it to the `courses` array in `src/main.js`
and it appears on the hub with its own cover and tabs. `hero(element)` draws the
cover picture; `spine` is the notebook's cover colour.

Write formulas in chapter text as `\\( inline \\)` or `\\[ display \\]`; they're
typeset with KaTeX after the chapter mounts (`src/lib/math.js` also has `tex()` and
`setTex()` for live formulas). Chapters that have nothing animated set `sims: false`
so the speed control stays hidden.

### Adding or reordering chapters

Each chapter exports `{ id, title, tab, blurb, mount(element) }` (and optionally
`kicker`). `tab` is the short label on its notebook tab, `blurb` its line in the
cover's contents list, and `id` becomes its link (`/#what-is-a-model`). Add a
folder under `src/chapters/`, then add it to the `chapters` array in
`src/main.js`. The order of that array is the order of the tabs, and chapter
numbers are assigned automatically. Pages are built the first time their tab is
opened and then kept, so experiments survive switching tabs; training loops
pause while their tab is hidden.

To give a new chapter a timeline:

```js
const tl = createTimeline(lab, {
  onScrubStart: () => loop.pause(),
  onView: (state) => { /* show the model as it was */ },
});
tl.record(step, { loss }, model.getState());   // inside the training loop
const past = tl.rewindHere();                   // on play: resume from the past if scrubbed back
```

## Design notes

- **Look:** a paper field notebook. Cream graph paper, ink-outlined panels with a
  hard offset shadow, Young Serif headings, Atkinson Hyperlegible body text,
  Caveat for handwritten margin notes and chart labels, IBM Plex Mono for
  numbers. Charts are flat ink, no glows.
- **Colour language** (in `src/styles/tokens.css`), the same in every chapter:
  orange = data, blue = the model, red = error, purple = learning / the next
  step. Positive weights are blue, negative weights red. The two groups in
  chapter 4 use colour *and* shape (orange circles vs. green triangles). The
  palette was checked for colour-blind separation and contrast on the paper colour.
- **Tabs:** one notebook tab per chapter plus a cover. Each tab has its own URL,
  so links, bookmarks and the back button work; arrow keys move between tabs.
- **Sim speed:** a small control in the bottom-right corner (shown on chapters
  with a simulation) sets how fast every simulation runs: ¼×, ½×, 1×, 2× or 4×.
  The choice is remembered in the browser. Base rates live at the top of each
  chapter (e.g. `STEPS_PER_SEC`) and are multiplied by that speed in
  `src/lib/loop.js`, so a chapter runs at the same pace at any frame rate.
- Training loops do a little work per animation frame and pause when their
  chapter is hidden or off screen, so the page never freezes.
- With `prefers-reduced-motion`, page-turn animations and the cover animation
  are off; nothing auto-plays, and replays jump instead of animating.

## Credits

The chapter 6 text retells ten of Aesop's fables (public-domain stories) in new,
plain wording written for this project. Fonts: Fraunces, Inter and JetBrains
Mono via Google Fonts.
