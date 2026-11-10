import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
B.monsters.E.normal.hp = 10; B.monsters.E.boss.hp = 10; B.monsters.E.normal.atk = 0; B.monsters.E.boss.atk = 0;
B.network.action_distance_tiles = 100; B.party.share_range_tiles = 100; B.gate_e.drops.mob.chance = 1;
B.places.interact_tiles = 100; // ไม่ต้องเดินไปหาร้าน/สมาคม/วิน (ระยะทดสอบแล้วใน gate.test.js)
B.taxi.cooldown_sec = 0.3;
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
  const c = { ws, room: null, notices: [], me: null, party: null, invited: null, chats: [], fails: [], cleared: null, self: null, mobs: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'room') c.room = m;
    if (m.t === 's') { c.mobs = m.m; c.self = m.p.find((x) => x[0] === token); }
    if (m.t === 'notice') c.notices.push(m.text);
    if (m.t === 'me') c.me = m;
    if (m.t === 'party') c.party = m;
    if (m.t === 'pinvited') c.invited = m;
    if (m.t === 'chat') c.chats.push(m);
    if (m.t === 'skillFailed') c.fails.push(m.why);
    if (m.t === 'cleared') c.cleared = m;
  });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token }));
  c.send = (o) => ws.send(JSON.stringify(o));
  await sleep(200);
  return c;
}
const bye = async (...cs) => { for (const c of cs) { c.ws.close(); await new Promise((r) => c.ws.readyState === 3 ? r() : c.ws.once('close', r)); } await sleep(100); };
const row = (uid) => db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
const equip = (uid) => db.prepare('SELECT * FROM equipment WHERE user_id = ?').get(uid);
const inv = (uid, item) => db.prepare('SELECT quantity q FROM inventory WHERE user_id = ? AND item_id = ?').get(uid, item)?.q ?? 0;

test('ลงแต้ม stat: ใช้แต้มที่มี, HP/MP/ความเร็วเปลี่ยนตามสูตร, บันทึก DB, ไม่มีแต้ม = ไม่ได้', async () => {
  await mk('u-s', 'Stat01');
  db.prepare("UPDATE users SET stat_points = 3 WHERE id = 'u-s'").run();
  const c = await connect('u-s');
  for (const k of ['vit', 'int', 'agi', 'str', 'hack']) { c.send({ t: 'stat', k }); await sleep(60); }
  assert.deepEqual(c.me.stats, { str: 14, agi: 10, vit: 13, int: 7, per: 9 }); assert.equal(c.me.statPoints, 0);
  assert.equal(c.self[7], (13 + 1) * 20); assert.equal(c.me.maxMp, 7 * 15); assert.ok(c.me.speed > 4.09);
  const u = row('u-s'); assert.deepEqual([u.vit, u.int_stat, u.agi, u.str, u.stat_points], [13, 7, 10, 14, 0]);
  await bye(c);
});

test('ร้านค้า: ซื้อน้ำ/น้ำมนต์/อาวุธ (สวมทันที อาวุธเดิมเข้ากระเป๋า), เงินไม่พอ, ของนอกร้าน', async () => {
  await mk('u-b', 'Buyer01');
  const c = await connect('u-b');
  c.send({ t: 'buy', item: 'water' }); c.send({ t: 'buy', item: 'mp_potion_0' }); await sleep(120);
  assert.equal(c.me.baht, 10000 - 100 - 500); assert.equal(c.me.items.water, 1); assert.equal(c.me.items.mp_potion_0, 6); assert.equal(inv('u-b', 'water'), 1);
  c.send({ t: 'buy', item: 'sword_long_e' }); await sleep(120);
  assert.equal(c.me.weapon, 'sword_long_e'); assert.equal(c.me.baht, 9400 - 5000); assert.equal(equip('u-b').weapon_id, 'sword_long_e'); assert.equal(inv('u-b', 'sword_short_e'), 1); assert.equal(inv('u-b', 'sword_long_e'), 1);
  c.send({ t: 'buy', item: 'sword_long_e' }); await sleep(100); assert.match(c.notices.at(-1), /มีอาวุธนี้แล้ว/);
  c.send({ t: 'buy', item: 'sword_long_d' }); await sleep(100); assert.match(c.notices.at(-1), /เงินไม่พอ/); assert.equal(c.me.weapon, 'sword_long_e');
  c.send({ t: 'buy', item: 'sword_long_s' }); c.send({ t: 'buy', item: '__proto__' }); await sleep(100); assert.equal(c.me.baht, 4400);
  assert.equal(row('u-b').baht, 4400);
  await bye(c);
});

