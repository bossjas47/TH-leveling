import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { openDb } from './db.js';
import { withD1 } from './d1sync.js';
import worker from '../db-gateway/worker.js';

// D1 จำลองด้วย SQLite (API เดียวกับ binding ของ Cloudflare: prepare/bind/all/batch)
function fakeD1() {
  const s = new DatabaseSync(':memory:'); s.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return { s, prepare: (sql) => { let a = []; const o = { bind: (...p) => (a = p, o), all: async () => ({ results: s.prepare(sql).all(...a) }), run: () => s.prepare(sql).run(...a) }; return o; },
    batch: async (list) => { s.exec('BEGIN'); try { list.forEach((x) => x.run()); s.exec('COMMIT'); } catch (e) { s.exec('ROLLBACK'); throw e; } } };
}
const TOKEN = 'secret-token';
const gateway = (d1) => async (url, init) => worker.fetch(new Request(url, init), { DB: d1, GATEWAY_TOKEN: TOKEN });
const mk = (d1, o = {}) => withD1(openDb(':memory:'), { url: 'http://gw', token: TOKEN, fetchImpl: gateway(d1), intervalMs: 3600e3, ...o });
const user = (db, id, name) => db.prepare(`INSERT INTO users (id,username,gender,job,skin_tone,hair_style,hair_color,outfit,str,agi,vit,int_stat,per,hp,mp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, name, 'male', 'Fighter', 1, 1, '#000', 'a', 5, 5, 5, 5, 5, 100, 50);

test('เขียนที่ server → flush → อยู่ใน D1 → server ใหม่ (restart) โหลดกลับมาครบ', async () => {
  const d1 = fakeD1(), a = mk(d1);
  user(a, 'u1', 'Somchai');
  a.prepare('INSERT INTO equipment (user_id, weapon_id) VALUES (?, ?)').run('u1', 'sword');
  a.prepare('INSERT INTO inventory (id,user_id,item_type,item_id,quantity,slot_index) VALUES (?,?,?,?,?,?)').run('i1', 'u1', 'potion', 'mp', 5, 0);
  a.prepare('UPDATE users SET baht = ? WHERE id = ?').run(777, 'u1');
  assert.equal(a.d1.pending(), 4);
  await a.d1.flush(); assert.equal(a.d1.pending(), 0);
  assert.equal(d1.s.prepare('SELECT baht FROM users WHERE id=?').get('u1').baht, 777);
  const b = mk(d1); // เครื่องใหม่ ดิสก์ว่าง
  assert.deepEqual(await b.d1.hydrate(), { users: 1, equipment: 1, inventory: 1 });
  assert.equal(b.prepare('SELECT username, baht FROM users').get().baht, 777);
  assert.equal(b.prepare('SELECT quantity FROM inventory').get().quantity, 5);
  a.d1.stop(); b.d1.stop();
});

test('ROLLBACK ไม่ถูกส่งขึ้น D1, COMMIT ส่งทั้งก้อน', async () => {
  const d1 = fakeD1(), a = mk(d1);
  a.exec('BEGIN'); user(a, 'u2', 'A'); a.exec('ROLLBACK'); assert.equal(a.d1.pending(), 0);
  a.exec('BEGIN'); user(a, 'u3', 'B'); a.exec('COMMIT'); assert.equal(a.d1.pending(), 1);
  await a.d1.flush(); assert.equal(d1.s.prepare('SELECT count(*) c FROM users').get().c, 1); a.d1.stop();
});

test('gateway ล่ม → คงคิวไว้ ไม่ทำให้เกมพัง แล้วส่งใหม่ได้เมื่อกลับมา', async () => {
  const d1 = fakeD1(); let up = false, err = 0;
  const a = mk(d1, { fetchImpl: (u, i) => (up ? gateway(d1)(u, i) : Promise.reject(new Error('down'))), onError: () => err++ });
  user(a, 'u4', 'C'); await a.d1.flush(); assert.equal(a.d1.pending(), 1); assert.equal(err, 1);
  up = true; await a.d1.flush(); assert.equal(a.d1.pending(), 0); a.d1.stop();
});

test('gateway ปฏิเสธ token ผิด และคำสั่งที่ไม่ใช่ INSERT/UPDATE/DELETE', async () => {
  const d1 = fakeD1(), env = { DB: d1, GATEWAY_TOKEN: TOKEN }, post = (body, tok = TOKEN) => worker.fetch(new Request('http://gw/batch', { method: 'POST', headers: { authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }), env);
  assert.equal((await post({ statements: [] }, 'wrong')).status, 401);
  assert.equal((await post({ statements: [{ sql: 'DROP TABLE users' }] })).status, 400);
  assert.equal((await worker.fetch(new Request('http://gw/dump'), { DB: d1 })).status, 401); // ไม่ตั้ง secret = ปิดทั้งหมด
});
