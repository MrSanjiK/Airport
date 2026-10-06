// Local helper (git-excluded): phone flow — pick a city chip in Regions and capture the result.
import puppeteer from 'puppeteer-core';
const [,, out, key = 'jizzax'] = process.argv;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto('http://127.0.0.1:5173/?lang=uz&nointro', { waitUntil: 'domcontentloaded' });
await sleep(9000);
await p.evaluate(() => { const el = document.querySelector('.rg-chips'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 300); });
await sleep(2000);
await p.evaluate((k) => document.querySelector(`.rg-chip[data-key="${k}"]`)?.click(), key);
await sleep(6000);
await p.screenshot({ path: `${out}-m-${key}.png` });
await p.evaluate(() => document.querySelector('.wp--venue.is-clickable')?.click());
await sleep(1500);
await p.screenshot({ path: `${out}-m-${key}-card.png` });
await b.close();
