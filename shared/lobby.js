// แผนที่ + การชนของ bkk_lobby — ใช้ร่วมกัน: server ตัดสินตำแหน่งจริง, client ใช้ทำนาย (GDD §9)
// bkk_lobby 24×24 (GDD §9.1) — # = กำแพง, . = พื้น, H/M/T/G = ตึก/ลาน (ตกแต่งสี)
export const MAP = [
  '########################',
  '#......................#',
  '#..HHHHHH.....MMMMMM...#',
  '#..HHHHHH.....MMMMMM...#',
  '#..HHHHHH.....MMMMMM...#',
  '#......................#',
  '#......................#',
  '#.PPPPP.....GGGG.......#',
  '#.PPPPP.....GGGG..MMMM.#',
  '#.PPPPP.....GGGG..MMMM.#',
  '#.PPPPP.....GGGG..MMMM.#',
  '#.....................##',
  '#.....................##',
  '#.......GGGG...........#',
  '#.......GGGG...........#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#...TTTT.......TTTT....#',
  '#...TTTT.......TTTT....#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
].map((r) => r.padEnd(24, '#').slice(0, 24));
export const N = 24;
// ตึก = ทึบ; G = ลานพื้นพิเศษ (เดินได้)
export const SOLID = new Set(['#', 'H', 'M', 'P', 'T', 'R']); // R = ต้นไม้/หินใน Gate

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
export const SPAWN = { x: 12, y: 12 };
