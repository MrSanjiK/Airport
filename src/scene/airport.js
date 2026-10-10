import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toXZ, KX } from './geo.js';

/* ───── Tashkent International Airport, modelled as it looks from above ─────
   Built from OpenStreetMap (scripts/data/airport_model.py): the 3D building parts of Terminal 2 (the departure
   hall, the green-roofed arrivals hall, the gallery and both gate piers), Terminals 1 and 3, the hangars, fuel
   farm and every building around the field; the two runways with their markings, taxiways, aprons and stands;
   car parks, roads, lawns, woods and trees. Roofs, asphalt, concrete and grass take the colours they have on
   satellite imagery; at night the halls glow through their glass. Volumes carry a 4× height exaggeration
   (the airport plate halves it). */

const HEX = 4;
const KM = 1 / 1000;
const mh = (m) => m * KM * HEX;
// the data is in metres at the airport's latitude; the chart's east scale is set at the sheet's centre latitude
const KXR = KX / (111.32 * Math.cos((41.26 * Math.PI) / 180));
const STOREY = mh(3.3);

const LOGV = `#include <common>
#include <logdepthbuf_pars_vertex>`;

// Buildings: roof colour from above; offices with storey windows, terminals with a glazed band, towers in curtain
// glass that reflects the sky (Fresnel), catches the sun, and shows its mullions, floor lines and panel tints;
// every wall darkens at its foot where it meets the ground
const bldVert = /* glsl */ `${LOGV}
  attribute vec3 aRoof; attribute vec3 aWall; attribute vec3 aInfo; attribute vec2 aC;
  varying vec3 vN; varying vec3 vNl; varying vec3 vP; varying vec3 vWp; varying vec3 vRoof; varying vec3 vWall; varying vec3 vInfo; varying vec2 vC;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal); vNl = normal; vP = position; vRoof = aRoof; vWall = aWall; vInfo = aInfo; vC = aC;
    vWp = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
// the diorama: everything beyond r0 dissolves (buildings, trees) or fades (ground) by r1, so the model melts into the chart
// uDiscS stretches the round into an ellipse (the hero's model follows the long, narrow airfield)
const DISC = /* glsl */ `
  uniform vec4 uDisc; uniform vec2 uDiscS;
  float discD(vec2 p){ return length((p - uDisc.xy) * uDiscS); }
  float discFade(vec2 p){ return uDisc.w > 0.0 ? smoothstep(uDisc.z, uDisc.w, discD(p)) : 0.0; }
  // whole buildings and trees stop at the cut, measured from their own centre: a clean edge, never a stipple
  bool discCut(vec2 c){ return uDisc.w > 0.0 && discD(c) > mix(uDisc.z, uDisc.w, 0.55); }`;
const bldFrag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uNight, uStorey, uOpacity; uniform vec3 uLight;${DISC}
  varying vec3 vN; varying vec3 vNl; varying vec3 vP; varying vec3 vWp; varying vec3 vRoof; varying vec3 vWall; varying vec3 vInfo; varying vec2 vC;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // a periodic band (a..b of every unit of x), box-filtered over the pixel's footprint: crisp while a period spans
  // many pixels, its plain average once it spans less than one, so a facade never crawls or breaks into moire as the
  // camera sways (the terminal is a 100 px symbol in the hero, a full plate later)
  float pint(float x, float a, float b){ return floor(x) * (b - a) + clamp(fract(x), a, b) - a; }
  float band(float x, float a, float b){ float w = max(fwidth(x), 1e-4); return (pint(x + w * 0.5, a, b) - pint(x - w * 0.5, a, b)) / w; }
  // how much per-cell detail (a lit window, a pane's tint, roof grain) can still be seen: none below a pixel
  float detail(float cells){ return 1.0 - smoothstep(0.3, 0.85, cells); }
  // the sky a facade reflects: ground below the horizon, haze at it, blue overhead (by day); a dark dome at night
  vec3 sky(vec3 r, float night){
    vec3 day = mix(vec3(0.5, 0.52, 0.52), mix(vec3(0.86, 0.9, 0.95), vec3(0.4, 0.58, 0.84), smoothstep(0.0, 0.7, r.y)), smoothstep(-0.08, 0.04, r.y));
    vec3 dark = mix(vec3(0.03, 0.04, 0.06), mix(vec3(0.1, 0.14, 0.22), vec3(0.02, 0.04, 0.09), smoothstep(0.0, 0.6, r.y)), smoothstep(-0.08, 0.04, r.y));
    return mix(day, dark, night);
  }
  void main(){
    #include <logdepthbuf_fragment>
    if (discCut(vC)) discard;
    vec3 n = normalize(vN);
    vec3 L = normalize(uLight);
    vec3 V = normalize(cameraPosition - vWp);
    float l = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
    float roof = step(0.8, n.y);
    float kind = vInfo.x;
    float rise = vP.y - vInfo.y;
    float h = clamp(rise / max(1e-5, vInfo.z - vInfo.y), 0.0, 1.0);
    // a coordinate running along the wall, whichever way it faces
    vec2 tg = vec2(-vNl.z, vNl.x);
    float u = dot(vP.xz, tg / max(1e-5, length(tg)));
    float fy = rise / uStorey;
    // roofs: the satellite colour, with faint panel grain on the big halls
    vec2 gq = vP.xz * 2600.0;
    float grain = (hash(floor(gq)) - 0.5) * 0.035 * detail(max(fwidth(gq.x), fwidth(gq.y)));
    vec3 roofD = vRoof * (1.0 + grain) * mix(0.94, 1.04, l);
    vec3 roofN = vRoof * 0.16 + vec3(0.03, 0.05, 0.09);
    // contact shadow where the walls meet the ground
    float ao = mix(0.62, 1.0, smoothstep(0.0, uStorey * 1.8, rise));
    // walls and windows
    float win = 0.0;
    float lit = 0.0;
    float mull = 0.0;
    float panel = 0.0;
    if (kind < 0.5) {
      float pw = uStorey * 0.55;
      float storeys = (vInfo.z - vInfo.y) / uStorey;
      win = band(fy, 0.34, 0.78) * band(u / pw, 0.18, 0.82) * step(0.6, storeys) * step(0.04, h);
      lit = mix(0.58, step(0.42, hash(vec2(floor(u / pw), floor(fy)) + vInfo.yz * 97.0)), detail(max(fwidth(u / pw), fwidth(fy))));
    } else if (kind < 1.5) {
      win = band(h, 0.14, 0.84);
      mull = 1.0 - band(u / (uStorey * 1.1), 0.05, 0.95);
    } else if (kind > 3.5) {
      // curtain wall: a panel grid, a dark spandrel at every floor, each pane a shade off its neighbours
      float pw = uStorey * 0.45;
      win = 1.0;
      mull = max(1.0 - band(u / pw, 0.06, 0.94), (1.0 - band(fy, 0.1, 1.0)) * 1.3);
      float dk = detail(max(fwidth(u / pw), fwidth(fy)));
      panel = (hash(vec2(floor(u / pw), floor(fy)) + vInfo.yz * 31.0) - 0.5) * dk;
      lit = mix(0.68, step(0.32, hash(vec2(floor(u / (pw * 2.0)), floor(fy)) + vInfo.yz * 97.0)), dk);
    }
    // glass: a tinted body under a sky reflection that strengthens at grazing angles, and the sun's glint
    vec3 R = reflect(-V, n);
    float fres = 0.05 + 0.95 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);
    vec3 body = kind > 3.5 ? mix(vec3(0.28, 0.35, 0.44), vWall * 0.8, 0.62) : vec3(0.3, 0.37, 0.46);
    // seen from above a facade would mirror the pavement; the chart lets it mirror the sky, as photographs read
    vec3 Rs = normalize(vec3(R.x, abs(R.y) * 0.55 + 0.1, R.z));
    vec3 glassD = mix(body * mix(0.78, 1.06, l), sky(Rs, 0.0), 0.34 + 0.56 * fres) * (1.0 + panel * 0.1);
    // towers brighten toward their crowns, where they catch more open sky
    if (kind > 3.5) glassD *= mix(0.86, 1.14, h);
    glassD += pow(max(dot(R, L), 0.0), 120.0) * 0.85 + pow(max(dot(R, L), 0.0), 12.0) * 0.06;
    glassD = mix(glassD, vec3(0.2, 0.24, 0.3), clamp(mull, 0.0, 1.0) * 0.55);
    vec3 wallD = vWall * mix(0.58, 1.0, l);
    vec3 dayC = mix(mix(wallD, glassD, win * 0.92), roofD, roof);
    vec3 wallN = vWall * 0.12 + vec3(0.02, 0.035, 0.06);
    // at night the halls glow softly through their glass, office and tower windows burn here and there
    vec3 glow = (kind < 0.5 || kind > 3.5) ? vec3(1.0, 0.78, 0.5) * mix(0.08, 0.85, lit) : vec3(0.5, 0.62, 0.8) * mix(0.55, 0.75, l);
    glow = mix(glow, sky(Rs, 1.0) * 2.0, kind > 3.5 ? fres * 0.5 : 0.0) * (1.0 - clamp(mull, 0.0, 1.0) * 0.7);
    vec3 nightC = mix(mix(wallN, glow, win), roofN, roof);
    vec3 col = mix(dayC, nightC, uNight) * mix(ao, 1.0, roof);
    gl_FragColor = vec4(col, uOpacity);
  }`;

