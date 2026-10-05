import * as THREE from 'three';
import { W, D, EXAG, BBOX } from './geo.js';

// Loads the packed DEM (scripts/data/pack_dem.py: 1 m steps, row deltas, split byte planes, zlib) and returns
// a CPU sampler plus a GPU half-float texture. Heights are stored as h + 200.
export async function loadHeights(size, onProgress) {
  const meta = size === 2048 ? { w: 2048, h: 1357 } : { w: 1024, h: 678 };
  const res = await fetch(`/data/dem-${size}.z`);
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
  for (let y = 0; y < meta.h; y++) {
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
  uniform float uExag;
  varying vec2 vUv;
  varying float vH;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    float h = texture2D(uH, vec2(uv.x, 1.0 - uv.y)).r;
    vH = h;
    vec3 p = position;
    p.y = max(h, -60.0) / 1000.0 * uExag;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uH, uFills, uSat, uNightTex, uCore, uFer, uTas, uSam, uBuk;
  uniform vec4 bBase, bCore, bFer, bTas, bSam, bBuk;
  uniform vec4 uGeo;
  uniform float uDetail;
  uniform vec2 uTexel, uSlope;
  uniform float uNight, uFogNear, uFogFar;
  uniform vec3 uCam, uLight, uFogDay, uFogNight;
  varying vec2 vUv;
  varying float vH;
  varying vec3 vWorld;

  // bounds are (lon0, lon1, lat0, lat1); image rows run north to south
  vec2 uvOf(vec2 ll, vec4 b) { return vec2((ll.x - b.x) / (b.y - b.x), (b.w - ll.y) / (b.w - b.z)); }
  float inside(vec2 uv, float f) {
    return smoothstep(0.0, f, uv.x) * smoothstep(0.0, f, 1.0 - uv.x) * smoothstep(0.0, f * 2.0, uv.y) * smoothstep(0.0, f * 2.0, 1.0 - uv.y);
  }
  vec3 layer(vec3 col, sampler2D t, vec4 b, vec2 ll, float f, float k) {
    vec2 uv = uvOf(ll, b);
    float w = inside(uv, f) * k;
    if (w <= 0.0) return col;
    return mix(col, texture2D(t, clamp(uv, 0.0, 1.0)).rgb, w);
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 tuv = vec2(vUv.x, 1.0 - vUv.y);
    float h = vH;
    vec2 ll = vec2(uGeo.x + vWorld.x / uGeo.z, uGeo.y - vWorld.z / uGeo.w);

    // Sentinel-2 cloudless imagery: the whole sheet, then finer layers where they exist
    vec3 sat = texture2D(uSat, clamp(uvOf(ll, bBase), 0.0, 1.0)).rgb;
    sat = layer(sat, uCore, bCore, ll, 0.03, uDetail);
    sat = layer(sat, uFer, bFer, ll, 0.05, uDetail);
    sat = layer(sat, uTas, bTas, ll, 0.06, uDetail);
    sat = layer(sat, uSam, bSam, ll, 0.12, uDetail);
    sat = layer(sat, uBuk, bBuk, ll, 0.12, uDetail);
    // a touch of contrast and saturation, the way a printed atlas plate lifts raw imagery
    sat = clamp((sat - 0.5) * 1.1 + 0.5 + 0.02, 0.0, 1.0);
    sat = mix(vec3(luma(sat)), sat, 1.14);

    // relief light from the elevation model, so the exaggerated mountains read in 3D
    float hx = texture2D(uH, tuv + vec2(uTexel.x, 0.0)).r - texture2D(uH, tuv - vec2(uTexel.x, 0.0)).r;
    float hz = texture2D(uH, tuv + vec2(0.0, uTexel.y)).r - texture2D(uH, tuv - vec2(0.0, uTexel.y)).r;
    vec3 n = normalize(vec3(-hx * uSlope.x, 1.0, -hz * uSlope.y));
    float diff = clamp(dot(n, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 day = sat * mix(0.8, 1.12, diff);

    // Uzbekistan stays in full colour; the neighbours sit back a little
    vec4 F = texture2D(uFills, tuv);
    float uz = F.r;
    vec3 dim = mix(vec3(luma(day)), day, 0.82) * 0.9 + vec3(0.02, 0.025, 0.035);
    day = mix(dim, day, uz);

    // night: the same ground under moonlight, cities lit from NASA Black Marble
    vec3 bm = texture2D(uNightTex, clamp(uvOf(ll, bBase), 0.0, 1.0)).rgb;
    float lights = smoothstep(0.2, 0.85, luma(bm));
    vec3 night = sat * vec3(0.12, 0.16, 0.26) * mix(0.75, 1.15, diff) + bm * vec3(0.18, 0.2, 0.28);
    night = mix(night * 0.7, night, uz);
    night += vec3(1.0, 0.78, 0.45) * pow(lights, 1.4) * 1.15;
    vec3 col = mix(day, night, uNight);

    float d = distance(vWorld, uCam);
    float fog = smoothstep(uFogNear, uFogFar, d);
    // the sheet's edges dissolve into the page instead of ending in a hard rectangle
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    fog = max(fog, 1.0 - smoothstep(0.0, 0.07, edge));
    col = mix(col, mix(uFogDay, uFogNight, uNight), fog * 0.92);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const loadTex = (url) => new Promise((resolve) => {
  new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.flipY = false;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    resolve(t);
  }, undefined, () => resolve(null));
});
const blank = new THREE.DataTexture(new Uint8Array([200, 190, 170, 255]), 1, 1);
blank.needsUpdate = true;

// The sheet needs the whole-country layer for the current theme first; the other one follows in the background.
export async function loadSatellite(meta, mobile, night, onProgress) {
  const sfx = mobile ? '-m' : '';
  const first = await loadTex(`/img/sat/${night ? 'night' : 'base'}${sfx}.webp`);
  onProgress?.(1);
  const sat = { meta: meta.layers, sfx, base: night ? null : first, night: night ? first : null };
  sat.rest = loadTex(`/img/sat/${night ? 'base' : 'night'}${sfx}.webp`).then((t) => { sat[night ? 'base' : 'night'] = t; return t; });
  return sat;
}

export function createTerrain(heights, overlays, { segX, segZ }, sat, geoK) {
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const kmPerTexX = W / heights.w;
  const kmPerTexZ = D / heights.h;
  const uniforms = {
    uH: { value: heights.tex },
    uLines: { value: overlays.lines },
    uFills: { value: overlays.fills },
    uSat: { value: sat?.base || blank },
    uNightTex: { value: sat?.night || blank },
    uCore: { value: blank }, uFer: { value: blank }, uTas: { value: blank }, uSam: { value: blank }, uBuk: { value: blank },
    bBase: { value: new THREE.Vector4(...(sat?.meta.base.bounds || [0, 1, 0, 1])) },
    bCore: { value: new THREE.Vector4(...(sat?.meta.core.bounds || [0, 0, 0, 0])) },
    bFer: { value: new THREE.Vector4(...(sat?.meta.fergana.bounds || [0, 0, 0, 0])) },
    bTas: { value: new THREE.Vector4(...(sat?.meta.tashkent.bounds || [0, 0, 0, 0])) },
    bSam: { value: new THREE.Vector4(...(sat?.meta.samarkand.bounds || [0, 0, 0, 0])) },
    bBuk: { value: new THREE.Vector4(...(sat?.meta.bukhara.bounds || [0, 0, 0, 0])) },
    uGeo: { value: new THREE.Vector4(...geoK) },
    uDetail: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / heights.w, 1 / heights.h) },
    uSlope: { value: new THREE.Vector2((EXAG / 1000) / (2 * kmPerTexX), (EXAG / 1000) / (2 * kmPerTexZ)) },
    uExag: { value: EXAG },
    uFold: { value: 1 },
    uReveal: { value: 0 },
    uDone: { value: 0 },
    uHub: { value: new THREE.Vector2() },
    uW: { value: W },
    uPanels: { value: 6 },
    uNight: { value: 0 },
    uTime: { value: 0 },
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
  sat?.rest.then((t) => { if (t) uniforms[sat.base === t ? 'uSat' : 'uNightTex'].value = t; });
  // finer imagery (east Uzbekistan, Fergana valley, Tashkent, Samarkand, Bukhara) fades in once it arrives
  const loadDetail = async () => {
    if (!sat) return;
    const names = [['uCore', 'core'], ['uFer', 'fergana'], ['uTas', 'tashkent'], ['uSam', 'samarkand'], ['uBuk', 'bukhara']];
    const texs = await Promise.all(names.map(([, n]) => loadTex(`/img/sat/${n}${sat.sfx}.webp`)));
    names.forEach(([u], i) => { if (texs[i]) uniforms[u].value = texs[i]; });
    return true;
  };
  return { mesh, uniforms, loadDetail };
}
