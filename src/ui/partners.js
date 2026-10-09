import { t } from '../i18n/index.js';
import { PARTNERS } from '../data/inventory.js';

// The brands that trust the holding: two rows drifting past in opposite directions, every mark in its own colours
// (a night cut lifts neutral dark ink on the dark chart). Each item's size comes from the data, never from a
// loaded image, so the two halves of a track are always the same width and the loop never jumps; the rows start
// only once every logo is decoded, run only while on screen, and stop under the pointer.
const item = (p, hidden) => {
  const alt = hidden ? '' : p.name;
  const aria = hidden ? ' aria-hidden="true"' : '';
  return `<li class="pm-item" style="--h:${p.h};--ar:${p.ar}"${aria}><img class="pm-day" src="/img/partners/${p.id}.png" alt="${alt}" decoding="async" draggable="false" /><img class="pm-night" src="/img/partners/${p.id}-night.png" alt="" aria-hidden="true" decoding="async" draggable="false" /></li>`;
};
const row = (list, rev) => `<div class="pm-row${rev ? ' pm-row--rev' : ''}"><ul class="pm-track">${list.map((p) => item(p, false)).join('')}${list.map((p) => item(p, true)).join('')}</ul></div>`;

export function partnersHTML() {
  // every other brand to each row, so the two rows share the list without repeating each other
  const a = PARTNERS.filter((_, i) => i % 2 === 0);
  const b = PARTNERS.filter((_, i) => i % 2 === 1);
  return `<div class="pm">
    <div class="pm-head"><p class="pm-k"><i></i>${t('partners.k')}</p><h3>${t('partners.title')}</h3></div>
    <div class="pm-rows" role="list" aria-label="${t('partners.title')}">${row(a, false)}${row(b, true)}</div>
  </div>`;
}

const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-run', e.isIntersecting)), { rootMargin: '120px' }) : null;
export function mountPartners(el) {
  if (!el) return;
  el.innerHTML = partnersHTML();
  const rows = el.querySelector('.pm-rows');
  // decode the visible cut of every logo first: no image may arrive mid-loop
  const night = document.documentElement.dataset.theme === 'night';
  const imgs = [...rows.querySelectorAll(night ? '.pm-night' : '.pm-day')];
  Promise.all(imgs.map((img) => img.decode().catch(() => {}))).then(() => {
    rows.classList.add('is-ready');
    if (io) io.observe(rows); else rows.classList.add('is-run');
  });
}
