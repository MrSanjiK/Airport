import logo from '../assets/logo.svg?raw';
import { t } from '../i18n/index.js';
import { DIRECTIONS } from '../data/inventory.js';

const TAG = { mediaport: 'tagMediaport', flytv: 'tagFlytv', mediagate: 'tagMediagate', 'tvl-korzinka': 'tagKorzinka', 'tvl-horeca': 'tagHoreca', 'tvl-region': 'tagRegion' };
export const dirById = (id) => DIRECTIONS.find((d) => d.id === id);
export const dirByChapter = (ch) => DIRECTIONS.find((d) => d.chapter === ch);

// The direction's own mark, set on a white tile so every logo reads as printed, in either theme.
// size: 'sm' (calculator, dock), 'md' (chapter heads)
export function badge(d, size = 'md') {
  const main = d.logo ? `<img class="bd-logo bd-logo--${d.logo}" src="/img/brand/${d.logo}.png" alt="${d.brand}" />` : `<span class="bd-logo bd-logo--svg" aria-label="${d.brand}">${logo}</span>`;
  let sub = '';
  if (d.subLogo) sub = `<img class="bd-sub bd-sub--${d.subLogo}" src="/img/brand/${d.subLogo}.png" alt="${d.sub}" />`;
  else if (d.sub) sub = `<span class="bd-subtext">${d.sub}</span>`;
  return `<span class="badge badge--${size} badge--${d.id}" style="--brand:${d.color}">${main}${sub ? `<i class="bd-sep" aria-hidden="true"></i>${sub}` : ''}</span>`;
}

export const tagline = (d) => t(`dir.${TAG[d.id]}`);

// The strip that opens every direction's chapter: its mark, what it is, the holding, and its own site.
export function brandBar(d) {
  return `<div class="brandbar">${badge(d)}
    <span class="bb-text"><b>${d.brand}${d.sub ? ` · ${d.sub}` : ''}</b><small>${tagline(d)} · ${t('dir.holding')}</small></span>
    ${d.site ? `<a class="bb-site" href="https://${d.site}" target="_blank" rel="noopener">${d.site}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg></a>` : ''}
  </div>`;
}
