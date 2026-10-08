// Headless end-to-end check: loads the page at desktop and phone widths,
// drives each chapter's controls and asserts that the models really learn.
// Usage: npm run check   (expects `npm run dev` or `npm run preview` running, or set URL)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173/';
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const only = process.argv.slice(2);
mkdirSync('shots', { recursive: true });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: exe });

for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 375, height: 740, isMobile: true, hasTouch: true }]) {
  console.log(`\n[${vp.name} ${vp.width}px]`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 2 });
  // Run the sims at 4× so the suite stays quick (the "speed" check tests the control itself).
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('hml-sim-speed', '4'); sessionStorage.setItem('seeded', '1'); } } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `no horizontal scroll (overflow ${overflow}px)`);

  const { default: checks } = await import('./checks.mjs');
  const { default: more } = await import('./checks-notebooks.mjs');
  Object.assign(checks, more);
  for (const [name, fn] of Object.entries(checks)) {
    if (only.length && !only.includes(name)) continue;
    console.log(` ${name}`);
    await fn(page, ok, vp);
  }
  ok(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await ctx.close();
}
// Reduced motion: content is visible immediately and the hero does not animate.
if (!only.length || only.includes('motion')) {
  console.log('\n[reduced motion]');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { location.hash = 'ml/a-single-neuron'; });
  await page.locator('#a-single-neuron').waitFor();
  const anim = await page.evaluate(() => getComputedStyle(document.getElementById('a-single-neuron')).animationName);
  ok(anim === 'none', `page-turn animation is skipped (${anim})`);
  await page.evaluate(() => { location.hash = 'ml'; });
  await page.locator('#ml-cover canvas').waitFor();
  const a = await page.locator('#ml-cover canvas').screenshot();
  await page.waitForTimeout(800);
  const b = await page.locator('#ml-cover canvas').screenshot();
  ok(a.equals(b), 'hero animation is paused');
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
