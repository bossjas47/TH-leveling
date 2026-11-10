import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basicDamage, damageTaken, critRate, attackInterval, expMult } from './combat.js';

const B = JSON.parse(readFileSync(new URL('./balance.json', import.meta.url)));
const u = (job, c) => ({ job, str: c.str ?? 0, agi: c.agi ?? 0, int_stat: c.int ?? 0 });

test('ดาเมจ Lv.1 ตรง GDD §21.7', () => {
  for (const [job, exp] of Object.entries({ Fighter: 12, Assassin: 12.5, Mage: 12, Tank: 11.5, Healer: 10, Miner: 11 })) {
    const c = B.classes[job];
    assert.equal(basicDamage(B, u(job, c), c.starter_weapon), exp, job);
  }
});

test('Fighter Lv.70 ดาบสวรรค์ +10 = 2,776 (GDD §21.5)', () => {
  assert.equal(basicDamage(B, u('Fighter', { str: 152, agi: 9, int: 6 }), 'sword_long_s', 10), 2776);
});

test('Mage ถือ Greatsword = prof 0.2 (841) แย่กว่า Staff (2,327)', () => {
  const mage = u('Mage', { str: 6, agi: 8, int: 154 });
  assert.equal(Math.round(basicDamage(B, mage, 'sword_great_s', 10)), 841);
  assert.equal(basicDamage(B, mage, 'staff_e', 0) < 100, true); // staff E ATK 4
});

test('DEF แบบ K: เกราะ rank เดียวกันกันได้ ~5% (E) ถึง ~42% (S)', () => {
  assert.ok(Math.abs(1 - damageTaken(1, 10, 5) / 1 - 0.05) < 0.01);
  assert.ok(Math.abs(1 - damageTaken(1, 1200, 77) - 0.42) < 0.02);
});

test('crit cap 50%, attack interval, level-diff penalty', () => {
  assert.equal(critRate(B, 999, 'sword_short_e'), 0.5);
  assert.ok(Math.abs(critRate(B, 9, 'sword_short_e') - 0.095) < 1e-9);
  assert.ok(Math.abs(attackInterval(B, 9, 'sword_short_e') - 0.893) < 0.001);
  assert.deepEqual([0, 9, 10, 19, 20].map((d) => expMult(B, 5 + d, 5)), [1, 1, 0.5, 0.5, 0.1]);
});
