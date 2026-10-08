import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KX } from './geo.js';
import { SHADERS } from './airport.js';

/* ───── The head office: Nest One, block C, and its neighbourhood ─────
   From OpenStreetMap 3D building parts (scripts/data/office_model.py): the Nest One towers in silver glass, block C
   in the holding's indigo with a red ring at its foot, the towers and blocks around, the Ankhor canal, parks, trees
   and streets, all as a diorama whose ground fades into the chart. Loaded only when the About page opens, drawn in
   its own pass over the chart while the contact block holds the screen. */

const HEX = 1.25;
const KM = 1 / 1000;
const mh = (m) => m * KM * HEX;
const KXR = KX / (111.32 * Math.cos((41.312 * Math.PI) / 180));
const LIGHT = new THREE.Vector3(-0.55, 0.78, -0.37);
const DISC_R = [0.5, 0.95];

const C = {
  land: [[0.86, 0.85, 0.82], [0.06, 0.1, 0.16]],
  grass: [[0.56, 0.66, 0.43], [0.05, 0.11, 0.11]],
  wood: [[0.33, 0.47, 0.28], [0.03, 0.08, 0.08]],
  pitch: [[0.45, 0.62, 0.42], [0.05, 0.12, 0.1]],
  water: [[0.47, 0.66, 0.78], [0.04, 0.14, 0.26]],
  park: [[0.66, 0.67, 0.68], [0.08, 0.11, 0.16]],
  road: [[0.62, 0.63, 0.64], [0.1, 0.13, 0.18]],
  shadow: [[0.0, 0.02, 0.06], [0.0, 0.0, 0.02]],
  ring: [[0.89, 0.0, 0.06], [1.0, 0.17, 0.23]],
};
const ROOF = {
  gen: [[0.86, 0.84, 0.8], [0.76, 0.75, 0.72], [0.66, 0.66, 0.67], [0.7, 0.5, 0.42], [0.58, 0.63, 0.68], [0.9, 0.89, 0.86], [0.8, 0.76, 0.68]],
  tower: [[0.74, 0.77, 0.8], [0.66, 0.69, 0.73]],
  nest: [[0.82, 0.85, 0.88]],
  office: [[0.07, 0.09, 0.31]],
};
const WALL = { gen: [0.88, 0.86, 0.82], tower: [0.5, 0.6, 0.72], nest: [0.72, 0.8, 0.88], office: [0.2, 0.26, 0.62] };
const KIND = { gen: 0, tower: 4, nest: 4, office: 4 };

