import './styles/main.css';
import gsap from 'gsap';
import Lenis from 'lenis';
import { setLang, initialLang, onLang, t } from './i18n/index.js';
import { initNav, mountLogos } from './ui/nav.js';
import { initSections } from './sections.js';
import { initPlanner } from './planner.js';
import { createWorld, POSES } from './scene/world.js';
import { initStory } from './story.js';
import { drawFallback } from './scene/fallback.js';
import { initExplore } from './explore.js';
import { createLoader, introDist, INTRO_TARGET } from './loader.js';
import { initMini } from './ui/mini.js';
import { initLightbox } from './ui/lightbox.js';

const bus = new EventTarget();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = document.getElementById('loader');
let ld = null;
const progress = (p) => ld?.set(p);

function quality() {
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
  const lowMem = (navigator.deviceMemory || 8) <= 4;
  if (small || lowMem) return { dem: 1024, seg: { segX: 420, segZ: 280 }, overlay: 1.25, dpr: 1.5 };
  return { dem: 2048, seg: { segX: 960, segZ: 640 }, overlay: 2, dpr: 1.75 };
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (e) {
    return false;
  }
}

function magnetic() {
  if (matchMedia('(hover: none)').matches || reduced) return;
  document.addEventListener('pointermove', (e) => {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const reach = Math.max(r.width, 140);
      const k = d < reach ? (1 - d / reach) * 0.32 : 0;
      el.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
    });
  }, { passive: true });
}

function linkWidths() {
  document.querySelectorAll('.btn-link').forEach((a) => a.style.setProperty('--w', `${a.offsetWidth}px`));
}

