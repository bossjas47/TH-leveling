import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { openDb } from './db.js';
import { makeVerifier } from './auth.js';
import { makeApi } from './api.js';
import { makeServer } from './index.js';

const B = JSON.parse(readFileSync(new URL('../shared/balance.json', import.meta.url)));
const PID = 'th-test';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: 'RS256', kid: 'k1' }] });

const token = (uid, { key = privateKey, aud = PID, exp = '1h' } = {}) =>
  new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setSubject(uid)
    .setIssuer(`https://securetoken.google.com/${PID}`).setAudience(aud).setExpirationTime(exp).sign(key);

const srv = makeServer(makeApi({ db: openDb(':memory:'), verify: makeVerifier(PID, jwks), B }));
await new Promise((r) => srv.listen(0, r));
const url = (p) => `http://localhost:${srv.address().port}${p}`;
test.after(() => srv.close());

const look = { skin_tone: 2, hair_style: 1, hair_color: '#1a1a1a', outfit: 'street_hoodie' };
const post = (tok, body) => fetch(url('/api/character'), { method: 'POST', headers: { authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
const get = (tok) => fetch(url('/api/me'), { headers: { authorization: `Bearer ${tok}` } });

test('token ปลอม/หมดอายุ/audience ผิด/ไม่มี → 401', async () => {
  for (const t of [await token('u1', { key: other.privateKey }), await token('u1', { exp: '-1h' }), await token('u1', { aud: 'x' }), 'junk', '']) {
    assert.equal((await get(t)).status, 401);
  }
});

test('ยังไม่มีตัวละคร → 404', async () => {
  assert.equal((await get(await token('new1'))).status, 404);
});

test('สร้างตัวละครทุกอาชีพ: stat 50 แต้ม, HP/MP ตาม GDD §3.2, ได้อาวุธเริ่มต้น', async () => {
  const expected = { Fighter: [260, 90], Assassin: [180, 90], Mage: [180, 240], Tank: [340, 105], Healer: [240, 210], Miner: [300, 90] };
  for (const [job, [hp, mp]] of Object.entries(expected)) {
    const r = await post(await token(`uid-${job}`), { username: `ฮันเตอร์${job.slice(0, 3)}`, gender: 'male', job, look });
    assert.equal(r.status, 201, job);
    const u = await r.json();
    assert.equal(u.str + u.agi + u.vit + u.int_stat + u.per, 50, job);
    assert.deepEqual([u.max_hp, u.max_mp, u.hp, u.mp], [hp, mp, hp, mp], job);
    assert.equal(u.baht, 10000); assert.equal(u.hunter_rank, 'E'); assert.equal(u.free_respawn_count, 4);
  }
  assert.equal((await (await get(await token('uid-Mage'))).json()).job, 'Mage');
});

test('สร้างซ้ำ → 409, ชื่อซ้ำ (ไม่สนตัวพิมพ์) → 409 และไม่เหลือแถวค้าง', async () => {
  const a = { username: 'Boss99', gender: 'female', job: 'Fighter', look };
  assert.equal((await post(await token('dup1'), a)).status, 201);
  assert.equal((await post(await token('dup1'), { ...a, username: 'Other99' })).status, 409);
  assert.equal((await post(await token('dup2'), { ...a, username: 'BOSS99' })).status, 409);
  assert.equal((await get(await token('dup2'))).status, 404); // rollback สะอาด
  assert.equal((await post(await token('dup2'), { ...a, username: 'Boss98' })).status, 201);
});

test('ข้อมูลไม่ถูกต้อง → 400', async () => {
  const ok = { username: 'Valid1', gender: 'male', job: 'Mage', look };
  const bad = [{ ...ok, username: 'ab' }, { ...ok, username: 'a'.repeat(13) }, { ...ok, username: 'x y z' }, { ...ok, username: 'ฮ' + 'ั'.repeat(60) }, { ...ok, username: 'ัััั' }, { ...ok, username: '123' + '_' }, { ...ok, username: '<script>' },
    { ...ok, job: 'Monarch' }, { ...ok, gender: 'x' }, { ...ok, look: { ...look, skin_tone: 9 } },
    { ...ok, look: { ...look, hair_color: 'red' } }, { ...ok, look: { ...look, outfit: 'x' } }, { ...ok, look: undefined }];
  for (const b of bad) assert.equal((await post(await token('bad1'), b)).status, 400, JSON.stringify(b));
  assert.equal((await get(await token('bad1'))).status, 404);
});

test('ส่ง stat/baht/level เองมาไม่ได้ผล (server กำหนดเอง)', async () => {
  const r = await post(await token('cheat1'), { username: 'Cheater1', gender: 'male', job: 'Healer', look, level: 99, baht: 9e9, str: 999, hunter_rank: 'S' });
  const u = await r.json();
  assert.deepEqual([u.level, u.baht, u.str, u.hunter_rank], [1, 10000, 6, 'E']);
});
