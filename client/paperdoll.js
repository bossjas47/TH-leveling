// ตัวละคร paper-doll วาดด้วยโค้ด: โครงกระดูก (pose) → วาดเป็นชั้น: ร่างกาย → กางเกง → รองเท้า → เสื้อ → หัว/ผม → หมวก → อาวุธ
// ใส่ของ = เปลี่ยน id ใน equip (ITEMS) ไม่ต้องวาดใหม่ทั้งตัว · สัดส่วนคนจริงสูง ~6.7 หัว (≈170–175 ซม.) ขายาวครึ่งตัว ไม่อ้วน
// sprite 40×60 พิกเซล, 3 มุม (หน้า/หลัง/ข้าง) × 10 เฟรม (ยืน 2, เดิน 4, ฟัน 3, ล้ม/คุกเข่า 1) — มุมมองบุคคลที่สาม: เลือกมุมตามทิศเทียบกล้อง
import { canvas, rect, line, outline } from './pixel.js';

export const CW = 40, CH = 60, FEET = 57; // ปลายเท้าอยู่ y=57 (โครงวาดที่ y=51 แล้วเลื่อนลง 6 ให้มีที่ว่างเหนือหัวสำหรับหมวก/อาวุธที่ยกขึ้น)
export const FRAMES = { idle: 0, walk: 2, atk: 6, down: 9, n: 10 };
export const VIEW = { f: 0, b: 1, s: 2 };
const SKIN = ['#f6d2b4', '#e9b98e', '#c98e5f', '#8d5a3b'];

// ---------- ของสวมใส่: slot + แบบ (type) + สี ----------
export const ITEMS = {
  coat_black: { slot: 'top', type: 'coat', c: '#1f1c26', c2: '#121017', in: '#3a3646' },
  coat_hunter: { slot: 'top', type: 'coat', c: '#1c1f2c', c2: '#10121a', in: '#2a3042' },
  robe_dark: { slot: 'top', type: 'robe', c: '#241c3a', c2: '#151024', in: '#3a2a5a' },
  robe_white: { slot: 'top', type: 'robe', c: '#c8ccd8', c2: '#9a9fb0', in: '#3fae7c' },
  plate_dark: { slot: 'top', type: 'armor', c: '#3a404e', c2: '#262a34', in: '#ffc44a' },
  vest_leather: { slot: 'top', type: 'vest', c: '#3a3020', c2: '#2a2216', in: '#4a4f5a' },
  pants_black: { slot: 'bottom', type: 'pants', c: '#16141b', c2: '#0d0c11' },
  pants_grey: { slot: 'bottom', type: 'pants', c: '#2a2e38', c2: '#1c2028' },
  boots_black: { slot: 'feet', type: 'boots', c: '#0d0c11', c2: '#2a2630' },
  boots_steel: { slot: 'feet', type: 'boots', c: '#4a5068', c2: '#6a7388' },
  hood_dark: { slot: 'head', type: 'hood', c: '#12141d', c2: '#1c1f2c' },
  hat_mage: { slot: 'head', type: 'hat', c: '#241c3a', c2: '#b48aff' },
  helm_dark: { slot: 'head', type: 'helmet', c: '#4a5068', c2: '#ffc44a' },
  hardhat: { slot: 'head', type: 'hardhat', c: '#c9902a', c2: '#fff7b0' },
  circlet: { slot: 'head', type: 'band', c: '#9aa3b8', c2: '#7dffb0' },
  sword_shadow: { slot: 'weapon', type: 'sword', c: '#2a3042', glow: '#7fe0ff' },
  greatsword_red: { slot: 'weapon', type: 'greatsword', c: '#2a2630', glow: '#ff5a4a' },
  dagger_cyan: { slot: 'weapon', type: 'dagger', c: '#2a3042', glow: '#7fe0ff' },
  staff_violet: { slot: 'weapon', type: 'staff', c: '#3a2a1e', glow: '#b48aff' },
  wand_green: { slot: 'weapon', type: 'staff', c: '#c8ccd8', glow: '#7dffb0', len: 0.6 },
  pickaxe: { slot: 'weapon', type: 'pickaxe', c: '#5a3a20', glow: '#ffb03a' },
  shield_tower: { slot: 'offhand', type: 'shield', c: '#3a404e', glow: '#ffc44a' },
  dagger_off: { slot: 'offhand', type: 'dagger', c: '#2a3042', glow: '#7fe0ff' },
};
// ชุดเริ่มต้นตามอาชีพ (ฮันเตอร์ชุดดำ ตา/อาวุธเรืองแสงสีประจำอาชีพ)
export const LOADOUT = {
  Fighter: ['coat_black', 'pants_black', 'boots_black', 'greatsword_red'],
  Assassin: ['coat_hunter', 'pants_black', 'boots_black', 'hood_dark', 'dagger_cyan', 'dagger_off'],
  Mage: ['robe_dark', 'pants_black', 'boots_black', 'hat_mage', 'staff_violet'],
  Tank: ['plate_dark', 'pants_grey', 'boots_steel', 'helm_dark', 'sword_shadow', 'shield_tower'],
  Healer: ['robe_white', 'pants_grey', 'boots_black', 'circlet', 'wand_green'],
  Miner: ['vest_leather', 'pants_grey', 'boots_black', 'hardhat', 'pickaxe'],
};
const EYE = { Fighter: '#ff5a4a', Assassin: '#7fe0ff', Mage: '#b48aff', Tank: '#ffc44a', Healer: '#7dffb0', Miner: '#ffb03a' };

