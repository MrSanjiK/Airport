import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toXZ } from './geo.js';

/* ───── Tashkent International Airport as an architectural model ─────
   Built from OpenStreetMap: terminal footprints, the four jet bridges (gates 1–4), the air-traffic control
   building, aprons, taxiways, stands, the landside roads, car parks, lawns, woods and trees, and every
   building within ~600 m. Volumes carry a 4× height exaggeration (the airport plate halves it). */

const HEX = 4;
const mh = (m) => (m / 1000) * HEX;
const KM = 1 / 1000;

const LOGV = `#include <common>
#include <logdepthbuf_pars_vertex>`;

// Terminal shell: shaded walls, a glazed band (a full-height curtain wall on the landside), roof seams
const termVert = /* glsl */ `${LOGV}
  varying vec3 vN; varying vec3 vP;
  void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  #include <logdepthbuf_vertex>
  }`;
const termFrag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uNight, uTop, uBase; uniform vec3 uLight; uniform vec2 uAxis, uLand;
  varying vec3 vN; varying vec3 vP;
  // a hairline that fades out once it would alias (the terminal is a 100 px symbol in the hero, a full plate later)
  float hair(float c, float w){ float d = fwidth(c); float f = abs(fract(c) - 0.5); float line = 1.0 - smoothstep(0.5 - w - d, 0.5 - w + d, 0.5 - f); return line * (1.0 - smoothstep(0.12, 0.3, d)); }
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN);
    float l = clamp(dot(n, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    float roof = step(0.9, n.y);
    vec3 ink = mix(vec3(0.086, 0.231, 0.404), vec3(0.62, 0.74, 0.88), uNight);
    vec3 roofC = mix(vec3(0.985, 0.99, 1.0), vec3(0.16, 0.26, 0.41), uNight);
    roofC = mix(roofC, ink, hair(dot(vP.xz, uAxis) * 120.0, 0.05) * 0.16);
    vec3 wall = mix(vec3(0.93, 0.95, 0.98) * mix(0.64, 0.93, l), vec3(0.09, 0.17, 0.29) * mix(0.8, 1.15, l), uNight);
    float h = clamp((vP.y - uBase) / max(1e-4, uTop - uBase), 0.0, 1.0);
    float land = step(0.35, dot(n.xz, uLand));
    float glass = land > 0.5 ? step(0.07, h) * step(h, 0.86) : step(0.22, h) * step(h, 0.74);
    // daylight glass reads dark blue-grey; at night the halls glow cool white through it
    vec3 glassC = mix(vec3(0.42, 0.52, 0.64) * mix(0.82, 1.1, l), vec3(0.86, 0.9, 0.97), uNight);
    float u = dot(vP.xz, uAxis), v = dot(vP.xz, vec2(-uAxis.y, uAxis.x));
    float mull = max(hair(u * 300.0, 0.07), hair(v * 300.0, 0.07)) * (1.0 - roof);
    glassC = mix(glassC, mix(vec3(0.93, 0.95, 0.98), vec3(0.12, 0.2, 0.33), uNight), mull * 0.55);
    wall = mix(wall, glassC, glass * (1.0 - roof));
    gl_FragColor = vec4(mix(wall, roofC, roof), 1.0);
  }
`;

// Everything else: one light, day and night colours, instancing-aware (trees, cars)
const shadeVert = /* glsl */ `${LOGV}
  uniform vec3 uDay, uNightC; uniform float uNight;
  varying vec3 vN; varying vec3 vC;
  void main(){
    vec4 p = vec4(position, 1.0); vec3 n = normal;
    vec3 c = mix(uDay, uNightC, uNight);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      c = instanceColor * mix(vec3(1.0), uNightC, uNight);
    #endif
    vC = c; vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
    #include <logdepthbuf_vertex>
  }`;
const shadeFrag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uLight; uniform float uOpacity;
  varying vec3 vN; varying vec3 vC;
  void main(){
    #include <logdepthbuf_fragment>
    float l = clamp(dot(normalize(vN), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(vC * mix(0.6, 1.05, l), uOpacity);
  }`;

const LIGHT = new THREE.Vector3(-0.5, 0.8, -0.3);
const INK_D = new THREE.Color(0.086, 0.231, 0.404);
const INK_N = new THREE.Color(0.62, 0.74, 0.88);

export function createAirport(plan, detail, hubWorld) {
  const group = new THREE.Group();
  const tc = (plan.terminals.find((t) => t.id === 'T2') || plan.terminals[0]).g;
  const cLon = tc.reduce((a, p) => a + p[0], 0) / tc.length;
  const cLat = tc.reduce((a, p) => a + p[1], 0) / tc.length;
  const [hx, hz] = toXZ(cLon, cLat);
  const L = (p) => { const [x, z] = toXZ(p[0], p[1]); return [x - hx, z - hz]; };
  // local km offsets (x east, z south) for the few parts OSM does not map
  const K = (x, z) => [x, z];

  const mats = []; // { m, day, night } for shade materials, terminals handled via uniforms
  const inks = [];
  const flatMats = [];
  const shade = (day, night, { opacity = 1, instanced = false } = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: shadeVert, fragmentShader: shadeFrag,
      uniforms: { uDay: { value: new THREE.Color(...day) }, uNightC: { value: new THREE.Color(...night) }, uNight: { value: 0 }, uLight: { value: LIGHT }, uOpacity: { value: opacity } },
      transparent: opacity < 1,
    });
    m.userData.instanced = instanced;
    mats.push(m);
    return m;
  };
  const flatMat = (day, night, opacity, order) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...day), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    m.userData = { day: new THREE.Color(...day), night: new THREE.Color(...night), base: opacity, order };
    flatMats.push(m);
    return m;
  };
  const lineMat = (o) => {
    const m = new THREE.LineBasicMaterial({ color: INK_D.clone(), transparent: true, opacity: o, depthWrite: false });
    inks.push(m);
    return m;
  };

  const shapeOf = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const flatGeo = (rings, y) => {
    const gs = rings.filter((r) => r.length > 3).map((r) => { const g = new THREE.ShapeGeometry(shapeOf(r.map(L))); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute('uv'); return g; });
    return gs.length ? mergeGeometries(gs) : null;
  };
  const ribbonGeo = (lines, y) => {
    const pos = [];
    lines.forEach(({ w, g }) => {
      const pts = g.map(L);
      const hw = (w * KM) / 2;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / len) * hw;
        const nz = ((bx - ax) / len) * hw;
        // extend each quad by half a width so joints close
        const ex = ((bx - ax) / len) * hw;
        const ez = ((bz - az) / len) * hw;
        const p0 = [ax - ex + nx, az - ez + nz], p1 = [ax - ex - nx, az - ez - nz], p2 = [bx + ex - nx, bz + ez - nz], p3 = [bx + ex + nx, bz + ez + nz];
        pos.push(p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], p0[0], y, p0[1], p2[0], y, p2[1], p3[0], y, p3[1]);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  };

  /* ── ground (plate only): lawns, woods, roads, car parks, aprons, markings ── */
  const flat = new THREE.Group();
  group.add(flat);
  const addFlat = (geo, mat) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.renderOrder = mat.userData.order; flat.add(m); };
  const greens = detail?.green || [];
  addFlat(flatGeo(greens.filter((g) => g.k === 'grass').map((g) => g.g), 0.0004), flatMat([0.86, 0.91, 0.83], [0.07, 0.15, 0.19], 0.9, 1));
  addFlat(flatGeo(greens.filter((g) => g.k === 'wood').map((g) => g.g), 0.0005), flatMat([0.78, 0.87, 0.75], [0.06, 0.14, 0.17], 0.9, 1));
  addFlat(flatGeo(plan.aprons, 0.0006), flatMat([0.885, 0.9, 0.92], [0.11, 0.18, 0.28], 0.95, 2));
  addFlat(flatGeo(detail?.parking || [], 0.0007), flatMat([0.8, 0.82, 0.85], [0.13, 0.2, 0.3], 0.95, 2));
  if (detail?.roads?.length) addFlat(ribbonGeo(detail.roads, 0.0008), flatMat([0.76, 0.78, 0.82], [0.15, 0.22, 0.33], 0.95, 3));
  // runways: asphalt with a white centreline
  const rwLabels = [];
  const rwG = [];
  const rwC = [];
  plan.runways.forEach((rw) => {
    const pts = rw.g.map(L);
    const a = pts[0];
    const b = pts[pts.length - 1];
    rwG.push({ w: rw.w || 60, g: [rw.g[0], rw.g[rw.g.length - 1]] });
    rwC.push({ w: 1.2, g: [rw.g[0], rw.g[rw.g.length - 1]] });
    rwLabels.push({ ref: rw.ref, a: new THREE.Vector3(a[0], 0.05, a[1]), b: new THREE.Vector3(b[0], 0.05, b[1]) });
  });
  addFlat(ribbonGeo(rwG, 0.0009), flatMat([0.42, 0.45, 0.5], [0.05, 0.09, 0.16], 0.96, 3));
  addFlat(ribbonGeo(rwC, 0.001), flatMat([1, 1, 1], [0.6, 0.68, 0.8], 0.9, 4));
  // taxiway centrelines and stand lead-in lines in apron yellow
  const yellow = flatMat([0.9, 0.72, 0.18], [0.82, 0.68, 0.3], 0.95, 4);
  addFlat(ribbonGeo(plan.taxiways.map((g) => ({ w: 0.9, g })), 0.0011), yellow);
  addFlat(ribbonGeo((detail?.stands || []).map((g) => ({ w: 0.6, g })), 0.0011), yellow);

  /* ── terminals ── */
  const axis = new THREE.Vector2(Math.cos(-0.5585), Math.sin(-0.5585));
  const landN = new THREE.Vector2(-0.53, -0.848); // T2's curved hall faces the city to the north-north-west
  const tmats = [];
  const termMat = (top, base = 0) => {
    const m = new THREE.ShaderMaterial({ vertexShader: termVert, fragmentShader: termFrag, uniforms: { uNight: { value: 0 }, uTop: { value: top }, uBase: { value: base }, uAxis: { value: axis }, uLand: { value: landN }, uLight: { value: LIGHT } } });
    tmats.push(m);
    return m;
  };
  const edgeHot = lineMat(1);
  const edgeSoft = lineMat(0.32);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0b1f3a, transparent: true, opacity: 0.14, depthWrite: false });
  const extrude = (pts, depth, base, mat, edges = edgeHot) => {
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, base, 0);
    return [new THREE.Mesh(g, mat), new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), edges), g];
  };
  const terminals = {};
  const addTerminal = (id, ring, heightM) => {
    const pts = ring.map(L);
    const depth = mh(heightM);
    const [mesh, edges, g] = extrude(pts, depth, 0, termMat(depth));
    const sg = new THREE.ShapeGeometry(shapeOf(pts));
    sg.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(sg, shadowMat);
    shadow.position.set(depth * 0.9, 0.0015, depth * 0.65);
    shadow.renderOrder = 5;
    const parts = [shadow, mesh, edges];
    group.add(...parts);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    bb.parts = parts;
    bb.pts = pts;
    bb.depth = depth;
    terminals[id] = bb;
    return bb;
  };
  plan.terminals.forEach((t) => addTerminal(t.id, t.g, { T1: 13, T2: 22, T3: 14 }[t.id] || 14));
  const T2 = terminals.T2;

  // landside canopy: the roof runs out over the kerb along the curved hall, on slender columns
  const gates = new THREE.Group();
  // the gallery and the far pier (gates 1/2) run 300 m south-west: shown on the plate, left out of the hero symbol
  const farGates = new THREE.Group();
  group.add(gates, farGates);
  const white = shade([0.97, 0.98, 1.0], [0.16, 0.26, 0.41]);
  if (T2) {
    const P = T2.pts;
    const n = P.length - 1;
    const facing = (i) => {
      const [ax, az] = P[i];
      const [bx, bz] = P[(i + 1) % n];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      // outward normal for this ring's winding, checked against the centroid
      let nx = (bz - az) / len, nz = -(bx - ax) / len;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    };
    const land = [];
    for (let i = 0; i < n; i++) { const [nx, nz] = facing(i); land.push(nx * landN.x + nz * landN.y > 0.25); }
    // the longest run of landside-facing edges is the curved hall
    let best = [0, 0], cur = null;
    for (let k = 0; k < n * 2; k++) {
      const i = k % n;
      if (land[i]) { cur = cur || [k, k]; cur[1] = k; if (cur[1] - cur[0] > best[1] - best[0]) best = [...cur]; } else cur = null;
    }
    const chain = [];
    for (let k = best[0]; k <= best[1] + 1; k++) chain.push(P[k % n]);
    if (chain.length > 2) {
      const off = 0.013;
      const outer = chain.map((p, i) => {
        const a = chain[Math.max(0, i - 1)];
        const b = chain[Math.min(chain.length - 1, i + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
        if (nx * landN.x + nz * landN.y < 0) { nx = -nx; nz = -nz; }
        return [p[0] + nx * off, p[1] + nz * off];
      });
      const slab = [...chain, ...outer.slice().reverse()];
      const [cm, ce] = extrude(slab, mh(1.6), T2.depth * 0.78, white);
      gates.add(cm, ce);
      const col = new THREE.CylinderGeometry(0.0005, 0.0005, T2.depth * 0.78, 8);
      outer.forEach((p, i) => { if (i % 2) return; const c = new THREE.Mesh(col, white); c.position.set(p[0], T2.depth * 0.39, p[1]); gates.add(c); });
    }
  }

  // Gates 1–4: OSM maps the four jet bridges; the piers they spring from and the gallery back to the hall
  // are not mapped, so they are inferred from the bridge roots (gate 3/4 at the hall's south tip, gates 1/2 at a pier 240 m south-west)
  const box = (cx, cz, w, d, h, ang, mat, base = 0) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]].map(([x, z]) => [cx + x * ca - z * sa, cz + x * sa + z * ca]);
    return extrude(c, h, base, mat);
  };
  const pierAng = Math.atan2(0.185, -0.15); // along the gallery, south-west from the hall
  [[K(-0.004, 0.118), 0.034, 0.03, gates], [K(-0.184, 0.279), 0.036, 0.03, farGates]].forEach(([[x, z], w, d, grp]) => {
    const [m, e] = box(x, z, w, d, mh(14), pierAng, termMat(mh(14)));
    grp.add(m, e);
  });
  {
    const a = K(-0.03, 0.098), b = K(-0.17, 0.262);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [m, e] = box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.016, len, mh(10), Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2, termMat(mh(10)));
    farGates.add(m, e);
  }
  const bridgeMat = shade([0.9, 0.92, 0.95], [0.2, 0.3, 0.45]);
  const bridgeH = mh(5);
  const aircraft = makeAircraft(shade);
  const piers = [K(-0.004, 0.118), K(-0.184, 0.279), K(0, 0)];
  (detail?.jetBridges || []).forEach((b) => {
    let pts = b.map(L);
    // root = the end nearest a pier or the hall
    const dTo = (p) => Math.min(...piers.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
    if (dTo(pts[0]) > dTo(pts[pts.length - 1])) pts = pts.reverse();
    const grp = Math.hypot(pts[0][0] - piers[1][0], pts[0][1] - piers[1][1]) < 0.06 ? farGates : gates;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(0.0042, mh(3.2), len);
      const m = new THREE.Mesh(g, bridgeMat);
      m.position.set((ax + bx) / 2, bridgeH, (az + bz) / 2);
      m.rotation.y = Math.atan2(bx - ax, bz - az);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeHot);
      e.position.copy(m.position);
      e.rotation.copy(m.rotation);
      grp.add(m, e);
    }
    const E = pts[pts.length - 1];
    const Pv = pts[pts.length - 2];
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, bridgeH, 8), bridgeMat);
    leg.position.set(E[0], bridgeH / 2, E[1]);
    grp.add(leg);
    // nose-in: the aircraft stands off the bridge head, its door at the cab
    const ax = (E[0] - Pv[0]), az = (E[1] - Pv[1]);
    const al = Math.hypot(ax, az) || 1;
    const dir = [ax / al, az / al];
    const plane = aircraft.clone();
    plane.position.set(E[0] + dir[0] * 0.003 + dir[1] * 0.0028, 0, E[1] + dir[1] * 0.003 - dir[0] * 0.0028);
    plane.rotation.y = Math.atan2(dir[0], dir[1]);
    grp.add(plane);
  });

  // Air-traffic control tower (Uzaeronavigation): fluted shaft, finned crown, glazed cab, mast
  if (detail?.tower) {
    const [tx, tz] = L(detail.tower);
    const tw = new THREE.Group();
    const glass = shade([0.3, 0.38, 0.5], [0.9, 0.94, 1.0]);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0042, mh(40), 18), white);
    shaft.position.y = mh(20);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0036, mh(6), 18), white);
    crown.position.y = mh(43);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0058, mh(5), 18), glass);
    cab.position.y = mh(48.5);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.006, mh(2), 18), white);
    cap.position.y = mh(52);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.00035, mh(9), 6), white);
    mast.position.y = mh(57.5);
    tw.add(shaft, crown, cab, cap, mast);
    const fin = new THREE.BoxGeometry(0.0007, mh(16), 0.0026);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const f = new THREE.Mesh(fin, white);
      f.position.set(Math.cos(a) * 0.0042, mh(36), Math.sin(a) * 0.0042);
      f.rotation.y = -a;
      tw.add(f);
    }
    tw.position.set(tx, 0, tz);
    gates.add(tw);
  }

  /* ── surroundings (plate only): every mapped building, trees, parked cars ── */
  const context = new THREE.Group();
  group.add(context);
  if (detail?.buildings?.length) {
    const geos = [];
    detail.buildings.forEach((b) => {
      const g = new THREE.ExtrudeGeometry(shapeOf(b.g.map(L)), { depth: mh(Math.min(b.h, 60)), bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.deleteAttribute('uv');
      geos.push(g.index ? g.toNonIndexed() : g);
    });
    const merged = mergeGeometries(geos);
    context.add(new THREE.Mesh(merged, shade([0.95, 0.96, 0.975], [0.12, 0.2, 0.32])), new THREE.LineSegments(new THREE.EdgesGeometry(merged, 30), edgeSoft));
  }
  const rnd = mulberry(7);
  const inside = (pt, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const scatter = (rings, step, keep, cap) => {
    const out = [];
    rings.forEach((r) => {
      const pts = r.map(L);
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      for (let x = Math.min(...xs); x < Math.max(...xs); x += step) {
        for (let z = Math.min(...zs); z < Math.max(...zs); z += step) {
          const p = [x + (rnd() - 0.5) * step * 0.8, z + (rnd() - 0.5) * step * 0.8];
          if (rnd() < keep && inside(p, pts) && out.length < cap) out.push(p);
        }
      }
    });
    return out;
  };
  // trees: mapped ones, then woods dense and lawns sparse
  const treePts = [...(detail?.trees || []).map(L), ...scatter(greens.filter((g) => g.k === 'wood').map((g) => g.g), 0.008, 0.85, 700), ...scatter(greens.filter((g) => g.k === 'grass').map((g) => g.g), 0.014, 0.4, 400)];
  if (treePts.length) {
    const tg = new THREE.IcosahedronGeometry(1, 0);
    const trees = new THREE.InstancedMesh(tg, shade([1, 1, 1], [0.3, 0.42, 0.5], { instanced: true }), treePts.length);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    treePts.forEach(([x, z], i) => {
      const r = 0.0028 + rnd() * 0.0022;
      m4.compose(new THREE.Vector3(x, r * 1.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(r, r * 1.6, r));
      trees.setMatrixAt(i, m4);
      c.setRGB(0.5 + rnd() * 0.08, 0.64 + rnd() * 0.08, 0.46 + rnd() * 0.06);
      trees.setColorAt(i, c);
    });
    context.add(trees);
  }
  // parked cars: rows across each car park, about two in three bays taken
  const carPts = [];
  (detail?.parking || []).forEach((r) => {
    const pts = r.map(L);
    // align rows with the car park's longest side
    let best = 0, ang = 0;
    for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (d > best) { best = d; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); } }
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const us = pts.map(([x, z]) => x * ca + z * sa), vs = pts.map(([x, z]) => -x * sa + z * ca);
    for (let u = Math.min(...us) + 0.002; u < Math.max(...us); u += 0.0027) {
      for (let v = Math.min(...vs) + 0.003; v < Math.max(...vs); v += 0.0065) {
        const p = [u * ca - v * sa, u * sa + v * ca];
        if (rnd() < 0.66 && inside(p, pts) && carPts.length < 1400) carPts.push([...p, ang]);
      }
    }
  });
  if (carPts.length) {
    const cg = new THREE.BoxGeometry(0.0018, mh(1.5) * 0.4, 0.0044);
    cg.translate(0, mh(1.5) * 0.2, 0);
    const cars = new THREE.InstancedMesh(cg, shade([1, 1, 1], [0.35, 0.42, 0.55], { instanced: true }), carPts.length);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    const pal = [[0.97, 0.97, 0.97], [0.97, 0.97, 0.97], [0.97, 0.97, 0.97], [0.78, 0.8, 0.83], [0.78, 0.8, 0.83], [0.2, 0.22, 0.25], [0.2, 0.22, 0.25], [0.5, 0.53, 0.57], [0.2, 0.28, 0.45], [0.7, 0.15, 0.15]];
    carPts.forEach(([x, z, a], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1));
      cars.setMatrixAt(i, m4);
      cars.setColorAt(i, c.setRGB(...pal[Math.floor(rnd() * pal.length)]));
    });
    context.add(cars);
  }

  group.position.set(hx, hubWorld.y, hz);

  // where a zone sits on the plan: a local point, resolved to world space every frame
  const zoneLocal = (terminal, spot, outdoor) => {
    const bb = terminals.T2;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    if (terminal === 'T3' && terminals.T3) {
      // T3 sits 1.4 km south: its marker waits at the diagram's edge, on the bearing to it
      const t3 = terminals.T3;
      const dx = (t3.min.x + t3.max.x) / 2 - cx;
      const dz = (t3.min.z + t3.max.z) / 2 - cz;
      const k = ((bb.max.x - bb.min.x) * 0.8) / Math.hypot(dx, dz);
      return new THREE.Vector3(cx + dx * k, 0.01, cz + dz * k);
    }
    if (outdoor) return new THREE.Vector3(cx + landN.x * 0.085, 0.01, cz + landN.y * 0.085);
    const x = cx + (spot[0] - 0.5) * (bb.max.x - bb.min.x) * 0.92;
    const z = cz + (spot[1] - 0.5) * (bb.max.z - bb.min.z) * 0.92;
    return new THREE.Vector3(x, bb.max.y * 1.02, z);
  };

  const setNight = (n) => {
    mats.forEach((m) => (m.uniforms.uNight.value = n));
    tmats.forEach((m) => (m.uniforms.uNight.value = n));
    const ink = INK_D.clone().lerp(INK_N, n);
    inks.forEach((m) => m.color.copy(ink));
    flatMats.forEach((m) => m.color.copy(m.userData.day).lerp(m.userData.night, n));
  };
  const setHot = () => {};
  // hero: the terminal group as the route's origin symbol; plate: the full model; T3 waits off-diagram
  let mode = { hero: 0, plate: 0 };
  // solo: the terminal stands on its own over the map (Fly TV, Media Gate chapters): no airfield, no far terminal
  const setSymbol = (k, plate = 0, solo = 0) => {
    mode = { hero: k, plate, solo };
    flat.visible = k < 0.5 && plate < 0.15 && solo < 0.3;
    context.visible = false;
    // on the plate, everything beyond the hall is drawn only inside the field (the plate pass), never across the map
    gates.visible = plate < 0.32;
    farGates.visible = k < 0.5 && plate < 0.32;
    terminals.T1?.parts.forEach((m) => (m.visible = k < 0.5 && plate < 0.32));
    terminals.T3?.parts.forEach((m) => (m.visible = k < 0.5 && plate < 0.5 && solo < 0.3));
  };
  // the plate pass draws the ground and surroundings too, faded with the field
  const plateOn = (fo) => {
    flat.visible = mode.hero < 0.5;
    context.visible = mode.hero < 0.5;
    gates.visible = true;
    farGates.visible = mode.hero < 0.5;
    terminals.T1?.parts.forEach((m) => (m.visible = mode.hero < 0.5));
    flatMats.forEach((m) => (m.opacity = m.userData.base * fo));
  };
  const plateOff = () => {
    flatMats.forEach((m) => (m.opacity = m.userData.base));
    setSymbol(mode.hero, mode.plate, mode.solo);
  };

  return { group, zoneLocal, rwLabels, setNight, setHot, setSymbol, plateOn, plateOff, terminals };
}

