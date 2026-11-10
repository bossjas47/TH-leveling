// สูตรที่ client (แสดงผล) และ server (ตัดสินจริง) ใช้ร่วมกัน — ตัวเลขมาจาก balance.json (GDD §4.2, §16.2)
export const moveSpeed = (B, agi) =>
  B.movement.base_tiles_per_sec * Math.min(B.movement.max_mult, 1 + agi / B.movement.agi_div);

export const maxHp = (vit, level, armorHp = 0) => (vit + level) * 20 + armorHp;
export const maxMp = (int) => int * 15;

export function expNext(level) {
  const x = 100 * level ** 2.2;
  const d = Math.floor(Math.log10(x)) - 2; // ปัดเหลือ 3 หลักนัยสำคัญ
  return d > 0 ? Math.round(x / 10 ** d) * 10 ** d : Math.round(x);
}
