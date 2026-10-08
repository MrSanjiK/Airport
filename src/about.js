import { t, num, onLang } from './i18n/index.js';
import { DIRECTIONS, PHONES } from './data/inventory.js';
import { badge } from './ui/brand.js';
import { mountPartners } from './ui/partners.js';
import oaLogo from './assets/oa-logo.svg?raw';
import oaMark from './assets/oa-mark.svg?raw';

/* ───── About: Orient Advertising, the holding behind the six directions ─────
   A page of its own over the chart: the story steps aside, the map stays. The camera moves only between blocks
   (the country, the Fergana valley, the airport, the office) and only once a block is settled on screen; nothing
   on the page flies the map on hover. The history runs sideways as the page scrolls. */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const OFFICE = [69.2527619, 41.3120115]; // Nest One, block C
const AIRPORT = [69.2668, 41.2621];
const POSE = {
  overview: { t: [66.1, 40.9], dist: 1500, az: 0, el: 60, shift: 0.2 },
  airport: { t: AIRPORT, dist: 2.6, az: 24, el: 50, shift: 0.22 },
  region: { t: [70.9, 40.65], dist: 520, az: 6, el: 48, shift: 0.2 },
  // from the south-east, so block C stands in front of the Nest One tower
  office: { t: OFFICE, dist: 1.85, az: -62, el: 36, shift: 0.22 },
};
const MEGA = { mediaport: 'mediaport', flytv: 'flytv', mediagate: 'mediagate', 'tvl-korzinka': 'korzinka', 'tvl-horeca': 'horeca', 'tvl-region': 'regions' };
const TAG = { mediaport: 'tagMediaport', flytv: 'tagFlytv', mediagate: 'tagMediagate', 'tvl-korzinka': 'tagKorzinka', 'tvl-horeca': 'tagHoreca', 'tvl-region': 'tagRegion' };
const ico = {
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.5s4.5-4.2 4.5-7.6a4.5 4.5 0 0 0-9 0c0 3.4 4.5 7.6 4.5 7.6z"/><circle cx="8" cy="6.9" r="1.6"/></svg>',
  phone: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h2l1 3-1.5 1a8 8 0 0 0 4 4l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5z"/></svg>',
};
const YEARS = [['2010', 't2010'], ['2024', 't2024'], ['2025', 't2025'], ['2026', 't2026']];
// the six airport formats (mediagate.uz), each with a line icon
const FORMATS = [
  '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M5 18l1.5-9 5.5 4 5.5-4L19 18z"/><path d="M5 21h14"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="15" rx="1.5"/><path d="M9 21h6M12 18v3M9 8h6M9 12h4"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7 10h6M7 14h10"/><path d="M3 3l2 2M21 3l-2 2"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4.2.9a2 2 0 0 1 1.5 2.3L17 19H10l-3.5-4.5a1.4 1.4 0 0 1 2-2L9 13.5"/></svg>',
];

