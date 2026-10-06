import * as THREE from 'three';
import { W, D, EXAG, BBOX } from './geo.js';

// Loads the packed DEM (scripts/data/pack_dem.py: 1 m steps, row deltas, split byte planes, zlib) and returns
// a CPU sampler plus a GPU half-float texture. Heights are stored as h + 200.
export async function loadHeights(size, onProgress, request) {
  const meta = size === 2048 ? { w: 2048, h: 1357 } : { w: 1024, h: 678 };
  const res = await (request || fetch(`/data/dem-${size}.z`));
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress?.(Math.min(1, got / total));
  }
  onProgress?.(1);
  const planes = new Uint8Array(await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const n = meta.w * meta.h;
  const f32 = new Float32Array(n);
  const half = new Uint16Array(n);
  let prevRow = 0;
  // decoded in slices with a breath between them, so the loader keeps drawing while the relief unpacks
  const breathe = () => new Promise((r) => setTimeout(r, 0));
  for (let y = 0; y < meta.h; y++) {
    if (y % 96 === 95) await breathe();
    let v = 0;
    for (let x = 0; x < meta.w; x++) {
      const i = y * meta.w + x;
      const d = planes[i] | (planes[n + i] << 8);
      v = x ? (v + d) & 0xffff : (prevRow + d) & 0xffff;
      if (!x) prevRow = v;
      const h = v - 200;
      f32[i] = h;
      half[i] = THREE.DataUtils.toHalfFloat(h);
    }
  }
  const tex = new THREE.DataTexture(half, meta.w, meta.h, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const sample = (lon, lat) => {
    const u = ((lon - BBOX.lon0) / (BBOX.lon1 - BBOX.lon0)) * (meta.w - 1);
    const v = ((BBOX.lat1 - lat) / (BBOX.lat1 - BBOX.lat0)) * (meta.h - 1);
    const x0 = Math.max(0, Math.min(meta.w - 2, Math.floor(u)));
    const y0 = Math.max(0, Math.min(meta.h - 2, Math.floor(v)));
    const fx = u - x0;
    const fy = v - y0;
    const i = y0 * meta.w + x0;
    return (
      f32[i] * (1 - fx) * (1 - fy) + f32[i + 1] * fx * (1 - fy) + f32[i + meta.w] * (1 - fx) * fy + f32[i + meta.w + 1] * fx * fy
    );
  };
  return { tex, sample, w: meta.w, h: meta.h };
}

// Vector layers rasterised into two RGB textures with additive channels.
export function buildOverlays(vec, scale) {
  const cw = Math.round(2048 * scale);
  const ch = Math.round((cw * D) / W);
  const P = (p) => [((p[0] - BBOX.lon0) / (BBOX.lon1 - BBOX.lon0)) * cw, ((BBOX.lat1 - p[1]) / (BBOX.lat1 - BBOX.lat0)) * ch];
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return [c, g];
  };
  const path = (g, ring, close) => {
    g.beginPath();
    ring.forEach((p, i) => {
      const [x, y] = P(p);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    if (close) g.closePath();
  };
  const px = cw / 2048;

  const [lines, gl] = mk();
  gl.strokeStyle = 'rgb(0,0,255)';
  gl.lineWidth = 1.6 * px;
  vec.rivers.forEach((r) => { path(gl, r); gl.stroke(); });
  gl.strokeStyle = 'rgb(0,255,0)';
  gl.lineWidth = 1.4 * px;
  gl.setLineDash([6 * px, 4 * px]);
  vec.neighbors.forEach((r) => { path(gl, r); gl.stroke(); });
  gl.setLineDash([]);
  gl.strokeStyle = 'rgb(255,0,0)';
  gl.lineWidth = 3.4 * px;
  vec.uz.forEach((r) => { path(gl, r, true); gl.stroke(); });

  const [fills, gf] = mk();
  gf.fillStyle = 'rgb(255,0,0)';
  gf.beginPath();
  vec.uz.forEach((r) => r.forEach((p, i) => { const [x, y] = P(p); i ? gf.lineTo(x, y) : gf.moveTo(x, y); }));
  gf.fill('evenodd');
  gf.fillStyle = 'rgb(0,255,0)';
  vec.lakes.forEach((r) => { path(gf, r, true); gf.fill(); });
  gf.strokeStyle = 'rgb(0,0,255)';
  gf.lineWidth = 1.2 * px;
  vec.lakes.forEach((r) => { path(gf, r, true); gf.stroke(); });

  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { lines: tex(lines), fills: tex(fills) };
}

const vert = /* glsl */ `
  uniform sampler2D uH;
  uniform float uExag, uFlatK;
  uniform vec4 uFlat[8];
  uniform float uFlatN;
  varying vec2 vUv;
  varying float vH;
  varying vec3 vWorld;
  varying float vFlat;
  void main() {
    vUv = uv;
    float h = texture2D(uH, vec2(uv.x, 1.0 - uv.y)).r;
    vH = h;
    vec3 p = position;
    p.y = max(h, -60.0) / 1000.0 * uExag;
    // uFlat[i] = (x, z, radius, height): every town in focus is levelled so its streets and buildings sit flat on the chart
    float fAll = 0.0;
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uFlatN) break;
      vec4 fl = uFlat[i];
      float f = (1.0 - smoothstep(fl.z, fl.z * 1.9, distance(p.xz, fl.xy))) * uFlatK;
      p.y = mix(p.y, fl.w, f);
      fAll = max(fAll, f);
    }
    vFlat = fAll;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uH, uLines, uFills;
  uniform vec2 uTexel, uSlope;
  uniform float uNight, uFogNear, uFogFar, uExag;
  uniform vec3 uCam, uLight, uFogDay, uFogNight;
  varying vec2 vUv;
  varying float vH;
  varying vec3 vWorld;
  varying float vFlat;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float iso(float h, float step, float px) {
    float v = h / step;
    float fw = max(fwidth(v), 1e-5);
    return 1.0 - smoothstep(0.0, px, abs(fract(v + 0.5) - 0.5) / fw);
  }

  void main() {
    vec2 tuv = vec2(vUv.x, 1.0 - vUv.y);
    float h = vH;

    float hx = texture2D(uH, tuv + vec2(uTexel.x, 0.0)).r - texture2D(uH, tuv - vec2(uTexel.x, 0.0)).r;
    float hz = texture2D(uH, tuv + vec2(0.0, uTexel.y)).r - texture2D(uH, tuv - vec2(0.0, uTexel.y)).r;
    vec3 n = normalize(vec3(-hx * uSlope.x, 1.0, -hz * uSlope.y));
    // a focused city lies on a level plate: no relief shading or contours under its streets
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), vFlat));
    float diff = dot(n, normalize(uLight));
    float shade = mix(0.7, 1.08, clamp(diff * 0.5 + 0.5, 0.0, 1.0));

    vec4 L = texture2D(uLines, tuv);
    vec4 F = texture2D(uFills, tuv);

    vec3 paperD = vec3(0.929, 0.949, 0.965);
    vec3 paperN = vec3(0.039, 0.090, 0.161);
    vec3 inkD = vec3(0.086, 0.231, 0.404);
    vec3 inkN = vec3(0.62, 0.74, 0.88);
    vec3 highD = vec3(0.70, 0.77, 0.84);
    vec3 highN = vec3(0.10, 0.20, 0.33);
    vec3 waterD = vec3(0.79, 0.865, 0.933);
    vec3 waterN = vec3(0.05, 0.16, 0.28);
    vec3 riverD = vec3(0.30, 0.50, 0.72);
    vec3 riverN = vec3(0.35, 0.62, 0.95);

    vec3 paper = mix(paperD, paperN, uNight);
    vec3 ink = mix(inkD, inkN, uNight);
    float alt = smoothstep(250.0, 3800.0, h);
    vec3 col = mix(paper, mix(highD, highN, uNight), alt * 0.6);

    float inside = F.r;
    col = mix(col * mix(0.94, 0.78, uNight), col, inside);
    col = mix(col, col * shade, mix(1.0, 0.8, uNight));
    if (uNight > 0.0) col += vec3(0.02, 0.05, 0.1) * clamp(diff, 0.0, 1.0) * uNight * alt;

    col = mix(col, mix(waterD, waterN, uNight), F.g * 0.92);
    col = mix(col, mix(riverD, riverN, uNight), F.b * 0.6);

    float minor = iso(h, 100.0, 1.1) * (1.0 - smoothstep(0.08, 0.32, fwidth(h / 100.0)));
    float major = iso(h, 500.0, 1.4) * (1.0 - smoothstep(0.12, 0.38, fwidth(h / 500.0)));
    float land = step(5.0, h) * (1.0 - F.g);
    col = mix(col, ink, (minor * 0.13 + major * 0.3) * land * mix(1.0, 0.85, uNight) * (1.0 - vFlat));

    // borders and rivers are drawn as draped vector lines; the texture only adds a soft halo
    col = mix(col, ink, L.r * 0.08);

    // paper: fibre grain and the faint memory of folds
    float g = noise(vUv * vec2(1800.0, 1200.0)) * 0.6 + noise(vUv * vec2(240.0, 160.0)) * 0.4;
    col += (g - 0.5) * mix(0.022, 0.03, uNight);
    float panels = 6.0;
    float fx = fract(vUv.x * panels);
    float crease = smoothstep(0.0, 0.012, fx) * smoothstep(0.0, 0.012, 1.0 - fx);
    col *= mix(0.965, 1.0, crease);
    float fy = abs(vUv.y - 0.5);
    col *= mix(0.975, 1.0, smoothstep(0.0, 0.006, fy));
    float d = distance(vWorld, uCam);
    float fog = smoothstep(uFogNear, uFogFar, d);
    // the sheet's edges dissolve into the page instead of ending in a hard rectangle
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    fog = max(fog, 1.0 - smoothstep(0.0, 0.07, edge));
    col = mix(col, mix(uFogDay, uFogNight, uNight), fog);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createTerrain(heights, overlays, { segX, segZ }) {
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const kmPerTexX = W / heights.w;
  const kmPerTexZ = D / heights.h;
  const uniforms = {
    uH: { value: heights.tex },
    uLines: { value: overlays.lines },
    uFills: { value: overlays.fills },
    uTexel: { value: new THREE.Vector2(1 / heights.w, 1 / heights.h) },
    uSlope: { value: new THREE.Vector2((EXAG / 1000) / (2 * kmPerTexX), (EXAG / 1000) / (2 * kmPerTexZ)) },
    uExag: { value: EXAG },
    uFlat: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 1, 0)) },
    uFlatN: { value: 0 },
    uFlatK: { value: 0 },
    uNight: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uLight: { value: new THREE.Vector3(-0.55, 0.62, -0.55) },
    uFogNear: { value: 600 },
    uFogFar: { value: 1600 },
    uFogDay: { value: new THREE.Vector3(0.929, 0.949, 0.965) },
    uFogNight: { value: new THREE.Vector3(0.039, 0.09, 0.161) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, extensions: { derivatives: true } });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
