import { t } from '../i18n/index.js';
import { PARTNERS } from '../data/inventory.js';

// The brands that trust the holding, as two rows drifting past in opposite directions, no tiles. Rows run only
// while on screen and stop under the pointer.
// one ink by default (a white knock-out version as a mask, filled with the chart's ink: legible on either theme);
// in daylight the mark under the pointer takes its own colours
const item = (p) => `<li class="pm-item" style="--h:${p.h || 1};--m:url(/img/partners/${p.id}-mono.png)"><img src="/img/partners/${p.id}.png" alt="${p.name}" loading="lazy" decoding="async" draggable="false" /><span class="pm-ink" aria-hidden="true"></span></li>`;
const row = (list, rev) => `<div class="pm-row${rev ? ' pm-row--rev' : ''}"><ul class="pm-track">${list.map(item).join('')}${list.map(item).join('').replace(/alt="[^"]*"/g, 'alt="" aria-hidden="true"')}</ul></div>`;

export function partnersHTML() {
  // every other brand to each row, so the two rows share the list without repeating each other
  const a = PARTNERS.filter((_, i) => i % 2 === 0);
  const b = PARTNERS.filter((_, i) => i % 2 === 1);
  return `<div class="pm">
    <div class="pm-head"><p class="pm-k"><i></i>${t('partners.k')}</p><h3>${t('partners.title')}</h3></div>
    <div class="pm-rows" role="list" aria-label="${t('partners.title')}">${row(a, false)}${row(b, true)}</div>
  </div>`;
}

const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-run', e.isIntersecting)), { rootMargin: '80px' }) : null;
export function mountPartners(el) {
  if (!el) return;
  el.innerHTML = partnersHTML();
  const rows = el.querySelector('.pm-rows');
  if (io) io.observe(rows); else rows.classList.add('is-run');
}
