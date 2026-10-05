import puppeteer from 'puppeteer-core';
const [,, out, theme = 'day'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument((th) => localStorage.setItem('mp-theme', th), theme);
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://127.0.0.1:5173/?lang=uz&nointro', { waitUntil: 'networkidle0' });
await sleep(3500);
await page.screenshot({ path: `${out}/c-hero.png` });
await page.click('.explore-fab');
await sleep(3500);
await page.screenshot({ path: `${out}/c-explore.png` });
// click the Toshkent Korzinka cluster
const cl = await page.evaluate(() => { const l = [...document.querySelectorAll('.wp--cluster')].find((x) => x.textContent.includes('Toshkent') && +x.style.opacity > 0.4); if (!l) return null; const r = l.querySelector('.cl-badge').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
console.log('cluster', cl);
if (cl) { await page.mouse.click(cl.x, cl.y); await sleep(4000); await page.screenshot({ path: `${out}/c-cluster.png` }); }
// hover-scan for a store icon then click it
let hit = null;
for (let y = 260; y < 760 && !hit; y += 12) for (let x = 300; x < 1200 && !hit; x += 12) {
  await page.mouse.move(x, y);
  const ty = await page.evaluate(() => document.querySelector('.map-tip.is-on') ? 'y' : '');
  if (ty) hit = { x, y };
}
console.log('icon', hit, hit && await page.evaluate(() => document.querySelector('.map-tip').innerText.replace(/\n/g, ' | ')));
if (hit) { await page.mouse.click(hit.x, hit.y); await sleep(3500); await page.screenshot({ path: `${out}/c-card.png` }); console.log(await page.evaluate(() => document.querySelector('.info-card').innerText.replace(/\n/g, ' | '))); }
await browser.close();
