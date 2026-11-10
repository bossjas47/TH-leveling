// Gate E (Green Gate) 42×42 — สร้างแบบกำหนดผล (seed เดียว) ให้ server กับ client ได้แผนที่เดียวกัน (GDD §8.1, §18.1)
const N = 42;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function makeGateE({ seed = 7, mobs = 22, nodes = 10 } = {}) {
  const rnd = mulberry32(seed);
  const g = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x === 0 || y === 0 || x === N - 1 || y === N - 1 ? '#' : rnd() < 0.09 ? 'R' : '.')));
  const clear = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = '.'; };
  clear(19, 23, 36, 40);                 // จุดเกิด (ใต้)
  clear(17, 25, 3, 9);                   // ลานบอส (เหนือ)
  const spawn = { x: 21.5, y: 38.5 }, boss = { x: 21.5, y: 6.5 };

  const reach = () => { // BFS จากจุดเกิด
    const seen = new Set(['21,38']), q = [[21, 38]];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (g[y + dy]?.[x + dx] === '.' && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); } } }
    return seen;
  };
  let seen = reach();
  if (!seen.has('21,6')) { clear(21, 21, 3, 40); seen = reach(); } // ไม่ถึงบอส → ตัดทางตรง (กันแผนที่ตัน)
  const free = [...seen].map((k) => k.split(',').map(Number)).filter(([x, y]) => Math.hypot(x + 0.5 - spawn.x, y + 0.5 - spawn.y) > 8 && !(x >= 17 && x <= 25 && y <= 9));
  const pick = (count, gap) => {
    const out = [];
    for (let tries = 0; out.length < count && tries < 5000; tries++) {
      const [x, y] = free[Math.floor(rnd() * free.length)];
      if (out.every(([a, b]) => Math.hypot(a - x, b - y) >= gap)) out.push([x, y]);
    }
    return out.map(([x, y]) => [x + 0.5, y + 0.5]);
  };
  return { rows: g.map((r) => r.join('')), N, spawn, boss, mobSpawns: pick(mobs, 4), nodeSpawns: pick(nodes, 3) };
}