// ---------- โครงกระดูก: ข้อต่อเป็นพิกเซลบนแคนวาส 40×54 ----------
// คืน { bob, head:[x,y], sh:[L,R], hip:[L,R], knee:[L,R], foot:[L,R], el:[L,R], hand:[L,R], atk } (L = แขน/ขาไกลกล้องในมุมข้าง)
function pose(view, frame) {
  const down = frame === FRAMES.down, atk = frame >= FRAMES.atk && !down ? frame - FRAMES.atk : -1, wt = frame >= FRAMES.walk && frame < FRAMES.atk ? frame - FRAMES.walk : -1;
  const bob = wt >= 0 ? (wt % 2 ? 0 : 1) : frame % 2 && !down ? 1 : 0, y = (v) => v + bob, X = 20;
  if (down) return { down: true, bob: 0, head: [X + 1, 25], sh: [[X - 4, 32], [X + 6, 32]], hip: [[X - 2, 44], [X + 3, 44]], knee: [[X - 3, 51], [X + 6, 45]], foot: [[X - 9, 51], [X + 6, 51]], el: [[X - 5, 38], [X + 7, 38]], hand: [[X - 4, 44], [X + 8, 45]], atk: -1 }; // คุกเข่า ก้มหัว
  if (view === 's') { // ด้านข้าง หันขวา: ขาแกว่งหน้า-หลัง แขนแกว่งสวน
    const s = wt >= 0 ? Math.sin((wt / 4) * Math.PI * 2) : 0, lift = (k) => (wt >= 0 ? Math.max(0, Math.cos((wt / 4) * Math.PI * 2 + k)) * 2 : 0);
    const leg = (d, k) => [[X + d * 2.5 | 0, y(38) - lift(k) | 0], [X + d * 5 | 0, 51 - lift(k) | 0]];
    const [kL, fL] = leg(-s, Math.PI), [kR, fR] = leg(s, 0);
    const hand = atk >= 0 ? [[X + 5, y(6)], [X + 11, y(16)], [X + 9, y(30)]][atk] : [X + 4 * -s + 1 | 0, y(27)];
    return { bob, head: [X, y(7)], sh: [[X, y(14)], [X, y(14)]], hip: [[X, 27], [X, 27]], knee: [kL, kR], foot: [fL, fR], el: [[X + 2 * s | 0, y(20)], [X + (atk >= 0 ? 3 : -2 * s + 1) | 0, y(atk === 0 ? 10 : 20)]], hand: [[X + 3 * s | 0, y(26)], hand], atk };
  }
  // หน้า/หลัง: ขาที่ก้าวยกสั้นลง แขนแกว่งขึ้นลงเล็กน้อย
  const lL = wt === 0 ? 3 : 0, lR = wt === 2 ? 3 : 0, sw = wt >= 0 ? [-1, 0, 1, 0][wt] : 0;
  const handR = atk >= 0 ? [[X + 8, y(5)], [X + 11, y(15)], [X + 7, y(31)]][atk] : [X + 6, y(27) + sw];
  return { bob, head: [X, y(7)], sh: [[X - 5, y(14)], [X + 5, y(14)]], hip: [[X - 2, 27], [X + 2, 27]], knee: [[X - 2, 38 - lL], [X + 2, 38 - lR]], foot: [[X - 2, 51 - lL], [X + 2, 51 - lR]],
    el: [[X - 6, y(20) - sw], [X + (atk >= 0 ? 7 : 6), y(atk === 0 ? 9 : 20) + sw]], hand: [[X - 6, y(27) - sw], handR], atk };
}

