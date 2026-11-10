// ศิลปะ pixel ทั้งหมดวาดด้วยโค้ด (ไม่มีไฟล์ภาพ): พื้น, ตึก, ต้นไม้/หิน/ดอกไม้, มอน (ตัวละครผู้เล่นอยู่ใน paperdoll.js), แร่, หุ่น
// พิกเซลทุกเม็ดมาจากฟังก์ชันเหล่านี้ → แก้สี/รูปทรงที่นี่ที่เดียว · ใช้ NearestFilter ทุก texture
import * as THREE from 'three';

export const hash = (x, y, k = 0) => (Math.imul(x * 374761393 + y * 668265263 + k * 1013904223, 1274126177) >>> 0) / 4294967296;
export const OUT = '#0b0912';
export const tint = { value: new THREE.Color(1, 1, 1) }; // ความสว่างของ sprite ที่ไม่รับแสง (ต้นไม้/หิน) — world ตั้งตามแผนที่ (กลางคืน = มืด)
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function texOf(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
export const rect = (g) => (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
export function line(g, x0, y0, x1, y1, c) { // เส้นพิกเซล (Bresenham)
  g.fillStyle = c; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
export function outline(c) { // เส้นขอบดำ 1 พิกเซลรอบรูปทรง = หัวใจของลุค pixel art
  const g = c.getContext('2d'), w = c.width, h = c.height, src = g.getImageData(0, 0, w, h), d = src.data, o = g.createImageData(w, h), [r, gr, b] = rgb(OUT);
  o.data.set(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 0) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, bb]) => { const X = x + a, Y = y + bb; return X >= 0 && Y >= 0 && X < w && Y < h && d[(Y * w + X) * 4 + 3] > 0; })) { const i = (y * w + x) * 4; o.data[i] = r; o.data[i + 1] = gr; o.data[i + 2] = b; o.data[i + 3] = 255; }
  }
  g.putImageData(o, 0, 0); return c;
}

// ---------- พื้น: ทุก tile = 16×16 พิกเซล ----------
export const T = 16;
export function paintGround(rows, lobby) {
  const N = rows.length, c = canvas(N * T, N * T), g = c.getContext('2d'), img = g.createImageData(N * T, N * T);
  const road = (x, y) => lobby && (y === 5 || y === 6 || ((x === 10 || x === 11) && y >= 7));
  const plaza = (x, y) => lobby && (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) <= 3.4 || rows[y][x] === 'G');
  const GRASS = lobby ? ['#2f5236', '#294a30', '#36603e', '#203c27'] : ['#16281f', '#12221a', '#1b3125', '#0d1a13']; // เมืองยามค่ำ / ป่ากลางคืน
  for (let py = 0; py < N * T; py++) for (let px = 0; px < N * T; px++) {
    const x = px >> 4, y = py >> 4, lx = px & 15, ly = py & 15, r = hash(px, py, 3);
    let col;
    if (plaza(x, y)) { col = (x + y) % 2 ? '#5c5a6a' : '#53515f'; if (lx === 0 || ly === 0) col = '#38364a'; else if (r < 0.06) col = '#4a4858'; }
    else if (road(x, y)) { col = r < 0.12 ? '#23252f' : '#1b1d26'; }
    else { col = GRASS[r < 0.55 ? 0 : r < 0.75 ? 1 : r < 0.9 ? 2 : 3]; if (hash(x, y, 5) < 0.22 && ((lx + ly * 3) % 11 === 0)) col = GRASS[3]; } // หญ้า: จุดเข้ม/อ่อน + กอเล็กๆ
    const [R, G, B] = rgb(col), i = (py * N * T + px) * 4; img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (lobby) { // เส้นกลางถนนประ + ตราวงเวียนกลางลาน
    g.fillStyle = '#a08a40';
    for (let x = 0; x < N * T; x += 16) g.fillRect(x, 6 * T - 1, 8, 2);
    for (let y = 7 * T; y < N * T; y += 16) g.fillRect(11 * T - 1, y, 2, 8);
    const cx = 12 * T, cy = 12 * T, ring = (R, col) => { g.fillStyle = col; for (let a = 0; a < 720; a++) g.fillRect(Math.round(cx + Math.cos(a / 114.6) * R), Math.round(cy + Math.sin(a / 114.6) * R), 1, 1); };
    ring(1.9 * T, '#5aa8ff'); ring(1.9 * T - 1, '#2a5aa8'); ring(1.2 * T, '#5aa8ff');
    g.fillStyle = '#5aa8ff'; g.fillRect(cx - 1, cy - 5, 3, 11); g.fillRect(cx - 5, cy - 1, 11, 3); // กากบาทกลางวง
  }
  return texOf(c);
}

