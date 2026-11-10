import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

// B ที่ปรับให้เทสต์เร็ว: ก๊อปลินเลือดน้อย / ตีแรง
const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
B.monsters.E.normal.hp = 20; B.monsters.E.normal.exp = 100; B.combat.mob.respawn_sec = 0.5;
const setMobAtk = (v) => { B.monsters.E.normal.atk = v; }; // server อ่านค่าสดทุกครั้ง
const verify = async (t) => { if (!t.startsWith('u-')) throw new Error('bad'); return t; };
const db = openDb(':memory:');
const srv = makeServer(makeApi({ db, verify, B }), { verify, B, worldOpts: { goblins: [[12.8, 12], [12, 20]] } }); // m0 ชิดจุดเกิด, m1 ไกล
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
test.after(() => { srv.close(); srv.closeAllConnections?.(); });

const look = { skin_tone: 1, hair_style: 1, hair_color: '#1a1a1a', outfit: 'street_hoodie' };
const mk = (uid, username, job = 'Fighter') => fetch(`http://localhost:${port}/api/character`, { method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: JSON.stringify({ username, gender: 'male', job, look }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const c = { ws, snap: null, mobs: null, me: null, hits: [], mePayload: null, closed: null };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 's') { c.snap = m.p; c.mobs = m.m; c.me = m.p.find((p) => p[0] === token); }
    if (m.t === 'hit') c.hits.push(m);
    if (m.t === 'me') c.mePayload = m;
  });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token }));
  c.send = (o) => ws.send(JSON.stringify(o));
  return c;
}
const row = (uid) => db.prepare('SELECT * FROM users WHERE id = ?').get(uid);

test('ตีมอน → ได้ EXP, เลเวลอัป (EXP 100 = Lv.2), บันทึก DB, +3 stat points', async () => {
  setMobAtk(1); // ก๊อปลินตีเบา เพื่อไม่ให้ล้มก่อนทดสอบจบ
  await mk('u-k', 'Killer1');
  const c = await connect('u-k'); await sleep(250);
  assert.ok(c.mobs.some((m) => m[0] === 'm0'));
  // ระยะไกล (m1 อยู่ห่าง 8 tiles) → ปฏิเสธ
  c.send({ t: 'atk', id: 'm1' }); await sleep(150); assert.equal(c.hits.length, 0);
  c.send({ t: 'in', dx: 0, dy: 0 });
  // กำลังจะถูกก๊อปลินตีด้วย (atk 400) จึงต้องฆ่าให้ทันใน 2 ครั้ง; HP 20 ÷ (12×K/(K+20)=10.3) = 2 ครั้ง
  c.send({ t: 'atk', id: 'm0' }); await sleep(100);
  c.send({ t: 'atk', id: 'm0' }); await sleep(100); // ติด cooldown (0.89 วิ) → ต้องถูกทิ้ง
  assert.equal(c.hits.length, 1, 'ตีซ้ำเร็วกว่า attack interval ต้องไม่นับ');
  assert.ok(c.hits[0].v >= 9 && c.hits[0].v <= 12, `dmg ${c.hits[0].v}`);
  await sleep(900); c.send({ t: 'atk', id: 'm0' }); await sleep(300);
  assert.equal(c.hits.length, 2);
  assert.equal(c.mePayload.level, 2); assert.equal(c.mePayload.exp, 0); assert.equal(c.mePayload.statPoints, 3);
  assert.ok(!c.mobs.some((m) => m[0] === 'm0'), 'มอนตายต้องหายจากจอ');
  assert.equal(row('u-k').level, 2); assert.equal(row('u-k').stat_points, 3); // บันทึกตอนเลเวลอัป
  c.ws.close(); await sleep(100);
});

test('โดนตีถึงตาย → Downed (HP 0, ขยับไม่ได้) → ยอมแพ้ → โรงพยาบาล ฟรี 4 ครั้งแรก', async () => {
  setMobAtk(400); await sleep(700); // ให้ m0 เกิดใหม่
  await mk('u-d', 'Victim1');
  const c = await connect('u-d'); await sleep(2000); // m0 ชิดจุดเกิด ตี atk 400 → ล้มทันที
  assert.equal(c.me[8], 1, 'ต้องอยู่ในสถานะล้ม'); assert.equal(c.me[6], 0);
  const at = [c.me[1], c.me[2]];
  c.send({ t: 'in', dx: 1, dy: 0 }); await sleep(300);
  assert.deepEqual([c.me[1], c.me[2]], at, 'ล้มแล้วเดินไม่ได้');
  c.send({ t: 'atk', id: 'm0' }); await sleep(100); assert.equal(c.hits.length, 0, 'ล้มแล้วโจมตีไม่ได้');
  c.send({ t: 'giveup' }); await sleep(300);
  assert.equal(c.me[8], 0); assert.equal(c.me[6], c.me[7]); // ฟื้นเต็ม HP
  assert.deepEqual([c.me[1], c.me[2]], B.combat.hospital); // อยู่ที่โรงพยาบาล
  assert.equal(c.mePayload.free, 3); assert.equal(c.mePayload.baht, 10000); // ฟรี ไม่เสียเงิน
  c.ws.close(); await sleep(100);
  assert.equal(row('u-d').free_respawn_count, 3);
});

test('หมด 4 ครั้งฟรี → คิดค่ารักษาตาม Rank E (2,000) และติดลบได้ = ลูกหนี้', async () => {
  await mk('u-p', 'Poorman1');
  db.prepare("UPDATE users SET free_respawn_count = 0, baht = 500 WHERE id = 'u-p'").run();
  const c = await connect('u-p'); await sleep(2000);
  assert.equal(c.me[8], 1);
  c.send({ t: 'giveup' }); await sleep(300);
  assert.equal(c.mePayload.baht, 500 - B.hospital.fee_by_hunter_rank.E); // -1500
  c.ws.close(); await sleep(100);
  const u = row('u-p'); assert.equal(u.baht, -1500); assert.equal(u.debt, 1500);
});