export function createOffice({ worldAt }) {
  const group = new THREE.Group();
  group.visible = false;
  const disc = { value: new THREE.Vector4(0, 0, DISC_R[0], DISC_R[1]) };
  const shadeDisc = { value: new THREE.Vector4(0, 0, DISC_R[0], DISC_R[1]) };
  const origin = { value: new THREE.Vector3() };
  const grounds = [];
  const mats = [];
  let built = null;
  let want = false;
  const state = { k: 0, anchor: null };

  const L = ([x, z]) => [x * KM * KXR, z * KM];
  const shapeOf = (pts, holes = []) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
    return s;
  };
  const ground = (key, { opacity = 1, grain = 0.08, scale = 220, order = 1 } = {}) => {
    const [day, night] = C[key];
    const m = new THREE.ShaderMaterial({
      vertexShader: SHADERS.groundVert, fragmentShader: SHADERS.groundFrag,
      uniforms: { uColor: { value: new THREE.Color(...day) }, uOpacity: { value: opacity }, uGrain: { value: grain }, uScale: { value: scale }, uDisc: disc },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    m.userData = { day: new THREE.Color(...day), night: new THREE.Color(...night), base: opacity, order };
    grounds.push(m);
    return m;
  };
  const flat = (rings, y, mat) => {
    const gs = rings.filter((r) => r.length > 2).map((r) => {
      const outer = Array.isArray(r[0][0]) ? r[0] : r;
      const holes = Array.isArray(r[0][0]) ? r.slice(1) : [];
      const g = new THREE.ShapeGeometry(shapeOf(outer.map(L), holes.map((h) => h.map(L))));
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute('uv'); g.deleteAttribute('normal');
      return g.index ? g.toNonIndexed() : g;
    });
    if (!gs.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(gs), mat);
    mesh.renderOrder = mat.userData.order;
    group.add(mesh);
  };
  const ribbon = (lines, y, mat) => {
    const pos = [];
    lines.forEach(({ w, g }) => {
      const pts = g.map(L);
      const hw = (w * KM) / 2;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const ux = (bx - ax) / len, uz = (bz - az) / len;
        const nx = -uz * hw, nz = ux * hw, ex = ux * hw, ez = uz * hw;
        pos.push(ax - ex + nx, y, az - ez + nz, ax - ex - nx, y, az - ez - nz, bx + ex - nx, y, bz + ez - nz, ax - ex + nx, y, az - ez + nz, bx + ex - nx, y, bz + ez - nz, bx + ex + nx, y, bz + ez + nz);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = mat.userData.order;
    group.add(mesh);
  };
  const shade = (night) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: SHADERS.shadeVert, fragmentShader: SHADERS.shadeFrag,
      uniforms: { uDay: { value: new THREE.Color(1, 1, 1) }, uNightC: { value: new THREE.Color(...night) }, uNight: { value: 0 }, uLight: { value: LIGHT }, uOpacity: { value: 1 }, uDisc: shadeDisc, uOrigin: origin },
    });
    mats.push(m);
    return m;
  };

  const build = (d) => {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const Y = (i) => 0.0002 + i * 0.00006;
    // the city's own pavement, a square the disc rounds off
    {
      const g = new THREE.PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, ground('land', { grain: 0.1, order: 0 }));
      mesh.renderOrder = 0;
      group.add(mesh);
    }
    flat(d.grass, Y(1), ground('grass', { grain: 0.16, scale: 90, order: 1 }));
    flat(d.wood, Y(2), ground('wood', { grain: 0.22, scale: 160, order: 1 }));
    flat(d.pitches, Y(3), ground('pitch', { grain: 0.06, order: 2 }));
    flat(d.parking, Y(3), ground('park', { grain: 0.05, order: 2 }));
    flat(d.water, Y(4), ground('water', { grain: 0.04, order: 3 }));
    ribbon(d.canals, Y(4), ground('water', { grain: 0.04, order: 3 }));
    ribbon(d.roads, Y(5), ground('road', { grain: 0.04, order: 3 }));
    flat(d.shadows.map((s) => [s.o, ...s.h]), Y(7), ground('shadow', { opacity: 0.28, grain: 0, order: 5 }));

    // buildings: one geometry, colour and kind per building in attributes
    const bm = new THREE.ShaderMaterial({
      vertexShader: SHADERS.bldVert, fragmentShader: SHADERS.bldFrag,
      uniforms: { uNight: { value: 0 }, uStorey: { value: mh(3.6) }, uOpacity: { value: 1 }, uLight: { value: LIGHT }, uDisc: disc },
    });
    mats.push(bm);
    const geos = d.bld.map((b) => {
      const base = mh(b.b || 0);
      const top = Math.max(base + mh(2), mh(b.h));
      const g = new THREE.ExtrudeGeometry(shapeOf(b.g.map(L)), { depth: top - base, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, base, 0);
      g.deleteAttribute('uv');
      const ng = g.index ? g.toNonIndexed() : g;
      const n = ng.attributes.position.count;
      const pal = ROOF[b.c] || ROOF.gen;
      const roof = pal[Math.floor(rnd() * pal.length)];
      const wall = WALL[b.c] || WALL.gen;
      const a = new Float32Array(n * 3), w = new Float32Array(n * 3), info = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a.set(roof, i * 3); w.set(wall, i * 3); info.set([KIND[b.c] ?? 0, base, top], i * 3); }
      ng.setAttribute('aRoof', new THREE.BufferAttribute(a, 3));
      ng.setAttribute('aWall', new THREE.BufferAttribute(w, 3));
      ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
      const pts = b.g.map(L);
      const cc = [pts.reduce((s0, p) => s0 + p[0], 0) / pts.length, pts.reduce((s0, p) => s0 + p[1], 0) / pts.length];
      const ca = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) ca.set(cc, i * 2);
      ng.setAttribute('aC', new THREE.BufferAttribute(ca, 2));
      return ng;
    });
    const merged = mergeGeometries(geos);
    const bmesh = new THREE.Mesh(merged, bm);
    bmesh.renderOrder = 8;
    group.add(bmesh);

    // trees
    const tp = d.trees.map(L);
    if (tp.length) {
      const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), shade([0.12, 0.2, 0.2]), tp.length);
      const m4 = new THREE.Matrix4();
      const c = new THREE.Color();
      tp.forEach(([x, z], i) => {
        const r = 0.0022 + rnd() * 0.0022;
        m4.compose(new THREE.Vector3(x, r * 1.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(r, r * 1.4, r));
        trees.setMatrixAt(i, m4);
        trees.setColorAt(i, c.setRGB(0.26 + rnd() * 0.08, 0.4 + rnd() * 0.1, 0.2 + rnd() * 0.06));
      });
      group.add(trees);
    }

    // block C: a red ring at its foot, the "you are here" of the chart
    const [ox, oz] = L(d.office);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.044, 0.05, 64).rotateX(-Math.PI / 2), ground('ring', { grain: 0, order: 6 }));
    ring.position.set(ox, Y(8), oz);
    ring.renderOrder = 6;
    group.add(ring);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.044, 64).rotateX(-Math.PI / 2), ground('ring', { opacity: 0.08, grain: 0, order: 6 }));
    halo.position.set(ox, Y(8), oz);
    group.add(halo);

    const at = worldAt(d.o[0], d.o[1], 0);
    group.position.copy(at);
    group.updateMatrixWorld(true);
    // the pin floats above the block's roof, a leader line drawn down to it (CSS)
    state.anchor = new THREE.Vector3(at.x + ox, at.y + mh(d.office[2]) + 0.12, at.z + oz);
    return true;
  };

  const load = () => {
    if (!built) built = fetch('/data/office-model.json').then((r) => r.json()).then(build).catch(() => null);
    return built;
  };

  return {
    group, load, state,
    show(on) { want = on; if (on) load(); },
    get k() { return state.k; },
    get anchor() { return state.anchor; },
    update(dt, night) {
      const target = want && state.anchor ? 1 : 0;
      state.k += (target - state.k) * Math.min(1, dt * 2.6);
      if (Math.abs(target - state.k) < 0.002) state.k = target;
      group.visible = state.k > 0.01;
      if (!group.visible) return;
      grounds.forEach((m) => { m.uniforms.uColor.value.copy(m.userData.day).lerp(m.userData.night, night); m.uniforms.uOpacity.value = m.userData.base * state.k; });
      mats.forEach((m) => { m.uniforms.uNight.value = night; m.uniforms.uOpacity.value = 1; });
      // the buildings rise out of the plan as the block arrives
      group.scale.set(1, 0.05 + 0.95 * (1 - Math.pow(1 - state.k, 3)), 1);
      origin.value.setFromMatrixPosition(group.matrixWorld);
    },
  };
}
