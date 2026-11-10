import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';
import { makeGateE } from '../shared/gate.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
// ปรับให้เทสต์เร็ว: บอส/มอนเลือดน้อย, ตี/ขุดจากระยะไกลได้ (อ่านค่าสดทุกครั้ง)
B.monsters.E.boss.hp = 15; B.monsters.E.normal.hp = 15;
B.network.action_distance_tiles = 100; B.gate_e.mining.range_tiles = 100; B.gate_e.mining.swing_cd_sec = 0.02;
B.gate_e.clear_linger_sec = 0.6;
const verify = async (t) => { if (!t.startsWith('u-')) throw new Error('bad'); return t; };
const db = openDb(':memory:');
const srv = makeServer(makeApi({ db, verify, B }), { verify, B, worldOpts: { goblins: [], resumeMs: 0 } });
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
test.after(() => { srv.close(); srv.closeAllConnections?.(); });

const look = { skin_tone: 1, hair_style: 1, hair_color: '#1a1a1a', outfit: 'coat#1c1f2c|pants#16141b|boots#16141b' };
const mk = (uid, username, job = 'Fighter') => fetch(`http://localhost:${port}/api/character`, { method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: JSON.stringify({ username, gender: 'male', job, look }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const c = { ws, room: null, rooms: [], notices: [], loot: [], me: null, cleared: null, sold: null, rank: null, failed: false, snap: null, mobs: [], nodes: [], self: null };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'room') { c.room = m; c.rooms.push(m.kind); }
    if (m.t === 's') { c.snap = m.p; c.mobs = m.m; c.nodes = m.n; c.self = m.p.find((x) => x[0] === token); }
    if (m.t === 'notice') c.notices.push(m.text);
    if (m.t === 'loot') c.loot.push(m.item);
    if (m.t === 'me') c.me = m;
    if (m.t === 'cleared') c.cleared = m;
    if (m.t === 'sold') c.sold = m;
    if (m.t === 'rankResult') c.rank = m;
    if (m.t === 'gateFailed') c.failed = true;
  });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token }));
  c.send = (o) => ws.send(JSON.stringify(o));
  await sleep(200);
  return c;
}
const bye = async (...cs) => { for (const c of cs) { c.ws.close(); await new Promise((r) => c.ws.readyState === 3 ? r() : c.ws.once('close', r)); } await sleep(100); };
const row = (uid) => db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
const inv = (uid, item) => db.prepare('SELECT quantity q FROM inventory WHERE user_id = ? AND item_id = ?').get(uid, item)?.q ?? 0;
async function walkTo(c, tx, ty) { // เดินจากตำแหน่งปัจจุบันไปใกล้เป้า (ความเร็ว ≈ 4.09/วิ)
  const [x, y] = [c.self[1], c.self[2]], d = Math.hypot(tx - x, ty - y);
  c.send({ t: 'in', dx: (tx - x) / d, dy: (ty - y) / d }); await sleep(d / 4.09 * 1000); c.send({ t: 'in', dx: 0, dy: 0 }); await sleep(250);
}

test('แผนที่ Gate E: กำหนดผลซ้ำได้, 42×42, 22 มอน + 10 จุดแร่ อยู่ในที่เดินได้', () => {
  const a = makeGateE(), b = makeGateE();
  assert.deepEqual(a, b); assert.equal(a.rows.length, 42); assert.ok(a.rows.every((r) => r.length === 42));
  assert.equal(a.mobSpawns.length, 22); assert.equal(a.nodeSpawns.length, 10);
  for (const [x, y] of [...a.mobSpawns, ...a.nodeSpawns, [a.boss.x, a.boss.y], [a.spawn.x, a.spawn.y]]) assert.equal(a.rows[Math.floor(y)][Math.floor(x)], '.');
});

test('ต้องยืนใกล้ประตูก่อนเข้า Gate; เข้าแล้วได้ instance 42×42 พร้อมมอน/บอส/แร่', async () => {
  await mk('u-g', 'Gater1');
  const c = await connect('u-g');
  c.send({ t: 'enter', gate: 0 }); await sleep(150); assert.deepEqual(c.rooms, ['lobby']); assert.match(c.notices.at(-1), /ใกล้ประตู/);
  await walkTo(c, 21.5, 28.5);
  c.send({ t: 'enter', gate: 0 }); await sleep(300);
  assert.equal(c.room.kind, 'gate_e'); assert.deepEqual([c.room.x, c.room.y], [21.5, 38.5]);
  assert.equal(c.mobs.length, 23, '22 มอน + บอส'); assert.equal(c.mobs.filter((m) => m[5] === 1).length, 1); assert.equal(c.nodes.length, 10);
  c.send({ t: 'enter', gate: 1 }); await sleep(100); assert.equal(c.rooms.length, 2, 'อยู่ใน Gate แล้วเข้าซ้ำไม่ได้');
  c.send({ t: 'leave' }); await sleep(200); assert.equal(c.room.kind, 'lobby');
  await bye(c);
});