// Ground: flat colour with a whisper of grain so grass and concrete never read as plastic
const groundVert = /* glsl */ `${LOGV}
  varying vec2 vW;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = position.xz; gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
  }`;
const groundFrag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor; uniform float uOpacity, uGrain, uScale;${DISC}
  varying vec2 vW;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    #include <logdepthbuf_fragment>
    // each octave of grain fades out before its cells shrink under a pixel (they would shimmer as the camera sways)
    vec2 q1 = vW * uScale, q2 = q1 * 4.3;
    float f1 = 1.0 - smoothstep(0.35, 0.9, max(fwidth(q1.x), fwidth(q1.y)));
    float f2 = 1.0 - smoothstep(0.35, 0.9, max(fwidth(q2.x), fwidth(q2.y)));
    float g = (noise(q1) - 0.5) * 0.7 * f1 + (noise(q2) - 0.5) * 0.3 * f2;
    gl_FragColor = vec4(uColor * (1.0 + g * uGrain), uOpacity * (1.0 - discFade(vW)));
  }`;

// Trees, cars, aircraft: one light, day and night colours, instancing-aware
const shadeVert = /* glsl */ `${LOGV}
  uniform vec3 uDay, uNightC; uniform float uNight;
  varying vec3 vN; varying vec3 vC; varying vec2 vL;
  void main(){
    vec4 p = vec4(position, 1.0); vec3 n = normal;
    vec3 c = mix(uDay, uNightC, uNight);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      c = instanceColor * mix(vec3(1.0), uNightC, uNight);
    #endif
    vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
      o = instanceMatrix * o;
    #endif
    vC = c; vN = normalize(mat3(modelMatrix) * n); vL = (modelMatrix * o).xz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
    #include <logdepthbuf_vertex>
  }`;
const shadeFrag = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uLight; uniform float uOpacity; uniform vec3 uOrigin;${DISC}
  varying vec3 vN; varying vec3 vC; varying vec2 vL;
  void main(){
    #include <logdepthbuf_fragment>
    if (discCut(vL - uOrigin.xz)) discard;
    float l = clamp(dot(normalize(vN), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(vC * mix(0.6, 1.05, l), uOpacity);
  }`;

// sun from the north-west, matching the shadows baked into the data
const LIGHT = new THREE.Vector3(-0.55, 0.78, -0.37);
const INK_D = new THREE.Color(0.086, 0.231, 0.404);
const INK_N = new THREE.Color(0.62, 0.74, 0.88);

// colours read off the field from above (day) and their night-chart counterparts
const C = {
  land: [[0.79, 0.77, 0.72], [0.06, 0.1, 0.16]],
  paved: [[0.72, 0.71, 0.68], [0.08, 0.11, 0.16]],
  grass: [[0.5, 0.59, 0.38], [0.05, 0.11, 0.11]],
  lawn: [[0.45, 0.56, 0.34], [0.05, 0.11, 0.11]],
  wood: [[0.27, 0.39, 0.23], [0.03, 0.08, 0.08]],
  apron: [[0.69, 0.69, 0.68], [0.12, 0.15, 0.2]],
  taxi: [[0.5, 0.51, 0.53], [0.08, 0.1, 0.14]],
  runway: [[0.36, 0.37, 0.39], [0.05, 0.07, 0.1]],
  park: [[0.47, 0.48, 0.5], [0.08, 0.1, 0.15]],
  road: [[0.55, 0.56, 0.57], [0.1, 0.13, 0.18]],
  shadow: [[0.0, 0.02, 0.06], [0.0, 0.0, 0.02]],
  white: [[0.96, 0.96, 0.95], [0.55, 0.6, 0.7]],
  yellow: [[0.9, 0.73, 0.22], [0.75, 0.6, 0.28]],
};
const ROOF = {
  dep: [[0.72, 0.74, 0.76], [0.66, 0.68, 0.7], [0.8, 0.81, 0.82], [0.6, 0.62, 0.65]],
  arr: [[0.47, 0.6, 0.48], [0.4, 0.53, 0.42]],
  canopy: [[0.92, 0.93, 0.94]],
  term: [[0.66, 0.67, 0.69]],
  hangar: [[0.8, 0.82, 0.84], [0.72, 0.75, 0.78], [0.86, 0.87, 0.88]],
  tank: [[0.93, 0.93, 0.91]],
  gen: [[0.82, 0.8, 0.76], [0.72, 0.71, 0.68], [0.6, 0.6, 0.6], [0.62, 0.42, 0.35], [0.5, 0.56, 0.62], [0.86, 0.85, 0.82], [0.48, 0.56, 0.5], [0.75, 0.7, 0.62]],
};
const WALL = { dep: [0.88, 0.9, 0.92], arr: [0.88, 0.9, 0.92], canopy: [0.9, 0.91, 0.92], term: [0.86, 0.87, 0.88], hangar: [0.84, 0.86, 0.88], tank: [0.92, 0.92, 0.9], gen: [0.86, 0.84, 0.8] };
const KIND = { gen: 0, dep: 1, arr: 1, term: 1, canopy: 3, hangar: 2, tank: 3 };

