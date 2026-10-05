import * as THREE from 'three';
import { toXZ, toLonLat, EXAG, W, D, LONC, LATC, KX, KZ } from './geo.js';
import { loadHeights, buildOverlays, createTerrain, loadSatellite } from './terrain.js';
import satMeta from '../data/satellite.json';
import { createIcons, worldAt } from './layers.js';
import { createAirport } from './airport.js';
import { createDrapedLines, createRoute, createRoads } from './lines.js';

THREE.ColorManagement.enabled = false;

export const TAS = [69.2812, 41.2579];

// Camera poses: target lon/lat, distance (km), azimuth (deg, 0 = camera south of target looking north), elevation (deg).
// shift: horizontal frustum offset (fraction of width) so the subject clears the chapter's plate.
export const POSES = {
  intro: { t: [64.6, 41.4], dist: 1900, az: 0, el: 89.9, shift: 0 },
  hero: { t: [68.3, 40.6], dist: 820, az: 4, el: 42, shift: 0 },
  airport: { t: [69.2687, 41.2634], dist: 46, az: 33, el: 56, shift: 0.24 },
  korzinka: { t: [68.6, 40.8], dist: 1350, az: -6, el: 52, shift: -0.22 },
  horeca: { t: [69.26, 41.3], dist: 62, az: -10, el: 50, shift: 0.19 },
  regions: { t: [69.6, 40.35], dist: 1550, az: 8, el: 44, shift: -0.27 },
  plan: { t: [66.6, 40.9], dist: 1450, az: 0, el: 74, shift: 0 },
};

// The airport plate frames the whole terminal complex (hall, gallery, both gate piers and their aircraft) at
// PLATE.scale; the camera aims at the complex's middle, which sits PLATE.center km from the hall's centroid,
// and the view turns 33° so the complex runs down the plate.
export const PLATE = { scale: 44, center: [-0.035, 0.07] };
{
  const [x0, z0] = toXZ(69.2687, 41.2634);
  POSES.airport.t = toLonLat(x0 + PLATE.center[0] * PLATE.scale, z0 + PLATE.center[1] * PLATE.scale);
}

