// แร่/หุ่นสอบ/ประตู — สร้างจากทรงพื้นฐานของ Three.js (ไม่มีไฟล์โมเดล); ผู้เล่นใช้โมเดล KayKit ใน adventurers.js
// ทุกตัวหันหน้าไปทาง +Z
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';


const mats = new Map();
export const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o })); return mats.get(k); };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();

// รวมหลายทรงเป็นเมชเดียว (สีเก็บใน vertex color) — ลดจำนวน draw call ของมอนจำนวนมาก
export function merge(parts) {
  const geos = parts.map(({ g, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const geo = g.clone(), c = new THREE.Color(color), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geo.applyMatrix4(M4.compose(new THREE.Vector3(...p), Q.setFromEuler(E.set(...r)), new THREE.Vector3(...s)));
    return geo;
  });
  return mergeGeometries(geos);
}
const part = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const G = { // ทรงที่ใช้ซ้ำ
  sphere: new THREE.SphereGeometry(1, 20, 14), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cap: (r, h) => new THREE.CapsuleGeometry(r, h, 6, 12), capHair: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), torus: new THREE.TorusGeometry(1, 0.2, 8, 20),
};
const sc = (m, x, y = x, z = x) => { m.scale.set(x, y, z); return m; };

// ---------- แร่มานา / หุ่นสอบ ----------
const crystalGeo = merge([
  { g: G.cone, color: '#3fa9f5', p: [-0.15, 0.2, 0.05], r: [0.1, 0, 0.15], s: [0.1, 0.46, 0.1] }, { g: G.cone, color: '#8fd6ff', p: [0.02, 0.3, 0], s: [0.13, 0.62, 0.13] },
  { g: G.cone, color: '#3fa9f5', p: [0.17, 0.17, -0.04], r: [-0.1, 0, -0.2], s: [0.09, 0.4, 0.09] }, { g: G.cone, color: '#6cc4ff', p: [0.0, 0.14, 0.17], r: [0.4, 0, 0], s: [0.08, 0.3, 0.08] },
]);
export function buildNode() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, emissive: 0x1a6fb0, emissiveIntensity: 0.9 });
  const root = new THREE.Group(); root.add(part(crystalGeo, m), sc(part(G.sphere, mat('#707782'), 0, 0.03, 0), 0.2, 0.07, 0.2));
  return { root, m };
}
export function buildDummy() {
  const root = new THREE.Group(), wood = mat('#7a5230'), straw = mat('#d9b45a');
  root.add(sc(part(G.cyl, wood, 0, 0.3, 0), 0.04, 0.6, 0.04), sc(part(G.box, wood, 0, 0.42, 0), 0.5, 0.05, 0.05), sc(part(G.cap(0.11, 0.18), straw, 0, 0.36, 0), 1, 1, 0.9),
    sc(part(G.cyl, mat('#cc3333'), 0, 0.37, 0.105), 0.09, 0.012, 0.09).rotateX(Math.PI / 2), sc(part(G.sphere, mat('#c8b27a'), 0, 0.62, 0), 0.085));
  root.scale.setScalar(1.3);
  return { root };
}

export function buildPortal() { // วงประตู Gate: แหวนเรืองแสงหมุน + แสงพื้น
  const g = new THREE.Group(), glow = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 10, 40), glow(0x6dffa8)), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 40), glow(0xb8ffd0));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.58, 40), new THREE.MeshBasicMaterial({ color: 0x2ee07a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  r1.position.y = r2.position.y = disc.position.y = 0.7; g.add(r1, r2, disc);
  g.userData = { r1, r2, disc };
  return g;
}