export function createAirport(model, hubWorld) {
  const group = new THREE.Group();
  const disc = { value: new THREE.Vector4(0, 0, 0, 0) };
  // the same disc in world units, for the shaders that measure in world space
  const shadeDisc = { value: new THREE.Vector4(0, 0, 0, 0) };
  const discS = { value: new THREE.Vector2(1, 1) };
  // trees, cars and aircraft are instanced: their fade works in world space, measured from the group's origin
  const origin = { value: new THREE.Vector3() };
  const scaleNow = new THREE.Vector3();
  const [hx, hz] = toXZ(model.o[0], model.o[1]);
  const L = ([x, z]) => [x * KM * KXR, z * KM];
  const rnd = mulberry(7);

  const flatMats = [];
  const ground = (key, { opacity = 1, grain = 0.08, scale = 220, order = 1 } = {}) => {
    const [day, night] = C[key];
    const m = new THREE.ShaderMaterial({
      vertexShader: groundVert, fragmentShader: groundFrag,
      uniforms: { uColor: { value: new THREE.Color(...day) }, uOpacity: { value: opacity }, uGrain: { value: grain }, uScale: { value: scale }, uDisc: disc, uDiscS: discS },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    m.userData = { day: new THREE.Color(...day), night: new THREE.Color(...night), base: opacity, order };
    flatMats.push(m);
    return m;
  };
  const mats = [];
  const shade = (day, night, { opacity = 1 } = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: shadeVert, fragmentShader: shadeFrag,
      uniforms: { uDay: { value: new THREE.Color(...day) }, uNightC: { value: new THREE.Color(...night) }, uNight: { value: 0 }, uLight: { value: LIGHT }, uOpacity: { value: opacity }, uDisc: shadeDisc, uDiscS: discS, uOrigin: origin },
      transparent: opacity < 1,
    });
    mats.push(m);
    return m;
  };
  const bmats = [];
  const bldMat = () => {
    const m = new THREE.ShaderMaterial({
      vertexShader: bldVert, fragmentShader: bldFrag,
      uniforms: { uNight: { value: 0 }, uStorey: { value: STOREY }, uOpacity: { value: 1 }, uLight: { value: LIGHT }, uDisc: disc, uDiscS: discS },
    });
    bmats.push(m);
    return m;
  };
  const inks = [];
  const lineMat = (o) => {
    const m = new THREE.LineBasicMaterial({ color: INK_D.clone(), transparent: true, opacity: o, depthWrite: false });
    m.userData.base = o;
    inks.push(m);
    return m;
  };

  const shapeOf = (pts, holes = []) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
    return s;
  };
  const flatGeo = (rings, y) => {
    const gs = rings.filter((r) => r.length > 2).map((r) => {
      const outer = Array.isArray(r[0][0]) ? r[0] : r;
      const holes = Array.isArray(r[0][0]) ? r.slice(1) : [];
      const g = new THREE.ShapeGeometry(shapeOf(outer.map(L), holes.map((h) => h.map(L))));
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute('uv'); g.deleteAttribute('normal');
      return g.index ? g.toNonIndexed() : g;
    });
    return gs.length ? mergeGeometries(gs) : null;
  };
  // quads along polylines, widths in metres; joints closed by running each quad half a width past its ends
  const quad = (pos, a, b, w, y, ext = true) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    const hw = w / 2;
    const ex = ext ? ux * hw : 0, ez = ext ? uz * hw : 0;
    const nx = -uz * hw, nz = ux * hw;
    const p0 = [a[0] - ex + nx, a[1] - ez + nz], p1 = [a[0] - ex - nx, a[1] - ez - nz], p2 = [b[0] + ex - nx, b[1] + ez - nz], p3 = [b[0] + ex + nx, b[1] + ez + nz];
    pos.push(p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], p0[0], y, p0[1], p2[0], y, p2[1], p3[0], y, p3[1]);
  };
  const ribbonGeo = (lines, y) => {
    const pos = [];
    lines.forEach(({ w, g }) => {
      const pts = g.map(L);
      for (let i = 0; i < pts.length - 1; i++) quad(pos, pts[i], pts[i + 1], w * KM, y);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  };

  /* ── ground (the field and its surroundings; drawn across the map only away from the plate) ── */
  const flat = new THREE.Group();
  group.add(flat);
  const addFlat = (geo, mat, grp = flat) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.renderOrder = mat.userData.order; grp.add(m); return m; };
  // the middle of the airfield (between both runways' ends), where the hero's model of the whole field is centred
  const fieldC = (() => {
    const ends = model.runways.flatMap((rw) => [L(rw.g[0]), L(rw.g[rw.g.length - 1])]);
    return [ends.reduce((a, p) => a + p[0], 0) / ends.length, ends.reduce((a, p) => a + p[1], 0) / ends.length];
  })();
  // the land round the field: the city on the plate, the plinth of the hero's model
  const plateLand = new THREE.Group();
  group.add(plateLand);
  {
    const g = new THREE.PlaneGeometry(9, 9);
    g.rotateX(-Math.PI / 2);
    g.translate(fieldC[0], 0.0002, fieldC[1]);
    addFlat(g, ground('land', { grain: 0.1, order: 0 }), plateLand);
  }
  const Y = (i) => 0.0003 + i * 0.00008;
  // the field's own ground is paved or bare; its grass is mapped piece by piece between runways and taxiways
  addFlat(flatGeo(model.aerodrome, Y(0)), ground('paved', { grain: 0.08, scale: 120, order: 1 }));
  addFlat(flatGeo(model.grass, Y(1)), ground('grass', { grain: 0.16, scale: 60, order: 1 }));
  addFlat(flatGeo(model.wood, Y(2)), ground('wood', { grain: 0.22, scale: 160, order: 1 }));
  addFlat(flatGeo(model.aprons, Y(3)), ground('apron', { grain: 0.05, order: 2 }));
  addFlat(ribbonGeo(model.taxiways, Y(4)), ground('taxi', { grain: 0.05, order: 3 }));
  addFlat(flatGeo(model.parking, Y(4)), ground('park', { grain: 0.05, order: 3 }));
  addFlat(ribbonGeo(model.roads, Y(5)), ground('road', { grain: 0.04, order: 3 }));
  addFlat(flatGeo(model.helipads, Y(5)), ground('taxi', { grain: 0.04, order: 3 }));
  addFlat(ribbonGeo(model.runways, Y(6)), ground('runway', { grain: 0.06, order: 4 }));
  // the shadows every building throws across the ground (unioned offline, so overlaps never double)
  addFlat(flatGeo(model.shadows.map((s) => [s.o, ...s.h]), Y(8)), ground('shadow', { opacity: 0.3, grain: 0, order: 6 }));

  // runway markings: edge lines, centreline dashes, threshold piano keys, touchdown and aiming-point bars
  const rwLabels = [];
  const white = [];
  model.runways.forEach((rw) => {
    const a = L(rw.g[0]);
    const b = L(rw.g[rw.g.length - 1]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const v = [-u[1], u[0]];
    const w = rw.w * KM;
    const at = (s, t) => [a[0] + u[0] * s + v[0] * t, a[1] + u[1] * s + v[1] * t];
    const bar = (s0, s1, t, width) => quad(white, at(s0, t), at(s1, t), width, Y(7), false);
    [-1, 1].forEach((sg) => bar(0, len, sg * (w / 2 - 1.2 * KM), 0.9 * KM));
    for (let s = 0.15; s < len - 0.15; s += 0.05) bar(s, Math.min(s + 0.03, len - 0.15), 0, 0.9 * KM);
    const keys = rw.w >= 60 ? 16 : 12;
    [[0, 1], [len, -1]].forEach(([s0, dir]) => {
      for (let k = 0; k < keys; k++) {
        const t = (k - (keys - 1) / 2) * (w * 0.84 / keys);
        if (Math.abs(t) < w * 0.06) continue;
        bar(s0 + dir * 0.006, s0 + dir * 0.036, t, 1.8 * KM);
      }
      [-1, 1].forEach((sg) => bar(s0 + dir * 0.4, s0 + dir * 0.46, sg * w * 0.24, 8 * KM));
      [0.15, 0.3, 0.6, 0.75].forEach((d, i) => {
        const n = i < 2 ? 3 : 2;
        [-1, 1].forEach((sg) => { for (let j = 0; j < n; j++) bar(s0 + dir * d, s0 + dir * (d + 0.0225), sg * (w * 0.24 + (j - (n - 1) / 2) * 3 * KM), 1.8 * KM); });
      });
    });
    rwLabels.push({ ref: rw.ref, a: new THREE.Vector3(a[0], 0.05, a[1]), b: new THREE.Vector3(b[0], 0.05, b[1]) });
  });
  // paint is a metre wide: it belongs to the close views, never to the hero's model (it would only twinkle there)
  const marks = new THREE.Group();
  flat.add(marks);
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(white, 3));
    addFlat(g, ground('white', { grain: 0, order: 7 }), marks);
  }
  // taxiway centrelines and stand lead-in lines in apron yellow
  const yellow = ground('yellow', { grain: 0, opacity: 0.95, order: 7 });
  addFlat(ribbonGeo(model.taxiways.map(({ g }) => ({ w: 0.9, g })), Y(7)), yellow, marks);
  addFlat(ribbonGeo(model.stands.map((g) => ({ w: 0.6, g })), Y(7)), yellow, marks);

  /* ── buildings ── */
  const pick = (arr, seed) => arr[Math.floor(seed * arr.length) % arr.length];
  const centroid = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  const insideRing = (pt, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const volume = (b) => {
    const pts = b.g.map(L);
    const base = mh(b.b || 0);
    const top = Math.max(base + mh(1.5), mh(b.h));
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: top - base, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, base, 0);
    g.deleteAttribute('uv');
    const ng = g.index ? g.toNonIndexed() : g;
    const n = ng.attributes.position.count;
    const seed = rnd();
    const roofC = pick(ROOF[b.c] || ROOF.gen, seed);
    const wallC = WALL[b.c] || WALL.gen;
    const roof = new Float32Array(n * 3), wall = new Float32Array(n * 3), info = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      roof.set(roofC, i * 3); wall.set(wallC, i * 3); info.set([KIND[b.c] ?? 0, base, top], i * 3);
    }
    ng.setAttribute('aRoof', new THREE.BufferAttribute(roof, 3));
    ng.setAttribute('aWall', new THREE.BufferAttribute(wall, 3));
    ng.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
    const cc = centroid(pts);
    const ca = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) ca.set(cc, i * 2);
    ng.setAttribute('aC', new THREE.BufferAttribute(ca, 2));
    return { g: ng, c: cc, top, ring: pts };
  };
  const T = model.terminals;
  const ringL = (r) => r.map(L);
  const terminals = {};
  const frame = (key, rings) => {
    const pts = rings.flat().map(L);
    const c = centroid(pts);
    // the hall's long axis: its longest edge
    let best = 0, ang = 0;
    rings.forEach((r) => { const q = r.map(L); for (let i = 0; i < q.length; i++) { const p0 = q[i], p1 = q[(i + 1) % q.length]; const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (d > best) { best = d; ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); } } });
    // u runs west to east along the hall, v from its landside (north) to its airside (south)
    const u = Math.cos(ang) < 0 ? [-Math.cos(ang), -Math.sin(ang)] : [Math.cos(ang), Math.sin(ang)];
    const v = [-u[1], u[0]];
    const us = pts.map((p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
    const vs = pts.map((p) => (p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1]);
    terminals[key] = { c, u, v, u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs), rings: rings.map(ringL), top: 0, parts: [] };
  };
  frame('DEP', T.DEP);
  frame('ARR', [T.ARR]);
  frame('T1', [T.T1]);
  frame('T3', [T.T3]);
  const inTerm = (key, p) => terminals[key].rings.some((r) => insideRing(p, r));

  // the hall that stands for the airport in the hero; the gallery and the far pier join it on the plate
  // airside buildings (hangars, the fuel farm, airport services) stand on the map with the field; the city
  // round the field is drawn only on the plate
  const aero = model.aerodrome.map(ringL);
  const buckets = { hall: [], gates: [], far: [], t1: [], t3: [], airside: [], context: [] };
  model.bld.forEach((b) => {
    const v = volume(b);
    const d = Math.hypot(v.c[0], v.c[1]);
    let k = aero.some((r) => insideRing(v.c, r)) ? 'airside' : 'context';
    if (b.c === 'dep' || b.c === 'arr' || (b.c === 'canopy' && d < 0.3)) k = d < 0.16 ? 'hall' : d < 0.24 ? 'gates' : 'far';
    else if (b.c === 'term') k = inTerm('T1', v.c) ? 't1' : 't3';
    else if (inTerm('T1', v.c)) k = 't1';
    buckets[k].push(v);
    if (k === 'hall') ['DEP', 'ARR'].forEach((t) => { if (inTerm(t, v.c)) terminals[t].top = Math.max(terminals[t].top, v.top); });
    if (k === 't1') terminals.T1.top = Math.max(terminals.T1.top, v.top);
    if (k === 't3') terminals.T3.top = Math.max(terminals.T3.top, v.top);
  });
  // rooftop plant on the big flat roofs (air handlers, chillers, louvred boxes): what makes a roof read as a roof
  const plant = { hall: [], gates: [], far: [], t1: [], t3: [], airside: [] };
  {
    const areaOf = (q) => { let a = 0; for (let i = 0, j = q.length - 1; i < q.length; j = i++) a += (q[j][0] + q[i][0]) * (q[j][1] - q[i][1]); return Math.abs(a / 2); };
    Object.entries(buckets).forEach(([k, list]) => {
      if (!plant[k]) return;
      list.forEach((v) => {
        const q = v.ring;
        const area = areaOf(q);
        if (area < 0.0016) return;
        const xs = q.map((p) => p[0]), zs = q.map((p) => p[1]);
        const n = Math.min(26, Math.round(area / 0.0011));
        for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
          const p = [Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), Math.min(...zs) + rnd() * (Math.max(...zs) - Math.min(...zs))];
          // clear of the parapet: the box's corners must be on the roof too
          if (![[0, 0], [0.006, 0], [-0.006, 0], [0, 0.006], [0, -0.006]].every(([dx, dz]) => insideRing([p[0] + dx, p[1] + dz], q))) continue;
          plant[k].push({ p, top: v.top, w: 0.0035 + rnd() * 0.0055, d: 0.003 + rnd() * 0.004, h: mh(1.6 + rnd() * 1.6), a: rnd() < 0.5 ? 0 : Math.PI / 2, c: rnd() });
          i++;
        }
      });
    });
  }
  const edgeHall = lineMat(0.22);
  const edgeSoft = lineMat(0.1);
  const groups = {};
  Object.entries(buckets).forEach(([k, list]) => {
    const grp = new THREE.Group();
    groups[k] = grp;
    group.add(grp);
    if (!list.length) return;
    const merged = mergeGeometries(list.map((v) => v.g));
    grp.add(new THREE.Mesh(merged, bldMat()));
    if (k !== 'context') grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(merged, 28), k === 'hall' ? edgeHall : edgeSoft));
  });
  {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const plantMat = shade([1, 1, 1], [0.2, 0.26, 0.36]);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    Object.entries(plant).forEach(([k, list]) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(box, plantMat, list.length);
      list.forEach((u, i) => {
        m4.compose(new THREE.Vector3(u.p[0], u.top, u.p[1]), q.setFromEuler(new THREE.Euler(0, u.a, 0)), new THREE.Vector3(u.w, u.h, u.d));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, c.setRGB(...(u.c < 0.55 ? [0.83, 0.84, 0.85] : u.c < 0.85 ? [0.7, 0.72, 0.74] : [0.55, 0.58, 0.62])));
      });
      groups[k].add(im);
    });
  }
  terminals.T1.parts = [groups.t1];
  terminals.T3.parts = [groups.t3];

  // jet bridges (gates 1–4) with an airliner nosed in at each
  const bridgeMat = shade([0.84, 0.86, 0.88], [0.16, 0.24, 0.36]);
  const bridgeH = mh(5);
  const aircraft = makeAircraft(shade);
  model.jet.forEach((b) => {
    let pts = b.map(L);
    // root = the end nearest a hall wall
    const dTo = (p) => Math.min(...['DEP', 'ARR'].map((t) => Math.hypot(p[0] - terminals[t].c[0], p[1] - terminals[t].c[1])));
    if (dTo(pts[0]) > dTo(pts[pts.length - 1])) pts = pts.reverse();
    const grp = Math.hypot(...centroid(pts)) < 0.2 ? groups.gates : groups.far;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.0042, mh(3.2), len), bridgeMat);
      m.position.set((ax + bx) / 2, bridgeH, (az + bz) / 2);
      m.rotation.y = Math.atan2(bx - ax, bz - az);
      grp.add(m);
    }
    const E = pts[pts.length - 1];
    const Pv = pts[pts.length - 2];
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, bridgeH, 8), bridgeMat);
    leg.position.set(E[0], bridgeH / 2, E[1]);
    grp.add(leg);
    const ax = E[0] - Pv[0], az = E[1] - Pv[1];
    const al = Math.hypot(ax, az) || 1;
    const dir = [ax / al, az / al];
    const plane = aircraft.group.clone();
    plane.position.set(E[0] + dir[0] * 0.003 + dir[1] * 0.0028, 0, E[1] + dir[1] * 0.003 - dir[0] * 0.0028);
    plane.rotation.y = Math.atan2(dir[0], dir[1]);
    grp.add(plane);
  });

  // Air-traffic control tower (Uzaeronavigation): fluted shaft, finned crown, glazed cab, mast
  if (model.tower) {
    const [tx, tz] = L(model.tower);
    const tw = new THREE.Group();
    const wht = shade([0.94, 0.95, 0.96], [0.16, 0.24, 0.36]);
    const glass = shade([0.3, 0.38, 0.5], [0.9, 0.94, 1.0]);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0042, mh(40), 18), wht);
    shaft.position.y = mh(20);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0036, mh(6), 18), wht);
    crown.position.y = mh(43);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0058, mh(5), 18), glass);
    cab.position.y = mh(48.5);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.006, mh(2), 18), wht);
    cap.position.y = mh(52);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.00035, mh(9), 6), wht);
    mast.position.y = mh(57.5);
    tw.add(shaft, crown, cab, cap, mast);
    const fin = new THREE.BoxGeometry(0.0007, mh(16), 0.0026);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const f = new THREE.Mesh(fin, wht);
      f.position.set(Math.cos(a) * 0.0042, mh(36), Math.sin(a) * 0.0042);
      f.rotation.y = -a;
      tw.add(f);
    }
    tw.position.set(tx, 0, tz);
    groups.gates.add(tw);
  }

  /* ── airside fleet: airliners on about half the stands, nosed to the stop line ── */
  const fleet = new THREE.Group();
  group.add(fleet);
  {
    const taxiPts = model.taxiways.flatMap((t) => t.g.map(L));
    const nearTaxi = (p) => { let d = 1; for (let i = 0; i < taxiPts.length; i += 2) { const q = taxiPts[i]; const e = Math.hypot(p[0] - q[0], p[1] - q[1]); if (e < d) d = e; } return d; };
    const slots = [];
    model.stands.forEach((s) => {
      if (s.length < 2 || rnd() > 0.5) return;
      let pts = s.map(L);
      // the stop end is the one farther from the taxilanes
      if (nearTaxi(pts[0]) > nearTaxi(pts[pts.length - 1])) pts = pts.reverse();
      const E = pts[pts.length - 1], Pv = pts[pts.length - 2];
      const len = Math.hypot(E[0] - Pv[0], E[1] - Pv[1]);
      if (len < 0.004) return;
      const d = [(E[0] - Pv[0]) / len, (E[1] - Pv[1]) / len];
      // keep the jet-bridge gates clear: those already have their aircraft
      if (model.jet.some((b) => { const q = L(b[b.length - 1]); return Math.hypot(q[0] - E[0], q[1] - E[1]) < 0.045; })) return;
      slots.push({ p: [E[0] - d[0] * 0.004, E[1] - d[1] * 0.004], a: Math.atan2(d[0], d[1]), s: rnd() < 0.25 ? 1.45 : 1 });
    });
    // liveries seen at TAS: white bodies; tails in the carriers' colours
    const tails = [[0.09, 0.27, 0.55], [0.09, 0.27, 0.55], [0.09, 0.27, 0.55], [0.78, 0.1, 0.12], [0.42, 0.06, 0.2], [0.12, 0.45, 0.72], [0.85, 0.85, 0.85], [0.1, 0.5, 0.35]];
    if (slots.length) {
      const body = new THREE.InstancedMesh(aircraft.body, shade([1, 1, 1], [0.32, 0.4, 0.54]), slots.length);
      const tail = new THREE.InstancedMesh(aircraft.tail, shade([1, 1, 1], [0.4, 0.5, 0.66]), slots.length);
      const m4 = new THREE.Matrix4();
      const c = new THREE.Color();
      slots.forEach((s, i) => {
        m4.compose(new THREE.Vector3(s.p[0], 0, s.p[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.a + Math.PI, 0)), new THREE.Vector3(s.s, s.s * 1.8, s.s));
        body.setMatrixAt(i, m4);
        tail.setMatrixAt(i, m4);
        body.setColorAt(i, c.setRGB(0.96, 0.97, 0.98));
        tail.setColorAt(i, c.setRGB(...tails[Math.floor(rnd() * tails.length)]));
      });
      fleet.add(body, tail);
      // ground handling at each parked aircraft: a tug at the nose, a catering truck and a baggage train at the doors
      const gse = [[0.0002, -0.006, 0.0018, 0.0034, 0.95], [0.0048, 0.008, 0.0024, 0.0062, 0.97], [-0.0052, 0.016, 0.0016, 0.0042, 0.9], [-0.0052, 0.021, 0.0016, 0.0042, 0.9], [0.005, 0.024, 0.0022, 0.0058, 0.62]];
      const vg = new THREE.BoxGeometry(1, 1, 1);
      vg.translate(0, 0.5, 0);
      const vm = new THREE.InstancedMesh(vg, shade([1, 1, 1], [0.3, 0.38, 0.5]), slots.length * gse.length);
      const q = new THREE.Quaternion();
      const e3 = new THREE.Euler();
      const v3 = new THREE.Vector3();
      let n = 0;
      slots.forEach((sl) => {
        const ang = sl.a + Math.PI;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        gse.forEach(([lx, lz, w, d, tone]) => {
          if (rnd() < 0.3) return;
          const x = sl.p[0] + (lx * ca + lz * sa) * sl.s, z = sl.p[1] + (-lx * sa + lz * ca) * sl.s;
          m4.compose(v3.set(x, 0, z), q.setFromEuler(e3.set(0, ang, 0)), new THREE.Vector3(w, mh(2.2), d));
          vm.setMatrixAt(n, m4);
          vm.setColorAt(n, c.setRGB(...(tone > 0.8 ? [tone, tone, tone * 0.98] : [0.96, 0.78, 0.2])));
          n++;
        });
      });
      vm.count = n;
      fleet.add(vm);
    }
  }

  /* ── life on the plate and the close dioramas: traffic on the roads, aircraft taxiing, one taking off from 08L and
     one landing on 26L, all on the field's own runways, taxiways and streets ── */
  const life = new THREE.Group();
  group.add(life);
  const TS = 1.6; // a little faster than life, so a reader sees a take-off within a chapter
  const trackOf = (pts) => {
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 1e-6) continue;
      seg.push({ ax, az, dx: (bx - ax) / l, dz: (bz - az) / l, l, s0: total });
      total += l;
    }
    return { seg, total };
  };
  const along = (tr, s, out) => {
    let k = tr.seg.length - 1;
    for (let i = 0; i < tr.seg.length; i++) if (s < tr.seg[i].s0 + tr.seg[i].l) { k = i; break; }
    const g = tr.seg[k];
    const t = Math.min(g.l, Math.max(0, s - g.s0));
    out[0] = g.ax + g.dx * t; out[1] = g.az + g.dz * t; out[2] = g.dx; out[3] = g.dz;
    return out;
  };
  const tmp4 = [0, 0, 0, 0];
  // cars: on the streets round the terminals, each running its street end to end
  const streets = model.roads.map((r) => ({ w: r.w, tr: trackOf(r.g.map(L)) })).filter((r) => r.tr.total > 0.12 && r.tr.seg.some((g) => Math.hypot(g.ax, g.az) < 1.4));
  const carList = [];
  streets.forEach((r) => {
    const n = Math.max(1, Math.round(r.tr.total / (r.w >= 9 ? 0.07 : 0.16)));
    for (let i = 0; i < n && carList.length < 140; i++) carList.push({ r, s: rnd() * r.tr.total, v: (0.009 + rnd() * 0.006) * (r.w >= 9 ? 1.4 : 1), side: r.w >= 9 ? (rnd() < 0.5 ? -1 : 1) : 0 });
  });
  const carMesh = (() => {
    if (!carList.length) return null;
    const cg = new THREE.BoxGeometry(0.0018, mh(1.5) * 0.4, 0.0044);
    cg.translate(0, mh(1.5) * 0.2, 0);
    const im = new THREE.InstancedMesh(cg, shade([1, 1, 1], [0.3, 0.36, 0.48]), carList.length);
    const pal = [[0.97, 0.97, 0.97], [0.97, 0.97, 0.97], [0.78, 0.8, 0.83], [0.2, 0.22, 0.25], [0.5, 0.53, 0.57], [0.2, 0.28, 0.45], [0.7, 0.15, 0.15], [0.95, 0.8, 0.25]];
    const c = new THREE.Color();
    carList.forEach((u, i) => im.setColorAt(i, c.setRGB(...pal[Math.floor(rnd() * pal.length)])));
    im.frustumCulled = false;
    life.add(im);
    return im;
  })();
  // aircraft under way: two taxiing to and fro on the long taxiways, a departure and an arrival
  const plane = () => { const p = aircraft.group.clone(); life.add(p); return p; };
  const taxiways = model.taxiways.map((t) => trackOf(t.g.map(L))).filter((t) => t.total > 0.45).sort((a, b) => b.total - a.total).slice(0, 2);
  const taxiers = taxiways.map((tr, i) => ({ tr, p: plane(), s: i ? tr.total * 0.6 : 0.05, dir: i ? -1 : 1, v: 0.0085, wait: 0, turn: 0 }));
  const rw = model.runways.map((r) => { const a = L(r.g[0]), b = L(r.g[r.g.length - 1]); const len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, len, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] }; });
  const dep = { p: plane(), t: 0 };
  const arr = { p: plane(), t: 0 };
  const m4l = new THREE.Matrix4();
  const ql = new THREE.Quaternion();
  const el3 = new THREE.Euler();
  const pl3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  // the nose leads: the model's fuselage runs down +z from the nose
  const place = (obj, x, y, z, dx, dz, pitch = 0, k = 1) => {
    obj.visible = k > 0.02;
    obj.position.set(x, y, z);
    obj.rotation.set(pitch, Math.atan2(-dx, -dz), 0, 'YXZ');
    obj.scale.set(k, 1.8 * k, k);
  };
  const ease = (x) => x * x * (3 - 2 * x);
  const update = (dt) => {
    const d = Math.min(0.05, dt) * TS;
    // traffic
    if (carMesh) {
      carList.forEach((u, i) => {
        u.s += u.v * d;
        if (u.s > u.r.tr.total) u.s -= u.r.tr.total;
        const [x, z, dx, dz] = along(u.r.tr, u.s, tmp4);
        const off = u.side * 0.0026;
        m4l.compose(pl3.set(x - dz * off, 0, z + dx * off), ql.setFromEuler(el3.set(0, Math.atan2(dx, dz), 0)), one);
        carMesh.setMatrixAt(i, m4l);
      });
      carMesh.instanceMatrix.needsUpdate = true;
    }
    // taxiing: on to the end, a pause, a slow turn about, and back
    taxiers.forEach((u) => {
      if (u.wait > 0) { u.wait -= d; u.turn = Math.min(1, u.turn + d / 4); }
      else {
        u.s += u.dir * u.v * d;
        if (u.s > u.tr.total - 0.02 || u.s < 0.02) { u.s = Math.min(u.tr.total - 0.02, Math.max(0.02, u.s)); u.dir *= -1; u.wait = 5; u.turn = 0; }
      }
      const [x, z, dx, dz] = along(u.tr, u.s, tmp4);
      // during the pause the heading swings round from the old direction to the new one
      const sw = u.wait > 0 ? 1 - ease(u.turn) : 0;
      const h = Math.atan2(dx * u.dir, dz * u.dir) + sw * Math.PI;
      place(u.p, x, 0, z, Math.sin(h), Math.cos(h));
    });
    // departure, 08L: line up, roll, rotate, climb out; a pause; again
    if (rw[0]) {
      const r = rw[0];
      dep.t += d;
      const t = dep.t;
      const hold = 8, acc = 0.0024, vr = 0.074;
      const tr = vr / acc;
      let s, y = 0, pitch = 0, k = Math.min(1, t / 1.5);
      if (t < hold) s = 0.25;
      else if (t < hold + tr) s = 0.25 + 0.5 * acc * (t - hold) ** 2;
      else {
        const tc = t - hold - tr;
        s = 0.25 + 0.5 * acc * tr * tr + 0.08 * tc;
        // about 8 degrees up at 80 m/s, the nose raised
        y = mh(Math.min(900, 11 * tc));
        pitch = Math.min(0.16, tc * 0.08);
        if (tc > 32) k = Math.max(0, 1 - (tc - 32) / 3);
        if (tc > 44) dep.t = 0;
      }
      place(dep.p, r.a[0] + r.u[0] * s, y, r.a[1] + r.u[1] * s, r.u[0], r.u[1], pitch, k);
    }
    // arrival, 26L: on the glide path from the east, flare, touchdown, roll-out, off the runway
    if (rw[1]) {
      const r = rw[1];
      arr.t += d;
      const t = arr.t;
      const ux = -r.u[0], uz = -r.u[1];
      const td = 0.35; // touchdown, km past the threshold
      const app = 34; // seconds on the approach
      let s, y = 0, pitch = 0, k = 1;
      if (t < app) {
        const left = (app - t) * 0.07;
        s = td - left;
        y = mh(left * 1000 * 0.0524);
        pitch = 0.03;
        k = Math.min(1, t / 2);
      } else {
        const tr2 = t - app;
        const v0 = 0.07, dec = 0.0026;
        const tstop = (v0 - 0.012) / dec;
        s = tr2 < tstop ? td + v0 * tr2 - 0.5 * dec * tr2 * tr2 : td + v0 * tstop - 0.5 * dec * tstop * tstop + 0.012 * (tr2 - tstop);
        if (tr2 > tstop + 6) k = Math.max(0, 1 - (tr2 - tstop - 6) / 2);
        if (tr2 > tstop + 16) arr.t = 0;
      }
      // the arrival runs the runway backwards, from its east threshold
      place(arr.p, r.b[0] + ux * s, y, r.b[1] + uz * s, ux, uz, pitch, k);
    }
  };
  // the departure and the arrival start out of step
  arr.t = 20;

  /* ── surroundings (plate only): trees, parked cars, the flag at the roundabout ── */
  const context = groups.context;
  const scatter = (rings, step, keep, cap) => {
    const out = [];
    rings.forEach((r) => {
      const pts = r.map(L);
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      for (let x = Math.min(...xs); x < Math.max(...xs); x += step) {
        for (let z = Math.min(...zs); z < Math.max(...zs); z += step) {
          const p = [x + (rnd() - 0.5) * step * 0.8, z + (rnd() - 0.5) * step * 0.8];
          if (rnd() < keep && insideRing(p, pts) && out.length < cap) out.push(p);
        }
      }
    });
    return out;
  };
  const near = (r, d) => r.some(([x, z]) => Math.hypot(x, z) < d * 1000);
  const treePts = [...model.trees.map(L), ...scatter(model.wood.filter((r) => near(r, 1.2)), 0.007, 0.9, 1500), ...scatter(model.grass.filter((r) => near(r, 0.9)), 0.016, 0.35, 500)];
  if (treePts.length) {
    const tg = new THREE.IcosahedronGeometry(1, 1);
    const trees = new THREE.InstancedMesh(tg, shade([1, 1, 1], [0.12, 0.2, 0.2]), treePts.length);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    treePts.forEach(([x, z], i) => {
      const r = 0.0026 + rnd() * 0.0024;
      m4.compose(new THREE.Vector3(x, r * 1.4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(r, r * 1.5, r));
      trees.setMatrixAt(i, m4);
      c.setRGB(0.24 + rnd() * 0.08, 0.36 + rnd() * 0.1, 0.18 + rnd() * 0.06);
      trees.setColorAt(i, c);
    });
    context.add(trees);
  }
  // parked cars: rows across each car park, about two in three bays taken
  const carPts = [];
  model.parking.forEach((r) => {
    const pts = r.map(L);
    let best = 0, ang = 0;
    for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; const d = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); if (d > best) { best = d; ang = Math.atan2(q[1] - pts[i][1], q[0] - pts[i][0]); } }
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const us = pts.map(([x, z]) => x * ca + z * sa), vs = pts.map(([x, z]) => -x * sa + z * ca);
    for (let u = Math.min(...us) + 0.002; u < Math.max(...us); u += 0.0027) {
      for (let v = Math.min(...vs) + 0.003; v < Math.max(...vs); v += 0.0065) {
        const p = [u * ca - v * sa, u * sa + v * ca];
        if (rnd() < 0.66 && insideRing(p, pts) && carPts.length < 2200) carPts.push([...p, ang]);
      }
    }
  });
  if (carPts.length) {
    const cg = new THREE.BoxGeometry(0.0018, mh(1.5) * 0.4, 0.0044);
    cg.translate(0, mh(1.5) * 0.2, 0);
    const cars = new THREE.InstancedMesh(cg, shade([1, 1, 1], [0.3, 0.36, 0.48]), carPts.length);
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
  // flagpoles: the 65 m national flag at the roundabout, and the row of flags before Terminal 1
  {
    const pole = shade([0.92, 0.93, 0.94], [0.3, 0.38, 0.5]);
    const flagTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 32;
      const x = cv.getContext('2d');
      [['#0099b5', 0, 10], ['#ce1126', 10, 1], ['#ffffff', 11, 10], ['#ce1126', 21, 1], ['#1eb53a', 22, 10]].forEach(([c, y, h]) => { x.fillStyle = c; x.fillRect(0, y, 64, h); });
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide });
    model.flags.forEach((f) => {
      const [x, z] = L(f.p);
      const h = mh(f.h) * 0.6;
      const r = f.h > 30 ? 0.0012 : 0.00035;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, h, 8), pole);
      p.position.set(x, h / 2, z);
      context.add(p);
      const fw = f.h > 30 ? 0.03 : 0.006;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(fw, fw / 2), flagMat);
      fl.position.set(x + fw / 2, h - fw / 4, z);
      context.add(fl);
    });
  }

  group.position.set(hx, hubWorld.y, hz);

  // where a zone sits: a point in the hall's own frame (u along its long side, v across), resolved every frame
  const landN = new THREE.Vector2(-0.53, -0.848); // the departure hall faces the city to the north-north-west
  const zoneLocal = (terminal, spot, outdoor) => {
    const key = terminals[terminal] ? terminal : 'DEP';
    const t = terminals[key];
    if (key === 'T3') {
      // T3 sits 1.4 km south: its marker waits at the diagram's edge, on the bearing to it
      const d = terminals.DEP;
      const dx = t.c[0] - d.c[0], dz = t.c[1] - d.c[1];
      const k = ((d.u1 - d.u0) * 0.9) / Math.hypot(dx, dz);
      return new THREE.Vector3(d.c[0] + dx * k, 0.01, d.c[1] + dz * k);
    }
    if (outdoor) return new THREE.Vector3(t.c[0] + landN.x * 0.1, 0.01, t.c[1] + landN.y * 0.1);
    const u = t.u0 + spot[0] * (t.u1 - t.u0);
    const v = t.v0 + spot[1] * (t.v1 - t.v0);
    return new THREE.Vector3(t.c[0] + t.u[0] * u + t.v[0] * v, t.top * 1.02, t.c[1] + t.u[1] * u + t.v[1] * v);
  };

  const setNight = (n) => {
    [...mats].forEach((m) => (m.uniforms.uNight.value = n));
    bmats.forEach((m) => (m.uniforms.uNight.value = n));
    const ink = INK_D.clone().lerp(INK_N, n);
    inks.forEach((m) => m.color.copy(ink));
    flatMats.forEach((m) => m.uniforms.uColor.value.copy(m.userData.day).lerp(m.userData.night, n));
  };
  const setHot = () => {};
  // hero: the hall stands for the airport; plate: the full model; T3 waits off-diagram
  let mode = { hero: 0, plate: 0, solo: 0 };
  // solo: the hall stands on its own over the map (Fly TV, Media Gate chapters): no airfield, no far terminal
  const setSymbol = (k, plate = 0, solo = 0) => {
    mode = { hero: k, plate, solo };
    flat.visible = k < 0.5 && plate < 0.15 && solo < 0.3;
    fleet.visible = flat.visible;
    groups.airside.visible = flat.visible;
    plateLand.visible = false;
    context.visible = false;
    // on the plate, everything beyond the hall is drawn only inside the field (the plate pass), never across the map
    groups.gates.visible = plate < 0.32;
    groups.far.visible = k < 0.5 && plate < 0.32;
    groups.t1.visible = k < 0.5 && plate < 0.32;
    groups.t3.visible = k < 0.5 && plate < 0.5 && solo < 0.3;
    // once the plate holds the screen the hall is drawn inside its frame only: turned or zoomed, it never spills out
    groups.hall.visible = plate < 0.5;
    life.visible = false;
  };
  // the field is alive (and the chart must keep drawing) only while the plate or a close diorama shows it
  const alive = () => mode.hero < 0.5 && (mode.plate > 0.15 || mode.solo > 0.3);
  // the plate pass draws the ground, the city round the field and the fleet too, faded with the field
  const plateOn = (fo) => {
    const show = mode.hero < 0.5;
    flat.visible = show;
    fleet.visible = show;
    groups.airside.visible = show;
    plateLand.visible = show;
    context.visible = show;
    groups.gates.visible = true;
    groups.hall.visible = true;
    groups.far.visible = show;
    groups.t1.visible = show;
    life.visible = show;
    flatMats.forEach((m) => (m.uniforms.uOpacity.value = m.userData.base * fo));
  };
  const plateOff = () => {
    flatMats.forEach((m) => (m.uniforms.uOpacity.value = m.userData.base));
    setSymbol(mode.hero, mode.plate, mode.solo);
  };

  // the diorama pass, drawn over the chart with its ground fading out at the edge:
  // - the hero: the whole airfield as a model on the map (both runways, the aprons and their aircraft, every
  //   terminal and hangar), as the field looks from the air, centred on the field
  // - Fly TV and Media Gate (and the airport chapter on a phone): the terminal complex, close up
  const DISC_R = [0.62, 1.15];
  // the hero's ellipse: about 2.3 km either way along the runways, a kilometre across them
  const HERO_R = [2.3, 2.75];
  const HERO_S = 2.35;
  const discK = () => (mode.hero > 0.02 ? Math.min(1, mode.hero * 4) : mode.hero < 0.5 ? Math.min(1, mode.solo * 1.6) : 0);
  const discOn = (k) => {
    const hero = mode.hero > 0.02;
    flat.visible = true;
    marks.visible = !hero;
    fleet.visible = true;
    groups.airside.visible = true;
    // the hero's field stands straight on the chart (its own paving and grass fading out), no plinth under it
    plateLand.visible = !hero;
    // the town round the field (its trees, parked cars, flags) is metre-scale: close views only
    context.visible = !hero;
    groups.gates.visible = true;
    groups.hall.visible = true;
    groups.far.visible = true;
    groups.t1.visible = true;
    groups.t3.visible = hero;
    life.visible = !hero;
    flatMats.forEach((m) => (m.uniforms.uOpacity.value = m.userData.base * k));
    // diving from the hero onto the plate the field gathers in onto the terminal complex: the disc shrinks from the
    // whole airfield to the plate's own round, so the outer buildings leave one by one instead of all at once
    const t = hero ? Math.min(1, mode.hero * 2) : 0;
    const e = t * t * (3 - 2 * t);
    const cx = fieldC[0] * e, cz = fieldC[1] * e;
    const r0 = DISC_R[0] + (HERO_R[0] - DISC_R[0]) * e;
    const r1 = DISC_R[1] + (HERO_R[1] - DISC_R[1]) * e;
    discS.value.set(1, 1 + (HERO_S - 1) * e);
    disc.value.set(cx, cz, r0, r1);
    group.updateMatrixWorld();
    group.getWorldScale(scaleNow);
    origin.value.setFromMatrixPosition(group.matrixWorld);
    shadeDisc.value.set(cx * scaleNow.x, cz * scaleNow.x, r0 * scaleNow.x, r1 * scaleNow.x);
  };
  const discOff = () => {
    disc.value.set(0, 0, 0, 0);
    shadeDisc.value.set(0, 0, 0, 0);
    marks.visible = true;
    plateOff();
  };

  // for the loader's shader compile: every part shown at once, so no program is left to compile mid-scroll
  const showAll = () => {
    [flat, fleet, plateLand, life, ...Object.values(groups)].forEach((g) => (g.visible = true));
    return () => setSymbol(mode.hero, mode.plate, mode.solo);
  };

  const parts = [flat, fleet, plateLand, life, ...Object.values(groups)];
  return { group, origin: model.o, fieldC, parts, update, alive, zoneLocal, rwLabels, setNight, setHot, setSymbol, plateOn, plateOff, discK, discOn, discOff, showAll, terminals };
}

