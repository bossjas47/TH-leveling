// ตัวละครผู้เล่น: โมเดลมีโครงกระดูกจาก KayKit Adventurers (CC0) + ท่าเดิน/วิ่ง/ยืน/ตาย จากชุด Rig_Medium
// ชุดฟรีไม่มีท่าโจมตี → ซ้อนท่าฟันบนกระดูกแขนเอง (ดู animateAdventurer)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const CHAR = { Fighter: 'Barbarian', Tank: 'Knight', Mage: 'Mage', Assassin: 'Rogue_Hooded', Healer: 'Ranger', Miner: 'Rogue' };
const GEAR = { // มือขวา / มือซ้าย
  Fighter: { r: 'axe_2handed' }, Tank: { r: 'sword_1handed', l: 'shield_round' }, Mage: { r: 'staff' },
  Assassin: { r: 'dagger', l: 'dagger' }, Healer: { r: 'wand', l: 'spellbook_closed' }, Miner: { r: 'axe_1handed' },
};
export const SCALE = 0.34; // โมเดลสูง ≈ 2.5 → ≈ 0.85 หน่วย (1 tile = 1 หน่วย)
let lib = null;

export async function loadAdventurers() {
  const L = new GLTFLoader(); lib = { chars: {}, weapons: {}, clips: {} };
  await Promise.all([
    ...[...new Set(Object.values(CHAR))].map(async (n) => { lib.chars[n] = (await L.loadAsync(`assets/chars/${n}.glb`)).scene; }),
    ...['Rig_Medium_General', 'Rig_Medium_MovementBasic'].map(async (n) => { for (const c of (await L.loadAsync(`assets/chars/${n}.glb`)).animations) lib.clips[c.name] = c; }),
    ...[...new Set(Object.values(GEAR).flatMap((g) => Object.values(g)))].map(async (n) => { lib.weapons[n] = (await L.loadAsync(`assets/chars/weapons/${n}.gltf`)).scene; }),
  ]);
}

export function buildAdventurer(job) {
  const model = clone(lib.chars[CHAR[job] ?? 'Barbarian']), root = new THREE.Group();
  model.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } }); // เมชมีโครงกระดูก: ปิด culling กันหายตอนท่าขยับ
  const slot = (n) => model.getObjectByName(n), // GLTFLoader ลบ "." ออกจากชื่อกระดูก: handslot.r → handslotr
     g = GEAR[job] ?? {};
  if (g.r) slot('handslotr')?.add(lib.weapons[g.r].clone());
  if (g.l) slot('handslotl')?.add(lib.weapons[g.l].clone());
  root.add(model); root.scale.setScalar(SCALE);
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const [k, name, once] of [['idle', 'Idle_A'], ['run', 'Running_A'], ['walk', 'Walking_B'], ['die', 'Death_A', true]]) {
    const a = mixer.clipAction(lib.clips[name]); if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } act[k] = a;
  }
  act.idle.play();
  return { root, mixer, act, cur: act.idle, arm: slot('upperarmr'), fore: slot('lowerarmr'), spine: slot('spine') };
}

// ก๊อปลิน/หัวหน้าก๊อปลิน: โมเดล KayKit ย้อมผิวเขียว (ชุดที่มีไม่มีโมเดลก๊อปลิน) — ได้โครงกระดูกและท่าทางครบเหมือนผู้เล่น
const tinted = new Map(); // วัสดุต้นฉบับ → วัสดุย้อมสี (ใช้ร่วมกันทุกตัว)
export function buildMonster(boss) {
  const r = buildAdventurer(boss ? 'Fighter' : 'Miner'), tint = boss ? '#7fae4a' : '#84c95a';
  r.root.traverse((o) => {
    if (!o.isMesh) return;
    const key = o.material.uuid + tint; if (!tinted.has(key)) { const m = o.material.clone(); m.color.set(tint); tinted.set(key, m); }
    o.material = tinted.get(key);
  });
  r.base = SCALE * (boss ? 1.75 : 0.82); r.root.scale.setScalar(r.base);
  return r;
}

function play(r, a, fade = 0.18) { // เปลี่ยนท่าแบบค่อยๆ กลืน
  if (r.cur === a) return;
  a.reset().setEffectiveWeight(1).play(); r.cur.crossFadeTo(a, fade, false); r.cur = a;
}

// a = { dt, moving, swing (0..1 | -1), down }
export function animateAdventurer(r, a) {
  play(r, a.down ? r.act.die : a.moving ? r.act.run : r.act.idle);
  r.act.run.timeScale = 1.9; // ฝีเท้าให้ทันความเร็วเดินจริงของเกม (โมเดลย่อส่วนลง)
  r.mixer.update(a.dt);
  if (a.swing >= 0 && !a.down) { // ท่าฟัน: ยกแขนขวาขึ้นแล้วสับลง (ซ้อนบนท่าที่เล่นอยู่)
    const k = a.swing < 0.4 ? a.swing / 0.4 : 1 - (a.swing - 0.4) / 0.6; // 0→1→0
    r.arm?.rotateX(-2.2 * k + 0.5); r.fore?.rotateX(-0.6 * k); r.spine?.rotateY(0.45 * (a.swing - 0.5));
  }
}
