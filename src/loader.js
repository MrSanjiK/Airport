import { toXZ } from './scene/geo.js';

const TAN = Math.tan((16 * Math.PI) / 180);
export const INTRO_TARGET = [64.56, 41.37];
// Uzbekistan's extent in km (17.2° × 8.4°) and its most interior point, 175 km from any border
const UZ_W = 1442;
const UZ_H = 925;
const CORE = [64.5, 40.8];
const CORE_R = 175;

// The same top-down framing the 3D intro opens on, so the outline lands exactly on the chart.
// Landscape screens fit the country's height and width; portrait screens fit its width and let the page frame it.
export function introDist(aspect = innerWidth / innerHeight) {
  const pad = aspect < 1 ? 1.1 : 1.25;
  return Math.max((UZ_W * pad) / (2 * TAN * aspect), (UZ_H * pad) / (2 * TAN));
}

// A top-view airliner: nose along +x, centred on its wing box, about 40 units long.
const PLANE = `
  <defs>
    <linearGradient id="ldFus" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef2f6"/><stop offset="1" stop-color="#b9c4d0"/></linearGradient>
    <linearGradient id="ldWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c7d0da"/><stop offset=".6" stop-color="#eef2f6"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
    <linearGradient id="ldEng" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f8b99"/><stop offset="1" stop-color="#c9d2dc"/></linearGradient>
  </defs>
  <g class="pl-body">
    <path class="pl-wing" fill="url(#ldWing)" d="M4.5 2L-5.5 18.6L-9.6 18.9L-5 2Z M4.5 -2L-5.5 -18.6L-9.6 -18.9L-5 -2Z"/>
    <path class="pl-wing" fill="url(#ldWing)" d="M-14.2 1.5L-18.6 7.6L-20.8 7.7L-19 1.4Z M-14.2 -1.5L-18.6 -7.6L-20.8 -7.7L-19 -1.4Z"/>
    <rect class="pl-eng" fill="url(#ldEng)" x="-1.6" y="6.2" width="6.4" height="2.3" rx="1.1"/>
    <rect class="pl-eng" fill="url(#ldEng)" x="-1.6" y="-8.5" width="6.4" height="2.3" rx="1.1"/>
    <path class="pl-fus" fill="url(#ldFus)" d="M20.2 0C20.2 1.5 18.4 2.15 15.6 2.15L-17.5 2.05C-19.6 2 -21.6 1.2 -21.9 0C-21.6 -1.2 -19.6 -2 -17.5 -2.05L15.6 -2.15C18.4 -2.15 20.2 -1.5 20.2 0Z"/>
    <path class="pl-fin" d="M-13.5 0L-21.4 0" />
    <path class="pl-glass" d="M18.4 -1.1C19.3 -0.6 19.3 0.6 18.4 1.1"/>
    <circle class="pl-nav pl-port" cx="-9.4" cy="-18.7" r="0.75"/>
    <circle class="pl-nav pl-star" cx="-9.4" cy="18.7" r="0.75"/>
    <circle class="pl-strobe" cx="-21.6" cy="0" r="0.7"/>
  </g>`;