test('Fatigue: โจมตี/สกิลเพิ่มตามสูตร VIT, ≥90% ใช้สกิลไม่ได้, น้ำเปล่า −15, บันทึก DB', async () => {
  await mk('u-f', 'Tired01');
  const c = await connect('u-f');
  c.send({ t: 'enter', gate: 0 }); await sleep(250);
  const id = c.mobs[0][0];
  c.send({ t: 'cast', skill: 'slash', id }); await sleep(250);
  assert.ok(Math.abs(c.self[11] - 0) <= 1, 'สกิล 1 ครั้ง ≈ 0.45%'); // 0.5 × 100/112
  await bye(c);
  db.prepare("UPDATE users SET fatigue = 95, fatigue_updated_at = unixepoch() WHERE id = 'u-f'").run();
  const d = await connect('u-f'); await sleep(150);
  assert.ok(d.self[11] >= 94);
  d.send({ t: 'enter', gate: 0 }); await sleep(250);
  d.send({ t: 'cast', skill: 'slash', id: d.mobs[0][0] }); await sleep(100); assert.deepEqual(d.fails, ['exhausted']);
  d.send({ t: 'leave' }); await sleep(150);
  d.send({ t: 'buy', item: 'water' }); await sleep(80); d.send({ t: 'use', item: 'water' }); await sleep(250);
  assert.ok(d.self[11] >= 78 && d.self[11] <= 80, `fatigue ${d.self[11]}`); assert.equal(d.me.items.water, 0); // ฟื้นเองช้าๆ ระหว่างทดสอบ
  d.send({ t: 'use', item: 'water' }); d.send({ t: 'use', item: 'mp_potion_0' }); await sleep(150); assert.ok(d.self[11] >= 78, 'ไม่มีของ/ไม่ใช่ของลด fatigue');
  await bye(d);
  assert.ok(Math.abs(row('u-f').fatigue - 79) < 2);
});

test('ปาร์ตี้: ชวน/รับ, เข้า Gate instance เดียวกัน, แบ่ง EXP (1+0.1(n−1))/n, โบนัส clear 5%, ออกแล้วยุบ', async () => {
  await mk('u-p1', 'Lead01'); await mk('u-p2', 'Mate01');
  const a = await connect('u-p1'), b = await connect('u-p2');
  a.send({ t: 'chat', ch: 'p', text: 'hi' }); await sleep(80); assert.match(a.notices.at(-1), /ยังไม่มีปาร์ตี้/);
  a.send({ t: 'pinvite', id: 'u-p2' }); await sleep(100); assert.equal(b.invited.from, 'u-p1');
  b.send({ t: 'paccept' }); await sleep(100);
  assert.deepEqual(a.party.members.map((m) => m[1]), ['Lead01', 'Mate01']); assert.equal(b.party.leader, 'u-p1');
  b.send({ t: 'pinvite', id: 'u-p1' }); await sleep(80); assert.match(b.notices.at(-1), /มีปาร์ตี้แล้ว/);
  a.send({ t: 'enter', gate: 0 }); await sleep(250); b.send({ t: 'enter', gate: 1 }); await sleep(250);
  assert.equal(a.room.kind, 'gate_e'); assert.equal(b.room.id, a.room.id, 'instance เดียวกัน');
  a.send({ t: 'atk', id: a.mobs[0][0] }); await sleep(200); // ก๊อปลิน EXP 25 → คนละ round(25×1.1/2)=14
  assert.equal(a.me.exp, 14); assert.equal(b.me.exp, 14);
  a.send({ t: 'chat', ch: 'p', text: 'ไปบอส' }); await sleep(100); assert.equal(b.chats.at(-1).text, 'ไปบอส'); assert.equal(b.chats.at(-1).ch, 'p');
  await sleep(1000); a.send({ t: 'atk', id: 'boss' }); await sleep(250);
  // ของที่ดรอป: หูก๊อปลิน 568 + หูบอส 5680 = 6248 → 5% ÷ 2 คน = 156
  assert.equal(a.cleared.bonus, 156); assert.equal(b.cleared.bonus, 156); assert.equal(b.me.baht, 10000 + 156);
  b.send({ t: 'pleave' }); await sleep(100); assert.deepEqual(a.party.members, []); assert.deepEqual(b.party.members, []);
  await bye(a, b);
});

test('แชต: ส่งถึงคนในห้อง, กรองคำหยาบ, กันลิงก์, rate limit 1/วิ, ซ้ำ 3 ครั้งบล็อก', async () => {
  await mk('u-c1', 'Chat01'); await mk('u-c2', 'Chat02');
  const a = await connect('u-c1'), b = await connect('u-c2');
  a.send({ t: 'chat', text: 'สวัสดี fuck' }); await sleep(100);
  assert.equal(b.chats.at(-1).text, 'สวัสดี ****'); assert.equal(b.chats.at(-1).name, 'Chat01');
  a.send({ t: 'chat', text: 'เร็วไป' }); await sleep(100); assert.equal(b.chats.length, 1, 'ภายใน 1 วิ ถูกทิ้ง');
  await sleep(1000); a.send({ t: 'chat', text: 'ดู www.evil.com' }); await sleep(100); assert.equal(b.chats.length, 1); assert.match(a.notices.at(-1), /ลิงก์/);
  for (const t of ['', '   ', 'x'.repeat(201), 123]) a.send({ t: 'chat', text: t }); await sleep(100); assert.equal(b.chats.length, 1);
  for (let i = 0; i < 3; i++) { await sleep(1050); a.send({ t: 'chat', text: 'spam' }); }
  await sleep(100); assert.equal(b.chats.filter((c) => c.text === 'spam').length, 2); assert.match(a.notices.at(-1), /ซ้ำ/);
  await bye(a, b);
});