export function initAbout({ nav, bus, lenis, reduced }) {
  const el = document.getElementById('about');
  let world = null;
  let story = null;
  let isOpen = false;
  let back = 0;
  let pose = 'overview';
  let brand = 'mediaport';
  let step = 0;
  let stepTimer = 0;
  let io = null;
  let poseTimer = 0;
  let track = null;
  let pin = null;

  const aim = (key) => {
    if (!world || !isOpen) return;
    // on a phone the plate takes the top of the screen: the subject is framed below it
    const phone = innerWidth < 960;
    world.setGoal(world.goalFromPose({ ...(POSE[key] || POSE.overview), shiftY: phone ? -0.26 : 0 }));
    // the office's neighbourhood rises out of the chart under the contact block
    world.office?.show(key === 'office');
  };
  // a block must hold the middle of the screen for a moment before the camera follows: a fast scroll past
  // several blocks makes one calm move, not a chain of flights
  const settle = (key) => {
    if (key === pose) return;
    pose = key;
    clearTimeout(poseTimer);
    poseTimer = setTimeout(() => aim(pose), 380);
  };

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
      ${badge(d, 'md', true)}<span>${esc(t(`dir.${TAG[d.id]}`))}</span></button>`;

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
          <h1 class="ab-title" id="aboutTitle" tabindex="-1"><span class="sr-only">Orient Advertising</span><span class="ab-logo" aria-hidden="true">${oaLogo}</span></h1>
          <p class="ab-sub">${esc(t('about.sub'))}</p>
          <p class="ab-lead">${esc(t('about.lead'))}</p>
          <blockquote class="ab-mission"><span>${esc(t('about.mission'))}</span><p>${esc(t('about.missionText'))}</p></blockquote>
          <div class="ab-stats">
            ${stat(2010, t('about.s1'), 'year')}${stat(15, t('about.s2'), '+')}${stat(120, t('about.s3'), '+')}
            ${stat(1000, t('about.s4'), '+')}${stat(6, t('about.s5'))}${stat(300, t('about.s6'), '+')}
          </div>
        </article>

        <article class="ab-plate ab-brands" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.brandsK'))}</p>
          <h2>${esc(t('about.brandsTitle'))}</h2>
          <p class="ab-lead">${esc(t('about.brandsLead'))}</p>
          <div class="ab-tree">
            <div class="ab-hub"><span class="oa-mark" aria-hidden="true">${oaMark}</span><b>Orient Advertising</b><span>${esc(t('dir.holdingK'))}</span></div>
            <div class="ab-branches">
              <div class="ab-branch"><p class="ab-bk">${esc(t('about.airport'))} <b>TAS</b></p><div class="ab-tiles">${air.map(tile).join('')}</div></div>
              <div class="ab-branch"><p class="ab-bk"><b>TV Line</b> ${esc(t('mega.tvline.stat'))}</p><div class="ab-tiles">${tvl.map(tile).join('')}</div></div>
            </div>
          </div>
          <div class="ab-detail" aria-live="polite">${brandDetail(DIRECTIONS.find((d) => d.id === brand))}</div>
        </article>

        <div class="ab-pin" data-pose="region">
          <article class="ab-plate ab-time">
            <div class="ab-time-head"><div><p class="ab-k"><i></i>${esc(t('about.timeK'))}</p><h2>${esc(t('about.timeTitle'))}</h2></div>
              <span class="ab-time-bar" aria-hidden="true"><i></i></span></div>
            <div class="ab-rail">
              <ol class="ab-tl">
                ${YEARS.map(([y, k]) => `<li><b class="tnum">${y}</b><p>${esc(t(`about.${k}`))}</p></li>`).join('')}
                <li class="is-now"><b>${esc(t('about.nowK'))}</b><p>${esc(t('about.tNow'))}</p></li>
              </ol>
            </div>
          </article>
        </div>

        <article class="ab-plate ab-work" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.workK'))}</p>
          <h2>${esc(t('about.workTitle'))}</h2>
          <div class="ab-steps" role="tablist">
            ${[1, 2, 3, 4].map((i) => `<button type="button" role="tab" class="ab-step${i - 1 === step ? ' is-on' : ''}" data-step="${i - 1}" aria-selected="${i - 1 === step}"><span class="tnum">0${i}</span>${esc(t(`about.w${i}t`))}<i></i></button>`).join('')}
          </div>
          <p class="ab-step-text">${esc(t(`about.w${step + 1}`))}</p>
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
        </article>

        <article class="ab-plate ab-formats" data-pose="airport">
          <p class="ab-k"><i></i>${esc(t('about.fmtK'))}</p>
          <h2>${esc(t('about.fmtTitle'))}</h2>
          <ol class="ab-fmt">${FORMATS.map((icon, i) => `<li><span class="ab-fmt-ic" aria-hidden="true">${icon}</span><b>${esc(t(`about.f${i + 1}t`))}</b><p>${esc(t(`about.f${i + 1}`))}</p><em class="tnum">0${i + 1}</em></li>`).join('')}</ol>
        </article>

        <article class="ab-plate ab-trust" data-pose="overview">
          <p class="ab-k"><i></i>${esc(t('about.trustK'))}</p>
          <h2>${esc(t('about.trustTitle'))}</h2>
          <div class="ab-meters">
            ${[[98, 'm1'], [45, 'm2'], [69, 'm4']].map(([v, k]) => `<div class="ab-meter" style="--v:${v}"><b class="tnum" data-count="${v}" data-plus="%">${v}%</b><span>${esc(t(`about.${k}`))}</span><i></i></div>`).join('')}
            <div class="ab-meter ab-meter--n"><b class="tnum" data-count="310" data-plus="+">310+</b><span>${esc(t('about.m3'))}</span></div>
          </div>
          <div class="ab-partners" data-partners></div>
        </article>

        <article class="ab-plate ab-contact" data-pose="office">
          <p class="ab-k"><i></i>${esc(t('about.contactK'))}</p>
          <h2>${esc(t('about.contactTitle'))}</h2>
          <ul class="ab-cards">
            <li>${ico.pin}<span><small>${esc(t('about.office'))}</small><b>${esc(t('about.address'))}</b></span></li>
            <li>${ico.phone}<a href="tel:${tel.replace(/\s/g, '')}"><small>${esc(t('footer.contacts'))}</small><b class="tnum">${tel}</b></a></li>
          </ul>
          <div class="ic-route ab-route"><span>${esc(t('card.route'))}</span>
            <a class="ic-map ic-map--y" href="https://yandex.uz/maps/?rtext=~${ll}&rtt=auto" target="_blank" rel="noopener"><i>Я</i>Yandex Maps</a>
            <a class="ic-map ic-map--g" href="https://www.google.com/maps/dir/?api=1&destination=${ll}" target="_blank" rel="noopener"><i>G</i>Google Maps</a></div>
          <a class="btn-route ab-cta" href="#plan">${esc(t('hero.cta'))}${ico.arrow}</a>
        </article>
      </div>`;
    mountPartners(el.querySelector('[data-partners]'));
    wire();
  };

  // ── interactions ──
  const setBrand = (id) => {
    brand = id;
    el.querySelectorAll('.ab-tile').forEach((b) => { const on = b.dataset.brand === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    el.querySelector('.ab-detail').innerHTML = brandDetail(DIRECTIONS.find((d) => d.id === id));
  };
  const setStep = (i) => {
    step = i;
    el.querySelectorAll('.ab-step').forEach((b) => { const on = +b.dataset.step === i; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    el.querySelector('.ab-step-text').textContent = t(`about.w${i + 1}`);
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
      const k = Math.min(1, (now - t0) / 1200);
      b.textContent = fmt(Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  // the history slides sideways while its block is pinned: scrolling down moves the years from right to left
  let ticking = false;
  const slide = () => {
    ticking = false;
    if (!isOpen || !pin || !track) return;
    const r = pin.getBoundingClientRect();
    const span = r.height - innerHeight;
    const k = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    const max = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
    track.style.transform = `translate3d(${(-k * max).toFixed(1)}px, 0, 0)`;
    pin.style.setProperty('--k', k.toFixed(3));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(slide); } };
  const wire = () => {
    el.querySelectorAll('.ab-tile').forEach((b) => b.addEventListener('click', () => setBrand(b.dataset.brand)));
    el.querySelectorAll('.ab-step').forEach((b) => b.addEventListener('click', () => { setStep(+b.dataset.step); clearInterval(stepTimer); stepTimer = -1; }));
    el.querySelector('[data-about-close]').addEventListener('click', (e) => { e.preventDefault(); close(); });
    pin = el.querySelector('.ab-pin');
    track = el.querySelector('.ab-tl');
    io?.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const b = en.target;
        if (b.dataset.pose) settle(b.dataset.pose);
        b.querySelectorAll('[data-count]').forEach(countUp);
        b.classList.add('is-in');
        if (b.classList.contains('ab-work') && !stepTimer && !reduced) stepTimer = setInterval(() => setStep((step + 1) % 4), 3800);
      });
    }, { rootMargin: '-42% 0px -42% 0px' });
    el.querySelectorAll('.ab-plate:not(.ab-time), .ab-pin').forEach((p) => io.observe(p));
    slide();
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
    world?.office?.load();
    pose = 'overview';
    render();
    aim(pose);
    addEventListener('scroll', onScroll, { passive: true });
    history.replaceState(null, '', '#about');
    el.querySelector('.ab-title')?.focus?.({ preventScroll: true });
  };
  const close = (then) => {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(stepTimer);
    clearTimeout(poseTimer);
    stepTimer = 0;
    io?.disconnect();
    removeEventListener('scroll', onScroll);
    document.documentElement.classList.remove('is-about');
    el.hidden = true;
    el.innerHTML = '';
    story?.setAbout(false);
    world?.office?.show(false);
    history.replaceState(null, '', location.pathname);
    // back where the reader left the story, unless a link asked for somewhere else
    requestAnimationFrame(() => {
      if (then) bus.dispatchEvent(new CustomEvent('goto', { detail: then }));
      else lenis ? lenis.scrollTo(back, { immediate: true, force: true }) : scrollTo(0, back);
    });
  };
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen && !document.documentElement.classList.contains('is-explore')) close(); });
  addEventListener('resize', () => isOpen && slide());
  onLang(() => { if (isOpen) { render(); aim(pose); } });

  return {
    open, close,
    get isOpen() { return isOpen; },
    // the chart arrives after the loader: from then on the page steers the camera
    attach(w, s) { world = w; story = s; if (isOpen) { story.setAbout(true); world.office?.load(); aim(pose); } },
    office: OFFICE,
  };
}
