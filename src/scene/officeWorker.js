import { Shape, Path, Vector2, Vector3, Quaternion, Euler, Matrix4, ShapeGeometry, ExtrudeGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { KX } from './geo.js';

/* The head office's neighbourhood, built off the main thread (see office.js): ground layers, the buildings with
   their colour attributes, lane marks, and the cars' and trees' instance matrices, all as transferable arrays in
   local km around the office point. */

const HEX = 1.25;
const KM = 1 / 1000;
const mh = (m) => m * KM * HEX;
const KXR = KX / (111.32 * Math.cos((41.312 * Math.PI) / 180));
const ROOF = {
  gen: [[0.86, 0.84, 0.8], [0.76, 0.75, 0.72], [0.66, 0.66, 0.67], [0.7, 0.5, 0.42], [0.58, 0.63, 0.68], [0.9, 0.89, 0.86], [0.8, 0.76, 0.68]],
  tower: [[0.74, 0.77, 0.8], [0.66, 0.69, 0.73]],
  nest: [[0.82, 0.85, 0.88]],
  office: [[0.07, 0.09, 0.31]],
};
const WALL = { gen: [0.88, 0.86, 0.82], tower: [0.5, 0.6, 0.72], nest: [0.72, 0.8, 0.88], office: [0.2, 0.26, 0.62] };
const KIND = { gen: 0, tower: 4, nest: 4, office: 4 };
const CARS = [[0.97, 0.97, 0.97], [0.97, 0.97, 0.97], [0.97, 0.97, 0.97], [0.78, 0.8, 0.83], [0.2, 0.22, 0.25], [0.2, 0.22, 0.25], [0.5, 0.53, 0.57], [0.2, 0.28, 0.45], [0.7, 0.15, 0.15]];
const Y = (i) => 0.0002 + i * 0.00006;

const L = ([x, z]) => [x * KM * KXR, z * KM];
const shapeOf = (pts, holes = []) => {
  const s = new Shape(pts.map(([x, z]) => new Vector2(x, -z)));
  holes.forEach((h) => s.holes.push(new Path(h.map(([x, z]) => new Vector2(x, -z)))));
  return s;
};
const flat = (rings, y) => {
  const gs = rings.filter((r) => r.length > 2).map((r) => {
    const outer = Array.isArray(r[0][0]) ? r[0] : r;
    const holes = Array.isArray(r[0][0]) ? r.slice(1) : [];
    const g = new ShapeGeometry(shapeOf(outer.map(L), holes.map((h) => h.map(L))));
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    return g.index ? g.toNonIndexed() : g;
  });
  return gs.length ? mergeGeometries(gs).attributes.position.array : new Float32Array(0);
};
const ribbon = (lines, y) => {
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
  return new Float32Array(pos);
};

self.onmessage = async (e) => {
  try {
    const d = await (await fetch(e.data.url)).json();
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ground = {
      grass: flat(d.grass, Y(1)), wood: flat(d.wood, Y(2)), pitch: flat(d.pitches, Y(3)), park: flat(d.parking, Y(3)),
      water: flat(d.water, Y(4)), canal: ribbon(d.canals, Y(4)), road: ribbon(d.roads, Y(5)), shadow: flat(d.shadows.map((s) => [s.o, ...s.h]), Y(7)),
    };

    // buildings: one geometry, colour and kind per building in attributes
    const geos = d.bld.map((b) => {
      const base = mh(b.b || 0);
      const top = Math.max(base + mh(2), mh(b.h));
      const g = new ExtrudeGeometry(shapeOf(b.g.map(L)), { depth: top - base, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, base, 0);
      g.deleteAttribute('uv');
      const ng = g.index ? g.toNonIndexed() : g;
      const n = ng.attributes.position.count;
      const pal = ROOF[b.c] || ROOF.gen;
      const roof = pal[Math.floor(rnd() * pal.length)];
      const wall = WALL[b.c] || WALL.gen;
      const pts = b.g.map(L);
      const cc = [pts.reduce((s0, p) => s0 + p[0], 0) / pts.length, pts.reduce((s0, p) => s0 + p[1], 0) / pts.length];
      const a = new Float32Array(n * 3), w = new Float32Array(n * 3), info = new Float32Array(n * 3), ca = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { a.set(roof, i * 3); w.set(wall, i * 3); info.set([KIND[b.c] ?? 0, base, top], i * 3); ca.set(cc, i * 2); }
      return { ng, a, w, info, ca };
    });
    // position and normal merge in order, so the per-building arrays line up when concatenated the same way
    const merged = mergeGeometries(geos.map((x) => x.ng));
    const cat = (key, size) => { const out = new Float32Array(merged.attributes.position.count * size); let o = 0; geos.forEach((x) => { out.set(x[key], o); o += x[key].length; }); return out; };
    const bld = { pos: merged.attributes.position.array, nor: merged.attributes.normal.array, roof: cat('a', 3), wall: cat('w', 3), info: cat('info', 3), c: cat('ca', 2) };

    // street life: dashed centre lines on the main roads, cars in both lanes
    const marks = [];
    d.roads.filter((r) => r.w >= 11).forEach(({ g }) => {
      const pts = g.map(L);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) continue;
        const ux = (bx - ax) / len, uz = (bz - az) / len, hw = 0.00035, nx = -uz * hw, nz = ux * hw;
        for (let t0 = 0.002; t0 < len - 0.004; t0 += 0.009) {
          const t1 = t0 + 0.004;
          const p0 = [ax + ux * t0, az + uz * t0], p1 = [ax + ux * t1, az + uz * t1];
          const y = Y(6);
          marks.push(p0[0] + nx, y, p0[1] + nz, p0[0] - nx, y, p0[1] - nz, p1[0] - nx, y, p1[1] - nz, p0[0] + nx, y, p0[1] + nz, p1[0] - nx, y, p1[1] - nz, p1[0] + nx, y, p1[1] + nz);
        }
      }
    });
    const m4 = new Matrix4();
    const q = new Quaternion();
    const eu = new Euler();
    const v = new Vector3();
    const sc = new Vector3(1, 1, 1);
    const carList = [];
    d.roads.filter((r) => r.w >= 8).forEach(({ w, g }) => {
      const pts = g.map(L);
      const lane = (w * KM) / 4;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) continue;
        const ux = (bx - ax) / len, uz = (bz - az) / len;
        for (const side of [-1, 1]) {
          for (let t0 = rnd() * 0.02; t0 < len; t0 += 0.012 + rnd() * 0.03) {
            if (carList.length > 1800) break;
            carList.push([ax + ux * t0 - uz * lane * side, az + uz * t0 + ux * lane * side, Math.atan2(ux, uz) + (side > 0 ? Math.PI : 0)]);
          }
        }
      }
    });
    const cars = { mat: new Float32Array(carList.length * 16), col: new Float32Array(carList.length * 3) };
    carList.forEach(([x, z, a], i) => {
      m4.compose(v.set(x, Y(6), z), q.setFromEuler(eu.set(0, a, 0)), sc.set(1, 1, 1));
      m4.toArray(cars.mat, i * 16);
      cars.col.set(CARS[Math.floor(rnd() * CARS.length)], i * 3);
    });
    const tp = d.trees.map(L);
    const trees = { mat: new Float32Array(tp.length * 16), col: new Float32Array(tp.length * 3) };
    tp.forEach(([x, z], i) => {
      const r = 0.0022 + rnd() * 0.0022;
      m4.compose(v.set(x, r * 1.3, z), q.setFromEuler(eu.set(0, rnd() * 6, 0)), sc.set(r, r * 1.4, r));
      m4.toArray(trees.mat, i * 16);
      trees.col.set([0.26 + rnd() * 0.08, 0.4 + rnd() * 0.1, 0.2 + rnd() * 0.06], i * 3);
    });

    const [ox, oz] = L(d.office);
    const out = { o: d.o, office: [ox, oz, mh(d.office[2])], ground, marks: new Float32Array(marks), bld, cars, trees };
    const transfer = [...Object.values(ground).map((a) => a.buffer), out.marks.buffer, ...Object.values(bld).map((a) => a.buffer), cars.mat.buffer, cars.col.buffer, trees.mat.buffer, trees.col.buffer];
    self.postMessage(out, [...new Set(transfer)]);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};