async function boot() {
  mountLogos();
  await setLang(initialLang(), { persist: false });
  progress(0.05);

  let world;
  const nav = initNav({
    onTheme: (next) => world && gsap.to(world.state, { night: next === 'night' ? 1 : 0, duration: reduced ? 0 : 1.4, ease: 'power2.inOut' }),
  });

  const vectors = await fetch('/data/vectors.json').then((r) => r.json());
  ld = createLoader(loader, vectors);
  progress(0.06);
  const [places, roads, airportDetail] = await Promise.all([
    fetch('/data/places.json').then((r) => r.json()),
    fetch('/data/roads.json').then((r) => r.json()).catch(() => null),
    fetch('/data/airport-detail.json').then((r) => r.json()).catch(() => null),
  ]);
  progress(0.14);

  initSections({ bus, places });
  initPlanner({ bus });
  magnetic();
  linkWidths();
  onLang(() => requestAnimationFrame(linkWidths));

  // Smooth scroll with anchor handling
  const lenis = reduced ? null : new Lenis({ duration: 1.25, easing: (x) => 1 - Math.pow(1 - x, 4), smoothWheel: true });
  if (lenis) {
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const goTo = (id) => {
    const el = id === 'top' ? document.body : document.getElementById(id);
    if (!el) return false;
    let y = id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY;
    if (el.classList.contains('chapter')) y += innerHeight * 0.42;
    if (id === 'plan') y += innerHeight * 0.18;
    if (id === 'inquiry') y -= 80;
    lenis ? lenis.scrollTo(y, { duration: 1.8 }) : scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    if (goTo(a.getAttribute('href').slice(1))) e.preventDefault();
  });
  bus.addEventListener('goto', (e) => goTo(e.detail));
  // bring an element into view through the smooth scroller (native scrollIntoView fights it)
  bus.addEventListener('scrollto', (e) => {
    const { el, offset = 0 } = e.detail;
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight * 0.15 && r.bottom < innerHeight * 0.85) return;
    const y = r.top + scrollY + offset;
    lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  });
  initMini(bus);
  initLightbox();

  const finish = () => loader.classList.add('is-done');

  // the planner sheet and footer card are full-width: map controls fade while they are on screen
  const sheets = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => sheets.set(e.target, e.intersectionRatio > 0.12));
    document.documentElement.classList.toggle('is-sheet', [...sheets.values()].some(Boolean));
  }, { threshold: [0, 0.12, 0.3] });
  ['.planner-sheet', '#footer'].forEach((q) => { const el = document.querySelector(q); if (el) io.observe(el); });

  if (!webglOK()) {
    const fb = document.getElementById('fallbackMap');
    fb.hidden = false;
    document.getElementById('gl').hidden = true;
    drawFallback(fb, { vectors, places });
    addEventListener('resize', () => drawFallback(fb, { vectors, places }));
    document.querySelector('.plates').hidden = true;
    progress(1);
    finish();
    return;
  }

  try {
    world = await createWorld(document.getElementById('gl'), { data: { places, vectors, roads, airportDetail }, onProgress: progress, quality: quality() });
  } catch (err) {
    console.error(err);
    const fb = document.getElementById('fallbackMap');
    fb.hidden = false;
    drawFallback(fb, { vectors, places });
    finish();
    return;
  }
  world.state.night = document.documentElement.dataset.theme === 'night' ? 1 : 0;
  if (import.meta.env.DEV) window.__mp = { world, gsap };
  const story = initStory(world, { places, nav, bus });
  world.start();
  bus.dispatchEvent(new CustomEvent('zone', { detail: 'arr32' }));

  // Intro: the loader's outline closes and floods with relief; the 3D chart beneath it is framed identically,
  // so the loader dissolves into it and the camera glides down to the hero view while the route draws.
  const startY = scrollY;
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search).get('pose');
    if (q) { const [name, ...v] = q.split(':'); const [lon, lat, dist, az, el] = v[0].split(',').map(Number); POSES[name] = { t: [lon, lat], dist, az, el, shift: 0 }; }
  }
  const settle = () => {
    world.lines.opacity = 1;
    world.route.progress = 1;
    story.introDone();
    story.releaseCamera();
  };
  initExplore(world, { bus, places, lenis, story });
  if (reduced || startY > innerHeight * 0.5 || new URLSearchParams(location.search).has('nointro')) {
    settle();
    if (startY <= innerHeight * 0.5) { world.setGoal(world.goalFromPose(POSES.hero)); world.jump(); }
    finish();
    world.loadDetail(gsap);
    return;
  }

  POSES.intro.t = INTRO_TARGET;
  POSES.intro.dist = introDist();
  world.setGoal(world.goalFromPose(POSES.intro));
  world.jump();
  world.state.parallax = 0;
  world.route.progress = 0;
  lenis?.stop();
  document.documentElement.classList.add('is-intro');
  // every shader compiled and every texture uploaded while the page still covers the chart, so the first
  // uncovered frames and the first frames of the flight never hitch
  world.prewarm();
  await ld.complete(gsap);

  const a = world.goalFromPose(POSES.intro);
  const b = world.goalFromPose(POSES.hero);
  const fly = { k: 0 };
  const lerp = (x, y, k) => x + (y - x) * k;
  const tl = gsap.timeline({
    // the scroll story takes the camera only once the flight has landed exactly on the hero pose
    onComplete: () => { story.releaseCamera(); lenis?.start(); world.loadDetail(gsap); },
  });
  tl.to(fly, {
    k: 1, duration: 3.0, ease: 'power3.inOut',
    onUpdate: () => {
      const k = fly.k;
      // altitude drops a little ahead of the travel, and the tilt follows the descent: a landing, not a pan
      const kd = 1 - Math.pow(1 - k, 1.8);
      world.setGoal({
        tx: lerp(a.tx, b.tx, k), ty: lerp(a.ty, b.ty, k), tz: lerp(a.tz, b.tz, k),
        dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), kd)),
        az: a.az + ((((b.az - a.az) % 360) + 540) % 360 - 180) * k, el: lerp(a.el, b.el, k * k * (3 - 2 * k)), shift: 0,
      });
    },
  }, 0);
  tl.to(world.route, { progress: 1, duration: 2.4, ease: 'power2.inOut' }, 0.5);
  tl.to(world.state, { parallax: 1, duration: 1.4, ease: 'power1.inOut' }, 2.4);
  tl.add(() => {
    story.introDone();
    document.documentElement.classList.remove('is-intro');
    const els = [...document.querySelectorAll('.hero-copy > *'), document.querySelector('.legend'), document.querySelector('.scroll-cue'), document.querySelector('.explore-fab')].filter(Boolean);
    els.forEach((el, j) => gsap.from(el, { y: 26, opacity: 0, duration: 1.3, delay: j * 0.1, ease: 'expo.out', clearProps: 'transform,opacity' }));
  }, 1.9);
}

boot();

if (import.meta.hot) import.meta.hot.accept(() => location.reload());
export { t };
