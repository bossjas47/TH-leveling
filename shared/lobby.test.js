import test from 'node:test';
import assert from 'node:assert/strict';
import { move, solid, SPAWN, MAP, N } from './lobby.js';

test('แผนที่ 48×48, spawn ว่าง', () => {
  assert.equal(MAP.length, N); assert.ok(MAP.every((r) => r.length === N));
  assert.ok(!solid(SPAWN.x, SPAWN.y));
});

test('wall sliding: ชนกำแพงเหนือแล้วยังไถลตามแกน x ได้', () => {
  const p = { x: 24, y: 12.3 };
  move(p, 1, -1, 0.5); // y ติดกำแพง (y<12.3), x ต้องไปต่อ
  assert.equal(p.y, 12.3); assert.equal(p.x, 24.5);
});

test('ไม่ทะลุกำแพงแม้เดินสุดทิศ', () => {
  const p = { ...SPAWN };
  for (let i = 0; i < 1000; i++) move(p, -1, -1, 0.2);
  assert.ok(p.x >= 12.3 && p.y >= 12.3 && !solid(p.x, p.y));
});