export function createLoader(el, vectors) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const [tx, tz] = toXZ(INTRO_TARGET[0], INTRO_TARGET[1]);
  const aspect = innerWidth / innerHeight;
  const dist = introDist(aspect);
  const hv = 2 * TAN * dist;
  const wv = hv * aspect;
  const vb = [tx - wv / 2, tz - hv / 2, wv, hv];
  const kmPerPx = wv / innerWidth;
  const big = [vb[0] - wv, vb[1] - hv, wv * 3, hv * 3];

  const ringPath = (ring) => ring.map((p, i) => { const [x, z] = toXZ(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${z.toFixed(2)}`; }).join('') + 'Z';
  const rings = [...vectors.uz].sort((a, b) => b.length - a.length);
  const main = ringPath(rings[0]);
  const rest = rings.slice(1).map(ringPath).join('');
  const [hx, hz] = toXZ(69.2812, 41.2579);
  const reach = Math.hypot(wv, hv) * 1.1;
  // the country's far corner from Tashkent (Karakalpakstan, ~1 350 km): the fill needs no more than that
  const fillR = 1420;

  // The page itself is drawn here, so the chart underneath can show through a hole: first inside the border,
  // then everywhere. The live 3D map sits behind at exactly this framing, so nothing is swapped, only uncovered.
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'ld-map');
  svg.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <clipPath id="ldClip"><path d="${main}${rest}"/></clipPath>
      <mask id="ldMask" maskUnits="userSpaceOnUse" x="${big[0]}" y="${big[1]}" width="${big[2]}" height="${big[3]}">
        <rect x="${big[0]}" y="${big[1]}" width="${big[2]}" height="${big[3]}" fill="#fff"/>
        <g clip-path="url(#ldClip)"><circle class="ld-fill" cx="${hx}" cy="${hz}" r="0" fill="#000"/></g>
        <circle class="ld-hole" cx="${hx}" cy="${hz}" r="0" fill="#000"/>
      </mask>
      <filter id="ldGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(7 * kmPerPx).toFixed(2)}"/></filter>
      <radialGradient id="ldHalo"><stop offset="0" stop-color="var(--route)" stop-opacity=".55"/><stop offset="1" stop-color="var(--route)" stop-opacity="0"/></radialGradient>
    </defs>
    <rect class="ld-page" x="${big[0]}" y="${big[1]}" width="${big[2]}" height="${big[3]}" mask="url(#ldMask)"/>
    <path class="ld-glow" d="${main}" filter="url(#ldGlow)" pathLength="1000"/>
    <path class="ld-line ld-rest" d="${rest}"/>
    <path class="ld-line ld-main" d="${main}" pathLength="1000"/>
    <path class="ld-head" d="${main}" pathLength="1000"/>
    <circle class="ld-ring" cx="${hx}" cy="${hz}" r="0"/>
    <circle class="ld-halo" r="${(26 * kmPerPx).toFixed(2)}" fill="url(#ldHalo)"/>
    <g class="ld-plane">${PLANE}</g>`;
  const box = el.querySelector('.loader-stage');
  box.prepend(svg);
  el.classList.add('has-map');

  const mainEl = svg.querySelector('.ld-main');
  const headEl = svg.querySelector('.ld-head');
  const glowEl = svg.querySelector('.ld-glow');
  const plane = svg.querySelector('.ld-plane');
  const halo = svg.querySelector('.ld-halo');
  const total = mainEl.getTotalLength();
  const pct = el.querySelector('.loader-pct');
  const read = el.querySelector('.loader-read');

  // the read-out sits in the country's open interior when it fits there, otherwise under the country
  const toPx = (x, z) => [((x - vb[0]) / vb[2]) * innerWidth, ((z - vb[1]) / vb[3]) * innerHeight];
  const inner = (CORE_R * 2 * 0.8) / kmPerPx;
  const font = Math.min(104, inner / 2.4);
  if (font >= 46) {
    const [px, py] = toPx(...toXZ(CORE[0], CORE[1]));
    read.style.setProperty('--ld-size', `${font.toFixed(0)}px`);
    read.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
  } else {
    const [, bottom] = toPx(0, toXZ(64, 37.1)[1]);
    read.style.setProperty('--ld-size', '64px');
    read.style.transform = `translate(${innerWidth / 2}px, ${Math.min(innerHeight - 110, bottom + 40)}px) translate(-50%, 0)`;
  }

  let target = 0;
  let shown = 0;
  let raf;
  let last = performance.now();
  // the outline never draws faster than this, however quickly the data arrives
  const MIN_DRAW = 3.6;
  const lenPx = innerWidth < 700 ? 44 : 60;
  const s = (lenPx / 42) * kmPerPx;
  const body = 42 * s;
  let heading = null;
  let turn = 0;
  const draw = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const gap = target - shown;
    // a steady pen: constant speed while data is ahead of it, no slow exponential tail at the end
    if (gap > 0) shown = Math.min(target, shown + dt / MIN_DRAW);
    if (Math.abs(target - shown) < 0.0005) shown = target;
    const p = shown;
    mainEl.style.strokeDashoffset = String(1000 * (1 - p));
    // explicit [gap, dash, gap] patterns: a lit segment that ends exactly at the drawing head
    const seg = (len) => { const b = p * 1000; const a = Math.max(0, b - len); return `0 ${a.toFixed(2)} ${(b - a).toFixed(2)} 3000`; };
    headEl.style.strokeDasharray = seg(26);
    glowEl.style.strokeDasharray = seg(70);
    // the airliner rides the border itself: its tail on the drawing head, its nose a fuselage-length further
    // along the line it is about to draw, so the glow streams straight out of the tail
    const L = Math.max(0.5, p * total);
    const head = mainEl.getPointAtLength(L);
    const nose = mainEl.getPointAtLength((L + body) % total);
    const ang = Math.atan2(nose.y - head.y, nose.x - head.x);
    if (heading === null) heading = ang;
    let d = ang - heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading += d * Math.min(1, dt * 9);
    turn += (d * 3 - turn) * Math.min(1, dt * 6);
    const cx = head.x + Math.cos(heading) * body * 0.5;
    const cy = head.y + Math.sin(heading) * body * 0.5;
    // banking: the wings foreshorten into a turn
    const bank = 1 - Math.min(0.22, Math.abs(turn) * 0.5);
    plane.setAttribute('transform', `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${((heading * 180) / Math.PI).toFixed(2)}) scale(${s.toFixed(4)} ${(s * bank).toFixed(4)})`);
    halo.setAttribute('cx', head.x.toFixed(2));
    halo.setAttribute('cy', head.y.toFixed(2));
    pct.textContent = `${Math.round(p * 100)}`;
    raf = requestAnimationFrame(draw);
  };
  draw();

  return {
    set(p) { target = Math.max(target, Math.min(1, p)); },
    // The outline closes and glows once; Uzbekistan's interior opens onto the live chart, then the whole page does.
    // Resolves when the chart is fully uncovered and still in register, i.e. the moment the camera may move.
    complete(gsap, { onOpen } = {}) {
      target = 1;
      return new Promise((resolve) => {
        const tl = gsap.timeline({ paused: true, onComplete: () => { cancelAnimationFrame(raf); el.classList.add('is-done'); } });
        tl.add(() => el.classList.add('is-closed'), 0.15);
        tl.to(read, { opacity: 0, y: -10, duration: 0.5, ease: 'power2.out' }, 0.2);
        tl.to(svg.querySelector('.ld-fill'), { attr: { r: fillR }, duration: 1.45, ease: 'power2.inOut' }, 0.3);
        tl.fromTo(svg.querySelector('.ld-ring'), { attr: { r: 0 }, opacity: 0.9 }, { attr: { r: fillR }, opacity: 0, duration: 1.45, ease: 'power2.inOut' }, 0.3);
        tl.add(() => onOpen?.(), 1.0);
        tl.to(svg.querySelector('.ld-hole'), { attr: { r: reach }, duration: 1.3, ease: 'power2.inOut' }, 1.15);
        tl.to(svg.querySelectorAll('.ld-line, .ld-glow, .ld-head, .ld-halo'), { opacity: 0, duration: 0.55, ease: 'power1.out' }, 1.25);
        tl.add(() => resolve(), 1.85);
        // start once the outline has closed at its own pace
        const wait = () => (shown >= 0.999 ? tl.play() : requestAnimationFrame(wait));
        wait();
      });
    },
    dist,
  };
}
