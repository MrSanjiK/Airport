import { t, num, money, onLang } from './i18n/index.js';
import { AIRPORT, LED_ZONES, LED_FACTS, AIRPORT_TV, LIGHTBOX, KORZINKA, HORECA, REGIONS, TERMS } from './data/inventory.js';
import { CITY_PHOTOS } from './data/photo-credits.js';
import { credit } from './ui/credit.js';

const img = (name, alt = '', eager = false) => `<img src="/img/${name}.webp" alt="${alt}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" />`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Price ladder drawn as an approach descent profile.
export function profile(prices, caption = t('airport.profile'), { w: Wd = 520, pair = false } = {}) {
  const H = pair ? 124 : 150, padX = pair ? 76 : 46, top = pair ? 14 : 34, bottom = pair ? 78 : 112;
  const max = prices[0], min = Math.min(...prices);
  const yv = (v) => top + ((max - v) / Math.max(1, max - min || max)) * (bottom - top - (pair ? 12 : 24));
  const xs = prices.map((_, i) => padX + (i * (Wd - padX * 2)) / (prices.length - 1));
  let d = `M8 ${yv(max) - 18} L${xs[0] - 26} ${yv(max) - 18} L${xs[0]} ${yv(prices[0])}`;
  prices.forEach((v, i) => {
    if (i) d += ` L${xs[i] - 40} ${yv(prices[i - 1])} L${xs[i]} ${yv(v)}`;
  });
  d += ` L${Wd - 8} ${yv(prices[prices.length - 1])}`;
  // paired labels read term and price together at the foot ("3 OY · 500 MLN"); when a language makes the pair
  // wider than the gap between stops, the pair stacks (price over term) instead of colliding
  const pv = (v) => `<tspan class="p-pv">${money(v).value}</tspan> ${esc(money(v).unit.split(' ')[0])}`;
  const longest = Math.max(...prices.map((v, i) => `${t(`units.month${TERMS[i]}`)} · ${money(v).value} ${money(v).unit.split(' ')[0]}`.length));
  const stack = pair && longest * 7.6 > (Wd - padX * 2) / (prices.length - 1) - 8;
  const label = (v, i) => pair
    ? stack
      ? `<text class="p-term p-term--pair" x="${xs[i]}" y="${bottom + 22}" text-anchor="middle">${pv(v)}</text><text class="p-term p-term--pair" x="${xs[i]}" y="${bottom + 38}" text-anchor="middle">${esc(t(`units.month${TERMS[i]}`))}</text>`
      : `<text class="p-term p-term--pair" x="${xs[i]}" y="${bottom + 26}" text-anchor="middle">${esc(t(`units.month${TERMS[i]}`))} · ${pv(v)}</text>`
    : `<text class="p-val" x="${xs[i]}" y="${yv(v) - 14}" text-anchor="middle">${num(v)}</text>
        <text class="p-term" x="${xs[i]}" y="${bottom + 26}" text-anchor="middle">${esc(t(`units.month${TERMS[i]}`))}</text>`;
  const stops = prices
    .map(
      (v, i) => `<g>
        <line class="p-drop" x1="${xs[i]}" x2="${xs[i]}" y1="${yv(v)}" y2="${bottom + 6}" />
        <circle class="p-stop" cx="${xs[i]}" cy="${yv(v)}" r="5.5" />
        ${label(v, i)}
      </g>`,
    )
    .join('');
  return `<figure class="profile${pair ? ' profile--pair' : ''}" data-profile style="margin:0">
    <figcaption class="profile-cap"><span>${esc(caption)}</span><span>${esc(t('units.mln'))} ${esc(t('units.perMonth'))}</span></figcaption>
    <svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${prices.map((v, i) => `${TERMS[i]}: ${v}`).join(', ')}">
      <g class="p-grid">${[0, 1, 2, 3].map((i) => `<line x1="0" x2="${Wd}" y1="${top + i * ((bottom - top) / 3)}" y2="${top + i * ((bottom - top) / 3)}" />`).join('')}</g>
      <path class="p-line" d="${d}" />
      ${stops}
    </svg>
    <p class="note">${esc(t('units.vat'))}</p>
  </figure>`;
}

