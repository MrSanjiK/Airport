import { POSES, TAS, PLATE } from './scene/world.js';
import { SITES, GROUPS } from './scene/city.js';
import { t, onLang, num, place, lang, ta } from './i18n/index.js';
import { REGIONS, LED_ZONES, LED_FACTS } from './data/inventory.js';
import { profile } from './sections.js';
import { formatDMS, toLonLat, toXZ } from './scene/geo.js';
import OA_MARK from './assets/oa-mark.svg?raw';

const CHAPTERS = ['hero', 'airport', 'flytv', 'mediagate', 'korzinka', 'horeca', 'regions', 'plan'];
const RAIL = { airport: 'mediaport', regions: 'region' };
const ALL = [...CHAPTERS, 'explore', 'about'];
const TRI = '<svg class="wp-tri" viewBox="0 0 15 13" aria-hidden="true"><path d="M7.5 1.2L13.8 11.8H1.2z"/></svg>';
const DOT = '<svg class="wp-tri wp-pin" viewBox="0 0 15 13" aria-hidden="true"><circle cx="7.5" cy="6.5" r="4.4"/></svg>';
const AERO = '<svg class="wp-aero" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 4.5l1.6 5.4 5.4 2.1-5.4 1.9L12 19.5l-1.6-5.6L5 12l5.4-2.1z"/></svg>';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAngle = (a, b, k) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;