// An A320-class airliner in km, nose at the origin, fuselage running down +z.
// Returns a group (for the four aircraft at the jet bridges) and two merged geometries for the instanced fleet.
function makeAircraft(shade) {
  const bodyM = shade([0.97, 0.98, 1.0], [0.36, 0.45, 0.6]);
  const tailM = shade([0.09, 0.27, 0.55], [0.5, 0.62, 0.8]);
  const r = 0.00198;
  const flatShape = (pts, depth) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false });
  const wing = (pts, y, d) => {
    const geo = flatShape([...pts, ...pts.slice().reverse().map(([x, z]) => [-x, z])], d);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y + d, 0);
    return geo;
  };
  const lift = r + 0.0012;
  const parts = [
    new THREE.CylinderGeometry(r, r, 0.027, 14).rotateX(Math.PI / 2).translate(0, 0, 0.0175),
    new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 2).translate(0, 0, 0.004),
    new THREE.ConeGeometry(r, 0.0062, 14).rotateX(Math.PI / 2).translate(0, 0.0004, 0.0341),
    wing([[0.0018, 0.0135], [0.0172, 0.0215], [0.0172, 0.0232], [0.0018, 0.0212]], -0.0011, 0.0003),
    wing([[0.0008, 0.0318], [0.0063, 0.0352], [0.0063, 0.0362], [0.0008, 0.0352]], 0.0004, 0.00022),
    new THREE.CylinderGeometry(0.00085, 0.00075, 0.0042, 12).rotateX(Math.PI / 2).translate(0.0057, -0.0016, 0.0148),
    new THREE.CylinderGeometry(0.00085, 0.00075, 0.0042, 12).rotateX(Math.PI / 2).translate(-0.0057, -0.0016, 0.0148),
  ].map((g) => { g.deleteAttribute('uv'); return (g.index ? g.toNonIndexed() : g).translate(0, lift, 0); });
  const finGeo = flatShape([[0.0303, 0], [0.0352, 0.0058], [0.0371, 0.0058], [0.0372, 0]], 0.0003);
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.00015, r * 0.85 + lift, 0);
  finGeo.deleteAttribute('uv');
  const body = mergeGeometries(parts);
  const tail = finGeo.index ? finGeo.toNonIndexed() : finGeo;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(body, bodyM), new THREE.Mesh(tail, tailM));
  group.scale.set(1, 1.8, 1);
  return { group, body, tail };
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// shared with the head office's neighbourhood (office.js)
export const SHADERS = { bldVert, bldFrag, groundVert, groundFrag, shadeVert, shadeFrag };
