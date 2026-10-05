// Captures the interactive pieces: mini card, regions city pick, lightbox, airport callout pick, theme switch, footer.
import puppeteer from 'puppeteer-core';
const [,, out = '.impeccable/review', theme = 'day'] = process.argv;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.evaluateOnNewDocument((th) => localStorage.setItem('mp-theme', th), theme);
p.on('pageerror', (e) => console.log('pageerror:', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto('http://127.0.0.1:5173/?lang=uz&nointro', { waitUntil: 'networkidle0' });
await sleep(3000);
const scrollToId = async (id, extra = 0.42) => { await p.evaluate((id, extra) => { const el = document.getElementById(id); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + innerHeight * extra); }, id, extra); await sleep(3500); };
// airport: click a callout
await scrollToId('airport');
await p.evaluate(() => document.querySelector('.callout[data-zone="dep1"]')?.click());
await sleep(2600);
await p.screenshot({ path: `${out}/x-airport-pick.png` });
// mini card on a readout row
await p.evaluate(() => { const el = document.querySelector('[data-mini="aFlights"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.45); });
await sleep(1600);
await p.evaluate(() => document.querySelector('[data-mini="aFlights"]')?.click());
await sleep(700);
await p.screenshot({ path: `${out}/x-mini.png` });
await p.keyboard.press('Escape');
// regions: pick Fergana
await scrollToId('regions');
await p.screenshot({ path: `${out}/x-regions-all.png` });
await p.evaluate(() => document.querySelector('.rg-chip[data-key="fargona"]')?.click());
await sleep(3200);
await p.screenshot({ path: `${out}/x-regions-city.png` });
await p.evaluate(() => { const el = document.querySelector('.rg-shots'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); });
await sleep(1500);
await p.screenshot({ path: `${out}/x-regions-city2.png` });
await p.evaluate(() => document.querySelector('.rg-shots img')?.click());
await sleep(1200);
await p.screenshot({ path: `${out}/x-lightbox.png` });
await p.keyboard.press('Escape');
await sleep(500);
// nav + theme + language
await p.evaluate(() => window.scrollTo(0, 0));
await sleep(2500);
await p.hover('#langBtn');
await sleep(500);
await p.screenshot({ path: `${out}/x-nav.png`, clip: { x: 0, y: 0, width: 1440, height: 120 } });
await p.click('#themeToggle');
await sleep(1800);
await p.screenshot({ path: `${out}/x-night-hero.png` });
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await sleep(2500);
await p.screenshot({ path: `${out}/x-footer-night.png` });
await b.close();
