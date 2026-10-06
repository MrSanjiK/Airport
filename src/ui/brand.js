import logo from '../assets/logo.svg?raw';
import { t } from '../i18n/index.js';
import { DIRECTIONS } from '../data/inventory.js';

const TAG = { mediaport: 'tagMediaport', flytv: 'tagFlytv', mediagate: 'tagMediagate', 'tvl-korzinka': 'tagKorzinka', 'tvl-horeca': 'tagHoreca', 'tvl-region': 'tagRegion' };
export const dirById = (id) => DIRECTIONS.find((d) => d.id === id);
export const dirByChapter = (ch) => DIRECTIONS.find((d) => d.chapter === ch);

// marks whose dark ink is lifted to white for the night chart (Korzinka's red reads on both)
const NIGHT = new Set(['flytv', 'mediagate', 'tvline', 'region-script']);
// A logo with no tile: the printed mark by day, its night cut on the dark chart.
export const logoImg = (name, cls, alt = '') => (NIGHT.has(name)
  ? `<img class="${cls} lg-day" src="/img/brand/${name}.png" alt="${alt}" decoding="async" /><img class="${cls} lg-night" src="/img/brand/${name}-d.png" alt="" aria-hidden="true" decoding="async" />`
  : `<img class="${cls}" src="/img/brand/${name}.png" alt="${alt}" decoding="async" />`);

// The direction's own mark. On a white tile it reads as printed in either theme; `bare` drops the tile.
// size: 'sm' (calculator, dock), 'md' (chapter heads)
export function badge(d, size = 'md', bare = false) {
  const img = (name, cls, alt) => (bare ? logoImg(name, cls, alt) : `<img class="${cls}" src="/img/brand/${name}.png" alt="${alt}" />`);
  const main = d.logo ? img(d.logo, `bd-logo bd-logo--${d.logo}`, d.brand) : `<span class="bd-logo bd-logo--svg" aria-label="${d.brand}">${logo}</span>`;
  let sub = '';
  if (d.subLogo) sub = img(d.subLogo, `bd-sub bd-sub--${d.subLogo}`, d.sub);
  else if (d.sub) sub = `<span class="bd-subtext">${d.sub}</span>`;
  return `<span class="badge badge--${size} badge--${d.id}${bare ? ' badge--bare' : ''}" style="--brand:${d.color}">${main}${sub ? `<i class="bd-sep" aria-hidden="true"></i>${sub}` : ''}</span>`;
}

export const tagline = (d) => t(`dir.${TAG[d.id]}`);

// The strip that opens every direction's chapter: its mark, what it is, the holding, and its own site.
export function brandBar(d) {
  return `<div class="brandbar">${badge(d)}
    <span class="bb-text"><b>${d.brand}${d.sub ? ` · ${d.sub}` : ''}</b><small>${tagline(d)} · ${t('dir.holding')}</small></span>
    ${d.site ? `<a class="bb-site" href="https://${d.site}" target="_blank" rel="noopener">${d.site}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg></a>` : ''}
  </div>`;
}
