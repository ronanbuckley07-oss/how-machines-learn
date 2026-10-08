# How Machines Learn — an explorable explanation

A small tabbed site, styled like a paper field notebook, that teaches how
machine learning works to people with no technical background. Readers learn by dragging, sliding and watching real
models train. **Nothing is pre-recorded**: every loss, gradient, prediction and
training run is computed live in the browser, in plain JavaScript.

| # | Chapter | What the reader does | What really runs |
|---|---------|----------------------|------------------|
| 1 | What is a model? | Drags a line through ice-cream sales data, then lets the computer try | Linear regression, gradient descent on mean squared error |
| 2 | Learning by getting less wrong | Rolls a ball down the error curve with a step-size slider | Exact 1D slice of the loss; gradient descent that really diverges when the step is too big |
| 3 | A single neuron | Drives weights, bias and activation; tries to solve two puzzles | One sigmoid neuron trained by gradient descent (it provably can't solve XOR) |
| 4 | A neural network | Trains a network on circles / corners / spirals, changes its size | Multi-layer perceptron with backpropagation + momentum |
| 5 | Memorizing vs. learning | Raises model complexity until it overfits, then collects more data | Exact least-squares polynomial fits (Chebyshev basis) with a held-out test set |
| 6 | How chatbots guess the next word | Types words, sees next-word probabilities, samples text | Trigram model with Witten–Bell smoothing, trained on ten retold Aesop fables |
| 7 | Epilogue | Glossary, what was simplified, further reading | — |

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

`npm run check` drives every chapter in headless Chromium at desktop (1280px)
and phone (375px) widths. It drags handles, moves sliders and presses play,
then asserts real outcomes: gradient descent reaches the exact least-squares
line, a too-large learning rate diverges, the network classifies every point,
test error rises with complexity and falls with more data, scrubbing the
timeline restores earlier models. It also clicks through every tab (each shows only
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
    main.js                tabs + hash routing; builds each chapter the first time it's opened
    hero.js                the cover's polaroid: a small network fitting drifting data, live
    styles/                tokens.css (colours, type), base.css, controls.css
    lib/
      timeline.js          the shared training timeline (record / scrub / replay / rewind)
      loop.js              requestAnimationFrame loop; pauses off-screen and in hidden tabs
      canvas.js            HiDPI canvas, scales, pointer dragging
      ui.js                sliders, buttons, segmented controls, readouts
      rng.js, motion.js    seeded randomness, prefers-reduced-motion
    ml/                    the machine learning, no dependencies
      linear.js            linear regression + gradient descent
      mlp.js               neural network: forward pass, backprop, momentum SGD
      datasets.js          circles, four corners (XOR), spirals
      poly.js              polynomial least squares (Chebyshev features)
      ngram.js, fables.js  trigram next-word model and its training text
    chapters/NN-name/      one folder per chapter: index.js + chapter.css
  tests/                   unit tests (node:test) and the Playwright end-to-end check
```

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
- Training loops do a little work per animation frame and pause when their
  chapter is hidden or off screen, so the page never freezes.
- With `prefers-reduced-motion`, page-turn animations and the cover animation
  are off; nothing auto-plays, and replays jump instead of animating.

## Credits

The chapter 6 text retells ten of Aesop's fables (public-domain stories) in new,
plain wording written for this project. Fonts: Fraunces, Inter and JetBrains
Mono via Google Fonts.
