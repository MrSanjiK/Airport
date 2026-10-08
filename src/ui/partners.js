import { t } from '../i18n/index.js';
import { PARTNERS } from '../data/inventory.js';

// The brands that trust the holding, as two rows drifting past in opposite directions. At rest the marks are
// one ink; under the pointer a row stops and the mark takes its own colours. Rows run only while on screen.
const item = (p) => `<li class="pm-item" style="--h:${p.h || 1}"><img src="/img/partners/${p.id}.png" alt="${p.name}" loading="lazy" decoding="async" draggable="false" /></li>`;
const row = (list, rev) => `<div class="pm-row${rev ? ' pm-row--rev' : ''}"><ul class="pm-track">${list.map(item).join('')}${list.map(item).join('').replace(/alt="[^"]*"/g, 'alt="" aria-hidden="true"')}</ul></div>`;

export function partnersHTML() {
  const half = Math.ceil(PARTNERS.length / 2);
  const a = [...PARTNERS.slice(0, half), ...PARTNERS.slice(half)];
  const b = [...PARTNERS.slice(half), ...PARTNERS.slice(0, half)].reverse();
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
