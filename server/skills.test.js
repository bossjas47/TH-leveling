import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
B.monsters.E.normal.hp = 100; B.monsters.E.normal.atk = 1; B.combat.mob.respawn_sec = 0.3;
B.combat.mob.aggro_tiles = 0.5; // ปกติก๊อปลินชิดจุดเกิด (0.8 tile) ไม่สนใจใคร; เปิดเป็น 1.0 เฉพาะตอนทำให้เหยื่อล้ม
B.downed.assist.channel_sec = 0.6; B.mp_potions.shared_cooldown_sec = 0.5;
const verify = async (t) => { if (!t.startsWith('u-')) throw new Error('bad'); return t; };
const db = openDb(':memory:');
// m0,m1 ชิดจุดเกิด (24,24); m2 ไกล
const srv = makeServer(makeApi({ db, verify, B }), { verify, B, worldOpts: { goblins: [[24.8, 24], [24, 24.8], [24, 32]], resumeMs: 0 } });
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
test.after(() => { srv.close(); srv.closeAllConnections?.(); });

const look = { skin_tone: 1, hair_style: 1, hair_color: '#1a1a1a', outfit: 'coat#1c1f2c|pants#16141b|boots#16141b' };
const mk = (uid, username, job) => fetch(`http://localhost:${port}/api/character`, { method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: JSON.stringify({ username, gender: 'male', job, look }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const c = { ws, p: null, mobs: [], hits: [], me: null, fails: [], skills: [], assisting: false, cancelled: false };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 's') { c.p = m.p; c.mobs = m.m; c.self = m.p.find((x) => x[0] === token); }
    if (m.t === 'hit') c.hits.push(m);
    if (m.t === 'me') c.me = m;
    if (m.t === 'skillFailed') c.fails.push(m.why);
    if (m.t === 'skill') c.skills.push(m.skill);
    if (m.t === 'assisting') c.assisting = true;
    if (m.t === 'assistCancel') c.cancelled = true;
  });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token }));
  c.send = (o) => ws.send(JSON.stringify(o));
  await sleep(200);
  return c;
}
const bye = async (...cs) => { for (const c of cs) { c.ws.close(); await new Promise((r) => c.ws.readyState === 3 ? r() : c.ws.once('close', r)); } await sleep(100); }; // รอปิดจริง ไม่ให้ผู้เล่นเก่าค้างในโลก
const row = (uid) => db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
const mob = (c, id) => c.mobs.find((m) => m[0] === id);

test('Fighter: Slash 1.5× หัก MP ติด cooldown; ไกล/คนละอาชีพ/MP ไม่พอ ถูกปฏิเสธ', async () => {
  await mk('u-f', 'Fighter1', 'Fighter');
  const c = await connect('u-f');
  assert.equal(c.me.mp, 90); assert.equal(c.me.potions, 5);
  c.send({ t: 'cast', skill: 'slash', id: 'm2' }); await sleep(100); assert.deepEqual(c.fails, ['range']);
  c.send({ t: 'cast', skill: 'fireball', id: 'm0' }); await sleep(100); assert.equal(c.fails.at(-1), 'unknown'); // สกิลของ Mage
  c.send({ t: 'cast', skill: 'slash', id: 'm0' }); await sleep(100);
  assert.equal(c.hits.length, 1); assert.equal(c.me.mp, 85);
  assert.ok(c.hits[0].v >= 13 && c.hits[0].v <= 24, `dmg ${c.hits[0].v}`); // 12 × 1.5 × 120/140 ≈ 15 (crit ×1.5 ≈ 23 ได้)
  c.send({ t: 'cast', skill: 'slash', id: 'm0' }); await sleep(100); assert.equal(c.fails.at(-1), 'cooldown');
  await sleep(2000);
  for (let i = 0; i < 4; i++) { c.send({ t: 'cast', skill: 'whirlwind' }); await sleep(50); } // 20 MP ต่อครั้ง, cd 8 วิ → ได้ครั้งเดียว
  assert.equal(c.me.mp, 85 - 20); assert.equal(c.hits.length >= 3, true, 'whirlwind โดนมอน 2 ตัวที่ชิด'); // slash 1 + whirl 2
  await bye(c);
});

test('น้ำมนต์: +50 MP, หักจำนวน, บันทึก DB, ติด cooldown', async () => {
  const c = await connect('u-f'); // MP คืนค่าเดิมจาก DB ไม่ได้ (MP ไม่ถูกบันทึกตอนเล่น?) — ดู p.mp หลังเชื่อมต่อ
  const before = c.me.mp;
  c.send({ t: 'potion' }); await sleep(100);
  assert.equal(c.me.mp, Math.min(90, before + 50)); assert.equal(c.me.potions, 4);
  const mp = c.me.mp; c.send({ t: 'potion' }); await sleep(100); assert.equal(c.me.potions, 4, 'cooldown'); assert.equal(c.me.mp, mp);
  assert.equal(db.prepare("SELECT quantity q FROM inventory WHERE user_id='u-f' AND item_id='mp_potion_0'").get().q, 4);
  await bye(c);
});

