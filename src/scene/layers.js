import * as THREE from 'three';
import { toXZ, EXAG } from './geo.js';

const RED = new THREE.Vector3(0.89, 0.0, 0.059);
const RED_N = new THREE.Vector3(1.0, 0.17, 0.23);

export const worldAt = (lon, lat, sample, lift = 0) => {
  const [x, z] = toXZ(lon, lat);
  return new THREE.Vector3(x, (Math.max(0, sample(lon, lat)) / 1000) * EXAG + lift, z);
};

/* ───── Red routes, hub-and-spoke from TAS ───── */
const routeVert = /* glsl */ `
  uniform float uWidth, uMinR;
  attribute vec3 aCenter;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normal;
    float dist = length(cameraPosition - aCenter);
    float r = max(uMinR, dist * uWidth);
    vec3 p = aCenter + normal * r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const routeFrag = /* glsl */ `
  uniform float uProgress, uTime, uOpacity, uNight, uFocus;
  uniform vec3 uRed, uRedN;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    if (vUv.x > uProgress) discard;
    vec3 red = mix(uRed, uRedN, uNight);
    float light = 0.78 + 0.22 * clamp(vN.y * 0.5 + 0.6, 0.0, 1.0);
    float pulse = exp(-pow((fract(vUv.x * 1.0 - uTime * 0.16) - 0.5) * 16.0, 2.0));
    vec3 col = red * light + pulse * mix(vec3(0.45, 0.3, 0.3), vec3(0.6, 0.5, 0.45), uNight) * (0.4 + uFocus * 0.6);
    float head = smoothstep(uProgress - 0.02, uProgress, vUv.x);
    col += head * 0.25;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function createRoutes(hub, targets, sample) {
  const group = new THREE.Group();
  const arcs = new Map();
  const a = worldAt(hub[0], hub[1], sample, 0.25);
  targets.forEach(({ key, p }) => {
    const b = worldAt(p[0], p[1], sample, 0.25);
    const dist = a.distanceTo(b);
    const lift = 1.2 + dist * 0.045;
    const c1 = a.clone().lerp(b, 0.28).add(new THREE.Vector3(0, lift, 0));
    const c2 = a.clone().lerp(b, 0.72).add(new THREE.Vector3(0, lift * 0.92, 0));
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    const geo = new THREE.TubeGeometry(curve, 160, 1, 10, false);
    // store centre-line point per vertex so the shader can hold a constant screen width
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const centers = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      centers[i * 3] = pos.getX(i) - nor.getX(i);
      centers[i * 3 + 1] = pos.getY(i) - nor.getY(i);
      centers[i * 3 + 2] = pos.getZ(i) - nor.getZ(i);
    }
    geo.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
    const uniforms = {
      uProgress: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uNight: { value: 0 }, uFocus: { value: 0 },
      uWidth: { value: 0.00105 }, uMinR: { value: 0.004 }, uRed: { value: RED }, uRedN: { value: RED_N },
    };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: routeVert, fragmentShader: routeFrag, uniforms, transparent: true, depthWrite: false }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    group.add(mesh);
    arcs.set(key, { mesh, uniforms, curve, end: b });
  });
  return { group, arcs };
}

/* ───── Venue icons (Korzinka stores, HoReCa venues) ───── */
function iconAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * 2;
  c.height = S;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // Korzinka: red tile with a basket
  g.save();
  g.shadowColor = 'rgba(16,40,72,0.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
  rr(18, 14, 92, 92, 22); g.fillStyle = '#163b67'; g.fill();
  g.restore();
  g.lineWidth = 6; g.strokeStyle = '#fff'; rr(18, 14, 92, 92, 22); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(36, 44); g.lineTo(46, 44); g.lineTo(56, 78); g.lineTo(88, 78); g.lineTo(95, 54); g.lineTo(50, 54); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(60, 90, 5.5, 0, 7); g.arc(84, 90, 5.5, 0, 7); g.fill();
  // HoReCa: navy disc with fork and knife
  g.save();
  g.translate(S, 0);
  g.shadowColor = 'rgba(16,40,72,0.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
  g.beginPath(); g.arc(64, 60, 46, 0, 7); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
  g.save();
  g.translate(S, 0);
  g.lineWidth = 7; g.strokeStyle = '#163b67'; g.beginPath(); g.arc(64, 60, 42, 0, 7); g.stroke();
  g.strokeStyle = '#163b67'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(50, 38); g.lineTo(50, 54); g.moveTo(44, 38); g.lineTo(44, 50); g.quadraticCurveTo(44, 58, 50, 58); g.quadraticCurveTo(56, 58, 56, 50); g.lineTo(56, 38); g.moveTo(50, 58); g.lineTo(50, 84); g.stroke();
  g.beginPath(); g.moveTo(78, 84); g.lineTo(78, 38); g.quadraticCurveTo(88, 46, 86, 64); g.lineTo(78, 64); g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
