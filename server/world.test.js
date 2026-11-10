import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
const verify = async (t) => { if (!t.startsWith('u-')) throw new Error('bad'); return t; }; // token = uid (JWT ครอบคลุมใน api.test.js)
const api = makeApi({ db: openDb(':memory:'), verify, B });
const srv = makeServer(api, { verify, B, worldOpts: { goblins: [], resumeMs: 0 } });
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
test.after(() => { srv.close(); srv.closeAllConnections?.(); });

const look = { skin_tone: 1, hair_style: 1, hair_color: '#1a1a1a', outfit: 'coat#1c1f2c|pants#16141b|boots#16141b' };
for (const [uid, username, job] of [['u-a', 'Alice1', 'Fighter'], ['u-b', 'Bobby1', 'Mage']]) {
  const r = await fetch(`http://localhost:${port}/api/character`, { method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: JSON.stringify({ username, gender: 'male', job, look }) });
  assert.equal(r.status, 201);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const c = { ws, snap: null, hello: null, closed: null };
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 's') c.snap = m.p; if (m.t === 'hello') c.hello = m; });
  ws.on('close', (code) => { c.closed = code; });
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'auth', token }));
  c.me = () => c.snap?.find((p) => p[0] === token);
  c.send = (o) => ws.send(JSON.stringify(o));
  return c;
}

test('token ผิด → ปิดด้วย 4002, ไม่มีตัวละคร → 4003', async () => {
  const bad = await connect('nope'); await sleep(150); assert.equal(bad.closed, 4002);
  const none = await connect('u-nochar'); await sleep(150); assert.equal(none.closed, 4003);
});

test('สองคนเห็นกัน และเห็นการเดินของกันและกัน', async () => {
  const a = await connect('u-a'), b = await connect('u-b');
  await sleep(300);
  assert.equal(a.snap.length, 2); assert.deepEqual(a.hello.x, 24);
  assert.deepEqual(a.snap.map((p) => p[3]).sort(), ['Alice1', 'Bobby1']);
  a.send({ t: 'in', dx: 1, dy: 0 }); await sleep(500); a.send({ t: 'in', dx: 0, dy: 0 }); await sleep(250);
  const seenByB = b.snap.find((p) => p[0] === 'u-a');
  assert.ok(seenByB[1] > 25.5 && seenByB[1] < 26.5, `x=${seenByB[1]}`); // ~4.09 tiles/วิ × 0.5 วิ
  assert.ok(Math.abs(seenByB[10] - Math.PI / 2) < 0.02, `หันหน้าตามทิศเดิน (+x = π/2) ได้ ${seenByB[10]}`); // client 3D ใช้หมุนตัว
  a.ws.close(); await sleep(250);
  assert.equal(b.snap.length, 1); // คนออกแล้วหายจากจอ
  b.ws.close();
});

test('โกงความเร็ว (dx=100) ไม่ได้: server จำกัดเวกเตอร์เป็น 1', async () => {
  const a = await connect('u-a'); await sleep(200);
  a.send({ t: 'in', dx: 100, dy: 0 }); await sleep(1000); a.send({ t: 'in', dx: 0, dy: 0 }); await sleep(250);
  const x = a.me()[1];
  assert.ok(x - 24 < 4.09 * 1.1 && x - 24 > 3, `ขยับ ${x - 24}`);
  for (const bad of [{ dx: NaN, dy: 1 }, { dx: 'a', dy: 0 }, { dx: null, dy: null }]) a.send({ t: 'in', ...bad });
  a.ws.close();
});

test('ชนกำแพงแล้วหยุด (server)', async () => {
  const a = await connect('u-a'); await sleep(200);
  a.send({ t: 'in', dx: -1, dy: 0 }); await sleep(6200); // 3.7 tiles → ถึงกำแพงแล้วค้าง
  const [, x, y] = a.me();
  assert.ok(x >= 20.29 && x < 20.5 && y === 24, `${x},${y}`);
  a.ws.close();
});

test('rate limit 20 msg/วิ: ข้อความที่ 21+ ถูกทิ้ง', async () => {
  const a = await connect('u-a'); await sleep(200);
  const x0 = a.me()[1];
  for (let i = 0; i < 20; i++) a.send({ t: 'in', dx: 0, dy: 0 });
  a.send({ t: 'in', dx: 1, dy: 0 }); await sleep(500);
  assert.equal(a.me()[1], x0);
  a.ws.close();
});

test('login ซ้ำ → เซสชันเก่าถูกเตะ', async () => {
  const a1 = await connect('u-a'); await sleep(200);
  const a2 = await connect('u-a'); await sleep(200);
  assert.equal(a1.closed, 4000); assert.equal(a2.closed, null);
  a2.ws.close();
});
