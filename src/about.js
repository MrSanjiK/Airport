import { t, num, onLang } from './i18n/index.js';
import { DIRECTIONS, PHONES } from './data/inventory.js';
import { badge } from './ui/brand.js';

/* ───── About: Orient Advertising, the holding behind the six directions ─────
   A page of its own over the live chart: the story steps aside, the map stays. Each block aims the camera
   (the whole network, the airport, Tashkent's stores and restaurants, the Fergana valley, the head office),
   and hovering a brand flies to where that brand works. Every figure is taken from the company's decks,
   its own sites or the press, and the sources are listed on the page. */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const OFFICE = [69.28757, 41.35491]; // Amir Temur shoh ko'chasi 129 (2GIS, OpenStreetMap)
const AIRPORT = [69.2668, 41.2621];
const POSE = {
  overview: { t: [66.1, 40.9], dist: 1500, az: 0, el: 60, shift: 0.2 },
  airport: { t: AIRPORT, dist: 2.6, az: 24, el: 50, shift: 0.22 },
  korzinka: { t: [69.27, 41.31], dist: 34, az: -6, el: 54, shift: 0.22 },
  horeca: { t: [69.26, 41.305], dist: 20, az: -10, el: 50, shift: 0.22 },
  region: { t: [70.9, 40.65], dist: 520, az: 6, el: 48, shift: 0.2 },
  office: { t: OFFICE, dist: 1.5, az: -18, el: 48, shift: 0.22 },
};
const BRAND_POSE = { mediaport: 'airport', flytv: 'airport', mediagate: 'airport', 'tvl-korzinka': 'korzinka', 'tvl-horeca': 'horeca', 'tvl-region': 'region' };
const MEGA = { mediaport: 'mediaport', flytv: 'flytv', mediagate: 'mediagate', 'tvl-korzinka': 'korzinka', 'tvl-horeca': 'horeca', 'tvl-region': 'regions' };

const SOURCES = [
  { k: 'p2', site: 'Spot.uz', date: '29.04.2024', href: 'https://www.spot.uz/ru/2024/04/29/orient-adv/' },
  { k: 'p1', site: 'Spot.uz', date: '16.04.2024', href: 'https://www.spot.uz/ru/2024/04/16/airport-advertisement/' },
  { k: 'p3', site: 'tvline.uz', href: 'https://tvline.uz' },
  { k: 'p4', site: 'mediagate.uz', href: 'https://mediagate.uz' },
  { k: 'p5', site: 'Yandex Maps', href: 'https://yandex.uz/maps/org/orient_advertising/85561821534/' },
  { k: 'p6', site: 'Facebook', href: 'https://www.facebook.com/orientadvertising.uz/' },
];
const CLIENTS = ['TBC', 'Click', 'Payme', 'Imzo', 'Crafers'];
const ico = {
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  out: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.5s4.5-4.2 4.5-7.6a4.5 4.5 0 0 0-9 0c0 3.4 4.5 7.6 4.5 7.6z"/><circle cx="8" cy="6.9" r="1.6"/></svg>',
  phone: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h2l1 3-1.5 1a8 8 0 0 0 4 4l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5z"/></svg>',
  tg: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14.5 2.5 1.8 7.4c-.6.2-.6 1 0 1.2l3.1 1 1.2 3.7c.2.5.8.6 1.1.2l1.8-1.9 3.2 2.4c.4.3 1 .1 1.1-.4l2.1-10.1c.1-.6-.4-1.1-1-.9z"/><path d="m4.9 9.6 7.3-4.8-5.6 6"/></svg>',
  ig: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3.5"/><circle cx="8" cy="8" r="2.9"/><circle cx="11.6" cy="4.4" r=".6"/></svg>',
  mail: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="2"/><path d="M2.5 4.5 8 9l5.5-4.5"/></svg>',
};

