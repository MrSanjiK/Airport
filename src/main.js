import './styles/main.css';
import gsap from 'gsap';
import Lenis from 'lenis';
import { setLang, initialLang, onLang, t } from './i18n/index.js';
import { initNav, mountLogos } from './ui/nav.js';
import { initSections } from './sections.js';
import { initPlanner } from './planner.js';
import { createWorld, POSES } from './scene/world.js';
import { initStory } from './story.js';
import { initAbout } from './about.js';
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

// a modest graphics chip, by its name where the browser tells it (budget Mali, Adreno 5xx/early 6xx, PowerVR, plain
// Intel HD/UHD, software rendering), or a device with few cores or little memory: these get a lighter chart
function lowGPU() {
  try {
    if (/[?&]low\b/.test(location.search)) return true;
    if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3) return true;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|powervr|mali-[t4]|mali-g(3\d|5[0-7]|7[0-2])\b|adreno\D*([1-5]\d\d|60\d|61[0-6])\b|intel.*\b(hd|uhd) graphics/i.test(name);
  } catch (e) { return false; }
}

function quality() {
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
  const lowMem = (navigator.deviceMemory || 8) <= 4;
  const low = lowGPU();
  if (low) document.documentElement.classList.add('low-gpu');
  // a lighter mesh and no live blur, but the same sharpness as any phone: the chart is never drawn soft on purpose
  if (low) return { dem: 1024, seg: { segX: 420, segZ: 280 }, overlay: 1.25, dpr: small ? 1.5 : 1.25, low };
  if (small || lowMem) return { dem: 1024, seg: { segX: 420, segZ: 280 }, overlay: 1.25, dpr: 1.5 };
  // a retina screen at desktop width is over 3000 device pixels across: the chart caps lower there
  return { dem: 2048, seg: { segX: 960, segZ: 640 }, overlay: 2, dpr: innerWidth * (window.devicePixelRatio || 1) > 3000 ? 1.5 : 1.75 };
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
  // the heavy files are requested at once, before anything else waits on them
  const q = quality();
  q.demRequest = fetch(`/data/dem-${q.dem}.z`);
  const early = {
    vectors: fetch('/data/vectors.json').then((r) => r.json()),
    places: fetch('/data/places.json').then((r) => r.json()),
    roads: fetch('/data/roads.json').then((r) => r.json()).catch(() => null),
    airport: fetch('/data/airport-model.json').then((r) => r.json()),
  };
  mountLogos();
  await setLang(initialLang(), { persist: false });
  progress(0.05);

  let world;
  const nav = initNav({
    onTheme: (next) => world && gsap.to(world.state, { night: next === 'night' ? 1 : 0, duration: reduced ? 0 : 0.5, ease: 'power1.inOut' }),
  });

  const vectors = await early.vectors;
  ld = createLoader(loader, vectors);
  progress(0.06);
  const [places, roads, airportModel] = await Promise.all([early.places, early.roads, early.airport]);
  progress(0.14);

  initSections({ bus, places });
  initPlanner({ bus });
  magnetic();
  linkWidths();
  onLang(() => requestAnimationFrame(linkWidths));

  // Smooth scroll with anchor handling
  // allowNestedScroll: a list that scrolls on its own (the budget breakdown, the brand split, a phone's map card)
  // takes the wheel while it can still move that way; at its end the page carries on
  const lenis = reduced ? null : new Lenis({ duration: 1.25, easing: (x) => 1 - Math.pow(1 - x, 4), smoothWheel: true, allowNestedScroll: true });
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
  // About is a page of its own over the chart: its link opens it, any other link closes it on the way
  const about = initAbout({ nav, bus, lenis, reduced });
  const wantAbout = location.hash === '#about';
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (id === 'about') { e.preventDefault(); about.open(); return; }
    if (about.isOpen) { e.preventDefault(); about.close(id === 'top' ? null : id); return; }
    if (goTo(id)) e.preventDefault();
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

  const finish = () => { loader.classList.add('is-done'); ld?.stop?.(); };

  // chapter plates arrive: the card rises into place and its blocks follow one after another, once per visit
  if (!reduced && 'IntersectionObserver' in window) {
    const enter = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-shown');
      enter.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px', threshold: 0.04 });
    document.querySelectorAll('.chapter .plate, .planner-sheet').forEach((el) => { el.classList.add('will-enter'); enter.observe(el); });
  }

  // the planner sheet and footer card are full-width: map controls fade while they are on screen
  const sheets = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => sheets.set(e.target, e.intersectionRatio > 0.12));
    document.documentElement.classList.toggle('is-sheet', [...sheets.values()].some(Boolean));
  }, { threshold: [0, 0.12, 0.3] });
  ['.planner-sheet', '#footer'].forEach((q) => { const el = document.querySelector(q); if (el) io.observe(el); });
  // the explore button steps up over the hero's partner strip only while that strip is on screen (on a phone the strip
  // sits in the page's flow, below the fold on a short screen)
  const strip = document.getElementById('heroPartners');
  if (strip) new IntersectionObserver(([e]) => document.documentElement.classList.toggle('strip-on', e.isIntersecting)).observe(strip);

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
    world = await createWorld(document.getElementById('gl'), { data: { places, vectors, roads, airportModel }, onProgress: progress, quality: q });
  } catch (err) {
    console.error(err);
    const fb = document.getElementById('fallbackMap');
    fb.hidden = false;
    drawFallback(fb, { vectors, places });
    finish();
    if (wantAbout) about.open();
    return;
  }
  world.state.night = document.documentElement.dataset.theme === 'night' ? 1 : 0;
  if (import.meta.env.DEV) window.__mp = { world, gsap };
  const story = initStory(world, { places, nav, bus });
  about.attach(world, story);
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
    world.prewarm();
    finish();
    if (wantAbout) about.open();
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
  await world.prewarm();
  await ld.complete(gsap);

  const a = world.goalFromPose(POSES.intro);
  const b = world.goalFromPose(POSES.hero);
  const fly = { k: 0 };
  const lerp = (x, y, k) => x + (y - x) * k;
  const tl = gsap.timeline({
    // the scroll story takes the camera only once the flight has landed exactly on the hero pose
    onComplete: () => { story.releaseCamera(); lenis?.start(); if (wantAbout) about.open(); },
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
        az: a.az + ((((b.az - a.az) % 360) + 540) % 360 - 180) * k, el: lerp(a.el, b.el, k * k * (3 - 2 * k)), shift: 0, shiftY: lerp(0, b.shiftY || 0, k),
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