// ---------- ตัวช่วยวาด ----------
const limb = (g, a, b, w, c) => { for (let dx = 0; dx < w; dx++) line(g, a[0] + dx - (w >> 1), a[1], b[0] + dx - (w >> 1), b[1], c); }; // แขน/ขาเป็นเส้นหนา w
const trap = (p, y0, y1, l0, r0, l1, r1, c) => { for (let y = y0; y <= y1; y++) { const k = (y - y0) / Math.max(1, y1 - y0), l = Math.round(l0 + (l1 - l0) * k), r = Math.round(r0 + (r1 - r0) * k); p(l, y, r - l + 1, 1, c); } }; // สี่เหลี่ยมคางหมู (ลำตัว/ชายเสื้อ)

function drawWeapon(g, p, it, hand, P, view, back) {
  const [hx, hy] = hand, atk = P.atk;
  const L = it.type === 'greatsword' ? 20 : it.type === 'sword' ? 14 : it.type === 'dagger' ? 6 : it.type === 'staff' ? Math.round(24 * (it.len ?? 1)) : 14;
  const ang = atk >= 0 ? [-2.2, -0.9, 0.7][atk] : it.type === 'staff' ? -1.45 : -1.15; // มุมใบมีด (เรเดียน, 0 = ชี้ขวา)
  const tx = Math.round(hx + Math.cos(ang) * L), ty = Math.round(hy + Math.sin(ang) * L);
  if (back && atk < 0) return; // มองหลัง ตอนยืน: อาวุธถูกตัวบัง
  if (it.type === 'staff') { line(g, hx, hy + 6, tx, ty, it.c); p(tx - 1, ty - 2, 3, 3, it.glow); p(tx, ty - 1, 1, 1, '#fff'); return; }
  if (it.type === 'pickaxe') { line(g, hx, hy + 2, tx, ty, it.c); p(tx - 3, ty - 1, 7, 2, '#8a93a6'); p(tx - 3, ty + 1, 1, 2, '#8a93a6'); p(tx + 3, ty + 1, 1, 2, it.glow); return; }
  // ใบมีดดำ ขอบเรืองแสง + ด้ามจับ/การ์ด
  line(g, hx, hy, tx, ty, it.c); line(g, hx + 1, hy, tx + 1, ty, it.glow);
  if (it.type === 'greatsword') line(g, hx - 1, hy, tx - 1, ty, it.c);
  p(hx - 2, hy, 5, 1, '#4a5068'); p(hx, hy + 1, 1, 2, '#3a2a1e');
}
function drawOffhand(g, p, it, hand, view, back) {
  const [hx, hy] = hand;
  if (it.type === 'shield') { const x = view === 's' ? hx - 2 : hx - 5; p(x, hy - 9, 8, 14, it.c); p(x + 1, hy - 8, 6, 12, '#2a2e38'); p(x + 3, hy - 6, 2, 8, it.glow); p(x + 1, hy - 4, 6, 1, it.glow); return; }
  if (it.type === 'dagger' && !back) { line(g, hx, hy, hx - 2, hy + 6, it.c); line(g, hx + 1, hy, hx - 1, hy + 6, it.glow); }
}
function drawTop(g, p, it, P, view, back) {
  const [sL, sR] = P.sh, [hL, hR] = P.hip, side = view === 's', ty = sL[1], wl = side ? sL[0] - 3 : sL[0] + 1, wr = side ? sL[0] + 2 : sR[0] - 1;
  const hy = hL[1], hemY = Math.min(51, hy + (it.type === 'robe' ? 22 : it.type === 'coat' ? 13 : it.type === 'armor' ? 3 : 1));
  trap(p, ty, hy - 1, wl, wr, side ? wl + 1 : hL[0] - 2, side ? wr : hR[0] + 2, it.c);                                   // ลำตัว (ไหล่กว้าง เอวคอด)
  if (hemY > hy) trap(p, hy, hemY, side ? wl : hL[0] - 3, side ? wr + 1 : hR[0] + 3, side ? wl - 2 - P.bob : hL[0] - (it.type === 'robe' ? 6 : 4), side ? wr + 2 : hR[0] + (it.type === 'robe' ? 6 : 4), it.c); // ชายเสื้อโค้ท/เสื้อคลุม
  if (!back && !side && it.type === 'coat') { p(19, ty + 1, 3, hy - 1 - ty, it.in); trap(p, hy, hemY, 19, 21, 19, 21, it.in); } // ปกเสื้อเปิดเห็นเสื้อใน
  if (!back && !side && it.type === 'robe') { p(19, ty + 2, 3, 6, it.in); }
  if (it.type === 'armor') { p(side ? wl - 1 : sL[0] - 1, ty - 1, side ? 6 : 4, 4, it.c2); if (!side) p(sR[0] - 2, ty - 1, 4, 4, it.c2); if (!back) p(side ? wr - 2 : 19, ty + 4, 3, 2, it.in); } // บ่าเกราะ + ตราทอง
  p(side ? wl : hL[0] - 2, hy - 2, side ? wr - wl + 1 : hR[0] - hL[0] + 5, 1, it.c2);                                      // เข็มขัด
  p(side ? wl + 1 : 19, ty - 1, side ? 3 : 3, 2, it.c2);                                                               // ปกคอ
}
function drawHead(g, p, P, view, back, skin, hairC, hs, eye) {
  const [x, y] = P.head, side = view === 's';
  p(x - (side ? 1 : 1), y + 6, 3, 2, skin);                                                       // คอ
  p(x - 3, y - 3, side ? 6 : 7, 9, skin); if (!side) p(x - 2, y + 6, 5, 1, skin);                // หัว (เรียว ไม่กลมโต)
  if (!back) {
    if (side) { p(x + 2, y + 1, 1, 1, eye); p(x + 3, y + 2, 1, 1, skin); p(x + 1, y + 4, 2, 1, '#00000033'); } // ตา/จมูก/ปาก
    else { p(x - 2, y + 1, 2, 1, eye); p(x + 1, y + 1, 2, 1, eye); p(x - 1, y + 4, 2, 1, '#00000033'); }
  }
  p(x - 4, y - 5, side ? 7 : 9, 3, hairC);                                                       // ผมด้านบน
  if (back) p(x - 4, y - 2, 9, hs === 1 ? 12 : 7, hairC);
  else if (side) { p(x - 4, y - 2, 3, hs === 1 ? 10 : 6, hairC); if (hs === 3) p(x - 6, y - 1, 3, 2, hairC); }
  else { p(x - 4, y - 2, 1, hs === 1 ? 10 : 4, hairC); p(x + 4, y - 2, 1, hs === 1 ? 10 : 4, hairC); p(x - 3, y - 2, 4, 1, hairC); } // หน้าม้า
  if (hs === 2) { p(x - 3, y - 7, 2, 2, hairC); p(x + 1, y - 7, 2, 2, hairC); }                  // ผมตั้ง
}
function drawHeadgear(g, p, it, P, view, back) {
  const [x, y] = P.head, side = view === 's', w = side ? 8 : 10, l = x - (side ? 5 : 5);
  if (it.type === 'hood') { p(l, y - 6, w + 1, 6, it.c); p(l, y, 2, 7, it.c); p(l + w - 1, y, 2, back || side ? 7 : 2, it.c); if (back) p(l, y - 1, w + 1, 9, it.c); if (side) p(l - 1, y - 3, 3, 10, it.c); }
  if (it.type === 'hat') { p(l - 2, y - 4, w + 4, 2, it.c); p(l + 1, y - 9, w - 2, 5, it.c); p(l + 3, y - 12, 4, 3, it.c); p(l + 5, y - 14, 2, 2, it.c); p(l + 1, y - 5, w - 2, 1, it.c2); }
  if (it.type === 'helmet') { p(l, y - 6, w + 1, 7, it.c); if (!back) p(l + 1, y + 1, w - 1, 1, '#000'); p(x - 1, y - 8, 2, 2, it.c2); }
  if (it.type === 'hardhat') { p(l, y - 6, w + 1, 4, it.c); p(l - 1, y - 3, w + 3, 1, it.c); if (!back) p(x - 1, y - 5, 2, 2, it.c2); }
  if (it.type === 'band') { p(l + 1, y - 3, w - 1, 1, it.c); if (!back) p(x, y - 4, 1, 2, it.c2); }
}

