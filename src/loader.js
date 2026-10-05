import { toXZ } from './scene/geo.js';
import bounds from './data/relief-bounds.json';

const TAN = Math.tan((16 * Math.PI) / 180);
const SHEET_H = 15 * 110.57;
export const INTRO_TARGET = [64.6, 41.4];

// The same top-down framing the 3D intro opens on, so the outline lands exactly on the chart.
export function introDist(aspect = innerWidth / innerHeight) {
  const fit = Math.max(1440 / (0.8 * 2 * TAN * aspect), 930 / (0.8 * 2 * TAN));
  return Math.min(fit, (SHEET_H * 0.92) / (2 * TAN));
}

const PLANE = 'M0 0l-6.5-3.2v1.8l2.6 1.4H-9l-1.4-1.7h-1.2l.8 2.7-.8 2.7h1.2L-9 2h5.1l-2.6 1.4v1.8z';

export function createLoader(el, vectors) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const night = () => document.documentElement.dataset.theme === 'night';
  const [tx, tz] = toXZ(INTRO_TARGET[0], INTRO_TARGET[1]);
  const aspect = innerWidth / innerHeight;
  const dist = introDist(aspect);
  const hv = 2 * TAN * dist;
  const wv = hv * aspect;
  const vb = [tx - wv / 2, tz - hv / 2, wv, hv];
  const kmPerPx = wv / innerWidth;

  const ringPath = (ring) => ring.map((p, i) => { const [x, z] = toXZ(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${z.toFixed(2)}`; }).join('') + 'Z';
  const rings = [...vectors.uz].sort((a, b) => b.length - a.length);
  const main = ringPath(rings[0]);
  const rest = rings.slice(1).map(ringPath).join('');
  const [ix0, iz0] = toXZ(bounds.lon0, bounds.lat1);
  const [ix1, iz1] = toXZ(bounds.lon1, bounds.lat0);
  const [hx, hz] = toXZ(69.2812, 41.2579);
  // the read-out sits in open ground south-west of the country, clear of the border it is drawing
  const [cx, cz] = toXZ(61.4, 38.7);

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'ld-map');
  svg.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <clipPath id="ldClip"><path d="${main}${rest}"/></clipPath>
      <mask id="ldMask" maskUnits="userSpaceOnUse" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}">
        <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#000"/>
        <circle class="ld-reveal" cx="${hx}" cy="${hz}" r="0" fill="#fff"/>
      </mask>
      <filter id="ldGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(9 * kmPerPx).toFixed(2)}"/></filter>
    </defs>
    <g clip-path="url(#ldClip)" mask="url(#ldMask)">
      <image class="ld-relief" href="/img/uz-relief-${night() ? 'night' : 'day'}.webp" x="${ix0}" y="${iz0}" width="${ix1 - ix0}" height="${iz1 - iz0}" preserveAspectRatio="none"/>
    </g>
    <path class="ld-glow" d="${main}" filter="url(#ldGlow)" pathLength="1000"/>
    <path class="ld-line ld-rest" d="${rest}"/>
    <path class="ld-line ld-main" d="${main}" pathLength="1000"/>
    <path class="ld-head" d="${main}" pathLength="1000"/>
    <circle class="ld-ring" cx="${hx}" cy="${hz}" r="0"/>
    <g class="ld-plane"><path d="${PLANE}"/></g>`;
  const box = el.querySelector('.loader-stage');
  box.prepend(svg);

  const mainEl = svg.querySelector('.ld-main');
  const headEl = svg.querySelector('.ld-head');
  const glowEl = svg.querySelector('.ld-glow');
  const plane = svg.querySelector('.ld-plane');
  const total = mainEl.getTotalLength();
  const pct = el.querySelector('.loader-pct');
  // centre the read-out over the country
  const toPx = (x, z) => [((x - vb[0]) / vb[2]) * innerWidth, ((z - vb[1]) / vb[3]) * innerHeight];
  let [px, py] = toPx(cx, cz);
  px = Math.min(Math.max(px, 120), innerWidth - 120);
  py = Math.min(Math.max(py, 140), innerHeight - 120);
  el.querySelector('.loader-read').style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;

  let target = 0;
  let shown = 0;
  let raf;
  let last = performance.now();
  // the outline never draws faster than this, however quickly the data arrives
  const MIN_DRAW = 3.6;
  const s = (24 * kmPerPx) / 9;
  const draw = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const gap = target - shown;
    shown += Math.min(gap * 0.06, dt / MIN_DRAW) * (gap > 0 ? 1 : 0);
    if (Math.abs(target - shown) < 0.0005) shown = target;
    const p = shown;
    mainEl.style.strokeDashoffset = String(1000 * (1 - p));
    // explicit [gap, dash, gap] patterns: a lit segment that ends exactly at the drawing head
    const seg = (len) => { const b = p * 1000; const a = Math.max(0, b - len); return `0 ${a.toFixed(2)} ${(b - a).toFixed(2)} 3000`; };
    headEl.style.strokeDasharray = seg(26);
    glowEl.style.strokeDasharray = seg(60);
    const L = Math.max(0.5, p * total);
    const a = mainEl.getPointAtLength(L);
    const b = mainEl.getPointAtLength(Math.max(0, L - 4));
    const ang = (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI;
    plane.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${ang.toFixed(1)}) scale(${s.toFixed(3)})`);
    pct.textContent = `${Math.round(p * 100)}`;
    raf = requestAnimationFrame(draw);
  };
  draw();

  return {
    set(p) { target = Math.max(target, Math.min(1, p)); },
    // the outline closes, glows once, and the relief floods in from TAS
    complete(gsap) {
      target = 1;
      return new Promise((resolve) => {
        const tl = gsap.timeline({ paused: true, onComplete: () => cancelAnimationFrame(raf) });
        // the outline keeps its own slow pace; what follows it is brisk, and the 3D flight starts while the relief is still flooding
        tl.to({}, { duration: 0.2 });
        tl.add(() => el.classList.add('is-closed'));
        tl.to(svg.querySelector('.ld-reveal'), { attr: { r: 1500 }, duration: 1.6, ease: 'power2.inOut' }, '+=0.1');
        tl.fromTo(svg.querySelector('.ld-ring'), { attr: { r: 0 }, opacity: 1 }, { attr: { r: 1500 }, opacity: 0, duration: 1.6, ease: 'power2.inOut' }, '<');
        tl.to(el.querySelector('.loader-read'), { opacity: 0, y: -12, duration: 0.5 }, '<');
        // the drawn border hands over to the 3D chart's own: it fades while the relief floods, so the two never double up
        tl.to(svg.querySelectorAll('.ld-line, .ld-glow'), { opacity: 0, duration: 0.6, ease: 'power1.out' }, '<+0.5');
        tl.add(() => resolve(), '-=0.45');
        // start once the outline has closed at its own pace
        const wait = () => (shown >= 0.999 ? tl.play() : requestAnimationFrame(wait));
        wait();
      });
    },
    dist,
  };
}