const readout = (items, cols = 3) =>
  `<dl class="readout" style="--cols:${cols}">${items
    .map(([v, label, frac]) => `<div><dd>${v}</dd><dt>${esc(label)}</dt>${frac != null ? `<span class="tick"><i style="--v:${Math.round(frac * 100)}%"></i></span>` : ''}</div>`)
    .join('')}</dl>`;

function ring(a, b, la, lb) {
  return `<div class="split" role="img" aria-label="${a}% ${esc(la)}, ${b}% ${esc(lb)}">
    <div class="split-bar"><i style="width:${a}%"></i><i style="width:${b}%"></i></div>
    <div class="split-legend"><span><b>${a}%</b>${esc(la)}</span><span><b>${b}%</b>${esc(lb)}</span></div></div>`;
}

const WHY_ICONS = [
  '<svg class="why-ico" viewBox="0 0 30 30"><circle cx="15" cy="9" r="4.5"/><path d="M6 25c1.2-5 4.6-7.5 9-7.5s7.8 2.5 9 7.5"/></svg>',
  '<svg class="why-ico" viewBox="0 0 30 30"><circle cx="15" cy="15" r="10.5"/><path d="M15 8v7l4.5 3"/></svg>',
  '<svg class="why-ico" viewBox="0 0 30 30"><rect x="4" y="7" width="22" height="14" rx="1.5"/><path d="M11 25h8M15 21v4"/></svg>',
  '<svg class="why-ico" viewBox="0 0 30 30"><circle cx="15" cy="15" r="10.5"/><path d="M4.5 15h21M15 4.5c3 3 4.5 6.5 4.5 10.5s-1.5 7.5-4.5 10.5c-3-3-4.5-6.5-4.5-10.5S12 7.5 15 4.5z"/></svg>',
];

