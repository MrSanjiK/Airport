import puppeteer from 'puppeteer-core';
const [,, out, w = '1440', h = '900', theme = 'day'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h });
await page.evaluateOnNewDocument((th) => { try { localStorage.setItem('mp-theme', th); } catch (e) {} }, theme);
// slow the DEM download a little so the outline drawing is visible in captures
await page.setRequestInterception(true);
page.on('request', (r) => { if (r.url().includes('dem-')) setTimeout(() => r.continue(), 1400); else r.continue(); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:5173/?lang=uz', { waitUntil: 'domcontentloaded' });
const times = [1200, 2600, 4000, 5200, 6400, 7400, 8600, 11000, 13000, 15000];
for (const ms of times) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: `${out}/intro-${ms}.png` });
}
await browser.close();