// An A320-class airliner in km, nose at the origin, fuselage running down +z
function makeAircraft(shade) {
  const body = shade([0.97, 0.98, 1.0], [0.36, 0.45, 0.6]);
  const tail = shade([0.086, 0.231, 0.404], [0.5, 0.62, 0.8]);
  const eng = shade([0.74, 0.77, 0.81], [0.25, 0.32, 0.44]);
  const g = new THREE.Group();
  const r = 0.00198;
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.027, 14).rotateX(Math.PI / 2).translate(0, 0, 0.0175), body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 2).translate(0, 0, 0.004), body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.0062, 14).rotateX(Math.PI / 2).translate(0, 0.0004, 0.0341), body);
  const flatShape = (pts, depth) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  };
  // wings and tailplane drawn in plan (x span, y = chord along the body) then laid flat
  const wingPts = [[0.0018, 0.0135], [0.0172, 0.0215], [0.0172, 0.0232], [0.0018, 0.0212]];
  const wing = (pts, y, d) => {
    const both = [...pts, ...pts.slice().reverse().map(([x, z]) => [-x, z])];
    const geo = flatShape(both, d);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y + d, 0);
    return geo;
  };
  const wings = new THREE.Mesh(wing(wingPts, -0.0011, 0.0003), body);
  const stab = new THREE.Mesh(wing([[0.0008, 0.0318], [0.0063, 0.0352], [0.0063, 0.0362], [0.0008, 0.0352]], 0.0004, 0.00022), body);
  const finGeo = flatShape([[0.0303, 0], [0.0352, 0.0058], [0.0371, 0.0058], [0.0372, 0]], 0.0003);
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.00015, r * 0.85, 0);
  const fin = new THREE.Mesh(finGeo, tail);
  const engGeo = new THREE.CylinderGeometry(0.00085, 0.00075, 0.0042, 12).rotateX(Math.PI / 2);
  const e1 = new THREE.Mesh(engGeo, eng);
  e1.position.set(0.0057, -0.0016, 0.0148);
  const e2 = e1.clone();
  e2.position.x = -0.0057;
  g.add(fus, nose, cone, wings, stab, fin, e1, e2);
  g.position.y = 0;
  g.scale.set(1, 1.8, 1);
  // lift the fuselage onto its gear
  g.children.forEach((c) => (c.position.y += r + 0.0012));
  return g;
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