export function initSections({ bus, places }) {
  let openZone = 'arr32';

  const renderAirport = () => {
    document.getElementById('airportReadout').outerHTML = readout(
      [
        [num(AIRPORT.visitsDay), t('airport.statDay')],
        [num(AIRPORT.visitsMonth), t('airport.statMonth')],
        [num(AIRPORT.visitsYear), t('airport.statYear')],
        [num(AIRPORT.areaK * 1000), t('airport.statArea')],
        [num(AIRPORT.halls), t('airport.statHalls')],
        [`${AIRPORT.flightsDay}+`, t('airport.statFlights')],
      ],
      3,
    ).replace('<dl class="readout"', '<dl class="readout" id="airportReadout"');
    document.getElementById('airportAudience').innerHTML =
      ring(AIRPORT.men, AIRPORT.women, t('airport.men'), t('airport.women')) + ring(AIRPORT.citizens, AIRPORT.foreigners, t('airport.citizens'), t('airport.foreigners'));

    const zones = document.getElementById('zones');
    zones.innerHTML = LED_ZONES.map(
      (z, i) => `<div class="zone${z.id === openZone ? ' is-open' : ''}" data-zone="${z.id}">
        <button class="zone-row" type="button" aria-expanded="${z.id === openZone}" aria-controls="zd-${z.id}">
          <span class="zone-n">${i + 1}</span>
          <span class="zone-name">${esc(t(`airport.zones.${z.id}`))}</span>
          ${z.hit ? `<span class="zone-hit">${esc(t('airport.hit'))}</span>` : '<span></span>'}
          <span class="zone-from tnum"><b>${num(z.price[2])}–${num(z.price[0])}</b> ${esc(t('units.mln'))}</span>
        </button>
        <div class="zone-detail" id="zd-${z.id}"><div><div class="zone-inner">
          <figure class="zone-photo" style="margin:0">${img(z.img, t(`airport.zones.${z.id}`))}</figure>
          <div style="display:grid;gap:16px;align-content:start">
            <dl class="spec">
              <dt>${esc(t('airport.screensN'))}</dt><dd>${z.screens}</dd>
              <dt>${esc(t('airport.size'))}</dt><dd><bdi dir="ltr">${z.size}</bdi></dd>
              <dt>${esc(t('airport.res'))}</dt><dd><bdi dir="ltr">${z.res}</bdi></dd>
              <dt>${esc(t('units.plays'))}</dt><dd>${LED_FACTS.playsDay} · ${LED_FACTS.spotSec} ${esc(t('units.sec'))}</dd>
            </dl>
          </div>
          <div style="grid-column:1/-1">${profile(z.price)}</div>
        </div></div></div>
      </div>`,
    ).join('');
    zones.querySelectorAll('.zone-row').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.parentElement.dataset.zone;
        setZone(openZone === id ? null : id, true);
      }),
    );
    observeProfiles(zones);

    document.getElementById('tabTv').innerHTML = `
      <div class="feature"><figure>${img(AIRPORT_TV.imgs[0], t('airport.tvTitle'))}</figure>
        <div><h3>${esc(t('airport.tvTitle'))}</h3><p>${esc(t('airport.tvText'))}</p></div></div>
      ${readout([[num(AIRPORT_TV.monitors), t('units.screens')], [AIRPORT_TV.diag, t('airport.size')], [num(AIRPORT_TV.playsDay), t('units.plays')]], 3)}
      <div class="gallery">${AIRPORT_TV.imgs.slice(1).map((n) => `<figure>${img(n)}</figure>`).join('')}</div>
      ${profile(AIRPORT_TV.price)}`;
    document.getElementById('tabLb').innerHTML = `
      <div class="feature"><figure>${img(LIGHTBOX.imgs[0], t('airport.lbTitle'))}</figure>
        <div><h3>${esc(t('airport.lbTitle'))}</h3><p>${esc(t('airport.lbText'))}</p></div></div>
      ${readout([[num(LIGHTBOX.count), t('airport.lbZones')], [`${LIGHTBOX.areaM2}<small>${esc(t('units.m2'))}</small>`, t('airport.size')], ['B1–B14', t('airport.lbZones')]], 3)}
      <ul class="venues">${LIGHTBOX.zones.map((z) => `<li>${esc(z)}</li>`).join('')}</ul>
      ${profile(LIGHTBOX.price)}
      <p class="note">${esc(t('airport.lbVip'))}</p>`;
    observeProfiles(document.getElementById('tabTv'));
    observeProfiles(document.getElementById('tabLb'));

    document.getElementById('whyList').innerHTML = [
      [WHY_ICONS[0], 'why1'], ['<b>53%</b>', 'why2'], [WHY_ICONS[2], 'why3'], ['<b>69%</b>', 'why4'],
    ].map(([ico, k]) => `<li>${ico}<span>${esc(t(`airport.${k}`))}</span></li>`).join('');
  };

  const setZone = (id, fromList) => {
    openZone = id;
    document.querySelectorAll('.zone').forEach((z) => {
      const on = z.dataset.zone === id;
      z.classList.toggle('is-open', on);
      z.querySelector('.zone-row').setAttribute('aria-expanded', String(on));
    });
    if (fromList && id) bus.dispatchEvent(new CustomEvent('zone', { detail: id }));
  };
  bus.addEventListener('zone', (e) => { if (openZone !== e.detail) setZone(e.detail, false); });
  bus.addEventListener('zonepick', (e) => {
    const tab = document.getElementById('tLed');
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    document.querySelector(`.zone[data-zone="${e.detail}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // Tabs with sliding ink
  const tabs = document.getElementById('airportTabs');
  const ink = tabs.querySelector('.tabs-ink');
  const placeInk = () => {
    const sel = tabs.querySelector('[aria-selected="true"]');
    const r = sel.getBoundingClientRect();
    const p = tabs.getBoundingClientRect();
    ink.style.width = `${r.width}px`;
    ink.style.transform = `translateX(${r.left - p.left}px)`;
  };
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (!b) return;
    tabs.querySelectorAll('[role="tab"]').forEach((x) => {
      const on = x === b;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    placeInk();
  });
  tabs.addEventListener('keydown', (e) => {
    const list = [...tabs.querySelectorAll('[role="tab"]')];
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const dir = document.documentElement.dir === 'rtl' ? -step : step;
    const n = list[(i + dir + list.length) % list.length];
    n.focus();
    n.click();
  });

  const renderKorzinka = () => {
    document.getElementById('kzBody').innerHTML = `
      <p class="lead">${esc(t('korzinka.lead'))}</p>
      ${readout([
        [`${num(KORZINKA.venues)}+`, t('korzinka.venues')],
        [num(KORZINKA.receiptsDay), t('korzinka.receipts')],
        [`${num(KORZINKA.monitors)}+`, t('korzinka.monitors')],
        [KORZINKA.playsDay, t('korzinka.plays')],
        [num(KORZINKA.spotSec), t('korzinka.spot')],
        [`${KORZINKA.audioShare}%`, t('korzinka.audioTitle')],
      ])}
      <div class="feature"><figure>${img('kz-checkout', t('korzinka.checkoutTitle'))}</figure>
        <div><h3>${esc(t('korzinka.checkoutTitle'))}</h3><p>${esc(t('korzinka.checkoutText'))}</p></div></div>
      <div class="feature"><figure>${img('kz-checkout-screens', t('korzinka.audioTitle'))}</figure>
        <div><h3>${esc(t('korzinka.audioTitle'))}</h3><p>${esc(t('korzinka.audioText'))}</p></div></div>
      <div class="growth"><p class="profile-cap"><span>${esc(t('korzinka.growth'))}</span><span>${esc(t('korzinka.growthNote'))}</span></p>
        <svg viewBox="0 0 520 120" aria-label="${esc(t('korzinka.growth'))}: 2025 ${KORZINKA.visitors2025}, 2026 ${KORZINKA.visitors2026}">
          <line class="g-base" x1="0" x2="520" y1="104" y2="104" />
          <path class="g-line" d="M40 84 C 200 84, 300 30, 480 26" />
          <circle class="g-dot" cx="40" cy="84" r="6" /><circle class="g-dot" cx="480" cy="26" r="6" />
          <text x="40" y="70" text-anchor="start">${num(KORZINKA.visitors2025)}</text>
          <text x="480" y="14" text-anchor="end">${num(KORZINKA.visitors2026)}</text>
          <text class="g-yr" x="40" y="120">2025</text><text class="g-yr" x="480" y="120" text-anchor="end">2026</text>
        </svg></div>
      <p class="fits">${esc(t('korzinka.online'))}</p>
      ${profile(KORZINKA.price)}
      <p class="note">${esc(t('korzinka.mapNote'))}</p>`;
    observeProfiles(document.getElementById('kzBody'));
  };

  const mapped = new Set(places.horeca.map((h) => h.n.toLowerCase()));
  const isMapped = (v) => [...mapped].some((m) => m.includes(v.toLowerCase().split(' ')[0].replace(/[’']/g, '')) || v.toLowerCase().includes(m.split(' ')[0]));
  const renderHoreca = () => {
    document.getElementById('hrBody').innerHTML = `
      <p class="lead">${esc(t('horeca.lead'))}</p>
      ${readout([
        [num(HORECA.visitors), t('horeca.visitors')],
        [`${num(HORECA.venues)}+`, t('horeca.venues')],
        [`${num(HORECA.monitors)}+`, t('horeca.monitors')],
        [HORECA.playsDay, t('horeca.plays')],
        [`${num(HORECA.avgCheck)}+`, t('horeca.check')],
        [HORECA.dwell, t('horeca.dwell')],
      ])}
      <div class="gallery">${['hr-akfa-screens', 'hr-terrace-tv', 'hr-hall-screens'].map((n) => `<figure>${img(n)}</figure>`).join('')}</div>
      <p class="fits">${esc(t('horeca.audience'))} ${esc(t('horeca.since'))}.</p>
      <div><h3 style="margin-bottom:12px">${esc(t('horeca.venuesTitle'))}</h3>
      <ul class="venues">${HORECA.venueList.map((v) => `<li class="${isMapped(v) ? 'is-mapped' : ''}">${esc(v)}</li>`).join('')}</ul></div>
      ${profile(HORECA.price)}
      <p class="note">${esc(t('horeca.mapNote'))}</p>`;
    observeProfiles(document.getElementById('hrBody'));
  };

  const renderRegions = () => {
    const max = Math.max(...REGIONS.rows.map((r) => r.screens));
    const sum = (k) => REGIONS.rows.reduce((a, r) => a + r[k], 0);
    document.getElementById('rgBody').innerHTML = `
      <p class="lead">${esc(t('regions.lead'))}</p>
      ${readout([
        [`${num(REGIONS.venues)}+`, t('regions.venues')],
        [num(REGIONS.visitorsDay), t('regions.visitors')],
        [REGIONS.playsDay, t('regions.plays')],
        [REGIONS.monitorsPerVenue, t('regions.perVenue')],
        [`${REGIONS.notice}%`, t('regions.notice')],
        [`${REGIONS.see}%`, t('regions.see')],
      ])}
      <table class="rtable">
        <thead><tr><th>${esc(t('regions.thRegion'))}</th><th>${esc(t('regions.thScreens'))}</th><th>${esc(t('regions.thVenues'))}</th><th>${esc(t('regions.thDaily'))}</th></tr></thead>
        <tbody>${REGIONS.rows
          .map((r) => `<tr data-key="${r.key}" tabindex="0"><td>${esc(t(`cities.${r.key}`))}${r.iata ? `<small>${r.iata}</small>` : ''}</td>
            <td class="tnum">${r.screens}<span class="bar"><i style="--v:${Math.round((r.screens / max) * 100)}%"></i></span></td>
            <td class="tnum">${r.venues}</td><td class="tnum">${num(r.daily)}</td></tr>`)
          .join('')}</tbody>
        <tfoot><tr><td>${esc(t('regions.total'))}</td><td class="tnum">${sum('screens')}</td><td class="tnum">${sum('venues')}</td><td class="tnum">${num(sum('daily'))}</td></tr></tfoot>
      </table>
      <section class="cities" aria-label="${esc(t('regions.citiesTitle'))}">
        <h3>${esc(t('regions.citiesTitle'))}</h3>
        <div class="cities-row">${REGIONS.rows.filter((r) => CITY_PHOTOS[r.key]).map((r) => `<button type="button" class="city" data-key="${r.key}">
          <span class="city-ph">${img(`city-${r.key}`)}${credit(CITY_PHOTOS[r.key], { link: false })}</span>
          <span class="city-name">${esc(t(`cities.${r.key}`))}${r.iata ? `<small>${r.iata}</small>` : ''}</span>
          <span class="city-meta">${r.screens} ${esc(t('map.screens'))} · ${r.venues} ${esc(t('map.venues'))}</span>
        </button>`).join('')}</div>
      </section>
      <div class="gallery">${['rg-cafe-screens', 'rg-checkout', 'rg-foodcourt'].map((n) => `<figure>${img(n)}<figcaption>${esc(t('card.networkPhoto'))}</figcaption></figure>`).join('')}</div>
      ${profile(REGIONS.price)}`;
    document.querySelectorAll('.cities .city').forEach((b) => b.addEventListener('click', () => bus.dispatchEvent(new CustomEvent('flyto', { detail: { type: 'city', key: b.dataset.key } }))));
    document.querySelectorAll('.rtable tbody tr').forEach((tr) => {
      const fire = () => {
        document.querySelectorAll('.rtable tbody tr').forEach((x) => x.classList.toggle('is-active', x === tr));
        bus.dispatchEvent(new CustomEvent('region', { detail: tr.dataset.key }));
      };
      tr.addEventListener('pointerenter', fire);
      tr.addEventListener('focus', fire);
    });
    observeProfiles(document.getElementById('rgBody'));
  };

  const renderAll = () => {
    renderAirport();
    renderKorzinka();
    renderHoreca();
    renderRegions();
    requestAnimationFrame(placeInk);
  };
  renderAll();
  onLang(renderAll);
  addEventListener('resize', placeInk);
}

// Draw each price profile when it scrolls into view.
const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const p = e.target;
      const line = p.querySelector('.p-line');
      if (line) p.style.setProperty('--len', Math.ceil(line.getTotalLength()));
      requestAnimationFrame(() => p.classList.add('is-in'));
      io.unobserve(p);
    }), { threshold: 0.35 })
  : null;
function observeProfiles(root) {
  root.querySelectorAll('[data-profile]').forEach((p) => {
    const line = p.querySelector('.p-line');
    if (line) p.style.setProperty('--len', Math.ceil(line.getTotalLength()));
    io ? io.observe(p) : p.classList.add('is-in');
  });
}