export function initStory(world, { places, nav, bus }) {
  const labelsEl = document.getElementById('labels');
  const leaders = document.getElementById('leaders');
  const rail = document.getElementById('rail');
  const coord = document.getElementById('coord');
  const coordV = document.getElementById('coordV');
  const labels = [];
  const tmpV = world.hubWorld.clone();
  const tmpTas = world.hubWorld.clone();
  const tasDrop = world.hubWorld.clone();
  let heroW = 1;
  const heroCopy = document.querySelector('.hero-copy');
  const holding = document.getElementById('holding');
  const legendEl = document.querySelector('.legend-sheet');

  const addLabel = ({ cls = '', world: w, html, weights, onClick, key, far = 0, near = 0 }) => {
    const el = document.createElement('div');
    el.className = `wp ${cls}`;
    el.innerHTML = html();
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    if (onClick) {
      el.addEventListener('click', onClick);
      el.classList.add('is-clickable');
    }
    labelsEl.append(el);
    const l = { el, w, html, weights, key, op: 0, proj: {}, far, near, prio: 0, size: null, cluster: cls.includes('wp--cluster'), tf: 'none', os: '0', pe: '' };
    labels.push(l);
    return l;
  };
  const fly = (detail) => bus.dispatchEvent(new CustomEvent('flyto', { detail }));

  // TAS
  addLabel({
    cls: 'wp--tas',
    // in the hero the label hangs below the model of the field, under its middle, rather than over the terminal
    world: () => {
      const sc = world.airport.group.scale.x * heroW;
      const [fx, fz] = world.airport.fieldC;
      return tmpTas.copy(world.hubWorld).add(tasDrop.set(fx * sc, 0.1, (fz + 1.15) * sc));
    },
    html: () => `${AERO}<span class="wp-box"><span class="wp-name">TAS</span><span class="wp-sub">${t('map.tas')}</span></span>`,
    weights: { hero: 1, korzinka: 0.7, horeca: 0.6, regions: 0.8, plan: 0.8, explore: 1, about: 0.8 },
    onClick: () => fly({ type: 'tas' }),
    key: 'tas',
  }).prio = 75;

  // Network cities: boxed chart labels
  const rowByKey = Object.fromEntries(REGIONS.rows.map((r) => [r.key, r]));
  const heroCities = ['samarqand', 'buxoro', 'jizzax', 'qoqon', 'fargona', 'namangan', 'andijon'];
  Object.entries(places.cities).forEach(([k, p]) => {
    const row = rowByKey[k];
    if (!row) return;
    addLabel({
      world: world.worldAt(p[0], p[1], 0.3),
      html: () => `${TRI}<span class="wp-box"><span class="wp-name">${t(`cities.${k}`)}${row.iata ? `<span class="wp-code">${row.iata}</span>` : ''}</span><span class="wp-sub">${num(row.screens)}${ta()} ${t('map.screens')} · ${num(row.venues)}${ta()} ${t('map.venues')}</span></span>`,
      weights: { hero: heroCities.includes(k) ? 0.9 : 0, regions: 1, plan: 0.8, korzinka: 0.5, explore: 1, about: 1 },
      // in the Regions chapter a city label picks the city in the plate; elsewhere it opens the map card
      onClick: () => (active === 'regions' && !exploring ? bus.dispatchEvent(new CustomEvent('regionpick', { detail: k })) : fly({ type: 'city', key: k })),
      key: k,
      far: 1,
    }).prio = 60 + row.screens / 10;
  });

  // Korzinka clusters by real town, and the HoReCa cluster in Tashkent
  const towns = new Map();
  places.korzinka.forEach((s) => {
    const g = towns.get(s.t) || { n: 0, x: 0, y: 0 };
    g.n++;
    g.x += s.p[0];
    g.y += s.p[1];
    towns.set(s.t, g);
  });
  towns.forEach((g, name) => {
    const ll = [g.x / g.n, g.y / g.n];
    addLabel({
      cls: 'wp--cluster',
      world: world.worldAt(ll[0], ll[1], 0.4),
      html: () => `${DOT}<span class="wp-box"><span class="wp-name">${name}</span><span class="wp-sub">${g.n}${ta()} Korzinka</span></span>`,
      weights: { korzinka: 1, regions: 0.6, plan: 0.5, explore: 1, about: 0.6 },
      onClick: () => fly({ type: 'town', name, ll, dist: g.n > 20 ? 34 : 14 }),
      key: `town-${name}`,
      far: 1,
    }).prio = 30 + Math.min(g.n, 60);
  });
  const hc = places.horeca.reduce((a, h) => [a[0] + h.p[0] / places.horeca.length, a[1] + h.p[1] / places.horeca.length], [0, 0]);
  addLabel({
    cls: 'wp--cluster wp--cluster-h',
    world: world.worldAt(hc[0], hc[1], 0.4),
    html: () => `${DOT}<span class="wp-box"><span class="wp-name">HoReCa · ${t('cities.toshkent')}</span><span class="wp-sub">75+${ta()} ${t('horeca.venues')}</span></span>`,
    weights: { horeca: 1, explore: 1, plan: 0.5, about: 0.8 },
    onClick: () => fly({ type: 'town', name: t('cities.toshkent'), ll: hc, dist: 30 }),
    key: 'horeca-cluster',
    far: 1,
  }).prio = 85;
  // the head office, on the About page only: a pin on block C of Nest One, once its neighbourhood has risen
  const office = [69.2527619, 41.3120115]; // Nest One, block C
  const officeFallback = world.worldAt(office[0], office[1], 0.05);
  const officeLabel = addLabel({
    cls: 'wp--office',
    world: () => world.office?.anchor || officeFallback,
    html: () => `<span class="wp-oa" aria-hidden="true">${OA_MARK}</span><span class="wp-box"><span class="wp-name">Orient Advertising</span><span class="wp-sub">Nest One · ${t('about.officeBlock')}</span></span>`,
    weights: { about: 1 },
    key: 'office',
  });
  officeLabel.prio = 99;
  officeLabel.when = () => world.cur.dist < 12 && (world.office?.k ?? 0) > 0.6;

  // Airport zones: numbered markers on the OSM terminal plan, named by callouts
  const ag = world.airport.group;
  const local = (v) => () => ag.localToWorld(tmpV.copy(v));
  const pickZone = (id) => {
    bus.dispatchEvent(new CustomEvent('zone', { detail: id }));
    bus.dispatchEvent(new CustomEvent('zonepick', { detail: id }));
    // on the plate the camera comes down onto the zone picked
    const i = LED_ZONES.findIndex((z) => z.id === id);
    if (i >= 0 && weights.airport > 0.5 && frame.offsetParent) { const v = zoneLabels[i].w(); focusOn({ x: v.x, y: world.goal.ty, z: v.z }, 0.62); }
  };
  const zoneLabels = LED_ZONES.map((z, i) => {
    const l = addLabel({
      cls: 'wp--zone',
      world: local(world.airport.zoneLocal(z.terminal, z.spot, z.outdoor)),
      html: () => `<span class="wp-dot">${i + 1}</span>`,
      weights: { airport: 1 },
      onClick: () => pickZone(z.id),
      key: `zone-${z.id}`,
    });
    // the numbers come up once the plate holds the screen, not in a knot over the terminal during the dive
    l.when = () => weights.airport > 0.72;
    l.zoneIdx = i;
    return l;
  });
  // The approach plate around the 3D airport (comp-3): title band, callouts on leaders, zone photo, price profile.
  const frame = document.createElement('div');
  frame.className = 'apt-frame';
  frame.innerHTML = `<div class="apt-band"></div><div class="apt-foot"><figure class="apt-photo" role="button" tabindex="0"><img src="/img/air-arrival-32.webp" alt="" width="1600" height="890" /><figcaption></figcaption></figure><div class="apt-profile" role="button" tabindex="0"></div></div>`;
  // the photo and the price ladder on the plate both lead to the zone's row in the list
  frame.querySelectorAll('.apt-photo, .apt-profile').forEach((el) => {
    el.addEventListener('click', () => pickZone(curZone));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') pickZone(curZone); });
  });
  labelsEl.append(frame);
  // the field inside the frame is a model to handle: drag to turn it, pinch (or the buttons) to zoom, double-click to
  // come down on a spot, a zone to fly to it; the view returns to the plate's own once the chapter is left
  const stage = document.createElement('div');
  stage.className = 'apt-stage';
  stage.tabIndex = 0;
  stage.innerHTML = `<p class="apt-hint"><i aria-hidden="true"></i><span></span></p><div class="apt-ctl"><button type="button" data-z="out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button><button type="button" data-z="in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button><button type="button" data-z="reset"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V8h3.5"/></svg></button></div>`;
  frame.append(stage);
  const orbit = { az: 0, el: 0, zoom: 1, fx: 0, fy: 0, fz: 0, fk: 0, fGoal: 0, vaz: 0, vel: 0, drag: null };
  const resetOrbit = () => Object.assign(orbit, { az: 0, el: 0, zoom: 1, fGoal: 0, vaz: 0, vel: 0 });
  if (import.meta.env.DEV) window.__orbit = orbit;
  const touched = () => { frame.classList.add('is-touched'); world.invalidate(); };
  const zoomBy = (f) => { orbit.zoom = clamp(orbit.zoom * f, 0.28, 1.9); touched(); };
  const focusOn = (v, zoom) => { orbit.fx = v.x; orbit.fy = v.y; orbit.fz = v.z; orbit.fGoal = 1; if (zoom) orbit.zoom = zoom; touched(); };
  const labelCtl = () => {
    stage.querySelector('.apt-hint span').textContent = t('airport.hint');
    stage.querySelectorAll('.apt-ctl button').forEach((b) => { const k = { in: 'zoomIn', out: 'zoomOut', reset: 'reset' }[b.dataset.z]; b.setAttribute('aria-label', t(`airport.${k}`)); b.title = t(`airport.${k}`); });
    stage.setAttribute('aria-label', t('airport.hint'));
  };
  labelCtl();
  onLang(labelCtl);
  stage.querySelector('.apt-ctl').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.z === 'in') zoomBy(0.72);
    else if (b.dataset.z === 'out') zoomBy(1 / 0.72);
    else { resetOrbit(); frame.classList.remove('is-touched'); world.invalidate(); }
  });
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.apt-ctl')) return;
    // no text selection, no native drag: the gesture belongs to the model
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    orbit.drag = { x: e.clientX, y: e.clientY };
    orbit.vaz = orbit.vel = 0;
    stage.classList.add('is-drag');
  });
  stage.addEventListener('pointermove', (e) => {
    const d = orbit.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    orbit.az += -dx * 0.3 * rtl;
    orbit.el = clamp(orbit.el + dy * 0.2, -30, 26);
    // the release speed is a smoothed, capped hand speed: a flick glides on a little, never spins the field round
    orbit.vaz = orbit.vaz * 0.6 + clamp(-dx * 0.3 * rtl, -3, 3) * 0.4;
    orbit.vel = orbit.vel * 0.6 + clamp(dy * 0.2, -2, 2) * 0.4;
    if (Math.abs(dx) + Math.abs(dy) > 1) touched();
  });
  const endDrag = (e) => { if (!orbit.drag) return; orbit.drag = null; stage.classList.remove('is-drag'); try { stage.releasePointerCapture(e.pointerId); } catch (_) {} };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  // a pinch on a trackpad (ctrl + wheel) zooms the model; a plain wheel still scrolls the page
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    zoomBy(Math.exp(e.deltaY * 0.012));
  }, { passive: false });
  stage.addEventListener('dblclick', (e) => {
    const ll = world.pick(e.clientX, e.clientY);
    if (!ll) return;
    const [x, z] = toXZ(ll[0], ll[1]);
    focusOn({ x, y: world.goal.ty, z }, clamp(orbit.zoom * 0.6, 0.28, 1.9));
  });
  stage.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
    if (k) { e.preventDefault(); orbit.az += k[0]; orbit.el = clamp(orbit.el + k[1], -30, 26); touched(); }
    else if (e.key === '+' || e.key === '=') zoomBy(0.72);
    else if (e.key === '-') zoomBy(1 / 0.72);
  });
  // over the model the pointer parallax rests, so the view holds still under the hand
  stage.addEventListener('pointerenter', () => { world.state.parallax = 0; });
  stage.addEventListener('pointerleave', () => { world.state.parallax = 1; });
  const callWrap = document.createElement('div');
  callWrap.className = 'callouts';
  frame.append(callWrap);
  let curZone = 'arr32';
  const renderFrame = () => {
    frame.querySelector('.apt-band').textContent = t('airport.plate');
    const z = LED_ZONES.find((x) => x.id === curZone) || LED_ZONES[4];
    const fig = frame.querySelector('.apt-photo');
    // resolutions stay left-to-right inside Arabic text (bdi), or 10112×786 reads back as 786×10112
    fig.querySelector('figcaption').innerHTML = `${t(`airport.zones.${z.id}`)} · <bdi dir="ltr">${z.res}</bdi> · ${LED_FACTS.spotSec} ${t('units.sec')} · ${LED_FACTS.playsDay}${ta()} ${t('units.plays')}`;
    const img = fig.querySelector('img');
    if (!img.src.endsWith(`${z.img}.webp`)) { fig.classList.remove('is-in'); img.onload = () => fig.classList.add('is-in'); img.src = `/img/${z.img}.webp`; }
    else if (img.complete) fig.classList.add('is-in');
    else img.onload = () => fig.classList.add('is-in');
    const pr = frame.querySelector('.apt-profile');
    // drawn at the foot's own pixel width, so axis labels stay at reading size
    pr.innerHTML = profile(z.price, t('airport.profile'), { w: Math.max(320, Math.round(pr.clientWidth - 36)), pair: true });
    requestAnimationFrame(() => {
      const prof = pr.querySelector('[data-profile]');
      const line = prof?.querySelector('.p-line');
      if (line) prof.style.setProperty('--len', Math.ceil(line.getTotalLength()));
      requestAnimationFrame(() => prof?.classList.add('is-in'));
    });
  };
  const callouts = LED_ZONES.map((z, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'callout';
    el.dataset.zone = z.id;
    el.addEventListener('click', () => pickZone(z.id));
    callWrap.append(el);
    return { el, z, i };
  });
  const renderCallouts = () => callouts.forEach(({ el, z, i }) => {
    el.innerHTML = `<b>${i + 1}</b><span>${t(`airport.zones.${z.id}`)}</span><small><bdi dir="ltr">${z.res}</bdi></small>`;
  });
  renderCallouts();
  renderFrame();
  world.airport.rwLabels.forEach((r) => {
    const [a, b] = (r.ref || '').split('/');
    // runway ends yield to venue clusters
    [[r.a, a], [r.b, b]].forEach(([w, txt]) => { if (txt) addLabel({ cls: 'wp--rw', world: local(w), html: () => `<span class="wp-name">${txt}</span>`, weights: { explore: 1 }, key: `rw-${txt}` }).prio = 20; });
  });

  onLang(() => { labels.forEach((l) => { l.el.innerHTML = l.html(); l.sizeStale = true; }); renderCallouts(); renderFrame(); world.invalidate(); });

  bus.addEventListener('zone', (e) => {
    world.invalidate();
    zoneLabels.forEach((l) => l.el.classList.toggle('is-active', l.key === `zone-${e.detail}`));
    callouts.forEach((c) => c.el.classList.toggle('is-active', c.z.id === e.detail));
    curZone = e.detail;
    renderFrame();
  });
  bus.addEventListener('region', (e) => labels.forEach((l) => l.el.classList.toggle('is-active', l.key === e.detail)));

  // Rail
  rail.innerHTML = `<ol><span class="rail-fill"></span>${CHAPTERS.slice(1).map((c) => `<li><a href="#${c}" data-c="${c}"><span>${t(`rail.${RAIL[c] || c}`)}</span><i></i></a></li>`).join('')}</ol>`;
  onLang(() => rail.querySelectorAll('a').forEach((a) => (a.querySelector('span').textContent = t(`rail.${RAIL[a.dataset.c] || a.dataset.c}`))));
  const railLinks = [...rail.querySelectorAll('a')];
  let railP = '';
  let railWant = '';
  let railOn = null;
  // the rail is written with the other styles, at the end of the frame
  const flushRail = () => {
    if (railWant !== railP) { railP = railWant; rail.style.setProperty('--p', railP); }
    if (railOn !== active) {
      railOn = active;
      const ai = CHAPTERS.indexOf(active);
      railLinks.forEach((el) => {
        el.classList.toggle('is-on', el.dataset.c === active);
        el.classList.toggle('is-past', CHAPTERS.indexOf(el.dataset.c) < ai);
      });
    }
  };

  // Scroll keyframes
  const HERO_T = POSES.hero.t.slice();
  let keys = [];
  const measure = () => {
    const vh = innerHeight;
    // centre the terminal in the airport plate's field, wherever the frame lands at this width
    const fr = frame.getBoundingClientRect();
    if (fr.width) POSES.airport.shift = Math.abs(fr.left + fr.width / 2 - innerWidth / 2) / innerWidth;
    // a phone's narrow hero looks a little further east, so the airfield's model (east of the terminal) stays whole
    POSES.hero.t = innerWidth < 700 ? [HERO_T[0] + 0.62, HERO_T[1] + 0.05] : HERO_T;
    // the hero terminal stands clear below the holding chart (its tower tip sits a quarter down the screen unshifted)
    POSES.hero.shiftY = holding.offsetParent ? -clamp((holding.offsetTop + holding.offsetHeight) / innerHeight + 0.035 - 0.25, 0, 0.2) : 0;
    keys = CHAPTERS.map((id) => {
      const el = document.querySelector(`[data-chapter="${id}"]`);
      const top = el.getBoundingClientRect().top + scrollY;
      const y = id === 'hero' ? 0 : id === 'plan' ? top + vh * 0.15 : top + vh * 0.42;
      // a long chapter holds its view until its own end reaches the screen's foot, so the map never fades
      // into the next chapter while this one is still being read (the airport zones run ten deep)
      const y2 = el.classList.contains('chapter') ? Math.max(y, top + el.offsetHeight - vh * 1.05) : y;
      return { id, y, y2, pose: world.goalFromPose(POSES[id]) };
    });
  };
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);

  const weights = Object.fromEntries(ALL.map((c) => [c, 0]));
  let introDone = false;
  let cameraFree = false;
  let focus = null;
  let regionKey = null;
  let exploreCity = null;
  let shownCity = null;
  // a city with a model is viewed close enough to read its streets; the rest from a regional height
  const cityPose = (key, shift = 0) => {
    const s0 = SITES[key];
    if (s0) return { t: [s0[0], s0[1]], dist: Math.max(6, s0[2] * 2.2), az: -8, el: 46, shift };
    return { t: places.cities[key] || places.cities.toshkent, dist: GROUPS[key] ? 150 : 240, az: 0, el: 50, shift };
  };
  bus.addEventListener('regionfocus', (e) => {
    regionKey = e.detail || null;
    focus = regionKey && places.cities[regionKey] ? world.goalFromPose(cityPose(regionKey, POSES.regions.shift)) : null;
  });
  let fitted = null;
  // the venues' extent (with the centre) sets the target and the distance; the view leans a little for depth
  const fitVenues = (c, shift) => {
    const pts = [...c.venues.map((v) => v.ll), c.center];
    const lon = pts.map((p) => p[0]);
    const lat = pts.map((p) => p[1]);
    const cx = (Math.min(...lon) + Math.max(...lon)) / 2;
    const cy = (Math.min(...lat) + Math.max(...lat)) / 2;
    const ext = Math.max((Math.max(...lon) - Math.min(...lon)) * 85, (Math.max(...lat) - Math.min(...lat)) * 110.6);
    const room = shift ? 0.5 : 0.85;
    // on a phone the bottom sheet takes the lower half: the town is framed in the upper part
    const phone = innerWidth < 700;
    return { t: [cx, cy], dist: Math.max(3.2, (ext * 1.35) / (phone ? 0.62 : room)), az: -8, el: 46, shift, shiftY: phone ? 0.22 : 0 };
  };
  // venue labels for a city model, built the first time it is shown
  const venueLabels = new Map();
  const KIND = { korzinka: 'Korzinka', makro: 'Makro' };
  const addVenueLabels = (c) => {
    bus.dispatchEvent(new CustomEvent('cityvenues', { detail: { key: c.key, venues: c.venues } }));
    venueLabels.set(c.key, c.venues.map((v) => {
      const l = addLabel({
        cls: `wp--venue wp--${v.k}`,
        world: v.w,
        html: () => `${DOT}<span class="wp-box"><span class="wp-name">${escH(lang().code === 'ru' && v.nr ? v.nr : place(v.n))}</span><span class="wp-sub">${escH(KIND[v.k] || t('card.kindCafe'))}${v.how === 'street' ? ' · ≈' : ''}</span></span>`,
        weights: {},
        onClick: () => bus.dispatchEvent(new CustomEvent('venuecard', { detail: { key: c.key, i: v.i } })),
        key: `v-${c.key}-${v.i}`,
      });
      l.cityKey = c.key;
      l.kind = v.k;
      l.prio = 95 - (v.how === 'street' ? 10 : 0);
      return l;
    }));
  };
  // the HoReCa chapter's Tashkent model (2.8 MB, 75 venue labels) is fetched, built, uploaded and labelled while the
  // reader is still a few chapters above it, in idle time, so arriving there costs nothing
  let preloaded = false;
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 400));
  const preloadCity = (key) => {
    if (preloaded) return;
    preloaded = true;
    world.city.load(key).then((c) => {
      if (!c || venueLabels.has(key)) return;
      idle(() => {
        if (venueLabels.has(key)) return;
        addVenueLabels(c);
        // their sizes are read in a later idle slot, one layout for all of them
        idle(() => venueLabels.get(key)?.forEach((l) => { l.size = [l.el.offsetWidth || 90, l.el.offsetHeight || 34]; l.sizeStale = false; }));
      });
    });
  };
  let exploring = false;
  // the About page takes the screen: the story's chapters rest, the page itself steers the camera
  let aboutMode = false;
  let aboutCity = null;
  let active = 'hero';
  const frameState = () => {
    if (exploring) {
      ALL.forEach((c) => (weights[c] = 0));
      weights.explore = 1;
      return;
    }
    weights.explore = 0;
    if (aboutMode) {
      ALL.forEach((c) => (weights[c] = 0));
      weights.about = 1;
      return;
    }
    weights.about = 0;
    const y = scrollY;
    let i = 0;
    while (i < keys.length - 2 && y > keys[i + 1].y) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const raw = clamp((y - a.y2) / Math.max(1, b.y - a.y2));
    const k = smooth(clamp((raw - 0.12) / 0.76));
    CHAPTERS.forEach((c) => (weights[c] = 0));
    weights[a.id] = 1 - k;
    weights[b.id] = k;
    if (cameraFree) {
      // a flight, not a pan: across a long hop the camera climbs, crosses the chart high and looking down, and dives
      // onto the next subject; the ground track moves mostly while it is high (zoom-out, pan, zoom-in)
      const travel = Math.hypot(b.pose.tx - a.pose.tx, b.pose.tz - a.pose.tz);
      const reach = travel / Math.max(1, Math.min(a.pose.dist, b.pose.dist));
      const lift = Math.sin(Math.PI * k) * Math.min(1.1, Math.log(1 + reach * 0.9) * 0.55);
      const pf = clamp(reach / 3);
      const kt = lerp(k, k * k * k * (k * (6 * k - 15) + 10), pf);
      const g = {
        tx: lerp(a.pose.tx, b.pose.tx, kt), ty: lerp(a.pose.ty, b.pose.ty, kt), tz: lerp(a.pose.tz, b.pose.tz, kt),
        dist: Math.exp(lerp(Math.log(a.pose.dist), Math.log(b.pose.dist), k) + lift),
        az: lerpAngle(a.pose.az, b.pose.az, k), el: Math.min(82, lerp(a.pose.el, b.pose.el, k) + lift * 14), shift: lerp(a.pose.shift, b.pose.shift, k), shiftY: lerp(a.pose.shiftY || 0, b.pose.shiftY || 0, k),
      };
      // a city picked in the Regions plate pulls the chart down onto it while that chapter holds the screen
      const fw = focus ? weights.regions : 0;
      if (fw > 0.001) {
        const f = focus;
        Object.assign(g, {
          tx: lerp(g.tx, f.tx, fw), ty: lerp(g.ty, f.ty, fw), tz: lerp(g.tz, f.tz, fw),
          dist: Math.exp(lerp(Math.log(g.dist), Math.log(f.dist), fw)), az: lerpAngle(g.az, f.az, fw), el: lerp(g.el, f.el, fw), shift: lerp(g.shift, f.shift, fw),
        });
      }
      // the visitor's own view of the airport plate (turned, zoomed, come down onto a zone), held while it is read
      const ow = weights.airport;
      orbit.fk += (orbit.fGoal - orbit.fk) * 0.12;
      if (ow > 0.001 && (orbit.az || orbit.el || orbit.zoom !== 1 || orbit.fk > 0.001)) {
        g.az += orbit.az * ow;
        g.el = clamp(g.el + orbit.el * ow, 18, 84);
        g.dist *= Math.pow(orbit.zoom, ow);
        const fk = orbit.fk * ow;
        g.tx = lerp(g.tx, orbit.fx, fk); g.ty = lerp(g.ty, orbit.fy, fk); g.tz = lerp(g.tz, orbit.fz, fk);
      }
      world.setGoal(g);
    }
    // a released drag glides to a stop; leaving the chapter puts the plate's own view back
    if (!orbit.drag && (Math.abs(orbit.vaz) > 0.01 || Math.abs(orbit.vel) > 0.01)) {
      orbit.vaz *= 0.86; orbit.vel *= 0.86;
      orbit.az += orbit.vaz; orbit.el = clamp(orbit.el + orbit.vel, -30, 26);
    }
    if (weights.airport < 0.04 && !orbit.drag && (orbit.az || orbit.el || orbit.zoom !== 1 || orbit.fGoal)) { resetOrbit(); orbit.fk = 0; frame.classList.remove('is-touched'); }
    const now = k < 0.5 ? a.id : b.id;
    if (now !== active) {
      active = now;
      nav.setCurrent(active === 'hero' ? '' : active);
    }
    if (introDone && CHAPTERS.indexOf(active) >= 2) preloadCity('toshkent');
    const docH = document.documentElement.scrollHeight - innerHeight;
    railWant = clamp(y / Math.max(1, docH)).toFixed(4);
  };

  // Hero: the holding chart. Orient Advertising branches into the airport's three brands and TV Line's three
  // networks; every leaf is the doorway to its chapter.
  const wires = document.getElementById('holdWires');
  const plateEls = [...holding.querySelectorAll('.hleaf')];
  plateEls.forEach((el) => {
    el.setAttribute('role', 'link');
    el.tabIndex = 0;
    const go = () => bus.dispatchEvent(new CustomEvent('goto', { detail: el.dataset.plate }));
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  // org-chart wiring, laid out from the boxes themselves (offsets are untouched by the tilt)
  const box = (el) => { let x = 0; let y = 0; let n = el; while (n && n !== holding) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
  const elbow = (x1, y1, x2, y2, yb, cls) => {
    const r = Math.min(8, Math.abs(x2 - x1) / 2);
    if (r < 1) return `<path class="${cls}" pathLength="1" d="M${x1} ${y1}V${y2}"/>`;
    const s = Math.sign(x2 - x1);
    return `<path class="${cls}" pathLength="1" d="M${x1} ${y1}V${yb - r}Q${x1} ${yb} ${x1 + s * r} ${yb}H${x2 - s * r}Q${x2} ${yb} ${x2} ${yb + r}V${y2}"/>`;
  };
  const wire = () => {
    if (!holding.offsetParent) return;
    const hub = box(holding.querySelector('.hold-hub'));
    const hx = hub.x + hub.w / 2;
    const hy = hub.y + hub.h;
    let svg = '';
    const dots = [[hx, hy]];
    holding.querySelectorAll('.hold-group').forEach((g) => {
      const head = box(g.querySelector('.hold-gk'));
      const gx = head.x + head.w / 2;
      svg += elbow(hx, hy, gx, head.y, (hy + head.y) / 2, 'hw-group');
      dots.push([gx, head.y], [gx, head.y + head.h]);
      const leaves = [...g.querySelectorAll('.hleaf')].map(box);
      const ly = leaves[0].y;
      leaves.forEach((l) => {
        const lx = l.x + l.w / 2;
        svg += elbow(gx, head.y + head.h, lx, ly, (head.y + head.h + ly) / 2, 'hw-leaf');
        dots.push([lx, ly]);
      });
    });
    svg += dots.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`).join('');
    wires.innerHTML = svg;
  };
  wire();
  addEventListener('resize', wire);
  onLang(() => requestAnimationFrame(wire));
  document.fonts?.ready.then(wire);
  // two leaders reach the map: the airport's brands to the terminal they share, Region to the Fergana valley towns
  const anchors = {
    flytv: world.hubWorld.clone().setY(world.hubWorld.y + 0.4),
    regions: world.worldAt(...places.cities.fargona, 0.3),
  };
  const ptr = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  const proj = {};
  let lastSvg = null;
  let frameLive = null;
  let blockEls = [];
  let blockMode = null;
  let blockAge = 0;
  // Every frame reads the page's geometry first and writes styles after: a read after a write would force the
  // browser to recompute styles and layout mid-frame, many times over with two hundred labels on screen.
  const foot = frame.querySelector('.apt-foot');
  let calloutStale = true;
  addEventListener('resize', () => { calloutStale = true; });
  onLang(() => { calloutStale = true; });
  world.onFrame(() => {
    const framePlaced = !!frame.offsetParent;
    const holdPlaced = !!holding.offsetParent;
    frameState();
    const w = weights;
    document.documentElement.classList.toggle('at-map', w.hero > 0.5 || exploring);
    const ex = w.explore;
    const dist = world.cur.dist;
    // far: clusters and city labels; near: individual venue icons
    heroW = w.hero;
    const nearK = 1 - clamp((dist - 70) / 130);
    const farK = clamp((dist - 60) / 110);

    // the hero shows the whole airfield as a model on the map, sized for the screen: a landmark on desktop, never a
    // wall over the copy on a phone; at ~40x it hands over to the airport plate's 44x without a change of scale
    const heroS = 43 * Math.min(1, Math.max(0.42, (Math.min(innerWidth, innerHeight * 1.6) - 300) / 1100));
    // the terminal keeps its plate size through all three airport directions
    const wAir = w.airport + w.flytv + w.mediagate;
    const as = 1 + heroS * w.hero + (PLATE.scale - 1) * wAir;
    // the model keeps the same 4x height exaggeration everywhere, as it reads on the About page
    // at the hero's scale the field's buildings would lie flat on it: they stand taller there, so the terminals and
    // the control tower read as a model; the extra height eases out as the camera dives onto the plate
    world.airport.group.scale.set(as, as * (1 + 1.6 * w.hero), as);
    // the terminal stands on the levelled Tashkent plate when that model is up
    world.airport.group.position.y = world.city.flatY(world.airport.group.position.x, world.airport.group.position.z, world.hubWorld.y);
    // a phone has no plate frame: there the airport chapter shows the diorama too
    world.airport.setSymbol(w.hero, framePlaced ? w.airport : 0, w.flytv + w.mediagate + (framePlaced ? 0 : w.airport));
    if (world.roads) world.roads.city = 1 - clamp((w.hero + wAir) * 1.4);
    world.airport.setHot(w.airport);
    const cityNow = world.city.active;
    const noCity = 1 - world.city.k;
    world.kor.uniforms.uOpacity.value = clamp(w.korzinka + w.regions * 0.6 + w.plan * 0.5 + w.horeca * 0.45 + ex + w.about * 0.8) * nearK * noCity;
    world.hor.uniforms.uOpacity.value = clamp(w.horeca * 1.4 + w.plan * 0.5 + ex + w.about * 0.8) * nearK * noCity;
    if (world.roads) world.roads.fade = noCity;
    const px = world.renderer.getPixelRatio();
    world.kor.uniforms.uPx.value = world.hor.uniforms.uPx.value = px;
    world.kor.uniforms.uSize.value = 20 + 6 * (1 - clamp((dist - 10) / 60));
    world.hor.uniforms.uSize.value = 24 + 6 * (1 - clamp((dist - 10) / 60));
    // the network is read from its venues and cities, not drawn as a route
    world.route.opacity = 0;
    // which city model is up: the explorer's pick, else the Regions plate's pick while that chapter holds the screen
    // in the explorer a model also comes up by itself wherever the camera comes down near a place with venues
    let autoSite = null;
    if (exploring && !exploreCity && dist < 45) {
      const [tl, ta] = toLonLat(world.cur.tx, world.cur.tz);
      autoSite = world.city.siteAt(tl, ta);
    }
    const wantCity = exploring ? exploreCity || autoSite : aboutMode ? aboutCity : w.regions > 0.4 ? regionKey : w.horeca > 0.4 ? 'toshkent' : null;
    if (wantCity !== shownCity) { shownCity = wantCity; world.city.show(world.city.has(wantCity) ? wantCity : null); }
    if (cityNow && !venueLabels.has(cityNow.key)) addVenueLabels(cityNow);
    // once a city's venues are known, frame them all rather than the city centre
    if (cityNow && fitted !== cityNow.key) {
      fitted = cityNow.key;
      const pose = fitVenues(cityNow, exploring ? 0 : POSES.regions.shift);
      if (!exploring && regionKey === cityNow.key) focus = world.goalFromPose(pose);
      if (exploring && exploreCity === cityNow.key) Object.assign(world.goal, world.goalFromPose(pose));
    }
    if (!cityNow) fitted = null;
    // the route ends before the legend's caption instead of running under the sheet
    const lb = legendEl.getBoundingClientRect();
    world.route.mask = lb.width ? [lb.left - 12, lb.top - 34, lb.right + 12, innerHeight + 40] : null;
    world.route.maskK = clamp(w.hero * 1.5 - 0.2) * (exploring ? 0 : 1);

    // panels the map labels must never run under: chapter plates, the airport frame, the open card, the bars
    const blockers = [];
    // (in the explorer the chapters are faded out: only its own bar, the card and the nav count)
    // the panel list is gathered twice a second, not every frame (the query alone cost half a millisecond)
    if (exploring !== blockMode || (blockAge += 1) > 30) { blockMode = exploring; blockAge = 0; blockEls = [...document.querySelectorAll(exploring ? '.info-card, .explore-bar, .nav' : '.chapter .plate, .apt-frame, .info-card, .explore-bar, .nav, .rail ol, .hleaf, .hold-hub, .hold-gk, .planner-sheet, .ab-plate, .ab-back')]; }
    blockEls.forEach((el) => {
      if (el.classList.contains('info-card') && !el.classList.contains('is-on')) return;
      if (el.style.visibility === 'hidden' || el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 2) return;
      if (holding.contains(el) && +holding.style.opacity < 0.3) return;
      blockers.push([r.left - 6, r.top - 6, r.right + 6, r.bottom + 6]);
    });
    // the airport frame and its callouts are measured with the other reads, before any label is placed
    const callOp = introDone && !exploring ? clamp(w.airport * 1.6 - 0.5) : 0;
    let fr = null;
    let footH = 0;
    if (callOp > 0.01) {
      fr = frame.getBoundingClientRect();
      footH = foot.offsetHeight;
      if (calloutStale || callouts.some((c) => !c.size)) { callouts.forEach((c) => { c.size = [c.el.offsetWidth, c.el.offsetHeight]; }); calloutStale = !fr.width; }
    }
    // a zone's number shows only over the model's clear middle: not past the frame, nor under the callout columns
    const cw = callouts[0]?.size?.[0] || 170;
    const zoneBox = fr && framePlaced ? [fr.left + 16 + cw + 6, fr.top + 44 + 10, fr.right - 16 - cw - 6, fr.bottom - footH - 10] : null;
    // labels: compute targets, then declutter greedily by priority
    const heroBox = heroCopy.getBoundingClientRect();
    const legBox = legendEl.getBoundingClientRect();
    const cands = [];
    labels.forEach((l) => {
      let target = 0;
      for (const c in l.weights) target += (l.weights[c] || 0) * w[c];
      // weights decide whether a label shows, not how faint it is: half-lit labels read as ghosts over the streets
      target = introDone ? clamp(target * 2) : 0;
      if (l.when && !l.when()) target = 0;
      if (l.far) target *= l.el.classList.contains('wp--cluster') ? farK : clamp(farK + 0.35);
      // a city's own venues show only while its model is up; its waypoint and store cluster step aside
      if (l.cityKey) {
        target = introDone && cityNow && cityNow.key === l.cityKey ? clamp(world.city.k * 1.4 - 0.2) : 0;
        // the HoReCa chapter shows its restaurants; the stores wait for the explorer
        if (target && !exploring && w.horeca > 0.4 && l.kind !== 'cafe') target = 0;
      }
      else if (cityNow && world.city.k > 0.3 && (l.key === cityNow.key || l.cluster || l.key === 'tas')) target = 0;
      const p = world.project(typeof l.w === 'function' ? l.w() : l.w, l.proj);
      if (!p.visible) target = 0;
      if (l.zoneIdx !== undefined && zoneBox && (p.x < zoneBox[0] || p.x > zoneBox[2] || p.y < zoneBox[1] || p.y > zoneBox[3])) target = 0;
      if (target > 0 && w.hero > 0.3 && p.x > heroBox.left - 30 && p.x < heroBox.right + 30 && p.y > heroBox.top - 20 && p.y < heroBox.bottom + 20) target = 0;
      if (target > 0 && w.hero > 0.3 && p.x < legBox.right && p.y > legBox.top - 40) target = 0;
      l.target = target;
      // in the Korzinka chapter the store clusters outrank the city waypoints beneath them
      l.rank = l.prio + (l.cluster ? 60 * w.korzinka : 0);
      if (target > 0.05 && l.prio > 0) cands.push(l);
    });
    cands.sort((a, b) => b.rank - a.rank);
    // sizes are read for every new label before any class changes below
    cands.forEach((l) => { if (!l.size || l.sizeStale) { l.size = [l.el.offsetWidth || 90, l.el.offsetHeight || 34]; l.sizeStale = false; } });
    // the holding chart's leaves are measured here too, ahead of the writes
    const heroOp = introDone && !exploring ? clamp(w.hero * 1.6 - 0.4) : 0;
    const plateRects = heroOp > 0.02 && holdPlaced && holding.classList.contains('is-drawn') ? plateEls.map((el) => el.getBoundingClientRect()) : null;
    const kept = [];
    cands.forEach((l) => {
      const [bw, bh] = l.size;
      const x0 = l.proj.x - bw / 2;
      const y0 = l.proj.y - 8;
      const box = [x0 - 3, y0 - 3, x0 + bw + 3, y0 + bh + 3];
      // a box the viewport would cut reads as broken: drop it rather than clip it; nothing sits under a plate or panel
      const cut = box[0] < 6 || box[2] > innerWidth - 6 || box[3] > innerHeight - 6;
      const under = blockers.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1]);
      const hit = (bx) => kept.some((k) => bx[0] < k[2] && bx[2] > k[0] && bx[1] < k[3] && bx[3] > k[1]);
      // a crowded venue keeps its pin (still clickable) and folds its card away instead of vanishing
      if (l.cityKey && !cut && !under && hit(box)) {
        const pin = [l.proj.x - 9, l.proj.y - 9, l.proj.x + 9, l.proj.y + 9];
        if (!hit(pin)) { l.el.classList.add('is-compact'); kept.push(pin); return; }
      }
      if (l.cityKey) l.el.classList.remove('is-compact');
      if (cut || under || hit(box)) { l.target = 0; l.op = Math.min(l.op, 0.3); }
      else kept.push(box);
    });
    labels.forEach((l) => {
      const target = l.target;
      const p = l.proj;
      l.op += (target - l.op) * 0.18;
      // only what changed is written: a hidden label costs nothing per frame
      const st = l.el.style;
      if (l.op < 0.01 && target === 0) {
        if (l.os !== '0') { l.os = '0'; st.opacity = '0'; }
        if (l.pe !== 'none') { l.pe = 'none'; st.pointerEvents = 'none'; }
        if (l.tf !== 'none') { l.tf = 'none'; st.transform = 'none'; st.visibility = 'hidden'; }
        return;
      }
      if (l.tf === 'none') st.visibility = '';
      const tf = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (l.tf !== tf) { l.tf = tf; st.transform = tf; }
      const os = l.op.toFixed(3);
      if (l.os !== os) { l.os = os; st.opacity = os; }
      const pe = l.op > 0.5 && l.el.classList.contains('is-clickable') ? 'auto' : 'none';
      if (l.pe !== pe) { l.pe = pe; st.pointerEvents = pe; }
    });

    let svg = '';
    // airport plate: callouts stacked down the frame's inner edge, each on a leader to its marker
    const callS = callOp.toFixed(3);
    if (frame.style.opacity !== callS) frame.style.opacity = callS;
    world.field.opacity = framePlaced ? callOp : 0;
    const callV = callOp < 0.01 ? 'hidden' : 'visible';
    if (frame.style.visibility !== callV) frame.style.visibility = callV;
    const live = callOp > 0.5;
    if (frameLive !== live) { frameLive = live; frame.classList.toggle('is-live', live); }
    if (callOp > 0.01) {
      world.field.rect = [fr.left, fr.top, fr.width, fr.height];
      // callouts sit either side of the terminal: the five westernmost on one side, the rest on the other,
      // each column ordered by its markers' height so the leaders never cross
      const pts = callouts.map((c, i) => ({ c, p: zoneLabels[i].proj })).sort((a, b) => a.p.x - b.p.x);
      const top = fr.top + 40 + 16;
      const bottom = fr.bottom - footH - 16;
      const half = Math.ceil(pts.length / 2);
      [pts.slice(0, half), pts.slice(half)].forEach((col, side) => {
        col.sort((a, b) => a.p.y - b.p.y);
        const step = (bottom - top) / col.length;
        col.forEach(({ c, p }, j) => {
          const el = c.el;
          const [bw, bh] = c.size;
          const y = top + step * (j + 0.5);
          const left = side === 0;
          const bx = left ? fr.left + 16 : fr.right - 16 - bw;
          el.style.transform = `translate3d(${(bx - fr.left).toFixed(1)}px, ${(y - bh / 2 - fr.top).toFixed(1)}px, 0)`;
          const ex1 = left ? bx + bw : bx;
          const ex2 = left ? ex1 + 14 : ex1 - 14;
          // a zone turned out of the clear middle keeps its callout (a click brings it back into view), not its leader
          const shown = zoneLabels[c.i].op > 0.3;
          if (shown) svg += `<path class="call-line" style="opacity:${(callOp * 0.85 * Math.min(1, zoneLabels[c.i].op)).toFixed(2)}" d="M${ex1.toFixed(1)} ${y.toFixed(1)} L${ex2.toFixed(1)} ${y.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/><circle class="call-dot" style="opacity:${callOp.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2"/>`;
        });
      });
    }

    // hero holding chart
    const heroS2 = heroOp.toFixed(3);
    if (holding.style.opacity !== heroS2) holding.style.opacity = heroS2;
    const heroV = heroOp < 0.01 ? 'hidden' : 'visible';
    if (holding.style.visibility !== heroV) holding.style.visibility = heroV;
    if (heroOp > 0.6 && !holding.classList.contains('is-drawn')) holding.classList.add('is-drawn');
    const lift = (1 - heroOp) * 30;
    if (heroOp > 0.01) holding.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0) rotateX(${(-ptr.y * 3 + 1).toFixed(2)}deg) rotateY(${(ptr.x * 4 - 1).toFixed(2)}deg)`;
    if (plateRects) {
      plateEls.forEach((el, pi) => {
        const a = anchors[el.dataset.plate];
        // mirrored, Region sits at the far side from the valley: only the terminal keeps its leader
        if (!a || (el.dataset.plate === 'regions' && document.documentElement.dir === 'rtl')) return;
        const p = world.project(a, proj);
        if (!p.visible) return;
        const r = plateRects[pi];
        const sx = r.left + r.width / 2;
        const sy = r.bottom;
        const my = sy + Math.max(26, (p.y - sy) * 0.5);
        svg += `<path style="opacity:${(heroOp * 0.6).toFixed(2)}" d="M${sx.toFixed(1)} ${sy.toFixed(1)} L${sx.toFixed(1)} ${my.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/><circle style="opacity:${heroOp.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/>`;
      });
    }
    if (svg !== lastSvg) { lastSvg = svg; leaders.innerHTML = svg; }
    flushRail();
  });

  // Cursor coordinates read off the chart
  addEventListener('pointermove', (e) => {
    const over = e.target.closest?.('.plate, .planner-sheet, .nav, .hero-copy, .hleaf, .hold-hub, .hold-gk, .ab-plate, .ab-back, .footer, .lang-pop, .rail, .info-card, .callout');
    if (over || !introDone) { coord.classList.remove('is-on'); return; }
    const ll = world.pick(e.clientX, e.clientY);
    if (!ll) { coord.classList.remove('is-on'); return; }
    coordV.textContent = formatDMS(ll[0], ll[1]);
    coord.classList.add('is-on');
  }, { passive: true });

  return {
    introDone() { introDone = true; world.state.ready = true; },
    releaseCamera() { cameraFree = true; },
    setExplore(v) { exploring = v; if (!v) { exploreCity = null; frameState(); } world.invalidate(); },
    setAbout(v) { aboutMode = v; frameState(); world.invalidate(); },
    setAboutCity(key) { aboutCity = key; },
    setExploreCity(key) { exploreCity = key; },
    cityPose,
    weights,
  };
}

export { TAS };