test('Assassin: Shadow Step วาร์ปไปหลังเป้า; Tank: Taunt; Mage: Ice Nova แช่แข็ง', async () => {
  await mk('u-a', 'Assassin1', 'Assassin');
  const a = await connect('u-a');
  const x0 = a.self[1]; a.send({ t: 'cast', skill: 'shadow_step', id: 'm0' }); await sleep(150);
  assert.ok(a.self[1] > x0 + 0.5, `วาร์ปไปฝั่งตรงข้ามเป้า x=${a.self[1]}`); assert.equal(a.me.mp, 90 - 25);
  await bye(a);
  await mk('u-t', 'Tank1', 'Tank');
  const t = await connect('u-t');
  t.send({ t: 'cast', skill: 'taunt' }); await sleep(100); assert.deepEqual(t.skills, ['taunt']); assert.equal(t.me.mp, 105 - 15);
  await bye(t);
  await mk('u-m', 'Mage1', 'Mage');
  const m = await connect('u-m');
  const before = ['m0', 'm1'].map((id) => mob(m, id)[3]); m.send({ t: 'cast', skill: 'ice_nova' }); await sleep(150);
  assert.ok(mob(m, 'm0')[3] < before[0] && mob(m, 'm1')[3] < before[1], 'AoE โดน 2 ตัว'); assert.equal(m.me.mp, 240 - 30);
  const [x, y] = [mob(m, 'm0')[1], mob(m, 'm0')[2]]; await sleep(400);
  assert.deepEqual([mob(m, 'm0')[1], mob(m, 'm0')[2]], [x, y], 'แช่แข็ง: มอนไม่ขยับ');
  await bye(m);
});

// ผู้ช่วยยืนห่างจากก๊อปลิน; เหยื่อเกิดที่จุดเกิดแล้วโดน ATK สูงชั่วคราวจนล้ม
async function standAway(c, sec = 0.37) { c.send({ t: 'in', dx: -1, dy: 0 }); await sleep(sec * 1000); c.send({ t: 'in', dx: 0, dy: 0 }); await sleep(150); }
async function fall(uid, name) {
  await mk(uid, name, 'Fighter');
  await sleep(1600); // ให้ก๊อปลินพ้น cooldown 1.5 วิ จากการตีครั้งก่อน → ตีทันทีที่เหยื่อเข้ามา
  B.monsters.E.normal.atk = 400; B.combat.mob.aggro_tiles = 1;
  const v = await connect(uid); await sleep(150); B.monsters.E.normal.atk = 1; B.combat.mob.aggro_tiles = 0.5; // หน้าต่างสั้น: ตีครั้งเดียว ผู้ช่วยที่ยืนห่างไม่โดน
  v.vs = () => v.p.find((p) => p[0] === uid);
  assert.equal(v.vs()[8], 1, 'เหยื่อต้องล้ม');
  return v;
}

test('Healer: Revive กู้คนล้ม 30%, Heal เพิ่ม HP, ล้มซ้ำใน 120 วิ = ตายทันที', async () => {
  await mk('u-h', 'Healer1', 'Healer');
  const h = await connect('u-h'); await standAway(h);
  const v = await fall('u-v', 'Victim2');
  h.send({ t: 'cast', skill: 'revive', id: 'u-v' }); await sleep(150);
  assert.equal(v.vs()[8], 0); assert.ok(Math.abs(v.vs()[6] - v.vs()[7] * 0.3) <= 2, 'HP ~30% (ก๊อปลิน ATK 1 อาจตีเพิ่ม)'); assert.equal(h.me.mp, 210 - 40);
  const hp0 = v.vs()[6]; h.send({ t: 'cast', skill: 'heal', id: 'u-v' }); await sleep(250);
  assert.ok(v.vs()[6] > hp0 + 30 && v.vs()[6] < hp0 + 60, `heal ${hp0}→${v.vs()[6]}`); // 260×15%×(1+14/500)×1.1 ≈ 44
  B.monsters.E.normal.atk = 400; B.combat.mob.aggro_tiles = 1; await sleep(1700); B.monsters.E.normal.atk = 1; B.combat.mob.aggro_tiles = 0.5; // ก๊อปลินตีรอบถัดไปทุก 1.5 วิ
  assert.equal(v.vs()[8], 0, 'ไม่เข้า Downed'); assert.deepEqual([v.vs()[1], v.vs()[2]], B.combat.hospital); assert.equal(v.me.free, 3);
  await bye(h, v);
});

test('พยุง (Assist): ครบเวลา → ฟื้น 10%; ขยับกลางทาง = ยกเลิก', async () => {
  // เหยื่อล้มก่อน แล้วผู้ช่วยค่อยเข้ามาที่จุดเกิดเดียวกัน (ก๊อปลิน aggro 0.5 จึงไม่สนผู้ช่วย)
  const y = await fall('u-y', 'Fallen2');
  await mk('u-w', 'Helper1', 'Miner');
  const w = await connect('u-w');
  w.send({ t: 'assist', id: 'u-y' }); await sleep(150); assert.equal(w.assisting, false, 'ไม่ใช่ปาร์ตี้เดียวกัน พยุงไม่ได้');
  w.send({ t: 'pinvite', id: 'u-y' }); await sleep(100); y.send({ t: 'paccept' }); await sleep(100);
  w.send({ t: 'assist', id: 'u-y' }); await sleep(150); assert.equal(w.assisting, true);
  w.send({ t: 'in', dx: -1, dy: 0 }); await sleep(300); w.send({ t: 'in', dx: 0, dy: 0 }); await sleep(900);
  assert.equal(w.cancelled, true); assert.equal(y.vs()[8], 1, 'ขยับ = ยกเลิก ไม่ฟื้น');
  await bye(w, y);

  const x = await fall('u-x', 'Fallen1');
  await mk('u-z', 'Helper2', 'Tank');
  const z = await connect('u-z');
  z.send({ t: 'pinvite', id: 'u-x' }); await sleep(100); x.send({ t: 'paccept' }); await sleep(100);
  z.send({ t: 'assist', id: 'u-x' }); await sleep(250);
  assert.equal(z.assisting, true); assert.equal(x.vs()[8], 1, 'ยังล้มระหว่าง channel');
  await sleep(600);
  assert.equal(x.vs()[8], 0); assert.ok(Math.abs(x.vs()[6] - x.vs()[7] * 0.1) <= 2, 'HP ~10%');
  await bye(z, x);
});
