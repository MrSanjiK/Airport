import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { toXZ, EXAG } from './geo.js';
import SITES from '../data/sites.json';

// what a pick shows: a site on its own, or a group of sites (the Tashkent region's towns)
export const GROUPS = {
  nurafshon: ['chirchiq', 'olmaliq', 'angren', 'yangiyol', 'bekobod', 'chorvoq', 'gazalkent', 'qibray', 'zangiota'],
};
export { SITES };

/* ───── City models for the regional network ─────
   public/data/city/<key>.json (scripts/data/cities.py): OSM streets, buildings, parks and water around the centre,
   and every network venue placed on them. The chart under the city is levelled (terrain uFlat) so the model sits
   on a flat plate; buildings carry a 4× height exaggeration, venue buildings are drawn in the brand red. */

const HEX = 5;
const LOGV = `#include <common>
#include <logdepthbuf_pars_vertex>`;
const vert = /* glsl */ `${LOGV}
  attribute vec3 aVenue;
  varying vec3 vN; varying vec3 vNl; varying vec3 vP; varying vec3 vInfo;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal); vNl = normal; vP = position; vInfo = aVenue;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
// roofs in the colours of the town seen from above (concrete, tin, terracotta, tar), walls with storey windows that
// burn at night, a contact shadow at every wall's foot; network venues in the brand red
const frag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uNight, uOpacity, uStorey; uniform vec3 uLight;
  varying vec3 vN; varying vec3 vNl; varying vec3 vP; varying vec3 vInfo;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // periodic bands box-filtered over the pixel (as in airport.js): crisp up close, their average once sub-pixel
  float pint(float x, float a, float b){ return floor(x) * (b - a) + clamp(fract(x), a, b) - a; }
  float band(float x, float a, float b){ float w = max(fwidth(x), 1e-4); return (pint(x + w * 0.5, a, b) - pint(x - w * 0.5, a, b)) / w; }
  float detail(float cells){ return 1.0 - smoothstep(0.3, 0.85, cells); }
  void main(){
    #include <logdepthbuf_fragment>
    float venue = vInfo.x, seed = vInfo.y, top = vInfo.z;
    vec3 n = normalize(vN);
    float l = clamp(dot(n, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    float roof = step(0.9, n.y);
    // roof palette, one per building
    vec3 r0 = vec3(0.86, 0.85, 0.82), r1 = vec3(0.72, 0.72, 0.71), r2 = vec3(0.66, 0.48, 0.41), r3 = vec3(0.56, 0.6, 0.64), r4 = vec3(0.8, 0.76, 0.68);
    vec3 roofC = seed < 0.34 ? r0 : seed < 0.56 ? r1 : seed < 0.72 ? r2 : seed < 0.86 ? r3 : r4;
    vec2 gq = vP.xz * 3000.0;
    roofC *= 1.0 + (hash(floor(gq)) - 0.5) * 0.04 * detail(max(fwidth(gq.x), fwidth(gq.y)));
    // walls: storey windows along the facade
    vec2 tg = vec2(-vNl.z, vNl.x);
    float u = dot(vP.xz, tg / max(1e-5, length(tg)));
    float fy = vP.y / uStorey;
    float pw = uStorey * 0.6;
    float win = band(fy, 0.3, 0.76) * band(u / pw, 0.2, 0.8) * step(1.2, top / uStorey) * step(0.5, fy);
    float lit = mix(0.55, step(0.45, hash(vec2(floor(u / pw), floor(fy)) + seed * 57.0)), detail(max(fwidth(u / pw), fwidth(fy))));
    float ao = mix(0.6, 1.0, smoothstep(0.0, uStorey * 1.8, vP.y));
    vec3 wallD = mix(vec3(0.9, 0.89, 0.86), vec3(0.84, 0.86, 0.9), seed) * mix(0.62, 1.0, l);
    vec3 glassD = mix(vec3(0.34, 0.41, 0.5), vec3(0.55, 0.63, 0.73), l);
    vec3 day = mix(mix(wallD, glassD, win * 0.85) * ao, roofC * mix(0.94, 1.04, l), roof);
    vec3 wallN = vec3(0.09, 0.16, 0.27) * mix(0.8, 1.15, l) * ao;
    vec3 glow = vec3(1.0, 0.8, 0.52) * mix(0.06, 0.9, lit);
    vec3 night = mix(mix(wallN, glow, win), vec3(0.17, 0.27, 0.42), roof);
    vec3 base = mix(day, night, uNight);
    vec3 red = mix(vec3(0.89, 0.0, 0.06), vec3(1.0, 0.24, 0.3), uNight) * mix(mix(0.72, 1.0, l), 1.08, roof);
    red = mix(red, vec3(1.0, 0.9, 0.8), win * 0.35 * (1.0 - roof));
    gl_FragColor = vec4(mix(base, red, venue), uOpacity);
  }`;

