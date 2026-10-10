import * as THREE from 'three';
import { SHADERS } from './airport.js';

/* ───── The head office: Nest One, block C, and its neighbourhood ─────
   From OpenStreetMap 3D building parts (scripts/data/office_model.py): the Nest One towers in silver glass, block C
   in the holding's indigo with a red ring at its foot, the towers and blocks around, the Ankhor canal, parks, trees
   and streets, all as a diorama whose ground fades into the chart. Loaded only when the About page opens, drawn in
   its own pass over the chart while the contact block holds the screen. */

const HEX = 1.25;
const KM = 1 / 1000;
const mh = (m) => m * KM * HEX;
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
  mark: [[0.97, 0.97, 0.95], [0.5, 0.56, 0.66]],
};
// layer heights for the ground fills, as in officeWorker.js
const Y = (i) => 0.0002 + i * 0.00006;

export function createOffice({ worldAt, compile }) {
  const group = new THREE.Group();
  group.visible = false;
  const disc = { value: new THREE.Vector4(0, 0, DISC_R[0], DISC_R[1]) };
  const shadeDisc = { value: new THREE.Vector4(0, 0, DISC_R[0], DISC_R[1]) };
  const discS = { value: new THREE.Vector2(1, 1) };
  const origin = { value: new THREE.Vector3() };
  const grounds = [];
  const mats = [];
  let built = null;
  let want = false;
  const state = { k: 0, anchor: null };

  const ground = (key, { opacity = 1, grain = 0.08, scale = 220, order = 1 } = {}) => {
    const [day, night] = C[key];
    const m = new THREE.ShaderMaterial({
      vertexShader: SHADERS.groundVert, fragmentShader: SHADERS.groundFrag,
      uniforms: { uColor: { value: new THREE.Color(...day) }, uOpacity: { value: opacity }, uGrain: { value: grain }, uScale: { value: scale }, uDisc: disc, uDiscS: discS },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    m.userData = { day: new THREE.Color(...day), night: new THREE.Color(...night), base: opacity, order };
    grounds.push(m);
    return m;
  };
  const shade = (night) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: SHADERS.shadeVert, fragmentShader: SHADERS.shadeFrag,
      uniforms: { uDay: { value: new THREE.Color(1, 1, 1) }, uNightC: { value: new THREE.Color(...night) }, uNight: { value: 0 }, uLight: { value: LIGHT }, uOpacity: { value: 1 }, uDisc: shadeDisc, uDiscS: discS, uOrigin: origin },
    });
    mats.push(m);
    return m;
  };
  const addMesh = (pos, mat) => {
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = mat.userData.order;
    group.add(mesh);
  };
  const instanced = (geo, mat, { mat: m16, col }) => {
    const n = col.length / 3;
    if (!n) return;
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.instanceMatrix = new THREE.InstancedBufferAttribute(m16, 16);
    im.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
    im.frustumCulled = false;
    group.add(im);
  };

  // everything heavy (triangulating ~600 buildings, the ground layers, cars and trees) is done in officeWorker.js;
  // here the arrays only become meshes
  const build = (d) => {
    {
      // the city's own pavement, a square the disc rounds off
      const g = new THREE.PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, ground('land', { grain: 0.1, order: 0 }));
      mesh.renderOrder = 0;
      group.add(mesh);
    }
    const G = d.ground;
    addMesh(G.grass, ground('grass', { grain: 0.16, scale: 90, order: 1 }));
    addMesh(G.wood, ground('wood', { grain: 0.22, scale: 160, order: 1 }));
    addMesh(G.pitch, ground('pitch', { grain: 0.06, order: 2 }));
    addMesh(G.park, ground('park', { grain: 0.05, order: 2 }));
    const water = ground('water', { grain: 0.04, order: 3 });
    addMesh(G.water, water);
    addMesh(G.canal, water);
    addMesh(G.road, ground('road', { grain: 0.04, order: 3 }));
    addMesh(G.shadow, ground('shadow', { opacity: 0.28, grain: 0, order: 5 }));
    // lane dashes are under a metre wide: kept soft, a hard white line that thin would twinkle as the view sways
    addMesh(d.marks, ground('mark', { grain: 0, opacity: 0.55, order: 4 }));

    const bm = new THREE.ShaderMaterial({
      vertexShader: SHADERS.bldVert, fragmentShader: SHADERS.bldFrag,
      uniforms: { uNight: { value: 0 }, uStorey: { value: mh(3.6) }, uOpacity: { value: 1 }, uLight: { value: LIGHT }, uDisc: disc, uDiscS: discS },
    });
    mats.push(bm);
    const B = d.bld;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(B.nor, 3));
    bg.setAttribute('aRoof', new THREE.BufferAttribute(B.roof, 3));
    bg.setAttribute('aWall', new THREE.BufferAttribute(B.wall, 3));
    bg.setAttribute('aInfo', new THREE.BufferAttribute(B.info, 3));
    bg.setAttribute('aC', new THREE.BufferAttribute(B.c, 2));
    const bmesh = new THREE.Mesh(bg, bm);
    bmesh.renderOrder = 8;
    group.add(bmesh);

    const cg = new THREE.BoxGeometry(0.0019, 0.0016, 0.0045);
    cg.translate(0, 0.0008, 0);
    instanced(cg, shade([0.3, 0.36, 0.48]), d.cars);
    instanced(new THREE.IcosahedronGeometry(1, 1), shade([0.12, 0.2, 0.2]), d.trees);

    // block C: a red ring at its foot, the "you are here" of the chart
    const [ox, oz, oh] = d.office;
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
    // the pin floats above the block's roof, a leader line drawn down to it (CSS); set once the programs are ready,
    // which is what lets the neighbourhood show
    const anchor = new THREE.Vector3(at.x + ox, at.y + oh + 0.12, at.z + oz);
    return Promise.resolve(compile?.(group)).then(() => { state.anchor = anchor; return true; });
  };

  const load = () => {
    if (!built) {
      built = new Promise((resolve) => {
        const w = new Worker(new URL('./officeWorker.js', import.meta.url), { type: 'module' });
        w.onmessage = (e) => { w.terminate(); resolve(e.data.error ? null : build(e.data)); };
        w.onerror = () => { w.terminate(); resolve(null); };
        w.postMessage({ url: new URL('/data/office-model.json', location.href).href });
      });
    }
    return built;
  };

  return {
    group, load, state,
    show(on) { want = on; if (on) load(); },
    get k() { return state.k; },
    get anchor() { return state.anchor; },
    update(dt, night) {
      const target = want && state.anchor ? 1 : 0;
      state.k += (target - state.k) * Math.min(1, dt * 4.2);
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
