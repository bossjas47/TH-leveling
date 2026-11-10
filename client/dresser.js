// ตัวแต่งตัว (ใช้ทั้งหน้าสร้างตัวละครและตู้เสื้อผ้าในเกม): ตัวเลือกผิว/ผม/ชุด + ภาพตัวละครหมุนดูได้
import { charSheet, CW, CH, FRAMES, VIEW } from './pixel.js';
import { parseOutfit, outfitStr, SLOTS, DEFAULT_OUTFIT } from '/shared/look.js';
import { ic } from './ui.js';

const SKIN = ['#f6d2b4', '#e9b98e', '#c98e5f', '#8d5a3b']; // ตรงกับ pixel.js
const NAMES = { tee: 'เสื้อยืด', hoodie: 'ฮู้ด', jacket: 'แจ็กเก็ต', coat: 'โค้ทยาว', uniform: 'ชุดสมาคม', suit: 'สูท', pants: 'กางเกงขายาว', shorts: 'ขาสั้น', skirt: 'กระโปรง', sneakers: 'ผ้าใบ', boots: 'บูท' };
const SLOT_NAME = { top: 'เสื้อ', bottom: 'ท่อนล่าง', shoes: 'รองเท้า' };

// คืน { el, look() } · getJob() ให้ภาพแสดงแสงเรืองแสง/อาวุธตามอาชีพที่เลือกอยู่
export function lookEditor(A, init = {}, getJob = () => 'Fighter') {
  const st = { skin_tone: init.skin_tone ?? 1, hair_style: init.hair_style ?? 1, hair_color: init.hair_color ?? A.hair_colors[0], o: parseOutfit(init.outfit ?? DEFAULT_OUTFIT) };
  const el = document.createElement('div'); el.className = 'dress';
  const sw = (key, val, color, on) => `<button type=button class="sw${on ? ' on' : ''}" data-k="${key}" data-v="${val}" style="background:${color}" aria-label="${val}"></button>`;
  const chip = (key, val, label, on) => `<button type=button class="chip${on ? ' on' : ''}" data-k="${key}" data-v="${val}">${label}</button>`;
  const C = A.clothes;
  function render() {
    el.querySelector('.opts').innerHTML = `
      <div class=grp><span>ผิว</span>${SKIN.slice(0, A.skin_tones).map((c, i) => sw('skin_tone', i + 1, c, st.skin_tone === i + 1)).join('')}</div>
      <div class=grp><span>ทรงผม</span>${Array.from({ length: A.hair_styles }, (_, i) => chip('hair_style', i + 1, i + 1, st.hair_style === i + 1)).join('')}</div>
      <div class=grp><span>สีผม</span>${A.hair_colors.map((c) => sw('hair_color', c, c, st.hair_color === c)).join('')}</div>
      ${SLOTS.map((k) => `<div class=grp><span>${SLOT_NAME[k]}</span>${C[k].map((s) => chip(k + '.s', s, NAMES[s] ?? s, st.o[k].s === s)).join('')}</div>
        <div class="grp cols">${C.colors.map((c) => sw(k + '.c', c, c, st.o[k].c === c)).join('')}</div>`).join('')}`;
  }
  el.innerHTML = `<div class=pv><canvas width=${CW * 6} height=${CH * 6}></canvas><div class=rot><button type=button data-r=-1 aria-label="หมุนซ้าย">${ic('rotate-ccw')}</button><button type=button data-r=1 aria-label="หมุนขวา">${ic('rotate-cw')}</button></div></div><div class=opts></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r) { view = (view + +b.dataset.r + 4) % 4; return; }
    const { k, v } = b.dataset; if (!k) return;
    if (k.includes('.')) { const [slot, f] = k.split('.'); st.o[slot][f] = v; } else st[k] = k === 'hair_color' ? v : +v;
    render();
  });
  render();

  // ภาพตัวอย่าง: หน้า → ข้างขวา → หลัง → ข้างซ้าย สลับยืน/เดิน
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  let view = 0;
  const look = () => ({ skin_tone: st.skin_tone, hair_style: st.hair_style, hair_color: st.hair_color, outfit: outfitStr(st.o) });
  (function draw(t) {
    if (!el.isConnected && t > 1000) return; // ปิดหน้าต่างแล้ว หยุดวาด
    const sheet = charSheet(getJob(), look()), v = ['f', 's', 'b', 's'][view], walk = Math.floor(t / 2400) % 2;
    const col = walk ? FRAMES.walk + (Math.floor(t / 140) % 4) : Math.floor(t / 450) % 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (view === 3) { g.translate(cv.width, 0); g.scale(-1, 1); }
    g.drawImage(sheet, col * CW, VIEW[v] * CH, CW, CH, 0, 0, cv.width, cv.height);
    requestAnimationFrame(draw);
  })(0);
  return { el, look };
}