function drawChar(g, job, look, view, frame, equip) {
  const p = rect(g), P = pose(view, frame), back = view === 'b', side = view === 's';
  const skin = SKIN[((look?.skin_tone ?? 1) - 1 + 4) % 4], hairC = /^#[0-9a-f]{6}$/i.test(look?.hair_color ?? '') ? look.hair_color : '#1a1520', hs = (look?.hair_style ?? 1) % 4, eye = EYE[job] ?? '#7fe0ff';
  const E = {}; for (const id of equip) { const it = ITEMS[id]; if (it) E[it.slot] = it; }
  const pants = E.bottom ?? { c: skin, c2: skin }, boots = E.feet, top = E.top;
  const leg = (i) => { limb(g, P.hip[i], P.knee[i], 3, pants.c); limb(g, P.knee[i], P.foot[i], 3, pants.c); if (boots) { const [fx, fy] = P.foot[i]; p(fx - 1, fy - 6, 3, 6, boots.c); p(fx - 1, fy - 6, 3, 1, boots.c2); p(fx + (side ? 1 : 0), fy - 1, side ? 3 : 2, 1, boots.c); } };
  const arm = (i) => { const c = top && top.type !== 'vest' ? top.c2 : skin; limb(g, P.sh[i], P.el[i], 3, c); limb(g, P.el[i], P.hand[i], 2, c); p(P.hand[i][0] - 1, P.hand[i][1], 2, 2, skin); };
  if (P.down) { // คุกเข่าล้ม: วาดทุกอย่างตามโครงเดียวกัน หัวก้ม
    leg(0); leg(1); if (top) drawTop(g, p, top, P, 'f', false); arm(0); arm(1);
    drawHead(g, p, P, 'f', false, skin, hairC, hs, eye); if (E.head) drawHeadgear(g, p, E.head, P, 'f', false); return;
  }
  if (back && E.weapon) drawWeapon(g, p, E.weapon, P.hand[1], P, view, false); // มองหลัง: อาวุธอยู่หน้าตัว (ฝั่งไกลกล้อง) ต้องวาดก่อน
  if (side) { arm(0); leg(0); leg(1); } else { leg(0); leg(1); }
  if (side && E.offhand) drawOffhand(g, p, E.offhand, P.hand[0], view, back);
  if (top) drawTop(g, p, top, P, view, back); else { trap(p, P.sh[0][1], 26, side ? 17 : 16, side ? 22 : 24, side ? 18 : 18, side ? 22 : 22, skin); }
  if (!side) { arm(0); arm(1); }
  drawHead(g, p, P, view, back, skin, hairC, hs, eye);
  if (E.head) drawHeadgear(g, p, E.head, P, view, back);
  if (side) arm(1);
  if (E.weapon && !back) drawWeapon(g, p, E.weapon, P.hand[1], P, view, back);
  if (E.offhand && !side) drawOffhand(g, p, E.offhand, P.hand[0], view, back);
}

const sheets = {};
export function charSheet(job, look, equip) { // แผ่น sprite ต่อ (อาชีพ, หน้าตา, ชุด) — วาดครั้งเดียวแล้วเก็บ
  const eq = equip ?? look?.equip ?? LOADOUT[job] ?? LOADOUT.Fighter;
  const key = `${job}|${look?.skin_tone ?? 1}|${look?.hair_style ?? 1}|${look?.hair_color ?? ''}|${eq.join(',')}`; if (sheets[key]) return sheets[key];
  const sheet = canvas(CW * FRAMES.n, CH * 3), sg = sheet.getContext('2d');
  for (const v of ['f', 'b', 's']) for (let f = 0; f < FRAMES.n; f++) {
    const c = canvas(CW, CH), cg = c.getContext('2d'); cg.translate(0, 6); drawChar(cg, job, look, v, f, eq); outline(c); sg.drawImage(c, f * CW, VIEW[v] * CH);
  }
  return (sheets[key] = sheet);
}
