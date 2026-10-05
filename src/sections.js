import { t, num, money, onLang } from './i18n/index.js';
import { AIRPORT, LED_ZONES, LED_FACTS, AIRPORT_TV, LIGHTBOX, KORZINKA, HORECA, REGIONS, TERMS } from './data/inventory.js';
import { CITY_PHOTOS } from './data/photo-credits.js';
import { CITY_VENUES, CITY_GALLERY, CITY_STORES } from './data/regions.js';
import { credit } from './ui/credit.js';

const img = (name, alt = '', eager = false) => `<img src="/img/${name}.webp" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" />`;
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

// items: [value, label, fraction?, mini-card key?, plan id?] — a key makes the row open its mini card
const readout = (items, cols = 3) =>
  `<dl class="readout" style="--cols:${cols}">${items
    .map(([v, label, frac, mini, plan]) => `<div${mini ? ` data-mini="${mini}" role="button" tabindex="0" aria-expanded="false"${plan ? ` data-mini-plan="${plan}"` : ''}` : ''}><dd>${v}</dd><dt>${esc(label)}</dt>${frac != null ? `<span class="tick"><i style="--v:${Math.round(frac * 100)}%"></i></span>` : ''}</div>`)
    .join('')}</dl>`;

function ring(a, b, la, lb, mini) {
  return `<div class="split" role="button" tabindex="0" aria-expanded="false" data-mini="${mini}" aria-label="${a}% ${esc(la)}, ${b}% ${esc(lb)}"><span class="mini-v" hidden>${a}% · ${b}%</span><span class="mini-l" hidden>${esc(la)} · ${esc(lb)}</span>
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
        [num(AIRPORT.visitsDay), t('airport.statDay'), null, 'aDay'],
        [num(AIRPORT.visitsMonth), t('airport.statMonth'), null, 'aMonth'],
        [num(AIRPORT.visitsYear), t('airport.statYear'), null, 'aYear'],
        [num(AIRPORT.areaK * 1000), t('airport.statArea'), null, 'aArea'],
        [num(AIRPORT.halls), t('airport.statHalls'), null, 'aHalls'],
        [`${AIRPORT.flightsDay}+`, t('airport.statFlights'), null, 'aFlights'],
      ],
      3,
    ).replace('<dl class="readout"', '<dl class="readout" id="airportReadout"');
    document.getElementById('airportAudience').innerHTML =
      ring(AIRPORT.men, AIRPORT.women, t('airport.men'), t('airport.women'), 'aGender') + ring(AIRPORT.citizens, AIRPORT.foreigners, t('airport.citizens'), t('airport.foreigners'), 'aCitizens');

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
          <figure class="zone-photo" style="margin:0" data-gallery>${img(z.img, t(`airport.zones.${z.id}`))}</figure>
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
      <div class="feature"><figure data-gallery>${img(AIRPORT_TV.imgs[0], t('airport.tvTitle'))}</figure>
        <div><h3>${esc(t('airport.tvTitle'))}</h3><p>${esc(t('airport.tvText'))}</p></div></div>
      ${readout([[num(AIRPORT_TV.monitors), t('units.screens')], [AIRPORT_TV.diag, t('airport.size')], [num(AIRPORT_TV.playsDay), t('units.plays'), null, 'a247']], 3)}
      <div class="gallery" data-gallery>${AIRPORT_TV.imgs.slice(1).map((n) => `<figure>${img(n, t('airport.tvTitle'))}</figure>`).join('')}</div>
      ${profile(AIRPORT_TV.price)}`;
    document.getElementById('tabLb').innerHTML = `
      <div class="feature"><figure data-gallery>${img(LIGHTBOX.imgs[0], t('airport.lbTitle'))}</figure>
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
  // picking a zone on the plate (callout, marker, photo) opens it in the list and brings the row into view
  bus.addEventListener('zonepick', (e) => {
    const tab = document.getElementById('tLed');
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    const row = document.querySelector(`.zone[data-zone="${e.detail}"]`);
    if (!row) return;
    setZone(e.detail, false);
    bus.dispatchEvent(new CustomEvent('scrollto', { detail: { el: row, offset: -innerHeight * 0.22 } }));
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
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
        [`${num(KORZINKA.venues)}+`, t('korzinka.venues'), null, 'kVenues', 'korzinka'],
        [num(KORZINKA.receiptsDay), t('korzinka.receipts'), null, 'kReceipts', 'korzinka'],
        [`${num(KORZINKA.monitors)}+`, t('korzinka.monitors'), null, 'kMonitors', 'korzinka'],
        [KORZINKA.playsDay, t('korzinka.plays'), null, 'kPlays', 'korzinka'],
        [num(KORZINKA.spotSec), t('korzinka.spot'), null, 'kSpot', 'korzinka'],
        [`${KORZINKA.audioShare}%`, t('korzinka.audioTitle'), null, 'kAudio', 'korzinka'],
      ])}
      <div class="feature"><figure data-gallery>${img('kz-checkout', t('korzinka.checkoutTitle'))}</figure>
        <div><h3>${esc(t('korzinka.checkoutTitle'))}</h3><p>${esc(t('korzinka.checkoutText'))}</p></div></div>
      <div class="feature"><figure data-gallery>${img('kz-checkout-screens', t('korzinka.audioTitle'))}</figure>
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
  const venuePlace = (v) => {
    const w = v.toLowerCase().split(' ')[0].replace(/[’']/g, '');
    return places.horeca.find((h) => h.n.toLowerCase().includes(w)) || places.horeca.find((h) => v.toLowerCase().includes(h.n.toLowerCase().split(' ')[0]));
  };
  const renderHoreca = () => {
    document.getElementById('hrBody').innerHTML = `
      <p class="lead">${esc(t('horeca.lead'))}</p>
      ${readout([
        [num(HORECA.visitors), t('horeca.visitors'), null, 'hVisitors', 'horeca'],
        [`${num(HORECA.venues)}+`, t('horeca.venues'), null, 'hVenues', 'horeca'],
        [`${num(HORECA.monitors)}+`, t('horeca.monitors'), null, 'hMonitors', 'horeca'],
        [HORECA.playsDay, t('horeca.plays'), null, 'hPlays', 'horeca'],
        [`${num(HORECA.avgCheck)}+`, t('horeca.check'), null, 'hCheck', 'horeca'],
        [HORECA.dwell, t('horeca.dwell'), null, 'hDwell', 'horeca'],
      ])}
      <div class="gallery" data-gallery>${['hr-akfa-screens', 'hr-terrace-tv', 'hr-hall-screens'].map((n) => `<figure>${img(n, t('horeca.title'))}</figure>`).join('')}</div>
      <p class="fits">${esc(t('horeca.audience'))} ${esc(t('horeca.since'))}.</p>
      <div><h3 style="margin-bottom:12px">${esc(t('horeca.venuesTitle'))}</h3>
      <ul class="venues">${HORECA.venueList.map((v) => isMapped(v) ? `<li class="is-mapped"><button type="button" data-venue="${esc(v)}">${esc(v)}</button></li>` : `<li>${esc(v)}</li>`).join('')}</ul></div>
      ${profile(HORECA.price)}
      <p class="note">${esc(t('horeca.mapNote'))}</p>`;
    document.querySelectorAll('#hrBody [data-venue]').forEach((b) => b.addEventListener('click', () => {
      const h = venuePlace(b.dataset.venue);
      if (h) bus.dispatchEvent(new CustomEvent('flyto', { detail: { type: 'horeca', name: h.n } }));
    }));
    observeProfiles(document.getElementById('hrBody'));
  };

  // Regions: pick a city from the chips or on the map; the city card brings its photo, figures, venue photos from
  // the deck and the deck's venue list, and the chart flies to it.
  let rgKey = 'all';
  let rgOpen = false;
  const korByCity = (key) => places.korzinka.filter((k) => {
    const c = places.cities[key];
    return c && Math.hypot((k.p[0] - c[0]) * 0.75, k.p[1] - c[1]) < 0.12;
  }).length;
  const renderCity = () => {
    const box = document.getElementById('rgCity');
    if (!box) return;
    const tot = { screens: 0, venues: 0, daily: 0 };
    REGIONS.rows.forEach((r) => { tot.screens += r.screens; tot.venues += r.venues; tot.daily += r.daily; });
    if (rgKey === 'all') {
      const max = Math.max(...REGIONS.rows.map((r) => r.screens));
      box.innerHTML = `
        <ol class="rg-rank">${REGIONS.rows.map((r) => `<li><button type="button" data-pick="${r.key}">
          <span class="rg-rank-n">${esc(t(`cities.${r.key}`))}${r.iata ? `<small>${r.iata}</small>` : ''}</span>
          <span class="rg-rank-bar"><i style="--v:${Math.round((r.screens / max) * 100)}%"></i></span>
          <span class="rg-rank-v tnum"><b>${r.screens}</b> ${esc(t('map.screens'))} · ${r.venues} ${esc(t('map.venues'))} · ${num(r.daily)}</span>
        </button></li>`).join('')}</ol>
        <p class="rg-total tnum"><span>${esc(t('regions.total'))}</span><b>${tot.screens}</b> ${esc(t('map.screens'))} · <b>${tot.venues}</b> ${esc(t('map.venues'))} · <b>${num(tot.daily)}</b> ${esc(t('regions.visitors'))}</p>
        <div class="gallery" data-gallery>${['network-1', 'network-2', 'network-3'].map((n) => `<figure>${img(`rg/${n}`, t('card.networkPhoto'))}<figcaption>${esc(t('card.networkPhoto'))}</figcaption></figure>`).join('')}</div>`;
    } else {
      const r = REGIONS.rows.find((x) => x.key === rgKey);
      const ph = CITY_PHOTOS[r.key];
      const pct = (v, all) => Math.round((v / all) * 100);
      const venues = CITY_VENUES[r.key] || [];
      const shots = CITY_GALLERY[r.key] || 0;
      const stores = korByCity(r.key);
      const stat = (v, label, share) => `<div class="rg-stat"><b class="tnum">${v}</b><span>${esc(label)}</span><i style="--v:${share}%"></i><em>${share}% · ${esc(t('regions.share'))}</em></div>`;
      box.innerHTML = `
        <figure class="rg-hero" data-gallery>${ph ? img(`city-${r.key}`, t(`cities.${r.key}`)) : img('rg/network-1', t(`cities.${r.key}`))}
          <figcaption class="rg-hero-cap"><span>${esc(t('regions.landmark'))}</span><b>${esc(t(`cities.${r.key}`))}${r.iata ? `<small>${r.iata}</small>` : ''}</b></figcaption>
          ${ph ? credit(ph) : ''}</figure>
        <div class="rg-stats">
          ${stat(r.screens, t('regions.thScreens'), pct(r.screens, tot.screens))}
          ${stat(r.venues, t('regions.thVenues'), pct(r.venues, tot.venues))}
          ${stat(num(r.daily), t('regions.thDaily'), pct(r.daily, tot.daily))}
        </div>
        ${shots || CITY_STORES.includes(r.key) ? `<div class="rg-shots-wrap"><h4>${esc(t('regions.photos'))}</h4><div class="rg-shots" data-gallery>
          ${Array.from({ length: shots }, (_, i) => `<figure>${img(`rg/${r.key}-${i + 1}`, `${t(`cities.${r.key}`)} · ${t('card.networkPhoto')}`)}</figure>`).join('')}
          ${CITY_STORES.includes(r.key) ? `<figure class="is-store">${img(`rg/kz-${r.key}-1`, `${t(`cities.${r.key}`)} · ${t('regions.storesPhoto')}`)}<figcaption>${esc(t('regions.storesPhoto'))}</figcaption></figure>` : ''}
        </div></div>` : ''}
        ${venues.length ? `<div class="rg-venues${rgOpen ? ' is-open' : ''}"><h4>${esc(t('regions.venueList'))} <small>${venues.length}</small></h4>
          <ol>${venues.map(([n, a]) => `<li><b>${esc(n)}</b><span>${esc(a)}</span></li>`).join('')}</ol>
          ${venues.length > 6 ? `<button type="button" class="rg-more">${esc(t(rgOpen ? 'regions.collapse' : 'regions.expand'))}</button>` : ''}</div>`
        : `<p class="note">${esc(t('regions.onRequest'))}</p>`}
        ${['fargona', 'andijon', 'qoqon', 'margilon', 'asaka', 'namangan'].includes(r.key) ? `<details class="rg-valley"><summary>${esc(t('regions.valley'))}</summary><ol>${CITY_VENUES.valley.map(([n, a]) => `<li><b>${esc(n)}</b><span>${esc(a)}</span></li>`).join('')}</ol></details>` : ''}
        <div class="rg-actions">
          <button type="button" class="btn-quiet" data-rg-map><svg viewBox="0 0 16 16"><path d="M8 14s5-4.2 5-8.2A5 5 0 0 0 3 5.8C3 9.8 8 14 8 14z"/><circle cx="8" cy="6" r="1.8"/></svg>${esc(t('regions.showMap'))}</button>
          <button type="button" class="btn-quiet" data-rg-plan><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>${esc(t('ui.addPlan'))}</button>
          ${stores ? `<span class="rg-stores tnum"><b>${stores}</b> ${esc(t('regions.stores'))}</span>` : ''}
        </div>`;
      box.querySelector('.rg-more')?.addEventListener('click', () => { rgOpen = !rgOpen; renderCity(); });
      box.querySelector('[data-rg-map]').addEventListener('click', () => bus.dispatchEvent(new CustomEvent('flyto', { detail: { type: 'city', key: r.key } })));
      box.querySelector('[data-rg-plan]').addEventListener('click', (e) => {
        bus.dispatchEvent(new CustomEvent('planadd', { detail: 'regions' }));
        e.currentTarget.lastChild.textContent = t('card.added');
      });
    }
    box.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pickCity(b.dataset.pick)));
    box.classList.remove('is-swap');
    void box.offsetWidth;
    box.classList.add('is-swap');
  };
  const pickCity = (key, { scroll = false } = {}) => {
    rgKey = key;
    rgOpen = false;
    document.querySelectorAll('.rg-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.key === key)));
    renderCity();
    bus.dispatchEvent(new CustomEvent('regionfocus', { detail: key === 'all' ? null : key }));
    bus.dispatchEvent(new CustomEvent('region', { detail: key }));
    if (scroll) bus.dispatchEvent(new CustomEvent('scrollto', { detail: { el: document.querySelector('.rg-pick'), offset: -(innerHeight * 0.16) } }));
  };
  bus.addEventListener('regionpick', (e) => pickCity(e.detail, { scroll: true }));

  const renderRegions = () => {
    document.getElementById('rgBody').innerHTML = `
      <p class="lead">${esc(t('regions.lead'))}</p>
      ${readout([
        [`${num(REGIONS.venues)}+`, t('regions.venues'), null, 'rVenues', 'regions'],
        [num(REGIONS.visitorsDay), t('regions.visitors'), null, 'rVisitors', 'regions'],
        [REGIONS.playsDay, t('regions.plays'), null, 'rPlays', 'regions'],
        [REGIONS.monitorsPerVenue, t('regions.perVenue'), null, 'rPerVenue', 'regions'],
        [`${REGIONS.notice}%`, t('regions.notice'), null, 'rNotice', 'regions'],
        [`${REGIONS.see}%`, t('regions.see'), null, 'rSee', 'regions'],
      ])}
      <div class="rg-pick" role="group" aria-label="${esc(t('regions.pick'))}">
        <p class="rg-pick-k">${esc(t('regions.pick'))}</p>
        <div class="rg-chips">
          <button type="button" class="rg-chip" data-key="all" aria-pressed="${rgKey === 'all'}">${esc(t('regions.all'))}</button>
          ${REGIONS.rows.map((r) => `<button type="button" class="rg-chip" data-key="${r.key}" aria-pressed="${rgKey === r.key}">${esc(t(`cities.${r.key}`))}${r.iata ? `<small>${r.iata}</small>` : ''}</button>`).join('')}
        </div>
      </div>
      <div class="rg-city" id="rgCity" aria-live="polite"></div>
      ${profile(REGIONS.price)}`;
    document.querySelectorAll('.rg-chip').forEach((b) => b.addEventListener('click', () => pickCity(b.dataset.key)));
    renderCity();
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
