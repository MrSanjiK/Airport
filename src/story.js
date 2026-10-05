import { POSES, TAS, PLATE } from './scene/world.js';
import { t, onLang, num } from './i18n/index.js';
import { REGIONS, LED_ZONES, LED_FACTS } from './data/inventory.js';
import { profile } from './sections.js';
import { formatDMS } from './scene/geo.js';

const CHAPTERS = ['hero', 'airport', 'korzinka', 'horeca', 'regions', 'plan'];
const ALL = [...CHAPTERS, 'explore'];
const TRI = '<svg class="wp-tri" viewBox="0 0 15 13" aria-hidden="true"><path d="M7.5 1.2L13.8 11.8H1.2z"/></svg>';
const AERO = '<svg class="wp-aero" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 4.5l1.6 5.4 5.4 2.1-5.4 1.9L12 19.5l-1.6-5.6L5 12l5.4-2.1z"/></svg>';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
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
  const legendEl = document.querySelector('.legend-sheet');

  const addLabel = ({ cls = '', world: w, html, weights, onClick, key, far = 0, near = 0 }) => {
    const el = document.createElement('div');
    el.className = `wp ${cls}`;
    el.innerHTML = html();
    el.style.opacity = '0';
    if (onClick) {
      el.addEventListener('click', onClick);
      el.classList.add('is-clickable');
    }
    labelsEl.append(el);
    const l = { el, w, html, weights, key, op: 0, proj: {}, far, near, prio: 0, size: null, cluster: cls.includes('wp--cluster') };
    labels.push(l);
    return l;
  };
  const fly = (detail) => bus.dispatchEvent(new CustomEvent('flyto', { detail }));

  // TAS
  addLabel({
    cls: 'wp--tas',
    // in the hero the label hangs below the terminal symbol rather than over it
    world: () => tmpTas.copy(world.hubWorld).add(tasDrop.set(0, 0.1, 0.075 * world.airport.group.scale.x * heroW)),
    html: () => `${AERO}<span class="wp-box"><span class="wp-name">TAS</span><span class="wp-sub">${t('map.tas')}</span></span>`,
    weights: { hero: 1, korzinka: 0.7, horeca: 0.6, regions: 0.8, plan: 0.8, explore: 1 },
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
      html: () => `${TRI}<span class="wp-box"><span class="wp-name">${t(`cities.${k}`)}${row.iata ? `<span class="wp-code">${row.iata}</span>` : ''}</span><span class="wp-sub">${num(row.screens)} ${t('map.screens')} · ${num(row.venues)} ${t('map.venues')}</span></span>`,
      weights: { hero: heroCities.includes(k) ? 0.9 : 0, regions: 1, plan: 0.8, korzinka: 0.5, explore: 1 },
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
      html: () => `<span class="cl-badge">${g.n}</span><span class="cl-name">${name}</span>`,
      weights: { korzinka: 1, regions: 0.6, plan: 0.5, explore: 1 },
      onClick: () => fly({ type: 'town', name, ll, dist: g.n > 20 ? 34 : 14 }),
      key: `town-${name}`,
      far: 1,
    }).prio = 30 + Math.min(g.n, 60);
  });
  const hc = places.horeca.reduce((a, h) => [a[0] + h.p[0] / places.horeca.length, a[1] + h.p[1] / places.horeca.length], [0, 0]);
  addLabel({
    cls: 'wp--cluster wp--cluster-h',
    world: world.worldAt(hc[0], hc[1], 0.4),
    html: () => `<span class="cl-badge">75+</span><span class="cl-name">HoReCa · ${t('cities.toshkent')}</span>`,
    weights: { horeca: 1, explore: 1, plan: 0.5 },
    onClick: () => fly({ type: 'town', name: t('cities.toshkent'), ll: hc, dist: 30 }),
    key: 'horeca-cluster',
    far: 1,
  }).prio = 85;

  // Airport zones: numbered markers on the OSM terminal plan, named by callouts
  const ag = world.airport.group;
  const local = (v) => () => ag.localToWorld(tmpV.copy(v));
  const pickZone = (id) => { bus.dispatchEvent(new CustomEvent('zone', { detail: id })); bus.dispatchEvent(new CustomEvent('zonepick', { detail: id })); };
  const zoneLabels = LED_ZONES.map((z, i) =>
    addLabel({
      cls: 'wp--zone',
      world: local(world.airport.zoneLocal(z.terminal, z.spot, z.outdoor)),
      html: () => `<span class="wp-dot">${i + 1}</span>`,
      weights: { airport: 1 },
      onClick: () => pickZone(z.id),
      key: `zone-${z.id}`,
    }),
  );
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
  const callWrap = document.createElement('div');
  callWrap.className = 'callouts';
  frame.append(callWrap);
  let curZone = 'arr32';
  const renderFrame = () => {
    frame.querySelector('.apt-band').textContent = t('airport.plate');
    const z = LED_ZONES.find((x) => x.id === curZone) || LED_ZONES[4];
    const fig = frame.querySelector('.apt-photo');
    // resolutions stay left-to-right inside Arabic text (bdi), or 10112×786 reads back as 786×10112
    fig.querySelector('figcaption').innerHTML = `${t(`airport.zones.${z.id}`)} · <bdi dir="ltr">${z.res}</bdi> · ${LED_FACTS.spotSec} ${t('units.sec')} · ${LED_FACTS.playsDay} ${t('units.plays')}`;
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

  onLang(() => { labels.forEach((l) => { l.el.innerHTML = l.html(); l.sizeStale = true; }); renderCallouts(); renderFrame(); });

  bus.addEventListener('zone', (e) => {
    zoneLabels.forEach((l) => l.el.classList.toggle('is-active', l.key === `zone-${e.detail}`));
    callouts.forEach((c) => c.el.classList.toggle('is-active', c.z.id === e.detail));
    curZone = e.detail;
    renderFrame();
  });
  bus.addEventListener('region', (e) => labels.forEach((l) => l.el.classList.toggle('is-active', l.key === e.detail)));

  // Rail
  rail.innerHTML = `<ol><span class="rail-fill"></span>${CHAPTERS.slice(1).map((c) => `<li><a href="#${c}" data-c="${c}"><span>${t(`rail.${c === 'airport' ? 'tas' : c}`)}</span><i></i></a></li>`).join('')}</ol>`;
  onLang(() => rail.querySelectorAll('a').forEach((a) => (a.querySelector('span').textContent = t(`rail.${a.dataset.c === 'airport' ? 'tas' : a.dataset.c}`))));

  // Scroll keyframes
  let keys = [];
  const measure = () => {
    const vh = innerHeight;
    // centre the terminal in the airport plate's field, wherever the frame lands at this width
    const fr = frame.getBoundingClientRect();
    if (fr.width) POSES.airport.shift = Math.abs(fr.left + fr.width / 2 - innerWidth / 2) / innerWidth;
    keys = CHAPTERS.map((id) => {
      const el = document.querySelector(`[data-chapter="${id}"]`);
      const top = el.getBoundingClientRect().top + scrollY;
      const y = id === 'hero' ? 0 : id === 'plan' ? top + vh * 0.15 : top + vh * 0.42;
      return { id, y, pose: world.goalFromPose(POSES[id]) };
    });
  };
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);

  const weights = Object.fromEntries(ALL.map((c) => [c, 0]));
  let introDone = false;
  let cameraFree = false;
  let focus = null;
  bus.addEventListener('regionfocus', (e) => {
    const c = e.detail && places.cities[e.detail];
    focus = c ? world.goalFromPose({ t: c, dist: 240, az: 0, el: 50, shift: POSES.regions.shift }) : null;
  });
  let exploring = false;
  let active = 'hero';
  const frameState = () => {
    if (exploring) {
      ALL.forEach((c) => (weights[c] = 0));
      weights.explore = 1;
      return;
    }
    weights.explore = 0;
    const y = scrollY;
    let i = 0;
    while (i < keys.length - 2 && y > keys[i + 1].y) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const raw = clamp((y - a.y) / Math.max(1, b.y - a.y));
    const k = smooth(clamp((raw - 0.12) / 0.76));
    CHAPTERS.forEach((c) => (weights[c] = 0));
    weights[a.id] = 1 - k;
    weights[b.id] = k;
    if (cameraFree) {
      const g = {
        tx: lerp(a.pose.tx, b.pose.tx, k), ty: lerp(a.pose.ty, b.pose.ty, k), tz: lerp(a.pose.tz, b.pose.tz, k),
        dist: Math.exp(lerp(Math.log(a.pose.dist), Math.log(b.pose.dist), k)),
        az: lerpAngle(a.pose.az, b.pose.az, k), el: lerp(a.pose.el, b.pose.el, k), shift: lerp(a.pose.shift, b.pose.shift, k),
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
      world.setGoal(g);
    }
    const now = k < 0.5 ? a.id : b.id;
    if (now !== active) {
      active = now;
      nav.setCurrent(active === 'hero' ? '' : active);
    }
    const docH = document.documentElement.scrollHeight - innerHeight;
    rail.style.setProperty('--p', clamp(y / Math.max(1, docH)).toFixed(4));
    rail.querySelectorAll('a').forEach((el) => {
      const idx = CHAPTERS.indexOf(el.dataset.c);
      el.classList.toggle('is-on', el.dataset.c === active);
      el.classList.toggle('is-past', idx < CHAPTERS.indexOf(active));
    });
  };

  // Hero plates: leader lines to their anchors and pointer tilt
  const plateEls = [...document.querySelectorAll('.hplate')];
  // each hero plate is the doorway to its chapter
  plateEls.forEach((el) => {
    el.setAttribute('role', 'link');
    el.tabIndex = 0;
    const go = () => bus.dispatchEvent(new CustomEvent('goto', { detail: el.dataset.plate }));
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  const anchors = {
    airport: world.hubWorld.clone().setY(world.hubWorld.y + 0.4),
    korzinka: world.worldAt(...places.cities.samarqand, 0.3),
    horeca: world.worldAt(...places.cities.toshkent, 0.3),
  };
  const ptr = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  const proj = {};
  world.onFrame(() => {
    frameState();
    const w = weights;
    document.documentElement.classList.toggle('at-map', w.hero > 0.5 || exploring);
    const ex = w.explore;
    const dist = world.cur.dist;
    // far: clusters and city labels; near: individual venue icons
    heroW = w.hero;
    const nearK = 1 - clamp((dist - 70) / 130);
    const farK = clamp((dist - 60) / 110);

    // the hero symbol is sized for the screen: a landmark on desktop, never a wall over the copy on a phone
    const heroS = 329 * Math.min(1, Math.max(0.42, (Math.min(innerWidth, innerHeight * 1.6) - 300) / 1100));
    const as = 1 + heroS * w.hero + (PLATE.scale - 1) * w.airport;
    // on the plate the volumes are drawn at half the hero symbol's height exaggeration, so the plan reads
    world.airport.group.scale.set(as, as * (1 - 0.45 * w.airport), as);
    world.airport.setSymbol(w.hero, frame.offsetParent ? w.airport : 0);
    if (world.roads) world.roads.city = 1 - clamp((w.hero + w.airport) * 1.4);
    world.airport.setHot(w.airport);
    world.kor.uniforms.uOpacity.value = clamp(w.korzinka + w.regions * 0.6 + w.plan * 0.5 + w.horeca * 0.45 + ex) * nearK;
    world.hor.uniforms.uOpacity.value = clamp(w.horeca * 1.4 + w.plan * 0.5 + ex) * nearK;
    const px = world.renderer.getPixelRatio();
    world.kor.uniforms.uPx.value = world.hor.uniforms.uPx.value = px;
    world.kor.uniforms.uSize.value = 20 + 6 * (1 - clamp((dist - 10) / 60));
    world.hor.uniforms.uSize.value = 24 + 6 * (1 - clamp((dist - 10) / 60));
    world.route.opacity = clamp(w.hero + w.airport * 0.1 + w.korzinka * 0.55 + w.horeca * 0.3 + w.regions + w.plan + ex);
    // the route ends before the legend's caption instead of running under the sheet
    const lb = legendEl.getBoundingClientRect();
    world.route.mask = lb.width ? [lb.left - 12, lb.top - 34, lb.right + 12, innerHeight + 40] : null;
    world.route.maskK = clamp(w.hero * 1.5 - 0.2) * (exploring ? 0 : 1);

    // labels: compute targets, then declutter greedily by priority
    const heroBox = heroCopy.getBoundingClientRect();
    const legBox = legendEl.getBoundingClientRect();
    const cands = [];
    labels.forEach((l) => {
      let target = 0;
      for (const c in l.weights) target += (l.weights[c] || 0) * w[c];
      // weights decide whether a label shows, not how faint it is: half-lit labels read as ghosts over the streets
      target = introDone ? clamp(target * 2) : 0;
      if (l.far) target *= l.el.classList.contains('wp--cluster') ? farK : clamp(farK + 0.35);
      const p = world.project(typeof l.w === 'function' ? l.w() : l.w, l.proj);
      if (!p.visible) target = 0;
      if (target > 0 && w.hero > 0.3 && p.x > heroBox.left - 30 && p.x < heroBox.right + 30 && p.y > heroBox.top - 20 && p.y < heroBox.bottom + 20) target = 0;
      if (target > 0 && w.hero > 0.3 && p.x < legBox.right && p.y > legBox.top - 40) target = 0;
      l.target = target;
      // in the Korzinka chapter the store clusters outrank the city waypoints beneath them
      l.rank = l.prio + (l.cluster ? 60 * w.korzinka : 0);
      if (target > 0.05 && l.prio > 0) cands.push(l);
    });
    cands.sort((a, b) => b.rank - a.rank);
    const kept = [];
    cands.forEach((l) => {
      if (!l.size || l.sizeStale) { l.size = [l.el.offsetWidth || 90, l.el.offsetHeight || 34]; l.sizeStale = false; }
      const [bw, bh] = l.size;
      const cl = l.el.classList.contains('wp--cluster');
      const x0 = cl ? l.proj.x - 16 : l.proj.x - bw / 2;
      const y0 = cl ? l.proj.y - 16 : l.proj.y - 8;
      const box = [x0 - 3, y0 - 3, x0 + bw + 3, y0 + bh + 3];
      // a box the viewport would cut reads as broken: drop it rather than clip it
      const cut = box[0] < 6 || box[2] > innerWidth - 6 || box[3] > innerHeight - 6;
      if (cut || kept.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1])) { l.target = 0; l.op = Math.min(l.op, 0.3); }
      else kept.push(box);
    });
    labels.forEach((l) => {
      const target = l.target;
      const p = l.proj;
      l.op += (target - l.op) * 0.18;
      if (l.op < 0.01 && target === 0) {
        if (l.el.style.opacity !== '0') l.el.style.opacity = '0';
        l.el.style.pointerEvents = 'none';
        return;
      }
      l.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      l.el.style.opacity = l.op.toFixed(3);
      l.el.style.pointerEvents = l.op > 0.5 && l.el.classList.contains('is-clickable') ? 'auto' : 'none';
    });

    let svg = '';
    // airport plate: callouts stacked down the frame's inner edge, each on a leader to its marker
    const callOp = introDone && !exploring ? clamp(w.airport * 1.6 - 0.5) : 0;
    frame.style.opacity = callOp.toFixed(3);
    world.field.opacity = frame.offsetParent ? callOp : 0;
    frame.style.visibility = callOp < 0.01 ? 'hidden' : 'visible';
    callWrap.style.pointerEvents = callOp > 0.5 ? 'auto' : 'none';
    if (callOp > 0.01) {
      const fr = frame.getBoundingClientRect();
      world.field.rect = [fr.left, fr.top, fr.width, fr.height];
      // callouts sit either side of the terminal: the five westernmost on one side, the rest on the other,
      // each column ordered by its markers' height so the leaders never cross
      const pts = callouts.map((c, i) => ({ c, p: zoneLabels[i].proj })).sort((a, b) => a.p.x - b.p.x);
      const top = fr.top + 40 + 16;
      const bottom = fr.bottom - frame.querySelector('.apt-foot').offsetHeight - 16;
      const half = Math.ceil(pts.length / 2);
      [pts.slice(0, half), pts.slice(half)].forEach((col, side) => {
        col.sort((a, b) => a.p.y - b.p.y);
        const step = (bottom - top) / col.length;
        col.forEach(({ c, p }, j) => {
          const el = c.el;
          const bw = el.offsetWidth;
          const bh = el.offsetHeight;
          const y = top + step * (j + 0.5);
          const left = side === 0;
          const bx = left ? fr.left + 16 : fr.right - 16 - bw;
          el.style.transform = `translate3d(${(bx - fr.left).toFixed(1)}px, ${(y - bh / 2 - fr.top).toFixed(1)}px, 0)`;
          const ex1 = left ? bx + bw : bx;
          const ex2 = left ? ex1 + 14 : ex1 - 14;
          svg += `<path class="call-line" style="opacity:${(callOp * 0.85).toFixed(2)}" d="M${ex1.toFixed(1)} ${y.toFixed(1)} L${ex2.toFixed(1)} ${y.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/><circle class="call-dot" style="opacity:${callOp.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2"/>`;
        });
      });
    }

    // hero plates
    const heroOp = introDone && !exploring ? clamp(w.hero * 1.6 - 0.4) : 0;
    plateEls.forEach((el, i) => {
      const key = el.dataset.plate;
      el.style.opacity = heroOp.toFixed(3);
      el.style.visibility = heroOp < 0.01 ? 'hidden' : 'visible';
      const lift = (1 - heroOp) * 30;
      const rx = -ptr.y * 6 + 2;
      const ry = ptr.x * 8 - 4 + i * 2;
      el.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      if (heroOp > 0.02 && el.offsetParent) {
        const r = el.getBoundingClientRect();
        const p = world.project(anchors[key], proj);
        if (p.visible) {
          const sx = r.left + r.width / 2;
          const sy = r.bottom;
          const my = sy + Math.max(30, (p.y - sy) * 0.55);
          svg += `<path style="opacity:${(heroOp * 0.6).toFixed(2)}" d="M${sx.toFixed(1)} ${sy.toFixed(1)} L${sx.toFixed(1)} ${my.toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/><circle style="opacity:${heroOp.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/>`;
        }
      }
    });
    leaders.innerHTML = svg;
  });

  // Cursor coordinates read off the chart
  addEventListener('pointermove', (e) => {
    const over = e.target.closest?.('.plate, .planner-sheet, .nav, .hero-copy, .hplate, .footer, .lang-pop, .rail, .info-card, .callout');
    if (over || !introDone) { coord.classList.remove('is-on'); return; }
    const ll = world.pick(e.clientX, e.clientY);
    if (!ll) { coord.classList.remove('is-on'); return; }
    coordV.textContent = formatDMS(ll[0], ll[1]);
    coord.classList.add('is-on');
  }, { passive: true });

  return {
    introDone() { introDone = true; world.state.ready = true; },
    releaseCamera() { cameraFree = true; },
    setExplore(v) { exploring = v; if (!v) frameState(); },
    weights,
  };
}

export { TAS };
