import { t, num, onLang, place, lang } from './i18n/index.js';
import { CITY_GALLERY } from './data/regions.js';
import { CITY_PHOTOS } from './data/photo-credits.js';
import { credit } from './ui/credit.js';
import { REGIONS, KORZINKA, HORECA, LED_FACTS, AIRPORT } from './data/inventory.js';
import { formatDMS, toXZ, toLonLat, EXAG, BBOX } from './scene/geo.js';
import { POSES } from './scene/world.js';

const UI = '.plate, .planner-sheet, .nav, .hero-copy, .hleaf, .hold-hub, .ab-plate, .ab-back, .footer, .lang-pop, .rail, .explore-fab, .explore-bar, .map-tip, .nav-scrim, .mobile-nav, .info-card, .callout, .wp.is-clickable';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Uzbekistan's extent: the explorer never leaves it
const UZ = { lon0: 56.2, lon1: 72.9, lat0: 37.3, lat1: 45.4 };


function hoursText(h) {
  if (!h) return '';
  if (h === '24/7') return '24/7';
  const m = h.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
  return m ? `${m[1]}–${m[2]}` : h;
}

export function initExplore(world, { bus, places, lenis, story }) {
  // ── DOM ──
  const fab = document.createElement('button');
  fab.className = 'explore-fab';
  fab.type = 'button';
  fab.setAttribute('aria-pressed', 'false');
  fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="ef-needle" d="M12 5.5l2.6 6.5L12 18.5 9.4 12z"/><path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2"/></svg><span></span>`;
  const bar = document.createElement('div');
  bar.className = 'explore-bar';
  const tip = document.createElement('div');
  tip.className = 'map-tip';
  tip.setAttribute('role', 'tooltip');
  const ring = document.createElement('div');
  ring.className = 'map-ring';
  const card = document.createElement('aside');
  card.className = 'info-card';
  card.setAttribute('aria-live', 'polite');
  document.body.append(fab, bar, tip, ring, card);

  const renderText = () => {
    fab.querySelector('span').textContent = t('map.explore');
    bar.innerHTML = `<p>${t('map.hint')}</p>
      <button type="button" class="btn-quiet" data-north title="${esc(t('map.north'))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l3.2 11L8 10.4l-3.2 2.1z" fill="currentColor" stroke="none"/></svg>${esc(t('map.north'))}</button>
      <button type="button" class="btn-quiet" data-exit><kbd>Esc</kbd>${esc(t('map.back'))}</button>`;
    bar.querySelector('[data-exit]').addEventListener('click', exit);
    bar.querySelector('[data-north]').addEventListener('click', () => { closeCard(); overview(); });
  };

  // ── Pickable things ──
  const rowByKey = Object.fromEntries(REGIONS.rows.map((r) => [r.key, r]));
  const korByTown = places.korzinka.reduce((m, s) => ((m[s.t] = (m[s.t] || 0) + 1), m), {});
  const items = [];
  items.push({ type: 'tas', w: world.hubWorld.clone().setY(world.hubWorld.y + 0.2), ll: [69.2812, 41.2579], dist: 46 });
  Object.entries(places.cities).forEach(([k, p]) => {
    if (!rowByKey[k] && k !== 'toshkent') return;
    items.push({ type: 'city', key: k, w: world.worldAt(p[0], p[1], 0.3), ll: p, dist: 60 });
  });
  places.horeca.forEach((h) => items.push({ type: 'horeca', name: h.n, a: h.a, h: h.h, w: world.worldAt(h.p[0], h.p[1], 0.3), ll: h.p, dist: 7 }));
  places.korzinka.forEach((s) => items.push({ type: 'korzinka', b: s.b, a: s.a, h: s.h, town: s.t, w: world.worldAt(s.p[0], s.p[1], 0.3), ll: s.p, dist: 7 }));

  const iconsOn = (type) => (type === 'korzinka' ? world.kor.uniforms.uOpacity.value : world.hor.uniforms.uOpacity.value) > 0.3;
  const proj = {};
  let hover = null;
  const pick = (x, y) => {
    let best = null;
    let bd = 20 * 20;
    for (const it of items) {
      if ((it.type === 'korzinka' || it.type === 'horeca') && !iconsOn(it.type)) continue;
      if ((it.type === 'city' || it.type === 'tas') && world.cur.dist < 25) continue;
      const p = world.project(it.w, proj);
      if (!p.visible) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };

  const titleOf = (it) => {
    if (it.type === 'tas') return 'TAS · UZTT';
    if (it.type === 'city') return t(`cities.${it.key}`);
    if (it.type === 'horeca') return it.name;
    if (it.type === 'town') return it.name;
    if (it.type === 'venue') return lang().code === 'ru' && it.v.nr ? it.v.nr : place(it.v.n);
    return `Korzinka${it.b ? ` · ${it.b}` : ''}`;
  };
  const tipHTML = (it) => {
    const sub = {
      tas: t('map.tas'),
      city: rowByKey[it.key] ? `${num(rowByKey[it.key].screens)} ${t('map.screens')} · ${num(rowByKey[it.key].venues)} ${t('map.venues')}` : '',
      horeca: it.a || t('map.horecaTip'),
      korzinka: place(it.a) || `${it.town}`,
      venue: it.type === 'venue' ? venueAddr(it.v) : '',
    }[it.type];
    return `<b>${esc(titleOf(it))}</b><span>${esc(sub)}</span><em>${t('map.flyHint')}</em>`;
  };
  const showTip = (it, x, y) => {
    hover = it;
    tip.innerHTML = tipHTML(it);
    const r = tip.getBoundingClientRect();
    let tx = x + 18;
    let ty = y - r.height - 14;
    if (tx + r.width > innerWidth - 12) tx = x - r.width - 18;
    if (ty < 70) ty = y + 18;
    tip.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    tip.classList.add('is-on');
    document.body.classList.add('is-pointing');
  };
  const hideTip = () => {
    hover = null;
    tip.classList.remove('is-on');
    if (!selected) ring.classList.remove('is-on');
    document.body.classList.remove('is-pointing');
  };

  // ── Info card ──
  let selected = null;
  const photoFor = (it) => {
    if (it.type === 'tas') return { src: 'air-arrival-32', own: true };
    // the city's own photograph (Wikimedia Commons, credited on the card)
    if (it.type === 'city') return CITY_PHOTOS[it.key] ? { src: `city-${it.key}`, own: true, credit: CITY_PHOTOS[it.key] } : { src: 'rg-checkout', own: false };
    if (it.type === 'horeca') {
      const n = it.name.toLowerCase();
      if (n.includes('жужа') || n.includes("jo'ja")) return { src: 'hr-axmad-night', own: false };
      if (n === 'soy') return { src: 'hr-soy', own: false };
      if (n.includes('rayhon')) return { src: 'hr-rayhon', own: false };
      return { src: 'hr-terrace-tv', own: false };
    }
    if (it.type === 'venue') {
      if (it.v.k === 'korzinka') return { src: 'kz-storefront', own: false };
      return { src: CITY_GALLERY[it.key] ? `rg/${it.key}-1` : 'rg-cafe-screens', own: false };
    }
    return { src: 'kz-storefront', own: false };
  };
  const venueAddr = (v) => (lang().code === 'ru' ? v.ar || v.a : v.a || place(v.ar));
  // directions in the two apps people in Uzbekistan actually use
  const routeHTML = (ll) => {
    const [lon, lat] = ll.map((x) => x.toFixed(6));
    return `<div class="ic-route"><span>${esc(t('card.route'))}</span>
      <a class="ic-map ic-map--y" href="https://yandex.uz/maps/?rtext=~${lat}%2C${lon}&rtt=auto" target="_blank" rel="noopener"><i>Я</i>Yandex Maps</a>
      <a class="ic-map ic-map--g" href="https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lon}" target="_blank" rel="noopener"><i>G</i>Google Maps</a></div>`;
  };
  const row = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '');
  const cardHTML = (it) => {
    const ph = photoFor(it);
    let body = '';
    let section = '';
    let plan = '';
    if (it.type === 'tas') {
      body = `<p>${esc(t('airport.lead'))}</p><dl>${row(t('airport.statYear'), num(AIRPORT.visitsYear))}${row('LED', `${LED_FACTS.count} · ${LED_FACTS.playsDay} ${t('units.plays')}`)}${row('IATA / ICAO', 'TAS / UZTT')}</dl>${routeHTML([69.2687, 41.2634])}`;
      section = 'airport';
    } else if (it.type === 'city' && !rowByKey[it.key]) {
      body = `<dl>${row(t('card.stores'), num(korByTown[t(`cities.${it.key}`)] || korByTown.Toshkent || 0))}${row(t('horeca.venues'), `${HORECA.venues}+`)}</dl>`;
      section = 'horeca';
    } else if (it.type === 'city') {
      const r = rowByKey[it.key];
      const k = korByTown[t(`cities.${it.key}`)] || korByTown[{ fargona: "Farg'ona", qoqon: "Qo'qon" }[it.key]] || 0;
      body = `<dl>${row(t('regions.thScreens'), num(r.screens))}${row(t('regions.thVenues'), num(r.venues))}${row(t('regions.thDaily'), num(r.daily))}${k ? row(t('card.stores'), num(k)) : ''}${row('', '')}</dl>`;
      section = 'regions';
      plan = 'regions';
    } else if (it.type === 'horeca') {
      body = `<dl>${row(t('card.address'), place(it.a))}${row(t('card.hours'), hoursText(it.h))}${row(t('horeca.dwell'), HORECA.dwell)}${row(t('horeca.plays'), HORECA.playsDay)}</dl>${routeHTML(it.ll)}`;
      section = 'horeca';
      plan = 'horeca';
    } else if (it.type === 'korzinka') {
      body = `<dl>${row(t('card.town'), it.town)}${row(t('card.address'), place(it.a))}${row(t('card.hours'), hoursText(it.h))}${row(t('korzinka.plays'), KORZINKA.playsDay)}</dl><p class="ic-sub">${esc(t('map.korzinkaSub'))}</p>${routeHTML(it.ll)}`;
      section = 'korzinka';
      plan = 'korzinka';
    } else if (it.type === 'venue') {
      const v = it.v;
      body = `<dl>${row(t('card.town'), t(`cities.${it.key}`))}${row(t('card.address'), venueAddr(v))}${row(t('card.hours'), hoursText(v.h))}${row(t('regions.plays'), v.k === 'korzinka' ? KORZINKA.playsDay : REGIONS.playsDay)}</dl>
        ${v.how === 'street' ? `<p class="ic-sub ic-approx">≈ ${esc(t('card.approx'))}</p>` : ''}${routeHTML(it.ll)}`;
      section = 'regions';
      plan = v.k === 'korzinka' ? 'korzinka' : 'regions';
    } else if (it.type === 'town') {
      body = `<dl>${row(t('card.stores'), num(korByTown[it.name] || 0))}</dl>`;
      section = 'korzinka';
      plan = 'korzinka';
    }
    return `<button type="button" class="ic-close" aria-label="${esc(t('card.close'))}"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      <figure class="ic-photo"><img src="/img/${ph.src}.webp" alt="" />${ph.own ? '' : `<figcaption>${esc(t('card.networkPhoto'))}</figcaption>`}${ph.credit ? credit(ph.credit) : ''}</figure>
      <div class="ic-body">
        <h3>${esc(titleOf(it))}</h3>
        ${body}
        <div class="ic-actions">
          <button type="button" class="btn-quiet" data-zoom><svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M7 5v4M5 7h4"/></svg>${esc(t('card.zoom'))}</button>
          ${plan ? `<button type="button" class="btn-quiet" data-plan="${plan}"><svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>${esc(t('card.add'))}</button>` : ''}
          <a class="btn-quiet" href="#${section}" data-section>${esc(t('card.open'))}</a>
        </div>
      </div>`;
  };
  const openCard = (it, { peek = false } = {}) => {
    selected = it;
    openedAt = scrollY;
    card.innerHTML = cardHTML(it);
    card.classList.add('is-on');
    card.classList.toggle('is-peek', peek && innerWidth < 700);
    card.querySelector('.ic-body h3').addEventListener('click', () => card.classList.remove('is-peek'));
    card.querySelector('.ic-close').addEventListener('click', closeCard);
    card.querySelector('[data-zoom]').addEventListener('click', () => flyTo(it, Math.max(2.5, world.goal.dist * 0.35)));
    card.querySelector('[data-plan]')?.addEventListener('click', (e) => {
      bus.dispatchEvent(new CustomEvent('planadd', { detail: e.currentTarget.dataset.plan }));
      e.currentTarget.classList.add('is-done');
      e.currentTarget.lastChild.textContent = t('card.added');
    });
    card.querySelector('[data-section]').addEventListener('click', () => { closeCard(); exit(); });
  };
  function closeCard() {
    selected = null;
    card.classList.remove('is-on');
    ring.classList.remove('is-on');
  }
  // the card is never modal: a press anywhere outside it puts it away (a press on another point opens that one
  // instead), and so does reading on through the story
  addEventListener('pointerdown', (e) => {
    if (!selected || e.target.closest?.('.info-card, .wp.is-clickable')) return;
    // on the explorer's map a drag still turns the view with the card open; a plain click there closes it on release
    if (exploring && !overUI(e)) return;
    closeCard();
  }, { capture: true });
  let openedAt = 0;
  addEventListener('scroll', () => {
    if (!selected || exploring) return;
    if (Math.abs(scrollY - openedAt) > innerHeight * 0.25) closeCard();
  }, { passive: true });

  // keep ring and card glued to their point while the camera moves; the card's size comes from an observer, so the
  // frame never reads layout after the map labels have been written
  let cardW = 0;
  let cardH = 0;
  new ResizeObserver(() => { cardW = card.offsetWidth; cardH = card.offsetHeight; }).observe(card);
  world.onFrame(() => {
    const target = selected || hover;
    if (!target) return;
    const p = world.project(target.w, proj);
    if (!p.visible) { if (!selected) hideTip(); return; }
    ring.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    ring.dataset.type = target.type;
    ring.classList.add('is-on');
    if (selected) {
      const cw = cardW;
      const ch = cardH;
      const mobile = innerWidth < 700;
      let x = p.x + 28;
      if (x + cw > innerWidth - 16) x = p.x - cw - 28;
      let y = clamp(p.y - ch * 0.4, 70, innerHeight - ch - 16);
      if (mobile) { x = 12; y = innerHeight - ch - 12; }
      card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });

  // ── Explore mode ──
  let exploring = false;
  const fitDist = () => {
    const aspect = innerWidth / innerHeight;
    const wkm = (UZ.lon1 - UZ.lon0) * 83.6;
    const hkm = (UZ.lat1 - UZ.lat0) * 110.6;
    const byW = (wkm * 1.02) / (0.5735 * aspect);
    const byH = (hkm * 1.02) / 0.62;
    return Math.min(Math.max(byW, byH), 2100);
  };
  const groundY = (tx, tz) => {
    const [lon, lat] = toLonLat(tx, tz);
    return (Math.max(0, world.sample(lon, lat)) / 1000) * EXAG;
  };
  // north-up view of the whole country, filling the screen
  function overview() {
    const [x, z] = toXZ(64.55, 41.25);
    Object.assign(world.goal, { tx: x, tz: z, ty: groundY(x, z), az: 0, el: 62, shift: 0, shiftY: 0, dist: fitDist() });
  }
  const constrain = () => {
    const g = world.goal;
    const [x0, z1] = toXZ(UZ.lon0, UZ.lat0);
    const [x1, z0] = toXZ(UZ.lon1, UZ.lat1);
    g.tx = clamp(g.tx, x0, x1);
    g.tz = clamp(g.tz, z0, z1);
    g.dist = clamp(g.dist, 2.5, fitDist());
    g.az = clamp(((g.az + 540) % 360) - 180, -50, 50);
    g.el = clamp(g.el, 28, 88);
    g.ty = groundY(g.tx, g.tz);
  };
  const enter = (fromCard) => {
    if (exploring) return;
    exploring = true;
    document.documentElement.classList.add('is-explore');
    lenis?.stop();
    story.setExplore(true);
    if (!fromCard) overview();
    fab.setAttribute('aria-pressed', 'true');
  };
  function exit() {
    if (!exploring) return;
    exploring = false;
    document.documentElement.classList.remove('is-explore');
    lenis?.start();
    story.setExplore(false);
    fab.setAttribute('aria-pressed', 'false');
    hideTip();
    closeCard();
  }
  fab.addEventListener('click', () => (exploring ? exit() : enter()));
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (selected) closeCard();
    else if (exploring) exit();
  });
  addEventListener('resize', () => { if (exploring) constrain(); });

  const flyTo = (it, dist) => {
    const [x, z] = toXZ(it.ll[0], it.ll[1]);
    enter(true);
    const g = world.goal;
    Object.assign(g, { tx: x, tz: z, dist: dist ?? it.dist, el: clamp(g.el, 45, 70), az: clamp(((g.az + 540) % 360) - 180, -30, 30), shift: 0, shiftY: innerWidth < 700 ? 0.22 : 0 });
    constrain();
    if (it.type === 'city') {
      bus.dispatchEvent(new CustomEvent('region', { detail: it.key }));
      if (world.city.has(it.key)) {
        story.setExploreCity(it.key);
        Object.assign(g, { dist: story.cityPose(it.key).dist, el: 44, az: -8 });
        constrain();
      }
    } else if (it.type !== 'venue') story.setExploreCity(null);
  };
  bus.addEventListener('venuecard', (e) => {
    const c = world.city.active;
    const v = c && c.key === e.detail.key ? c.venues[e.detail.i] : null;
    if (!v) return;
    openCard({ type: 'venue', key: c.key, v, w: v.w, ll: v.ll, dist: 1.4 });
  });
  bus.addEventListener('flyto', (e) => {
    const d = e.detail;
    let it;
    if (d.type === 'tas') it = items[0];
    else if (d.type === 'city') it = items.find((x) => x.type === 'city' && x.key === d.key);
    else if (d.type === 'horeca') it = items.find((x) => x.type === 'horeca' && x.name === d.name);
    else it = { type: 'town', name: d.name, ll: d.ll, dist: d.dist, w: world.worldAt(d.ll[0], d.ll[1], 0.4) };
    if (!it) return;
    flyTo(it);
    openCard(it, { peek: it.type === 'city' });
  });

  // ── Pointer: hover, click, orbit ──
  const ptrs = new Map();
  let downAt = null;
  let moved = 0;
  let pinch = null;
  const overUI = (e) => !!e.target.closest?.(UI);

  const pan = (dx, dy) => {
    const g = world.goal;
    const az = (g.az * Math.PI) / 180;
    const s = g.dist * 0.0014;
    const fx = Math.sin(az), fz = -Math.cos(az);
    const rx = Math.cos(az), rz = Math.sin(az);
    g.tx += (-dx * rx + dy * fx) * s;
    g.tz += (-dx * rz + dy * fz) * s;
    constrain();
  };

  addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) {
      const prev = ptrs.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(dx) + Math.abs(dy);
      if (!exploring || moved < 4) return;
      const g = world.goal;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) g.dist *= pinch / d;
        pinch = d;
        pan(dx * 0.5, dy * 0.5);
      } else if (e.shiftKey || e.buttons === 2 || e.buttons === 4 || e.pointerType === 'touch') {
        // a single finger pans on touch, like any map app
        pan(dx, dy);
      } else {
        g.az -= dx * 0.18;
        g.el += dy * 0.14;
        constrain();
      }
      hideTip();
      return;
    }
    if (!world.ready() || overUI(e) || e.pointerType === 'touch') { if (hover) hideTip(); return; }
    const it = pick(e.clientX, e.clientY);
    it ? showTip(it, e.clientX, e.clientY) : hideTip();
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    if (overUI(e) || !world.ready()) return;
    if (!exploring && e.pointerType !== 'touch' && !hover) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = { it: hover || (e.pointerType === 'touch' && exploring ? pick(e.clientX, e.clientY) : null) };
    moved = 0;
    pinch = null;
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    pinch = null;
    if (downAt && moved < 6 && downAt.it) {
      flyTo(downAt.it);
      openCard(downAt.it);
      hideTip();
    } else if (downAt && moved < 6 && selected) {
      // a click on the open map, away from any point, puts the card away
      closeCard();
    }
    downAt = null;
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('contextmenu', (e) => { if (exploring && !overUI(e)) e.preventDefault(); });
  addEventListener('wheel', (e) => {
    if (!exploring || overUI(e)) return;
    e.preventDefault();
    world.goal.dist *= Math.exp(e.deltaY * 0.0012);
    constrain();
  }, { passive: false });
  addEventListener('touchmove', (e) => { if (exploring && !overUI(e)) e.preventDefault(); }, { passive: false });

  renderText();
  onLang(() => { renderText(); if (selected) openCard(selected); });
  return { enter, exit, isExploring: () => exploring };
}

export { POSES };