const iconVert = /* glsl */ `
  uniform float uSize, uPx;
  attribute float aType, aSeed;
  varying float vType;
  void main() {
    vType = aType;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPx;
  }
`;
const iconFrag = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uOpacity;
  varying float vType;
  void main() {
    vec2 uv = vec2((gl_PointCoord.x + vType) * 0.5, 1.0 - gl_PointCoord.y);
    vec4 c = texture2D(uAtlas, uv);
    if (c.a < 0.02) discard;
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  }
`;
export function createIcons(list, sample, type) {
  const pos = new Float32Array(list.length * 3);
  const typ = new Float32Array(list.length).fill(type);
  list.forEach((p, i) => {
    const v = worldAt(p[0], p[1], sample, 0.3);
    pos.set([v.x, v.y, v.z], i * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aType', new THREE.BufferAttribute(typ, 1));
  const uniforms = { uSize: { value: 22 }, uPx: { value: 1 }, uOpacity: { value: 0 }, uAtlas: { value: iconAtlas() } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: iconVert, fragmentShader: iconFrag, uniforms, transparent: true, depthWrite: false, depthTest: false }));
  pts.frustumCulled = false;
  pts.renderOrder = 9;
  return { points: pts, uniforms };
}

/* ───── Compass rose at TAS ───── */
function compassCanvas() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const R = S / 2;
  g.translate(R, R);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 6;
  g.beginPath(); g.arc(0, 0, R - 8, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, R - 92, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.42, 0, Math.PI * 2); g.stroke();
  for (let d = 0; d < 360; d += 2) {
    const a = (d * Math.PI) / 180;
    const len = d % 30 === 0 ? 54 : d % 10 === 0 ? 38 : 20;
    g.lineWidth = d % 10 === 0 ? 4 : 2.2;
    g.beginPath();
    g.moveTo(Math.sin(a) * (R - 12), -Math.cos(a) * (R - 12));
    g.lineTo(Math.sin(a) * (R - 12 - len), -Math.cos(a) * (R - 12 - len));
    g.stroke();
  }
  g.font = '700 44px "Sofia Sans Condensed Variable", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let d = 30; d < 360; d += 30) {
    if (d % 90 === 0) continue;
    const a = (d * Math.PI) / 180;
    g.save();
    g.rotate(a);
    g.fillText(String(d).padStart(3, '0'), 0, -(R - 126));
    g.restore();
  }
  g.font = '800 70px "Sofia Sans Condensed Variable", sans-serif';
  ['N', 'E', 'S', 'W'].forEach((l, i) => {
    g.save();
    g.rotate((i * Math.PI) / 2);
    g.fillText(l, 0, -(R - 132));
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}
const flatVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const flatFrag = /* glsl */ `
  uniform sampler2D uMap; uniform float uNight, uOpacity;
  varying vec2 vUv;
  void main(){
    float a = texture2D(uMap, vUv).a;
    vec3 ink = mix(vec3(0.086,0.231,0.404), vec3(0.72,0.82,0.94), uNight);
    gl_FragColor = vec4(ink, a * uOpacity);
  }
`;
export function createCompass(center, radius) {
  const uniforms = { uMap: { value: compassCanvas() }, uNight: { value: 0 }, uOpacity: { value: 0.92 } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.ShaderMaterial({ vertexShader: flatVert, fragmentShader: flatFrag, uniforms, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(center);
  m.renderOrder = 3;
  // redraw once the chart face has loaded so numerals use it
  document.fonts?.ready.then(() => { uniforms.uMap.value = compassCanvas(); });
  return { mesh: m, uniforms };
}