test('ขุดแร่ครบ → ฆ่าบอส → clear (EXP + หูบอส) → ถูกวาร์ปออก → ขายของได้เงิน', async () => {
  await mk('u-m', 'Miner01', 'Miner');
  const c = await connect('u-m'); await walkTo(c, 21.5, 28.5);
  c.send({ t: 'enter', gate: 0 }); await sleep(300);
  for (const n of c.nodes) for (let i = 0; i < 3; i++) { c.send({ t: 'mine', id: n[0] }); await sleep(60); } // Miner ขุด 40/ครั้ง → 3 ครั้งแตก
  await sleep(200);
  assert.equal(c.nodes.length, 0); assert.equal(inv('u-m', 'mana_stone_e'), 10); assert.equal(c.loot.filter((i) => i === 'mana_stone_e').length, 10);
  for (let i = 0; i < 30 && !c.cleared; i++) { c.send({ t: 'atk', id: 'boss' }); await sleep(150); }
  assert.ok(c.cleared, 'ฆ่าบอสแล้วต้อง clear'); assert.equal(c.cleared.exp, Math.round(B.gates.table.E.exp_clear));
  assert.equal(inv('u-m', 'goblin_ear_boss'), 1); assert.ok(c.me.level >= 5, `เลเวล ${c.me.level}`);
  await sleep(900); assert.equal(c.room.kind, 'lobby', 'หลัง linger ถูกวาร์ปออก');
  // ขาย: ต้องเดินไปที่ตลาด
  c.send({ t: 'sell' }); await sleep(100); assert.match(c.notices.at(-1), /ตลาด/);
  await walkTo(c, 28, 23.5);
  const before = row('u-m').baht;
  c.send({ t: 'sell' }); await sleep(200);
  const expected = 10 * B.items.mana_stone_e.price + B.items.goblin_ear_boss.price;
  assert.equal(c.sold.total >= expected, true); assert.equal(row('u-m').baht, before + c.sold.total);
  assert.equal(inv('u-m', 'mana_stone_e'), 0); assert.equal(c.me.baht, row('u-m').baht);
  c.send({ t: 'sell' }); await sleep(100); assert.match(c.notices.at(-1), /ไม่มีของ/);
  await bye(c);
});

test('Gate หมดเวลา → ถูกวาร์ปออก + gateFailed', async () => {
  const old = B.gates.table.E.timer_h; B.gates.table.E.timer_h = 1 / 3600; // 1 วินาที
  B.gates.low_pool.dungeon_break_if_no_clear = false; // Dungeon Break ทดสอบแยกด้านล่าง (มอนในเมืองจะรบกวนเทสต์ถัดไป)
  await mk('u-t', 'Timer01');
  const c = await connect('u-t'); await walkTo(c, 21.5, 28.5);
  c.send({ t: 'enter', gate: 0 }); await sleep(300); assert.equal(c.room.kind, 'gate_e');
  await sleep(1300); B.gates.table.E.timer_h = old; B.gates.low_pool.dungeon_break_if_no_clear = true;
  assert.equal(c.failed, true); assert.equal(c.room.kind, 'lobby');
  await bye(c);
});

test('สอบแรงค์ D: ต้องเลเวลถึง + อยู่ใกล้สมาคม; ผ่านเมื่อ burst ถึงเกณฑ์ (ตกไม่เสียอะไร)', async () => {
  const req = B.hunter_ranks.assessment.requirements.D, dur = B.hunter_ranks.assessment.duration_sec;
  B.hunter_ranks.assessment.duration_sec = 1.5;
  await mk('u-r', 'Ranker01');
  const c = await connect('u-r');
  c.send({ t: 'ranktest' }); await sleep(100); assert.match(c.notices.at(-1), /สมาคม/);
  await walkTo(c, 18, 19.5);
  c.send({ t: 'ranktest' }); await sleep(100); assert.match(c.notices.at(-1), new RegExp(`เลเวล ${req.level}`));
  await bye(c);
  db.prepare("UPDATE users SET level = 10 WHERE id = 'u-r'").run();
  const d = await connect('u-r'); await walkTo(d, 18, 19.5);
  const burst = req.burst; req.burst = 100000; // ตก
  d.send({ t: 'ranktest' }); await sleep(250); assert.equal(d.room.kind, 'test');
  d.send({ t: 'atk', id: 'dummy' }); await sleep(1700);
  assert.equal(d.rank.passed, false); assert.equal(row('u-r').hunter_rank, 'E'); assert.equal(d.room.kind, 'lobby');
  req.burst = 20; // ผ่าน
  await walkTo(d, 18, 19.5);
  d.send({ t: 'ranktest' }); await sleep(250);
  d.send({ t: 'atk', id: 'dummy' }); await sleep(900); d.send({ t: 'cast', skill: 'slash', id: 'dummy' }); await sleep(900);
  assert.equal(d.rank.passed, true, JSON.stringify(d.rank)); assert.equal(d.rank.rank, 'D'); assert.equal(row('u-r').hunter_rank, 'D');
  req.burst = burst; B.hunter_ranks.assessment.duration_sec = dur;
  await bye(d);
});

test('Dungeon Break: Gate หมดเวลาไม่มีใคร clear → มอนบุกเมืองรอบประตูตามจำนวนใน balance + แจ้งทุกคน', async () => {
  const old = B.gates.table.E.timer_h; B.gates.table.E.timer_h = 1 / 3600;
  await mk('u-db', 'Breaker1');
  const c = await connect('u-db'); await walkTo(c, 21.5, 28.5);
  c.send({ t: 'enter', gate: 0 }); await sleep(300); assert.equal(c.room.kind, 'gate_e');
  await sleep(1300); B.gates.table.E.timer_h = old;
  assert.equal(c.room.kind, 'lobby'); await sleep(200);
  assert.equal(c.mobs.length, B.dungeon_break.mobs.E.count); assert.ok(c.notices.some((t) => /Dungeon Break/.test(t)));
  for (const [x, y] of c.mobs.map((m) => [m[1], m[2]])) assert.ok(Math.hypot(x - 21.5, y - 28.5) <= 5, `เกิดใกล้ประตู (เดินมาได้นิดหน่อย) ${x},${y}`);
  await bye(c);
});
