import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseOutfit, validOutfit, outfitStr, DEFAULT_OUTFIT } from './look.js';

const C = JSON.parse(readFileSync(new URL('./balance.json', import.meta.url), 'utf8')).appearance.clothes;

test('ชุด: ค่าเริ่มต้นถูกต้อง, แยก/รวมกลับได้เหมือนเดิม', () => {
  assert.ok(validOutfit(DEFAULT_OUTFIT, C));
  assert.equal(outfitStr(parseOutfit(DEFAULT_OUTFIT)), DEFAULT_OUTFIT);
  assert.deepEqual(parseOutfit('suit#d8dce6|skirt#8a2030|sneakers#16141b').bottom, { s: 'skirt', c: '#8a2030' });
});

test('ชุด: แบบ/สีนอกรายการ, รูปแบบเสีย, ค่าเก่า = ไม่ผ่าน (ค่าเก่าวาดเป็นชุดเริ่มต้น)', () => {
  for (const bad of ['street_hoodie', 'cape#1c1f2c|pants#16141b|boots#16141b', 'coat#ffffff|pants#16141b|boots#16141b', 'coat#1c1f2c|pants#16141b', 'coat#1c1f2c|pants#16141b|boots#16141b|x', 42, null])
    assert.equal(validOutfit(bad, C), false, String(bad));
  assert.equal(outfitStr(parseOutfit('street_hoodie')), DEFAULT_OUTFIT);
});