export function initAbout({ nav, bus, lenis, reduced }) {
  const el = document.getElementById('about');
  let world = null;
  let story = null;
  let isOpen = false;
  let back = 0;
  let pose = 'overview';
  let hover = null;
  let brand = 'mediaport';
  let step = 0;
  let stepTimer = 0;
  let io = null;

  const aim = (key) => {
    if (!world || !isOpen) return;
    const p = POSE[key] || POSE.overview;
    world.setGoal(world.goalFromPose(p));
    story?.setAboutCity(key === 'office' || key === 'korzinka' || key === 'horeca' ? 'toshkent' : null);
  };
  const reaim = () => aim(hover || pose);

  const stat = (n, label, plus = '') => `<div class="ab-stat"><b class="tnum" data-count="${n}" data-plus="${plus}">${plus === 'year' ? n : num(n)}${plus && plus !== 'year' ? plus : ''}</b><span>${esc(label)}</span></div>`;
  const brandDetail = (d) => {
    const m = MEGA[d.id];
    const rows = ['a', 'b', 'c'].map((k) => t(`mega.${m}.${k}`)).filter((s) => typeof s === 'string' && s && !s.startsWith('mega.'));
    return `<div class="ab-bd" style="--brand:${d.color}">
      <div class="ab-bd-head">${badge(d, 'md', true)}<p>${esc(t(`mega.${m}.title`))}</p></div>
      <ul>${rows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <div class="ab-bd-foot"><b class="tnum">${esc(t(`mega.${m}.stat`))}</b><a class="pill pill--route" href="#${d.chapter}">${esc(t('about.open'))}${ico.arrow}</a></div>
    </div>`;
  };
  const tile = (d) => `<button type="button" class="ab-tile${d.id === brand ? ' is-on' : ''}" data-brand="${d.id}" aria-pressed="${d.id === brand}" style="--brand:${d.color}">
      ${badge(d, 'md', true)}<span>${esc(t(`dir.${{ mediaport: 'tagMediaport', flytv: 'tagFlytv', mediagate: 'tagMediagate', 'tvl-korzinka': 'tagKorzinka', 'tvl-horeca': 'tagHoreca', 'tvl-region': 'tagRegion' }[d.id]}`))}</span></button>`;

  const render = () => {
    const air = DIRECTIONS.filter((d) => d.group === 'airport');
    const tvl = DIRECTIONS.filter((d) => d.group === 'tvline');
    const tel = PHONES[0];
    const ll = `${OFFICE[1]}%2C${OFFICE[0]}`;
    el.innerHTML = `
      <div class="ab-col">
        <a class="ab-back pill" href="#top" data-about-close>${ico.back}${esc(t('about.back'))}</a>

        <article class="ab-plate ab-hero" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.kicker'))}</p>
          <h1 class="ab-title" id="aboutTitle">Orient Advertising</h1>
          <p class="ab-sub">${esc(t('about.sub'))}</p>
          <p class="ab-lead">${esc(t('about.lead'))}</p>
          <div class="ab-stats">
            ${stat(2010, t('about.s1'), 'year')}${stat(15, t('about.s2'), '+')}${stat(100, t('about.s3'), '+')}
            ${stat(1000, t('about.s4'), '+')}${stat(6, t('about.s5'))}${stat(300, t('about.s6'), '+')}
          </div>
          <p class="ab-src">${esc(t('about.srcDecks'))}</p>
        </article>

        <article class="ab-plate ab-brands" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.brandsK'))}</p>
          <h2>${esc(t('about.brandsTitle'))}</h2>
          <p class="ab-lead">${esc(t('about.brandsLead'))}</p>
          <div class="ab-tree">
            <div class="ab-hub"><i class="hold-dot"></i><b>Orient Advertising</b><span>${esc(t('dir.holdingK'))}</span></div>
            <div class="ab-branches">
              <div class="ab-branch"><p class="ab-bk">${esc(t('about.airport'))} <b>TAS</b></p><div class="ab-tiles">${air.map(tile).join('')}</div></div>
              <div class="ab-branch"><p class="ab-bk"><b>TV Line</b> ${esc(t('mega.tvline.stat'))}</p><div class="ab-tiles">${tvl.map(tile).join('')}</div></div>
            </div>
          </div>
          <div class="ab-detail" aria-live="polite">${brandDetail(DIRECTIONS.find((d) => d.id === brand))}</div>
        </article>

        <article class="ab-plate ab-time" data-pose="region">
          <p class="ab-k"><i></i>${esc(t('about.timeK'))}</p>
          <h2>${esc(t('about.timeTitle'))}</h2>
          <ol class="ab-tl">
            ${[['2010', 't2010'], ['2024', 't2024'], ['2025', 't2025'], ['2026', 't2026']].map(([y, k]) => `<li><b class="tnum">${y}</b><p>${esc(t(`about.${k}`))}</p></li>`).join('')}
            <li class="is-now"><b>${esc(t('about.nowK'))}</b><p>${esc(t('about.tNow'))}</p></li>
          </ol>
        </article>

        <article class="ab-plate ab-work" data-pose="korzinka">
          <p class="ab-k"><i></i>${esc(t('about.workK'))}</p>
          <h2>${esc(t('about.workTitle'))}</h2>
          <div class="ab-steps" role="tablist">
            ${[1, 2, 3, 4].map((i) => `<button type="button" role="tab" class="ab-step${i - 1 === step ? ' is-on' : ''}" data-step="${i - 1}" aria-selected="${i - 1 === step}"><span class="tnum">0${i}</span>${esc(t(`about.w${i}t`))}<i></i></button>`).join('')}
          </div>
          <p class="ab-step-text">${esc(t(`about.w${step + 1}`))}</p>
          <p class="ab-src">${esc(t('about.workSrc'))}</p>
        </article>

        <article class="ab-plate ab-case" data-pose="airport">
          <p class="ab-k"><i></i>${esc(t('about.caseK'))}</p>
          <h2>${esc(t('about.caseTitle'))}</h2>
          <p class="ab-lead">${esc(t('about.caseLead'))}</p>
          <div class="ab-figs">
            <div><b class="tnum">22,2</b><small>${esc(t('units.bln'))}</small><span>${esc(t('about.c1'))}</span></div>
            <div><b class="tnum">700</b><small>m²</small><span>${esc(t('about.c2'))}</span></div>
            <div><b class="tnum">3</b><small>${esc(t('about.years'))}</small><span>${esc(t('about.c3'))}</span></div>
            <div><b class="tnum">≈7</b><small>${esc(t('about.mln'))}</small><span>${esc(t('about.c4'))}</span></div>
          </div>
          <p class="ab-sk">${esc(t('about.reqTitle'))}</p>
          <ul class="ab-req">${[1, 2, 3, 4, 5].map((i) => `<li>${ico.check}${esc(t(`about.r${i}`))}</li>`).join('')}</ul>
          <a class="ab-cite" href="${SOURCES[0].href}" target="_blank" rel="noopener">${esc(t('about.caseSrc'))}${ico.out}</a>
        </article>

        <article class="ab-plate ab-trust" data-pose="horeca">
          <p class="ab-k"><i></i>${esc(t('about.trustK'))}</p>
          <h2>${esc(t('about.trustTitle'))}</h2>
          <div class="ab-meters">
            ${[[98, 'm1'], [45, 'm2'], [69, 'm4']].map(([v, k]) => `<div class="ab-meter" style="--v:${v}"><b class="tnum" data-count="${v}" data-plus="%">${v}%</b><span>${esc(t(`about.${k}`))}</span><i></i></div>`).join('')}
            <div class="ab-meter ab-meter--n"><b class="tnum" data-count="310" data-plus="+">310+</b><span>${esc(t('about.m3'))}</span></div>
          </div>
          <p class="ab-sk">${esc(t('about.clients'))}</p>
          <ul class="ab-clients">${CLIENTS.map((c) => `<li>${c}</li>`).join('')}</ul>
          <p class="ab-src">${esc(t('about.trustSrc'))}</p>
          <p class="ab-sk">${esc(t('about.teamK'))}</p>
          <ul class="ab-team">
            <li><i aria-hidden="true">AA</i><span><b>Ag'zam Asrorov</b>${esc(t('about.ceo'))} · Spot.uz, 2024</span></li>
            <li><i aria-hidden="true">AY</i><span><b>Azizbek Yusufov</b>${esc(t('about.cofounder'))} · mediagate.uz</span></li>
          </ul>
        </article>

        <article class="ab-plate ab-press" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.pressK'))}</p>
          <h2>${esc(t('about.pressTitle'))}</h2>
          <ul class="ab-links">${SOURCES.map((s) => `<li><a href="${s.href}" target="_blank" rel="noopener"><span><b>${esc(s.site)}</b>${s.date ? `<em class="tnum">${s.date}</em>` : ''}</span><span>${esc(t(`about.${s.k}`))}</span>${ico.out}</a></li>`).join('')}</ul>
        </article>

        <article class="ab-plate ab-contact" data-pose="office">
          <p class="ab-k"><i></i>${esc(t('about.contactK'))}</p>
          <h2>${esc(t('about.contactTitle'))}</h2>
          <ul class="ab-cards">
            <li>${ico.pin}<span><small>${esc(t('about.office'))}</small><b>${esc(t('about.address'))}</b></span></li>
            <li>${ico.phone}<a href="tel:${tel.replace(/\s/g, '')}"><small>${esc(t('footer.contacts'))}</small><b class="tnum">${tel}</b></a></li>
            <li>${ico.tg}<a href="https://t.me/orientadvertising" target="_blank" rel="noopener"><small>Telegram</small><b>@orientadvertising</b></a></li>
            <li>${ico.ig}<a href="https://instagram.com/tvline.uz" target="_blank" rel="noopener"><small>Instagram</small><b>@tvline.uz</b></a></li>
            <li>${ico.mail}<a href="mailto:tvlineuzbekistan@gmail.com"><small>E-mail</small><b>tvlineuzbekistan@gmail.com</b></a></li>
          </ul>
          <div class="ic-route ab-route"><span>${esc(t('card.route'))}</span>
            <a class="ic-map ic-map--y" href="https://yandex.uz/maps/?rtext=~${ll}&rtt=auto" target="_blank" rel="noopener"><i>Я</i>Yandex Maps</a>
            <a class="ic-map ic-map--g" href="https://www.google.com/maps/dir/?api=1&destination=${ll}" target="_blank" rel="noopener"><i>G</i>Google Maps</a></div>
          <a class="btn-route ab-cta" href="#plan">${esc(t('hero.cta'))}${ico.arrow}</a>
        </article>
      </div>`;
    wire();
  };

  // ── interactions ──
  const setBrand = (id) => {
    brand = id;
    el.querySelectorAll('.ab-tile').forEach((b) => { const on = b.dataset.brand === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    const box = el.querySelector('.ab-detail');
    box.innerHTML = brandDetail(DIRECTIONS.find((d) => d.id === id));
    box.firstElementChild.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  };
  const setStep = (i) => {
    step = i;
    el.querySelectorAll('.ab-step').forEach((b) => { const on = +b.dataset.step === i; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    const p = el.querySelector('.ab-step-text');
    p.textContent = t(`about.w${i + 1}`);
    p.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 360 });
  };
  const countUp = (b) => {
    if (b.dataset.done) return;
    b.dataset.done = '1';
    const n = +b.dataset.count;
    const plus = b.dataset.plus;
    const fmt = (v) => (plus === 'year' ? String(v) : `${num(v)}${plus || ''}`);
    if (reduced) { b.textContent = fmt(n); return; }
    const from = plus === 'year' ? 1990 : 0;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1400);
      const e = 1 - Math.pow(1 - k, 3);
      b.textContent = fmt(Math.round(from + (n - from) * e));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const wire = () => {
    el.querySelectorAll('.ab-tile').forEach((b) => {
      b.addEventListener('click', () => setBrand(b.dataset.brand));
      b.addEventListener('pointerenter', () => { hover = BRAND_POSE[b.dataset.brand]; reaim(); });
      b.addEventListener('pointerleave', () => { hover = null; reaim(); });
      b.addEventListener('focus', () => { hover = BRAND_POSE[b.dataset.brand]; reaim(); });
      b.addEventListener('blur', () => { hover = null; reaim(); });
    });
    el.querySelectorAll('.ab-step').forEach((b) => b.addEventListener('click', () => { setStep(+b.dataset.step); clearInterval(stepTimer); stepTimer = 0; }));
    el.querySelector('[data-about-close]').addEventListener('click', (e) => { e.preventDefault(); close(); });
    // the block across the screen's middle aims the camera; numbers count up as they arrive
    io?.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const b = en.target;
        if (b.dataset.pose && en.intersectionRect.top < innerHeight * 0.55) { pose = b.dataset.pose; reaim(); }
        b.querySelectorAll('[data-count]').forEach(countUp);
        b.classList.add('is-in');
        if (b.classList.contains('ab-work') && !stepTimer && !reduced) stepTimer = setInterval(() => setStep((step + 1) % 4), 3800);
      });
    }, { rootMargin: '-38% 0px -38% 0px' });
    el.querySelectorAll('.ab-plate').forEach((p) => io.observe(p));
  };

  // ── open / close: a page of its own over the chart ──
  const open = () => {
    if (isOpen) return;
    isOpen = true;
    back = scrollY;
    el.hidden = false;
    document.documentElement.classList.add('is-about');
    lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0);
    nav?.setCurrent('about');
    story?.setAbout(true);
    pose = 'overview';
    hover = null;
    render();
    aim(pose);
    history.replaceState(null, '', '#about');
    el.querySelector('.ab-title')?.focus?.({ preventScroll: true });
  };
  const close = (then) => {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(stepTimer);
    stepTimer = 0;
    io?.disconnect();
    document.documentElement.classList.remove('is-about');
    el.hidden = true;
    story?.setAboutCity(null);
    story?.setAbout(false);
    history.replaceState(null, '', location.pathname);
    // back where the reader left the story, unless a link asked for somewhere else
    requestAnimationFrame(() => {
      if (then) bus.dispatchEvent(new CustomEvent('goto', { detail: then }));
      else lenis ? lenis.scrollTo(back, { immediate: true, force: true }) : scrollTo(0, back);
    });
  };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen && !document.documentElement.classList.contains('is-explore')) close(); });
  onLang(() => { if (isOpen) { render(); reaim(); } });

  return {
    open, close,
    get isOpen() { return isOpen; },
    // the chart arrives after the loader: from then on the page steers the camera
    attach(w, s) { world = w; story = s; if (isOpen) { story.setAbout(true); reaim(); } },
    office: OFFICE,
  };
}