// ---------- ตึก: กล่อง + texture ผนัง/หลังคาพิกเซล ----------
const BTYPE = { H: { wall: '#2c3346', trim: '#5aa8ff', door: '#141820' }, M: { wall: '#3e2e2a', trim: '#e0703a', door: '#141820' }, P: { wall: '#5a5f6c', trim: '#e04b4b', door: '#1e2638' }, T: { wall: '#253a32', trim: '#3fd08a', door: '#141820' }, X: { wall: '#30343f', trim: '#4a5068', door: '#141820' } };
const wallCache = {};
export function wallTex(ch, rowsOfWin = 3) {
  const key = ch + rowsOfWin; if (wallCache[key]) return wallCache[key];
  const t = BTYPE[ch] ?? BTYPE.X, W = 16, H = 10 + rowsOfWin * 8 + 4, c = canvas(W, H), g = c.getContext('2d'), p = rect(g), [r, gg, b] = rgb(t.wall);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (hash(x, y, 9) - 0.5) * 18; p(x, y, 1, 1, `rgb(${r + k | 0},${gg + k | 0},${b + k | 0})`); } // อิฐ/ปูนหยาบ
  p(0, 0, W, 3, t.trim); p(0, 3, W, 1, '#0004');          // แถบป้ายด้านบน
  for (let i = 0; i < rowsOfWin; i++) for (const x of [2, 9]) { const y = 6 + i * 8; p(x - 1, y - 1, 6, 6, '#2a2f44'); p(x, y, 4, 4, hash(x, i, 7) < 0.45 ? '#ffd27a' : '#1c2a44'); p(x, y, 4, 1, '#ffffff66'); } // หน้าต่าง (บางบานเปิดไฟ)
  p(6, H - 8, 5, 8, t.door); p(7, H - 7, 3, 6, '#00000033'); p(9, H - 4, 1, 1, '#e8c25a');                                                             // ประตู
  if (ch === 'P') { p(11, 0, 4, 3, '#fff'); p(12, 0, 2, 3, t.trim); p(11, 1, 4, 1, t.trim); }                                                            // กากบาทแดงโรงพยาบาล
  return (wallCache[key] = texOf(c));
}
let roofT; export const roofTex = () => roofT ??= (() => { const c = canvas(8, 8), g = c.getContext('2d'); g.fillStyle = '#1e2230'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#282d3e'; g.fillRect(1, 1, 6, 6); g.fillStyle = '#5aa8ff'; g.fillRect(3, 3, 2, 2); return texOf(c); })();

// ---------- ธรรมชาติ: sprite ต้นไม้/หิน/พุ่ม/ดอกไม้ ----------
const NAT = {
  pine: [20, 28, (p) => { p(9, 22, 3, 5, '#6b4a2b'); [[2, 12, 16], [4, 7, 12], [6, 2, 8]].forEach(([y, x, w], i) => { p(10 - w / 2, y + 6, w, 7, i % 2 ? '#2f7a3a' : '#276a32'); p(10 - w / 2 + 1, y + 6, 2, 2, '#4e9a3a'); }); p(9, 1, 2, 3, '#2f7a3a'); }],
  oak: [20, 24, (p) => { p(9, 15, 3, 8, '#6b4a2b'); p(3, 3, 14, 12, '#3f8f3a'); p(5, 1, 10, 3, '#3f8f3a'); p(5, 4, 4, 3, '#5fb04a'); p(11, 8, 4, 3, '#2f7a3a'); }],
  rock: [16, 12, (p) => { p(2, 5, 12, 6, '#8a93a0'); p(4, 2, 8, 4, '#a4adba'); p(3, 7, 4, 2, '#6c7480'); p(9, 3, 3, 2, '#c4ccd6'); }],
  bush: [14, 10, (p) => { p(1, 4, 12, 5, '#3f8f3a'); p(3, 1, 8, 4, '#4e9a3a'); p(4, 2, 2, 2, '#6fbd4b'); p(9, 6, 3, 2, '#2f7a3a'); }],
  tuft: [8, 6, (p) => { p(1, 3, 1, 3, '#3e7a2b'); p(3, 1, 1, 5, '#4e9a3a'); p(5, 2, 1, 4, '#3e7a2b'); p(6, 3, 1, 3, '#4e9a3a'); }],
  flowerR: [6, 8, (p) => { p(2, 4, 1, 4, '#3e7a2b'); p(1, 1, 3, 3, '#e8483c'); p(2, 2, 1, 1, '#ffe08a'); }],
  flowerY: [6, 8, (p) => { p(2, 4, 1, 4, '#3e7a2b'); p(1, 1, 3, 3, '#f0d040'); p(2, 2, 1, 1, '#c0701a'); }],
  flowerP: [6, 8, (p) => { p(2, 4, 1, 4, '#3e7a2b'); p(1, 1, 3, 3, '#b070e0'); p(2, 2, 1, 1, '#ffe08a'); }],
  mush: [8, 7, (p) => { p(3, 4, 2, 3, '#e8dcc0'); p(1, 1, 6, 3, '#d8403a'); p(2, 2, 1, 1, '#fff'); p(5, 1, 1, 1, '#fff'); }],
};
const natCache = {};
export const natTex = (k) => natCache[k] ??= (() => { const [w, h, d] = NAT[k], c = canvas(w, h), g = c.getContext('2d'); d(rect(g)); outline(c); return { tex: texOf(c), w, h }; })();

const BB = (() => { // billboard instanced: หันหน้าเข้าหากล้องเสมอ, จุดยึดอยู่ที่โคนล่างกลาง
  let m; return () => m ??= (t) => new THREE.ShaderMaterial({ fog: true, uniforms: { map: { value: t }, tint, ...THREE.UniformsLib.fog }, vertexShader: `varying vec2 vUv;
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vec4 c = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
      c.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)); gl_Position = projectionMatrix * c; vec4 mvPosition = c;
      #include <fog_vertex>
    }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying vec2 vUv;
    #include <fog_pars_fragment>
    void main(){ vec4 c = texture2D(map, vUv); if (c.a < .5) discard; gl_FragColor = vec4(c.rgb * tint, 1.);
    #include <colorspace_fragment>
    #include <fog_fragment>
    }` });
})();
const bbGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; })();
export const PXW = 1 / 20; // 1 พิกเซลของ sprite ธรรมชาติ = กี่หน่วยโลก
export function billboards(kind, list) { // list: [{ x, y, s }]
  const { tex, w, h } = natTex(kind), im = new THREE.InstancedMesh(bbGeo, BB()(tex), list.length), m = new THREE.Matrix4();
  list.forEach((p, i) => { m.compose(new THREE.Vector3(p.x, 0, p.y), new THREE.Quaternion(), new THREE.Vector3(w * PXW * p.s, h * PXW * p.s, 1)); im.setMatrixAt(i, m); });
  im.frustumCulled = false; return im;
}

