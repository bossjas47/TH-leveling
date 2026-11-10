// แผนที่ + การชนของ bkk_lobby — ใช้ร่วมกัน: server ตัดสินตำแหน่งจริง, client ใช้ทำนาย (GDD §9)
// bkk_lobby 48×48: ย่านกลาง 24×24 ที่ (12,12) = ภาพพื้นหลังกรุงเทพ (client/assets/lobby_bkk.jpg) ที่เหลือเป็นกำแพง
// . = เดินได้ (ถนน/ทางเท้า), # = ทึบ (ตึก ต้นไม้ คลอง เสา BTS ขอบภาพ) — พิกัดช่อง (i,j) ในภาพ: i = ลงขวา (+x), j = ลงซ้าย (+y)
export const N = 48;
const OFF = 12, PILLARS = [[15, 2], [15, 8], [15, 15], [15, 21]]; // เสา BTS ฐานเสา 2 ช่อง (i=15,16) — เดินลอดใต้ราง
// shortcut: มาสก์วาดด้วยตาจากภาพ ไม่ใช่การวัด — เปิด ?grid=1 ดูช่องทึบทับภาพ แล้วแก้กฎด้านล่างให้ตรง
const isBlocked = (i, j) => (i <= 7 && j <= 19) // 7-Eleven + ตึกแถว (รวมพื้นที่ที่ถูกบัง)
  || (i >= 17 && j <= 2) // ตึกสูงขวา
  || (i >= 17 && j >= 9) // คลอง
  || (i <= 3 && j >= 20) // เพิงสังกะสี + ต้นไม้
  || PILLARS.some(([a, b]) => (a === i || a + 1 === i) && b === j);
export const MAP = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => {
  const i = x - OFF, j = y - OFF;
  return i >= 0 && j >= 0 && i < 24 && j < 24 && !isBlocked(i, j) ? '.' : '#';
}).join(''));
// ตึก = ทึบ; G = ลานพื้นพิเศษ (เดินได้)
export const SOLID = new Set(['#', 'H', 'M', 'P', 'T', 'A', 'O', 'S', 'R']); // R = ต้นไม้/หินใน Gate

const R = 0.3; // รัศมีตัวละคร (tiles)

// แผนที่จากแถวข้อความ (สี่เหลี่ยมจัตุรัส): solid / blocked / move ผูกกับแผนที่นั้น
export function makeMap(rows) {
  const n = rows.length;
  const solid = (x, y) => x < 0 || y < 0 || x >= n || y >= n || SOLID.has(rows[Math.floor(y)][Math.floor(x)]);
  const blocked = (x, y) => solid(x - R, y - R) || solid(x + R, y - R) || solid(x - R, y + R) || solid(x + R, y + R);
  // ขยับ p ไปทิศ (dx,dy) ระยะ d แบบ wall sliding แยกแกน X/Y (GDD §9.2)
  const move = (p, dx, dy, d) => {
    if (!blocked(p.x + dx * d, p.y)) p.x += dx * d;
    if (!blocked(p.x, p.y + dy * d)) p.y += dy * d;
  };
  return { rows, N: n, solid, blocked, move };
}

export const LOBBY = makeMap(MAP);
export const { solid, blocked, move } = LOBBY;
export const SPAWN = { x: N / 2, y: N / 2 }; // กลางลานวงเวียน
