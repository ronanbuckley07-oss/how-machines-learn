// Screenshot helper: node tests/shoot.mjs <tab-id> <name> [width] [fullPage]
import { chromium } from 'playwright-core';
const [tab = 'start', name = 'page', width = '1280', full = ''] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 1 });
await p.goto((process.env.URL || 'http://localhost:5173/') + '#' + tab, { waitUntil: 'networkidle' });
await p.waitForTimeout(+(process.env.WAIT || 1200));
await p.screenshot({ path: `shots/${name}.png`, fullPage: !!full });
await b.close();
