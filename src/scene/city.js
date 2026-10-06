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
  attribute float aVenue;
  varying vec3 vN; varying float vVenue; varying float vRoof;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal); vVenue = aVenue; vRoof = step(0.9, normal.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
const frag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uNight, uOpacity; uniform vec3 uLight;
  varying vec3 vN; varying float vVenue; varying float vRoof;
  void main(){
    #include <logdepthbuf_fragment>
    float l = clamp(dot(normalize(vN), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 roofD = vec3(0.985, 0.99, 1.0), wallD = vec3(0.86, 0.9, 0.95) * mix(0.72, 1.0, l);
    vec3 roofN = vec3(0.17, 0.27, 0.42), wallN = vec3(0.09, 0.16, 0.27) * mix(0.8, 1.15, l);
    vec3 base = mix(mix(wallD, roofD, vRoof), mix(wallN, roofN, vRoof), uNight);
    vec3 red = mix(vec3(0.89, 0.0, 0.06), vec3(1.0, 0.24, 0.3), uNight) * mix(mix(0.72, 1.0, l), 1.08, vRoof);
    gl_FragColor = vec4(mix(base, red, vVenue), uOpacity);
  }`;

export function createCityLayer({ scene, sample, terrain }) {
  const LIGHT = new THREE.Vector3(-0.5, 0.8, -0.3);
  const cache = new Map();
  const groups = new Map();
  let active = null;
  const fade = { k: 0, key: null };

  const buildMat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true,
    uniforms: { uNight: { value: 0 }, uOpacity: { value: 0 }, uLight: { value: LIGHT } },
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

  const shapeXZ = (ring) => ring.map(([x, z]) => new THREE.Vector2(x, z));

  const build = (key, d) => {
    const [c0, c1] = d.c;
    const P = (dx, dy) => toXZ(c0 + dx / 1e5, c1 + dy / 1e5);
    const y0 = (Math.max(0, sample(c0, c1)) / 1000) * EXAG;
    const group = new THREE.Group();
    group.visible = false;
    const venueB = new Set(d.venues.map((v) => v.b).filter((b) => b >= 0));

    // buildings: roofs and walls in one geometry, roof outlines in another
    const pos = [];
    const nor = [];
    const ven = [];
    const edges = [];
    d.bld.forEach((b, i) => {
      const h = (b[0] / 1000) * HEX;
      let ring = [];
      for (let j = 1; j < b.length; j += 2) ring.push(P(b[j], b[j + 1]));
      if (ring.length < 3) return;
      if (THREE.ShapeUtils.isClockWise(shapeXZ(ring))) ring = ring.reverse();
      const v = venueB.has(i) ? 1 : 0;
      const top = y0 + h * (v ? 1.35 : 1);
      const tris = THREE.ShapeUtils.triangulateShape(shapeXZ(ring), []);
      tris.forEach((t) => t.slice().reverse().forEach((k) => { pos.push(ring[k][0], top, ring[k][1]); nor.push(0, 1, 0); ven.push(v); }));
      for (let k = 0; k < ring.length; k++) {
        const [ax, az] = ring[k];
        const [bx, bz] = ring[(k + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (bz - az) / len;
        const nz = -(bx - ax) / len;
        pos.push(ax, y0, az, bx, y0, bz, bx, top, bz, ax, y0, az, bx, top, bz, ax, top, az);
        for (let q = 0; q < 6; q++) { nor.push(nx, 0, nz); ven.push(v); }
        edges.push(ax, top, az, bx, top, bz);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aVenue', new THREE.Float32BufferAttribute(ven, 1));
    const mesh = new THREE.Mesh(g, buildMat);
    mesh.renderOrder = 5;
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
    const lines = new THREE.LineSegments(eg, edgeMat);
    lines.renderOrder = 6;

    // parks and water as flat fills just above the levelled chart
    const fill = (rings, mat, y) => {
      const geos = [];
      rings.forEach((r) => {
        const ring = [];
        for (let j = 0; j < r.length; j += 2) ring.push(P(r[j], r[j + 1]));
        if (ring.length < 4) return;
        const sg = new THREE.ShapeGeometry(new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
        sg.rotateX(-Math.PI / 2);
        sg.translate(0, y, 0);
        geos.push(sg);
      });
      if (!geos.length) return;
      geos.forEach((sg) => { const m = new THREE.Mesh(sg, mat); m.renderOrder = 2; group.add(m); });
    };
    fill(d.green, greenMat, y0 + 0.0008);
    fill(d.water, waterMat, y0 + 0.001);

    // streets by class, and canals
    const byClass = [[], [], [], []];
    d.roads.forEach((r) => {
      const out = byClass[r[0]];
      for (let j = 1; j < r.length - 2; j += 2) {
        const [ax, az] = P(r[j], r[j + 1]);
        const [bx, bz] = P(r[j + 2], r[j + 3]);
        out.push(ax, y0 + 0.003, az, bx, y0 + 0.003, bz);
      }
    });
    byClass.forEach((arr, i) => {
      if (!arr.length) return;
      const lg = new LineSegmentsGeometry();
      lg.setPositions(arr);
      const l = new LineSegments2(lg, roadMats[i]);
      l.renderOrder = 4 - i * 0.1;
      group.add(l);
    });
    const can = [];
    d.canals.forEach((r) => {
      for (let j = 0; j < r.length - 2; j += 2) {
        const [ax, az] = P(r[j], r[j + 1]);
        const [bx, bz] = P(r[j + 2], r[j + 3]);
        can.push(ax, y0 + 0.002, az, bx, y0 + 0.002, bz);
      }
    });
    if (can.length) {
      const lg = new LineSegmentsGeometry();
      lg.setPositions(can);
      group.add(new LineSegments2(lg, canalMat));
    }
    group.add(mesh, lines);
    scene.add(group);

    // venues: world anchor on top of their building (or the street), for the DOM labels
    const venues = d.venues.map((v, i) => {
      const lon = c0 + v.p[0] / 1e5;
      const lat = c1 + v.p[1] / 1e5;
      const [x, z] = toXZ(lon, lat);
      const b = v.b >= 0 ? d.bld[v.b] : null;
      const top = b ? y0 + (b[0] / 1000) * HEX * 1.35 : y0;
      return { ...v, i, ll: [lon, lat], w: new THREE.Vector3(x, top + 0.004, z) };
    });
    const [cx, cz] = toXZ(c0, c1);
    return { key, group, venues, center: [c0, c1], x: cx, z: cz, y0, r: d.r };
  };

  const load = async (key) => {
    if (groups.has(key)) return groups.get(key);
    if (!cache.has(key)) cache.set(key, fetch(`/data/city/${key}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    const d = await cache.get(key);
    if (!d) return null;
    if (!groups.has(key)) groups.set(key, build(key, d));
    return groups.get(key);
  };

  return {
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
      fade.k += (want - fade.k) * Math.min(1, dt * 3.2);
      if (fade.k < 0.002 && !want) fade.k = 0;
      terrain.uniforms.uFlatK.value = fade.k;
      groups.forEach((g) => (g.group.visible = !!active && active.parts.includes(g) && fade.k > 0.01));
      if (!active) return;
      const res = renderer.getDrawingBufferSize(new THREE.Vector2());
      const dpr = renderer.getPixelRatio();
      const k = fade.k;
      buildMat.uniforms.uNight.value = night;
      buildMat.uniforms.uOpacity.value = k;
      edgeMat.opacity = 0.5 * k * (1 - 0.55 * night);
      edgeMat.color.setRGB(0.086 + (0.62 - 0.086) * night, 0.231 + (0.74 - 0.231) * night, 0.404 + (0.88 - 0.404) * night);
      [greenMat, waterMat].forEach((m) => { m.color.copy(m.userData.day).lerp(m.userData.night, night); m.opacity = m.userData.op * k; });
      [...roadMats, canalMat].forEach((m) => {
        m.resolution.copy(res);
        m.linewidth = m.userData.w * dpr;
        // seen from a regional height a town's streets would knot into a blot: they thin out with distance
        m.opacity = m.userData.o * k * Math.min(1, Math.max(0.12, (70 - dist) / 45));
      });
      roadMats.forEach((m) => m.color.setRGB(0.086 + (0.62 - 0.086) * night, 0.231 + (0.74 - 0.231) * night, 0.404 + (0.88 - 0.404) * night));
    },
  };
}
