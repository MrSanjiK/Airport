import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { toXZ, EXAG } from './geo.js';

// Borders and rivers as screen-space lines draped over the relief: crisp at every zoom.
export function createDrapedLines(vec, sample) {
  const group = new THREE.Group();
  const build = (rings, stepKm, lift) => {
    const out = [];
    rings.forEach((ring) => {
      let prev = null;
      ring.forEach((p) => {
        const [x, z] = toXZ(p[0], p[1]);
        if (prev) {
          const d = Math.hypot(x - prev[0], z - prev[1]);
          const n = Math.max(1, Math.ceil(d / stepKm));
          for (let i = 0; i < n; i++) {
            const a = i / n;
            const b = (i + 1) / n;
            const ax = prev[0] + (x - prev[0]) * a, az = prev[1] + (z - prev[1]) * a;
            const bx = prev[0] + (x - prev[0]) * b, bz = prev[1] + (z - prev[1]) * b;
            const al = prev[2] + (p[0] - prev[2]) * a, at = prev[3] + (p[1] - prev[3]) * a;
            const bl = prev[2] + (p[0] - prev[2]) * b, bt = prev[3] + (p[1] - prev[3]) * b;
            out.push(ax, (Math.max(0, sample(al, at)) / 1000) * EXAG + lift, az, bx, (Math.max(0, sample(bl, bt)) / 1000) * EXAG + lift, bz);
          }
        }
        prev = [x, z, p[0], p[1]];
      });
    });
    const g = new LineSegmentsGeometry();
    g.setPositions(out);
    return g;
  };
  const mk = (geo, width, dashed) => {
    const m = new LineMaterial({ color: 0x163b67, linewidth: width, transparent: true, depthWrite: false, dashed: !!dashed, dashSize: 3, gapSize: 2.2, worldUnits: false });
    const l = new LineSegments2(geo, m);
    if (dashed) l.computeLineDistances();
    l.renderOrder = 2;
    group.add(l);
    return m;
  };
  const rivers = mk(build(vec.rivers, 3, 0.14), 1.1);
  const neighbors = mk(build(vec.neighbors, 4, 0.18), 1.0, true);
  const uz = mk(build(vec.uz, 2.5, 0.22), 2.1);

  const res = new THREE.Vector2();
  const DAY = { ink: new THREE.Color(0.086, 0.231, 0.404), river: new THREE.Color(0.30, 0.50, 0.72) };
  const NIGHT = { ink: new THREE.Color(0.62, 0.74, 0.88), river: new THREE.Color(0.35, 0.62, 0.95) };
  const tmp = new THREE.Color();
  return {
    group,
    opacity: 1,
    update(night, renderer) {
      renderer.getDrawingBufferSize(res);
      [rivers, neighbors, uz].forEach((m) => m.resolution.copy(res));
      // widths are in device pixels; keep them visually constant across DPR
      const dpr = renderer.getPixelRatio();
      uz.linewidth = 2.1 * dpr;
      neighbors.linewidth = 1.0 * dpr;
      rivers.linewidth = 1.15 * dpr;
      uz.color.copy(tmp.copy(DAY.ink).lerp(NIGHT.ink, night));
      neighbors.color.copy(uz.color);
      const o = this.opacity;
      uz.opacity = o;
      neighbors.opacity = 0.5 * o;
      group.visible = o > 0.001;
      rivers.color.copy(tmp.copy(DAY.river).lerp(NIGHT.river, night));
      rivers.opacity = 0.85 * o;
    },
  };
}

