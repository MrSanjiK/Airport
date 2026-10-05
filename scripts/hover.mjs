import puppeteer from 'puppeteer-core';
const [,, out] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => localStorage.setItem('mp-theme', 'day'));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:5173/?lang=uz&nointro', { waitUntil: 'networkidle0' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(3500);
const tas = await page.evaluate(() => { const l = document.querySelector('.wp--tas'); const r = l.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y - 8 }; });
await page.mouse.move(tas.x - 60, tas.y - 40);
await page.mouse.move(tas.x, tas.y, { steps: 6 });
await sleep(700);
console.log('TAS tip:', await page.evaluate(() => document.querySelector('.map-tip.is-on')?.innerText.replace(/\n/g, ' | ') || 'none'));
await page.screenshot({ path: `${out}/hv-tas.png` });
// HoReCa chapter: find a restaurant dot by scanning
await page.evaluate(() => { const el = document.getElementById('horeca'); scrollTo(0, el.getBoundingClientRect().top + scrollY + innerHeight * 0.42); });
await sleep(4000);
let found = null;
for (let y = 300; y < 760 && !found; y += 10) for (let x = 760; x < 1300 && !found; x += 10) {
  await page.mouse.move(x, y);
  const t = await page.evaluate(() => document.querySelector('.map-tip.is-on')?.dataset.type);
  if (t === 'horeca') found = { x, y };
}
console.log('horeca dot:', found, await page.evaluate(() => document.querySelector('.map-tip.is-on')?.innerText.replace(/\n/g, ' | ') || 'none'));
await sleep(400);
await page.screenshot({ path: `${out}/hv-horeca.png` });
if (found) { await page.mouse.down(); await page.mouse.up(); await sleep(3000); await page.screenshot({ path: `${out}/hv-fly.png` }); console.log('explore after click:', await page.evaluate(() => document.documentElement.classList.contains('is-explore'))); }
await browser.close();