export async function createWorld(canvas, { data, onProgress, quality }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.dpr));
  const scene = new THREE.Scene();
  const bg = new THREE.Color(0.929, 0.949, 0.965);
  scene.background = bg;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 8000);

  // elevation and the whole-sheet imagery load together; the progress bar follows the larger of the two
  let pH = 0, pS = 0;
  const report = () => onProgress?.(0.15 + ((pH * 2 + pS * 1.3) / 3.3) * 0.72);
  const [heights, sat] = await Promise.all([
    loadHeights(quality.dem, (p) => { pH = p; report(); }),
    loadSatellite(satMeta, quality.dem < 2048, document.documentElement.dataset.theme === 'night', (p) => { pS = p; report(); }),
  ]);
  const overlays = buildOverlays(data.vectors, quality.overlay);
  onProgress?.(0.9);
  const terrain = createTerrain(heights, overlays, quality.seg, sat, [LONC, LATC, KX, KZ]);
  scene.add(terrain.mesh);

  const sample = heights.sample;
  const hubWorld = worldAt(TAS[0], TAS[1], sample, 0.06);

  const c = data.places.cities;
  const KAMCHIK = [70.53, 40.94];
  const ANGREN = [70.08, 41.02];
  const route = createRoute([
    { key: 'west', pts: [TAS, c.guliston, c.jizzax, c.samarqand, c.buxoro] },
    { key: 'south', pts: [c.samarqand, c.qarshi], delay: 0.45 },
    { key: 'tashreg', pts: [TAS, c.nurafshon] },
    { key: 'east', pts: [TAS, ANGREN, KAMCHIK, c.qoqon, c.margilon, c.fargona] },
    { key: 'valley', pts: [c.margilon, c.asaka, c.andijon, c.namangan], delay: 0.5 },
  ], sample);
  scene.add(route.group);

  const kor = createIcons(data.places.korzinka.map((k) => k.p), sample, 0);
  const hor = createIcons(data.places.horeca.map((h) => h.p), sample, 1);
  scene.add(kor.points, hor.points);

  terrain.uniforms.uHub.value.set(hubWorld.x, hubWorld.z);
  const airport = createAirport(data.places.airportPlan, data.airportDetail, hubWorld);
  scene.add(airport.group);
  const lines = createDrapedLines(data.vectors, sample);
  scene.add(lines.group);
  const roads = data.roads ? createRoads(data.roads, sample) : null;
  if (roads) scene.add(roads.group);

  // Camera state with damping
  const cur = { tx: 0, ty: 0, tz: 0, dist: 0, az: 0, el: 0, shift: 0 };
  const goal = { ...cur };
  const poseToState = (p, o = goal) => {
    const [x, z] = toXZ(p.t[0], p.t[1]);
    o.tx = x;
    o.tz = z;
    o.ty = (Math.max(0, sample(p.t[0], p.t[1])) / 1000) * EXAG;
    o.dist = p.dist;
    o.az = p.az;
    o.el = p.el;
    o.shift = matchMedia('(max-width: 960px)').matches ? 0 : p.shift || 0;
    return o;
  };
  poseToState(POSES.intro, cur);
  poseToState(POSES.intro, goal);

  const target = new THREE.Vector3();
  const applyCamera = () => {
    const az = (cur.az * Math.PI) / 180;
    const el = (cur.el * Math.PI) / 180;
    target.set(cur.tx, cur.ty, cur.tz);
    camera.position.set(
      cur.tx - Math.sin(az) * Math.cos(el) * cur.dist,
      cur.ty + Math.sin(el) * cur.dist,
      cur.tz + Math.cos(az) * Math.cos(el) * cur.dist,
    );
    camera.lookAt(target);
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    if (Math.abs(cur.shift) > 0.001) camera.setViewOffset(w, h, -cur.shift * rtl * w, 0, w, h);
    else camera.clearViewOffset();
    camera.near = Math.max(0.02, cur.dist * 0.004);
    camera.far = cur.dist * 8 + 1500;
    camera.updateProjectionMatrix();
  };

  // Pointer parallax
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const px = renderer.getPixelRatio();
    kor.uniforms.uPx.value = px;
    hor.uniforms.uPx.value = px;
  };
  resize();
  addEventListener('resize', resize);

  const state = { night: 0, parallax: 1, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  const v3 = new THREE.Vector3();
  const project = (world, out = {}) => {
    v3.copy(world).project(camera);
    out.x = (v3.x * 0.5 + 0.5) * innerWidth;
    out.y = (-v3.y * 0.5 + 0.5) * innerHeight;
    out.z = v3.z;
    out.visible = v3.z < 1 && v3.z > -1 && out.x > -200 && out.x < innerWidth + 200 && out.y > -200 && out.y < innerHeight + 200;
    out.dist = camera.position.distanceTo(world);
    return out;
  };

  // Screen point → lon/lat by ray-marching the relief once
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -5);
  const hit = new THREE.Vector3();
  const pick = (cx, cy) => {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    let [lon, lat] = toLonLat(hit.x, hit.z);
    const y = (Math.max(0, sample(lon, lat)) / 1000) * EXAG;
    plane.constant = -y;
    if (ray.ray.intersectPlane(plane, hit)) [lon, lat] = toLonLat(hit.x, hit.z);
    plane.constant = -5;
    if (Math.abs(hit.x) > W / 2 || Math.abs(hit.z) > D / 2) return null;
    return [lon, lat];
  };

  // The airport plate: an opaque field painted under the frame, and the airport drawn again inside it,
  // so map lines and the route never bleed through the diagram.
  const field = { opacity: 0, rect: [0, 0, 0, 0] };
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: { uRect: { value: new THREE.Vector4() }, uPx: { value: new THREE.Vector4() }, uRadius: { value: 30 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
    vertexShader: 'uniform vec4 uRect; void main(){ gl_Position = vec4(mix(uRect.xy, uRect.zw, uv), 0.0, 1.0); }',
    // the field follows the frame's rounded corners (rounded-rect distance in device pixels)
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uRadius; uniform vec4 uPx;
      void main(){
        vec2 c = (uPx.xy + uPx.zw) * 0.5; vec2 h = (uPx.zw - uPx.xy) * 0.5;
        vec2 q = abs(gl_FragCoord.xy - c) - h + uRadius;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
        gl_FragColor = vec4(uColor, uOpacity * (1.0 - smoothstep(-1.0, 0.5, d)));
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const fieldScene = new THREE.Scene();
  const fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fieldMat);
  fieldMesh.frustumCulled = false;
  fieldScene.add(fieldMesh);
  const vsize = new THREE.Vector2();
  const drawField = () => {
    if (field.opacity < 0.002) return;
    renderer.getSize(vsize);
    const [x, y, w, h] = field.rect;
    const W = vsize.x, H = vsize.y;
    fieldMat.uniforms.uRect.value.set((x / W) * 2 - 1, 1 - ((y + h) / H) * 2, ((x + w) / W) * 2 - 1, 1 - (y / H) * 2);
    const pr = renderer.getPixelRatio();
    fieldMat.uniforms.uPx.value.set(x * pr, (H - y - h) * pr, (x + w) * pr, (H - y) * pr);
    fieldMat.uniforms.uRadius.value = 30 * pr;
    fieldMat.uniforms.uColor.value.setRGB(0.969 + (0.051 - 0.969) * state.night, 0.976 + (0.11 - 0.976) * state.night, 0.984 + (0.192 - 0.984) * state.night);
    fieldMat.uniforms.uOpacity.value = field.opacity;
    renderer.autoClear = false;
    renderer.render(fieldScene, camera);
    renderer.clearDepth();
    renderer.setScissorTest(true);
    // inset by the corner radius top and bottom: the band and the foot cover those strips anyway
    renderer.setScissor(x, H - y - h + 30, w, h - 60);
    airport.plateOn(field.opacity);
    renderer.render(airport.group, camera);
    airport.plateOff();
    renderer.setScissorTest(false);
    renderer.autoClear = true;
  };

  const clock = new THREE.Clock();
  let running = true;
  const listeners = new Set();
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.elapsedTime;
    const k = state.reduced ? 1 : 1 - Math.pow(0.0009, dt);
    pointer.sx += (pointer.x - pointer.sx) * k * 0.6;
    pointer.sy += (pointer.y - pointer.sy) * k * 0.6;
    // ease the camera; distance in log space so long hops feel like a climb
    cur.tx += (goal.tx - cur.tx) * k;
    cur.ty += (goal.ty - cur.ty) * k;
    cur.tz += (goal.tz - cur.tz) * k;
    cur.dist = Math.exp(Math.log(cur.dist) + (Math.log(goal.dist) - Math.log(cur.dist)) * k);
    // pointer parallax is held at zero through the intro: at a top-down view any azimuth sway would turn the map
    // out of register with the loader's outline
    cur.az += (goal.az + pointer.sx * 2.2 * state.parallax - cur.az) * k;
    cur.el += (goal.el - pointer.sy * 1.4 * state.parallax - cur.el) * k;
    cur.shift += (goal.shift - cur.shift) * k;
    applyCamera();

    const u = terrain.uniforms;
    u.uCam.value.copy(camera.position);
    u.uNight.value = state.night;
    u.uFogNear.value = cur.dist * 0.95 + 60;
    u.uFogFar.value = cur.dist * 2.7 + 280;
    bg.setRGB(0.929 + (0.039 - 0.929) * state.night, 0.949 + (0.09 - 0.949) * state.night, 0.965 + (0.161 - 0.965) * state.night);
    route.update(state.night, renderer);
    airport.setNight(state.night);
    lines.update(state.night, renderer);
    if (roads) { roads.opacity = lines.opacity; roads.update(state.night, renderer, cur.dist); }

    listeners.forEach((fn) => fn(time, dt));
    renderer.render(scene, camera);
    drawField();
  };

  document.addEventListener('visibilitychange', () => {
    const vis = document.visibilityState === 'visible';
    if (vis && !running) { running = true; clock.getDelta(); loop(); }
    else if (!vis) running = false;
  });

  onProgress?.(1);

  return {
    renderer, scene, camera, sample, route, lines, roads, goal, cur, kor, hor, airport, terrain, hubWorld, state, field,
    setPose(p) { poseToState(p); },
    setGoal(g) { Object.assign(goal, g); },
    goalFromPose(p) { return poseToState(p, {}); },
    jump() { Object.assign(cur, goal); applyCamera(); },
    // finer imagery streams in after the intro and cross-fades over the whole-sheet layer
    async loadDetail(gsap) {
      if (await terrain.loadDetail()) gsap.to(terrain.uniforms.uDetail, { value: 1, duration: 1.6, ease: 'power2.inOut' });
    },
    // compile every shader and upload every texture before the first visible frame
    prewarm() { renderer.compile(scene, camera); renderer.render(scene, camera); },
    project, pick,
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() { loop(); },
    ready: () => !!state.ready,
    worldAt: (lon, lat, lift) => worldAt(lon, lat, sample, lift),
  };
}