// ---------- มอน / แร่ / หุ่น ----------
function drawGoblin(g, f, boss) {
  const p = rect(g), s = f % 2, G = boss ? '#2a4a30' : '#3e6a3a', D = boss ? '#1a3020' : '#284a28';
  p(4, 3 + s, 8, 6, G); p(2, 4 + s, 2, 2, G); p(12, 4 + s, 2, 2, G); p(1, 3 + s, 1, 2, D); p(14, 3 + s, 1, 2, D);       // หัว + หูแหลม
  p(5, 5 + s, 2, 2, '#ff3a3a'); p(9, 5 + s, 2, 2, '#ff3a3a'); p(6, 6 + s, 1, 1, OUT); p(10, 6 + s, 1, 1, OUT); p(6, 8 + s, 4, 1, '#fff'); // ตา+เขี้ยว
  p(4, 9 + s, 8, 4, boss ? '#7a2a2a' : '#7a5a30'); p(4, 12 + s, 8, 1, '#3b2a1e');                                           // ตัว
  p(3, 10 + s, 1, 3, G); p(12, 10 + s, 1, 3, G); p(13, 6 + s, 2, 8, '#7a5230'); p(12, 5 + s, 4, 3, '#5a3a20');            // แขน + กระบอง
  p(5, 13, 2, 2 + (s ? 0 : 1), D); p(9, 13, 2, 3 - (s ? 0 : 1), D);                                                         // ขา
  if (boss) { p(4, 0, 8, 2, '#f0c020'); p(4, -0, 1, 1, '#f0c020'); p(7, 0, 2, 1, '#fff7b0'); p(11, 0, 1, 1, '#f0c020'); }
}
function drawNode(g) { const p = rect(g); p(2, 8, 10, 5, '#5a6078'); p(3, 3, 3, 8, '#6fa8ff'); p(6, 0, 3, 11, '#9fd0ff'); p(9, 4, 3, 7, '#5a8cf0'); p(7, 1, 1, 5, '#fff'); p(4, 4, 1, 3, '#d0e8ff'); }
function drawDummy(g) { const p = rect(g); p(7, 6, 2, 14, '#7a5230'); p(2, 9, 12, 2, '#7a5230'); p(4, 1, 8, 8, '#d8b86a'); p(5, 3, 2, 2, OUT); p(9, 3, 2, 2, OUT); p(5, 6, 6, 1, OUT); p(3, 11, 10, 6, '#c8a050'); p(5, 17, 6, 2, '#9a7a38'); p(6, 8, 1, 1, '#e04b4b'); }
const small = {};
export function propSheet(kind) { // 'goblin' | 'boss' | 'node' | 'dummy' → { canvas, w, h, n }
  if (small[kind]) return small[kind];
  const mob = kind === 'goblin' || kind === 'boss', n = mob ? 2 : 1, w = mob ? 16 : kind === 'node' ? 14 : 16, h = mob ? 16 : kind === 'node' ? 14 : 21, c = canvas(w * n, h), g = c.getContext('2d');
  for (let i = 0; i < n; i++) { const f = canvas(w, h), fg = f.getContext('2d'); if (mob) drawGoblin(fg, i, kind === 'boss'); else if (kind === 'node') drawNode(fg); else drawDummy(fg); outline(f); g.drawImage(f, i * w, 0); }
  return (small[kind] = { canvas: c, w, h, n });
}
