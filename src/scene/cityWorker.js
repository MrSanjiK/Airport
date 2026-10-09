import { ShapeUtils, Vector2 } from 'three';
import { toXZ } from './geo.js';

/* City model geometry, built off the main thread: Tashkent alone is thousands of buildings to triangulate, and
   doing that in a frame froze the page for a second. The worker fetches the model, triangulates roofs, walls,
   parks and water, lays out the streets, and hands back typed arrays relative to the plate's own level (y0 = 0);
   the main thread only wraps them in geometries. */

const HEX = 5;
const v2 = (ring) => ring.map(([x, z]) => new Vector2(x, z));

self.onmessage = async (e) => {
  const { key, url } = e.data;
  try {
    const d = await (await fetch(url)).json();
    const [c0, c1] = d.c;
    const P = (dx, dy) => toXZ(c0 + dx / 1e5, c1 + dy / 1e5);
    const venueB = new Set(d.venues.map((v) => v.b).filter((b) => b >= 0));

    // buildings: roofs and walls in one geometry, roof outlines in another
    const pos = [], nor = [], ven = [], edges = [];
    d.bld.forEach((b, i) => {
      const h = (b[0] / 1000) * HEX;
      let ring = [];
      for (let j = 1; j < b.length; j += 2) ring.push(P(b[j], b[j + 1]));
      if (ring.length < 3) return;
      if (ShapeUtils.isClockWise(v2(ring))) ring = ring.reverse();
      const v = venueB.has(i) ? 1 : 0;
      const top = h * (v ? 1.35 : 1);
      // per building: a seed for its roof colour and window pattern, and its height for the storeys
      const seed = ((i * 2654435761) % 1000) / 1000;
      ShapeUtils.triangulateShape(v2(ring), []).forEach((t) => t.slice().reverse().forEach((k) => { pos.push(ring[k][0], top, ring[k][1]); nor.push(0, 1, 0); ven.push(v, seed, top); }));
      for (let k = 0; k < ring.length; k++) {
        const [ax, az] = ring[k];
        const [bx, bz] = ring[(k + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (bz - az) / len;
        const nz = -(bx - ax) / len;
        pos.push(ax, 0, az, bx, 0, bz, bx, top, bz, ax, 0, az, bx, top, bz, ax, top, az);
        for (let q = 0; q < 6; q++) { nor.push(nx, 0, nz); ven.push(v, seed, top); }
        edges.push(ax, top, az, bx, top, bz);
      }
    });

    // parks and water: every polygon into one face-up triangle list per kind
    const fill = (rings, y) => {
      const out = [];
      rings.forEach((r) => {
        let ring = [];
        for (let j = 0; j < r.length; j += 2) { const [x, z] = P(r[j], r[j + 1]); ring.push([x, -z]); }
        if (ring.length < 4) return;
        if (ShapeUtils.isClockWise(v2(ring))) ring = ring.reverse();
        ShapeUtils.triangulateShape(v2(ring), []).forEach((t) => t.forEach((k) => out.push(ring[k][0], y, -ring[k][1])));
      });
      return new Float32Array(out);
    };
    const green = fill(d.green, 0.0008);
    const water = fill(d.water, 0.001);

    // streets by class, and canals
    const roads = [[], [], [], []];
    d.roads.forEach((r) => {
      const out = roads[r[0]];
      for (let j = 1; j < r.length - 2; j += 2) {
        const [ax, az] = P(r[j], r[j + 1]);
        const [bx, bz] = P(r[j + 2], r[j + 3]);
        out.push(ax, 0.003, az, bx, 0.003, bz);
      }
    });
    const canals = [];
    d.canals.forEach((r) => {
      for (let j = 0; j < r.length - 2; j += 2) {
        const [ax, az] = P(r[j], r[j + 1]);
        const [bx, bz] = P(r[j + 2], r[j + 3]);
        canals.push(ax, 0.002, az, bx, 0.002, bz);
      }
    });

    // venues: an anchor on top of their building (or the street), for the DOM labels
    const venues = d.venues.map((v, i) => {
      const lon = c0 + v.p[0] / 1e5;
      const lat = c1 + v.p[1] / 1e5;
      const [x, z] = toXZ(lon, lat);
      const b = v.b >= 0 ? d.bld[v.b] : null;
      return { ...v, i, ll: [lon, lat], w: [x, (b ? (b[0] / 1000) * HEX * 1.35 : 0) + 0.004, z] };
    });

    const out = {
      key, c: d.c, r: d.r, venues,
      pos: new Float32Array(pos), nor: new Float32Array(nor), ven: new Float32Array(ven), edges: new Float32Array(edges),
      green, water, roads: roads.map((a) => new Float32Array(a)), canals: new Float32Array(canals),
    };
    self.postMessage(out, [out.pos.buffer, out.nor.buffer, out.ven.buffer, out.edges.buffer, green.buffer, water.buffer, out.canals.buffer, ...out.roads.map((a) => a.buffer)]);
  } catch (err) {
    self.postMessage({ key, error: String(err) });
  }
};
