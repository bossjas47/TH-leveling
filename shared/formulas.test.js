import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moveSpeed, maxHp, maxMp, expNext } from './formulas.js';

const B = JSON.parse(readFileSync(new URL('./balance.json', import.meta.url)));

test('HP/MP ตามตาราง §3.2', () => {
  for (const [name, c] of Object.entries(B.classes)) {
    assert.equal(maxHp(c.vit, 1), (c.vit + 1) * 20, name);
  }
  assert.equal(maxHp(12, 1), 260); // Fighter
  assert.equal(maxMp(16), 240);    // Mage
});

test('EXP ตามตาราง §16.3', () => {
  assert.equal(expNext(1), 100);
  assert.equal(expNext(10), 15800);
  assert.equal(expNext(50), 547000);
  assert.equal(expNext(99), 2460000);
});

test('ความเร็วเดิน: AGI 9 ≈ 4.09, cap ×1.5', () => {
  assert.ok(Math.abs(moveSpeed(B, 9) - 4.09) < 0.01);
  assert.equal(moveSpeed(B, 9999), 6);
});
