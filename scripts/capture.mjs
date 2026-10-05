// Usage: node scripts/capture.mjs <outDir> <width> <height> [lang] [theme] [shots...]
// shots: "name@scrollFraction" or "name#anchorId"
import puppeteer from 'puppeteer-core';
const [,, out = '.impeccable/review', w = '1440', h = '900', lang = 'uz', theme = 'day', ...shots] = process.argv;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((th) => { try { localStorage.setItem('mp-theme', th); } catch (e) {} }, theme);
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('console:', m.type(), m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:5173/?lang=${lang}`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 6500));
const list = shots.length ? shots : ['hero@0'];
for (const s of list) {
  const [name, pos] = s.includes('#') ? s.split('#') : s.split('@');
  if (s.includes('#')) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      let y = el.getBoundingClientRect().top + scrollY;
      if (el.classList.contains('chapter')) y += innerHeight * 0.42;
      if (id === 'plan') y += innerHeight * 0.18;
      window.scrollTo(0, y);
    }, pos);
  } else {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), +pos);
  }
  await new Promise((r) => setTimeout(r, 3800));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
}
await browser.close();