export function createCityLayer({ scene, sample, terrain, upload = () => Promise.resolve() }) {
  const LIGHT = new THREE.Vector3(-0.5, 0.8, -0.3);
  const cache = new Map();
  const groups = new Map();
  let active = null;
  const fade = { k: 0, key: null };

  const buildMat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true,
    uniforms: { uNight: { value: 0 }, uOpacity: { value: 0 }, uLight: { value: LIGHT }, uStorey: { value: (3.3 / 1000) * HEX } },
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x163b67, transparent: true, opacity: 0, depthWrite: false });
  const flatMat = (day, night, op) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...day), transparent: true, opacity: 0, depthWrite: false });
    m.userData = { day: new THREE.Color(...day), night: new THREE.Color(...night), op };
    return m;
  };
  const greenMat = flatMat([0.82, 0.89, 0.83], [0.07, 0.16, 0.19], 0.85);
  const waterMat = flatMat([0.76, 0.85, 0.93], [0.06, 0.18, 0.31], 0.95);
  const roadMats = [
    [2.2, 0.8], [1.5, 0.65], [0.8, 0.42], [0.5, 0.26], // major, secondary, residential, service
  ].map(([w, o]) => { const m = new LineMaterial({ color: 0x163b67, linewidth: w, transparent: true, depthWrite: false, worldUnits: false }); m.userData = { w, o }; return m; });
  const canalMat = new LineMaterial({ color: 0x4d80b8, linewidth: 1.4, transparent: true, depthWrite: false, worldUnits: false });
  canalMat.userData = { w: 1.4, o: 0.7 };

  // the geometry is built in a worker (cityWorker.js); here it is only wrapped and placed on its levelled plate
  const worker = new Worker(new URL('./cityWorker.js', import.meta.url), { type: 'module' });
  const waiting = new Map();
  worker.onmessage = (e) => { const done = waiting.get(e.data.key); waiting.delete(e.data.key); done?.(e.data.error ? null : e.data); };
  const fetchBuilt = (key) => new Promise((resolve) => {
    waiting.set(key, resolve);
    worker.postMessage({ key, url: new URL(`/data/city/${key}.json`, location.href).href });
  });

  const assemble = (key, d) => {
    const [c0, c1] = d.c;
    const y0 = (Math.max(0, sample(c0, c1)) / 1000) * EXAG;
    const group = new THREE.Group();
    group.visible = false;
    group.position.y = y0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
    g.setAttribute('aVenue', new THREE.BufferAttribute(d.ven, 3));
    const mesh = new THREE.Mesh(g, buildMat);
    mesh.renderOrder = 5;
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(d.edges, 3));
    const lines = new THREE.LineSegments(eg, edgeMat);
    lines.renderOrder = 6;
    // parks and water as flat fills just above the levelled chart, one mesh each
    [[d.green, greenMat], [d.water, waterMat]].forEach(([arr, mat]) => {
      if (!arr.length) return;
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const m = new THREE.Mesh(fg, mat);
      m.renderOrder = 2;
      group.add(m);
    });
    // streets by class, and canals
    d.roads.forEach((arr, i) => {
      if (!arr.length) return;
      const lg = new LineSegmentsGeometry();
      lg.setPositions(arr);
      const l = new LineSegments2(lg, roadMats[i]);
      l.renderOrder = 4 - i * 0.1;
      group.add(l);
    });
    if (d.canals.length) {
      const lg = new LineSegmentsGeometry();
      lg.setPositions(d.canals);
      group.add(new LineSegments2(lg, canalMat));
    }
    group.add(mesh, lines);
    scene.add(group);
    const venues = d.venues.map((v) => ({ ...v, w: new THREE.Vector3(v.w[0], v.w[1] + y0, v.w[2]) }));
    const [cx, cz] = toXZ(c0, c1);
    return { key, group, venues, center: [c0, c1], x: cx, z: cz, y0, r: d.r };
  };

  // every city material on one degenerate stand-in, so the loader's prewarm compiles their programs: the first
  // model to come up (Tashkent, in the HoReCa chapter) then costs no shader compile mid-scroll
  const warm = new THREE.Group();
  {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, -1e3, 0, 1e-6, -1e3, 0, 0, -1e3, 1e-6], 3));
    tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    tri.setAttribute('aVenue', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    warm.add(new THREE.Mesh(tri, buildMat), new THREE.Mesh(tri, greenMat), new THREE.Mesh(tri, waterMat), new THREE.LineSegments(tri, edgeMat));
    [...roadMats, canalMat].forEach((m) => { const lg = new LineSegmentsGeometry(); lg.setPositions([0, -1e3, 0, 1e-6, -1e3, 0]); warm.add(new LineSegments2(lg, m)); });
    warm.traverse((o) => { o.frustumCulled = false; });
    scene.add(warm);
  }

  const load = (key) => {
    // a model counts as loaded once its buffers are on the GPU (world.js upload queue), so its first frame never stalls
    if (!cache.has(key)) cache.set(key, fetchBuilt(key).then((d) => { if (!d) return null; const c = assemble(key, d); return upload([...c.group.children]).then(() => { groups.set(key, c); return c; }); }));
    return cache.get(key);
  };

  return {
    // after the loader's compile the stand-in leaves the scene
    unwarm() { scene.remove(warm); },
    has: (key) => !!(key && (SITES[key] || GROUPS[key])),
    load,
    // the site whose area holds a point (lon, lat), for the explorer's automatic models
    siteAt(lon, lat) {
      let best = null;
      let bd = Infinity;
      for (const [k, [x, y, r]] of Object.entries(SITES)) {
        const d = Math.hypot((lon - x) * 85, (lat - y) * 111);
        if (d < r + 1.5 && d < bd) { best = k; bd = d; }
      }
      return best;
    },
    // show a site or group (or none); the models and the levelled plates fade together
    async show(key) {
      if (key === fade.key) return active;
      fade.key = key;
      if (!key) return null;
      const keys = GROUPS[key] || [key];
      const parts = (await Promise.all(keys.map(load))).filter(Boolean);
      if (fade.key !== key || !parts.length) return null;
      const venues = parts.flatMap((c) => c.venues.map((v) => ({ ...v, site: c.key })));
      venues.forEach((v, i) => (v.i = i));
      const lon = parts.reduce((a, c) => a + c.center[0], 0) / parts.length;
      const lat = parts.reduce((a, c) => a + c.center[1], 0) / parts.length;
      active = { key, parts, venues, center: [lon, lat] };
      const u = terrain.uniforms;
      parts.slice(0, 8).forEach((c, i) => u.uFlat.value[i].set(c.x, c.z, c.r * 1.05, c.y0));
      u.uFlatN.value = Math.min(8, parts.length);
      return active;
    },
    get active() { return fade.key && active && active.key === fade.key ? active : null; },
    // height of the chart at (x, z) once the plates are levelled, for things standing on it (the airport)
    flatY(x, z, y) {
      if (!active || fade.k <= 0) return y;
      let out = y;
      for (const c of active.parts) {
        const d = Math.hypot(x - c.x, z - c.z);
        const r = c.r * 1.05;
        const t = Math.min(1, Math.max(0, (d - r) / (r * 0.9)));
        const f = (1 - t * t * (3 - 2 * t)) * fade.k;
        out = out + (c.y0 - out) * f;
      }
      return out;
    },
    get k() { return fade.k; },
    update(night, renderer, dt, dist = 10) {
      const want = this.active ? 1 : 0;
      // in quickly, out quicker: a model left behind must not ride along into the next chapter's flight
      fade.k += (want - fade.k) * Math.min(1, dt * (want ? 3.2 : 5.5));
      if (fade.k < 0.002 && !want) fade.k = 0;
      terrain.uniforms.uFlatK.value = fade.k;
      // a town's model is drawn only from a town's distance: from a regional height its thousands of buildings and
      // its street network (lines a fixed number of pixels wide) would be painted into a few pixels, over and over,
      // which on a modest graphics chip stalled the flight out to the Regions chapter
      const near = dist < 150;
      groups.forEach((g) => (g.group.visible = near && !!active && active.parts.includes(g) && fade.k > 0.01));
      if (!active) return;
      const res = renderer.getDrawingBufferSize(new THREE.Vector2());
      const dpr = renderer.getPixelRatio();
      const k = fade.k;
      buildMat.uniforms.uNight.value = night;
      buildMat.uniforms.uOpacity.value = k;
      edgeMat.opacity = 0.16 * k * (1 - 0.4 * night);
      edgeMat.color.setRGB(0.086 + (0.62 - 0.086) * night, 0.231 + (0.74 - 0.231) * night, 0.404 + (0.88 - 0.404) * night);
      [greenMat, waterMat].forEach((m) => { m.color.copy(m.userData.day).lerp(m.userData.night, night); m.opacity = m.userData.op * k; });
      [...roadMats, canalMat].forEach((m) => {
        m.resolution.copy(res);
        m.linewidth = m.userData.w * dpr;
        // seen from a regional height a town's streets would knot into a blot: they thin out with distance
        m.opacity = m.userData.o * k * Math.min(1, Math.max(0, (90 - dist) / 50));
        m.visible = m.opacity > 0.004;
      });
      // streets in asphalt grey by day (the chart's ink only for the main roads' edge), lit ink at night
      roadMats.forEach((m, i) => m.color.setRGB(...[0, 1, 2].map((c) => { const d = i === 0 ? [0.36, 0.4, 0.47][c] : [0.52, 0.55, 0.6][c]; const n = [0.62, 0.74, 0.88][c]; return d + (n - d) * night; })));
    },
  };
}