// The Media Port route: red ink draped on the relief, with a paper casing so it reads over any terrain.
export function createRoute(chains, sample) {
  const group = new THREE.Group();
  const parts = [];
  // a screen-space hole the route fades out in (the hero legend), feathered so it ends rather than clips
  const uMask = { value: new THREE.Vector4(-1, -1, -1, -1) };
  const uMaskK = { value: 0 };
  const masked = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = uMask;
      sh.uniforms.uMaskK = uMaskK;
      sh.fragmentShader = 'uniform vec4 uMask; uniform float uMaskK;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `{
        vec2 q = gl_FragCoord.xy; float f = 36.0;
        float ix = smoothstep(uMask.x - f, uMask.x, q.x) * (1.0 - smoothstep(uMask.z, uMask.z + f, q.x));
        float iy = smoothstep(uMask.y - f, uMask.y, q.y) * (1.0 - smoothstep(uMask.w, uMask.w + f, q.y));
        gl_FragColor.a *= 1.0 - uMaskK * ix * iy;
      }
      #include <tonemapping_fragment>`);
    };
    return m;
  };
  chains.forEach(({ key, pts, delay = 0 }) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const [ax, az] = toXZ(a[0], a[1]);
      const [bx, bz] = toXZ(b[0], b[1]);
      const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2));
      for (let j = 0; j < n; j++) {
        const s = j / n, e = (j + 1) / n;
        const l0 = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
        const l1 = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
        const y0 = (Math.max(0, sample(l0[0], l0[1])) / 1000) * EXAG + 0.35;
        const y1 = (Math.max(0, sample(l1[0], l1[1])) / 1000) * EXAG + 0.35;
        out.push(ax + (bx - ax) * s, y0, az + (bz - az) * s, ax + (bx - ax) * e, y1, az + (bz - az) * e);
      }
    }
    const geo = new LineSegmentsGeometry();
    geo.setPositions(out);
    let len = 0;
    for (let i = 0; i < out.length; i += 6) len += Math.hypot(out[i + 3] - out[i], out[i + 4] - out[i + 1], out[i + 5] - out[i + 2]);
    const mk = (color, width, order) => {
      const m = masked(new LineMaterial({ color, linewidth: width, transparent: true, depthWrite: false, dashed: true, dashSize: 0, gapSize: 1e7, worldUnits: false }));
      const l = new LineSegments2(geo, m);
      l.computeLineDistances();
      l.renderOrder = order;
      group.add(l);
      return m;
    };
    const casing = mk(0xedf2f6, 11, 6);
    const ink = mk(0xe3000f, 5.5, 7);
    parts.push({ key, len, delay, casing, ink });
  });
  const res = new THREE.Vector2();
  const api = {
    group,
    progress: 0,
    opacity: 1,
    focus: null,
    mask: null,
    maskK: 0,
    update(night, renderer) {
      renderer.getDrawingBufferSize(res);
      const dpr = renderer.getPixelRatio();
      uMaskK.value = api.mask ? api.maskK : 0;
      if (api.mask) {
        const [x0, y0, x1, y1] = api.mask;
        uMask.value.set(x0 * dpr, res.y - y1 * dpr, x1 * dpr, res.y - y0 * dpr);
      }
      parts.forEach((p) => {
        const k = Math.min(1, Math.max(0, (api.progress - p.delay) / (1 - p.delay)));
        const shown = k * p.len + (k >= 1 ? 1e6 : 0);
        const dim = api.focus && !api.focus.includes(p.key) ? 0.28 : 1;
        [p.casing, p.ink].forEach((m) => { m.resolution.copy(res); m.dashSize = shown; });
        p.casing.linewidth = 11 * dpr;
        p.ink.linewidth = 5.5 * dpr;
        p.casing.color.setRGB(0.929 + (0.039 - 0.929) * night, 0.949 + (0.09 - 0.949) * night, 0.965 + (0.161 - 0.965) * night);
        p.ink.color.setRGB(0.89 + 0.11 * night, 0.0 + 0.17 * night, 0.059 + 0.17 * night);
        p.ink.opacity = api.opacity * dim;
        p.casing.opacity = api.opacity * dim * 0.9;
      });
      group.visible = api.opacity > 0.001;
    },
  };
  return api;
}

// Roads from OpenStreetMap: national trunk roads always, Tashkent's street grid once the camera is close.
export function createRoads(roads, sample) {
  const group = new THREE.Group();
  const drape = (rings, stepKm, lift) => {
    const out = [];
    rings.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const [ax, az] = toXZ(a[0], a[1]);
        const [bx, bz] = toXZ(b[0], b[1]);
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / stepKm));
        for (let j = 0; j < n; j++) {
          const s = j / n, e = (j + 1) / n;
          const la = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
          const lb = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
          out.push(ax + (bx - ax) * s, (Math.max(0, sample(la[0], la[1])) / 1000) * EXAG + lift, az + (bz - az) * s,
            ax + (bx - ax) * e, (Math.max(0, sample(lb[0], lb[1])) / 1000) * EXAG + lift, az + (bz - az) * e);
        }
      }
    });
    const g = new LineSegmentsGeometry();
    g.setPositions(out);
    return g;
  };
  const mk = (geo) => {
    const m = new LineMaterial({ color: 0x163b67, linewidth: 1, transparent: true, depthWrite: false, worldUnits: false });
    const l = new LineSegments2(geo, m);
    l.renderOrder = 1;
    group.add(l);
    return m;
  };
  const trunk = mk(drape(roads.trunk, 3, 0.1));
  const major = mk(drape(roads.cityMajor, 0.6, 0.06));
  const minor = mk(drape(roads.cityMinor, 0.6, 0.05));
  const res = new THREE.Vector2();
  return {
    group,
    opacity: 1,
    city: 1,
    update(night, renderer, dist) {
      renderer.getDrawingBufferSize(res);
      const dpr = renderer.getPixelRatio();
      const near = (1 - Math.min(1, Math.max(0, (dist - 40) / 160))) * this.city;
      const ink = [0.086 + (0.62 - 0.086) * night, 0.231 + (0.74 - 0.231) * night, 0.404 + (0.88 - 0.404) * night];
      [[trunk, 1.1, 0.22 + 0.25 * near], [major, 1.5, 0.5 * near], [minor, 0.9, 0.3 * near]].forEach(([m, w, o]) => {
        m.resolution.copy(res);
        m.linewidth = w * dpr;
        m.color.setRGB(ink[0], ink[1], ink[2]);
        m.opacity = o * this.opacity;
      });
      major.visible = minor.visible = near > 0.01;
      group.visible = this.opacity > 0.001;
    },
  };
}
