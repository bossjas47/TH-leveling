// ชุดแบบ paper-doll (วาดด้วยโค้ดใน client/pixel.js): outfit = "top#สี|bottom#สี|shoes#สี" เช่น "coat#1c1f2c|pants#16141b|boots#16141b"
// ใช้ร่วมกัน: server ตรวจค่า (api/world), client แยกค่าไปวาด — รายการแบบ/สีอยู่ใน balance.json → appearance.clothes
export const SLOTS = ['top', 'bottom', 'shoes'];
export const DEFAULT_OUTFIT = 'coat#1c1f2c|pants#16141b|boots#16141b';

export function parseOutfit(s) { // ค่าเก่า/เสีย → ชุดเริ่มต้น (แถวเดิมใน DB เก็บชื่อชุด เช่น street_hoodie)
  const parts = String(s ?? '').split('|').map((p) => p.split('#'));
  if (parts.length !== 3 || parts.some((p) => p.length !== 2)) return parseOutfit(DEFAULT_OUTFIT);
  return Object.fromEntries(SLOTS.map((k, i) => [k, { s: parts[i][0], c: '#' + parts[i][1] }]));
}
export const outfitStr = (o) => SLOTS.map((k) => `${o[k].s}${o[k].c}`).join('|');

export function validOutfit(s, clothes) {
  if (typeof s !== 'string' || s.length > 64 || s.split('|').length !== 3) return false;
  const o = parseOutfit(s);
  return outfitStr(o) === s && SLOTS.every((k) => clothes[k].includes(o[k].s) && clothes.colors.includes(o[k].c));
}

export function validLook(look, a) { // a = balance.appearance · คืนข้อความผิดพลาด หรือ null
  if (!look || typeof look !== 'object') return 'หน้าตาไม่ถูกต้อง';
  if (!Number.isInteger(look.skin_tone) || look.skin_tone < 1 || look.skin_tone > a.skin_tones) return 'โทนผิวไม่ถูกต้อง';
  if (!Number.isInteger(look.hair_style) || look.hair_style < 1 || look.hair_style > a.hair_styles) return 'ทรงผมไม่ถูกต้อง';
  if (!a.hair_colors.includes(look.hair_color)) return 'สีผมไม่ถูกต้อง';
  if (!validOutfit(look.outfit, a.clothes)) return 'ชุดไม่ถูกต้อง';
  return null;
}