test('วิน: หักค่าโดยสารตามระยะ, วาร์ป, ติด cooldown · ตีบวก: ต้องแรงค์ D + แร่พอ', async () => {
  await mk('u-t', 'Taxi01');
  const c = await connect('u-t');
  c.send({ t: 'taxi', to: 'hospital' }); await sleep(200);
  const fare = Math.round(50 + Math.hypot(24 - 21.5, 24 - 33.5) * 40);
  assert.equal(c.me.baht, 10000 - fare); assert.deepEqual([c.room.x, c.room.y], [21.5, 33.5]);
  c.send({ t: 'taxi', to: 'market' }); await sleep(100); assert.match(c.notices.at(-1), /ไม่ว่าง/);
  c.send({ t: 'taxi', to: 'moon' }); await sleep(100);
  c.send({ t: 'enhance' }); await sleep(100); assert.match(c.notices.at(-1), /แรงค์ D/);
  await bye(c);
  db.prepare("UPDATE users SET hunter_rank = 'D' WHERE id = 'u-t'").run();
  db.prepare("INSERT INTO inventory (id,user_id,item_type,item_id,quantity,slot_index) VALUES ('x1','u-t','loot','mana_stone_e',3,9)").run();
  const d = await connect('u-t');
  for (let i = 0; i < 3; i++) { d.send({ t: 'enhance' }); await sleep(80); } // +1 ใช้ 1, +2 ใช้ 2, +3 ต้อง 4 (เหลือ 0)
  assert.equal(d.me.enhance, 2); assert.equal(d.me.items.mana_stone_e, 0); assert.equal(equip('u-t').weapon_enhance, 2); assert.match(d.notices.at(-1), /4 ก้อน/);
  await bye(d);
});

test('ตู้เสื้อผ้า: เปลี่ยนชุดในเมือง → บันทึก DB + คนในห้องเห็น; ชุดนอกรายการถูกปฏิเสธ', async () => {
  await mk('u-w', 'Wardrobe1'); await mk('u-w2', 'Watcher1');
  const a = await connect('u-w'), b = await connect('u-w2'); const looks = [];
  b.ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'look' && m.id === 'u-w') looks.push(m.look); });
  const look = { skin_tone: 3, hair_style: 2, hair_color: '#c9a227', outfit: 'suit#d8dce6|skirt#8a2030|sneakers#16141b' };
  a.send({ t: 'look', look }); await sleep(150);
  const u = row('u-w'); assert.deepEqual([u.skin_tone, u.hair_style, u.hair_color, u.outfit], [3, 2, '#c9a227', look.outfit]);
  assert.deepEqual(looks.at(-1), look);
  a.send({ t: 'look', look: { ...look, outfit: 'cape#d8dce6|skirt#8a2030|sneakers#16141b' } }); await sleep(150);
  assert.equal(row('u-w').outfit, look.outfit); assert.match(a.notices.at(-1), /ชุด/);
  await bye(a, b);
});

test('สลับอาวุธ: ค่าตีบวกติดไปกับอาวุธแต่ละชิ้น, สลับไปอาวุธที่ไม่มีไม่ได้', async () => {
  await mk('u-e', 'Equip01');
  const start = equip('u-e').weapon_id, other = Object.keys(B.weapons).find((w) => w !== start);
  db.prepare("INSERT INTO inventory (id,user_id,item_type,item_id,quantity,enhance,slot_index) VALUES ('e1','u-e','weapon',?,1,3,9)").run(other);
  const c = await connect('u-e');
  c.send({ t: 'equip', item: 'nope' }); await sleep(80); assert.equal(c.me.weapon, start);
  c.send({ t: 'equip', item: other }); await sleep(100);
  assert.deepEqual([c.me.weapon, c.me.enhance], [other, 3]); assert.deepEqual([equip('u-e').weapon_id, equip('u-e').weapon_enhance], [other, 3]);
  c.send({ t: 'equip', item: start }); await sleep(100);
  assert.deepEqual([c.me.weapon, c.me.enhance], [start, 0]); assert.deepEqual(c.me.weapons.find(([w]) => w === other), [other, 3]);
  await bye(c);
});
