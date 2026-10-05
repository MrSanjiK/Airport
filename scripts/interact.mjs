import puppeteer from 'puppeteer-core';
const [,, out] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:5173/?lang=uz&nointro', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3500));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// airport chapter + zone marker
await page.evaluate(() => { const el = document.getElementById('airport'); scrollTo(0, el.getBoundingClientRect().top + scrollY + innerHeight * 0.42); });
await sleep(3500);
const z = await page.evaluate(() => { const l = [...document.querySelectorAll('.wp--zone')].find((x) => +x.style.opacity > 0.5); if (!l) return null; const r = l.querySelector('.wp-dot').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
console.log('zone marker', z);
if (z) { await page.mouse.move(z.x, z.y); await sleep(600); }
await page.screenshot({ path: `${out}/i-airport.png` });
// back to hero and hover Samarqand
await page.evaluate(() => scrollTo(0, 0));
await sleep(3500);
const sam = await page.evaluate(() => { const l = [...document.querySelectorAll('.wp')].find((x) => x.textContent.includes('Samarqand') && +x.style.opacity > 0.4); if (!l) return null; const r = l.querySelector('.wp-tri').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height - 2 }; });
console.log('samarqand', sam);
if (sam) { await page.mouse.move(sam.x - 40, sam.y); await page.mouse.move(sam.x, sam.y + 10, { steps: 4 }); await sleep(700); }
console.log('tip on', await page.evaluate(() => document.querySelector('.map-tip').classList.contains('is-on'), ));
await page.screenshot({ path: `${out}/i-hover.png` });
// explore mode: click fab, drag, wheel
await page.click('.explore-fab');
await sleep(800);
await page.mouse.move(700, 600); await page.mouse.down(); await page.mouse.move(520, 560, { steps: 12 }); await page.mouse.up();
await page.mouse.move(720, 500);
for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(60); }
await sleep(2200);
await page.screenshot({ path: `${out}/i-explore.png` });
console.log('explore', await page.evaluate(() => document.documentElement.classList.contains('is-explore')));
// click a korzinka/horeca dot nearest the centre by scanning for a tooltip
let hit = null;
for (let y = 380; y < 620 && !hit; y += 14) for (let x = 560; x < 900 && !hit; x += 14) {
  await page.mouse.move(x, y);
  if (await page.evaluate(() => document.querySelector('.map-tip').classList.contains('is-on'))) hit = { x, y };
}
console.log('dot hover', hit, hit && await page.evaluate(() => document.querySelector('.map-tip').innerText.replace(/\n/g, ' | ')));
if (hit) { await page.screenshot({ path: `${out}/i-dot.png` }); await page.mouse.down(); await page.mouse.up(); await sleep(2500); await page.screenshot({ path: `${out}/i-fly.png` }); }
await page.keyboard.press('Escape');
await sleep(1200);
console.log('after esc', await page.evaluate(() => document.documentElement.classList.contains('is-explore')));
await browser.close();
