import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { openDb } from './db.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
const verify = async (t) => { if (!t.startsWith('u-')) throw new Error('bad'); return t; };
const api = makeApi({ db: openDb(':memory:'), verify, B });
const srv = makeServer(api, { verify, B, worldOpts: { goblins: [], resumeMs: 400 } });
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
test.after(() => { srv.close(); srv.closeAllConnections?.(); });
const look = { skin_tone: 1, hair_style: 1, hair_color: '#1a1a1a', outfit: 'coat#1c1f2c|pants#16141b|boots#16141b' };
await fetch(`http://localhost:${port}/api/character`, { method: 'POST', headers: { authorization: 'Bearer u-r' }, body: JSON.stringify({ username: 'Resume1', gender: 'male', job: 'Fighter', look }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  const ws = new WebSocket(`ws://localhost:${port}/ws`), c = { ws, hello: null };
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'hello') c.hello = m; });
  await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ t: 'auth', token: 'u-r' })); await sleep(150);
  c.close = async () => { ws.close(); await new Promise((r) => ws.once('close', r)); await sleep(50); };
  return c;
}

test('หลุดแล้วกลับมาเร็ว = เกิดที่เดิม; นานเกินกำหนด = กลับจุดเกิด', async () => {
  let c = await connect(); assert.equal(c.hello.x, 24);
  c.ws.send(JSON.stringify({ t: 'in', dx: 1, dy: 0 })); await sleep(300); c.ws.send(JSON.stringify({ t: 'in', dx: 0, dy: 0 })); await sleep(100);
  await c.close();
  c = await connect(); assert.ok(c.hello.x > 25, `x=${c.hello.x}`);
  await c.close(); await sleep(500);
  c = await connect(); assert.equal(c.hello.x, 24);
  await c.close();
});
