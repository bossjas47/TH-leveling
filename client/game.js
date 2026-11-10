import { moveSpeed } from '/shared/formulas.js';
import { MAP as LOBBY_ROWS, SPAWN, makeMap } from '/shared/lobby.js';
import { makeGateE } from '/shared/gate.js';
import { ensureCharacter } from './account.js';
import { createWorld } from './world3d.js';
import { API } from './firebase-config.js';

const B = await (await fetch('/shared/balance.json')).json();
const me = await ensureCharacter(B);
document.getElementById('ui').style.display = 'none';

let MAP = LOBBY_ROWS, N = LOBBY_ROWS.length, gmap = makeMap(MAP); // แผนที่ปัจจุบัน (สลับตามห้อง)


const player = { ...SPAWN, speed: moveSpeed(B, me.agi), job: me.job, look: me, face: 0 };

// ---------- Network: server ตัดสินตำแหน่งจริง, client ทำนายตัวเอง + แก้เมื่อคลาดเกิน 1 tile ----------
// shortcut: ไม่ reconnect อัตโนมัติ (ขึ้นข้อความแล้วให้รีเฟรช), ก่อนเปิดจริงเพิ่ม reconnect + input sequence
const looks = new Map();  // id → { skin_tone, hair_style, hair_color, outfit }
const others = new Map(); // id → { x, y, tx, ty, name, job }
const nodes = new Map();  // id → { x, y, hp, max, flash } จุดแร่ใน Gate
const toasts = [];        // ข้อความลอยกลางบน { text, until, big }
let room = { kind: 'lobby', name: '', expiresAt: 0 };
const toast = (text, ms = 2600, big = false) => toasts.push({ text, until: performance.now() + ms, big });
const mobs = new Map();   // id → { x, y, tx, ty, hp, max }
const fx = [];            // ตัวเลขดาเมจลอย { x, y, v, crit, t }
const stats = { rank: me.hunter_rank ?? 'E', hp: me.hp, max: me.max_hp, state: 0, level: me.level, exp: 0, next: 100, mp: me.mp, maxMp: me.max_mp, potions: 5, baht: me.baht ?? 0, items: {}, st: { str: me.str, agi: me.agi, vit: me.vit, int: me.int_stat, per: me.per }, statPoints: 0, weapon: null, enhance: 0, fatigue: 0 };
let party = [];           // [[uid, name], ...] ว่าง = ไม่มีปาร์ตี้
const chatLog = [];       // ข้อความล่าสุด { text, at, p }
const cds = {};           // skill id → เวลาที่พร้อมใช้ (ms) ให้ UI โชว์ cooldown; server ตัดสินจริง
let assisting = 0;        // เวลาสิ้นสุดการพยุง (ms) ไว้โชว์แถบ
let ws = null, status = '', lastSent = [0, 0], lastSentAt = 0, myId = null, downedAt = 0, atkHeld = false, lastAtk = 0;
function connect() { // เชื่อมต่อหลังโหลดภาพเสร็จเท่านั้น: ข้อความจาก server (เช่น room) ใช้พื้น/ภาพที่ต้องพร้อมก่อน
  if (!me.getToken) return;
  ws = new WebSocket((API || location.origin).replace(/^http/, 'ws') + '/ws');
  ws.onopen = async () => ws.send(JSON.stringify({ t: 'auth', token: await me.getToken() }));
  ws.onclose = (e) => { status = e.code === 4000 ? 'ล็อกอินจากที่อื่น' : 'ขาดการเชื่อมต่อ — รีเฟรชหน้า'; };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'me') { Object.assign(stats, { level: m.level, exp: m.exp, next: m.next, mp: m.mp, maxMp: m.maxMp, potions: m.potions, rank: m.rank ?? stats.rank, baht: m.baht, items: m.items, st: m.stats, statPoints: m.statPoints, weapon: m.weapon, enhance: m.enhance }); player.speed = m.speed; renderPanel(); }
    if (m.t === 'party') { party = m.members; renderPanel(); }
    if (m.t === 'pinvited') panel(() => ({ title: 'คำเชิญปาร์ตี้', info: `${m.name} ชวนเข้าปาร์ตี้`, rows: [{ label: 'เข้าร่วม', fn: () => sendMsg({ t: 'paccept' }), close: true }] }));
    if (m.t === 'chat') { chatLog.push({ text: `${m.ch === 'p' ? '[ปาร์ตี้] ' : ''}${m.name}: ${m.text}`, at: performance.now(), p: m.ch === 'p' }); if (chatLog.length > 6) chatLog.shift(); const o = m.id === myId ? player : others.get(m.id); if (o) { o.say = m.text; o.sayUntil = performance.now() + B.chat.bubble_sec * 1000; } }
    if (m.t === 'levelup') toast(`เลเวลอัป! Lv.${m.level} (+${B.stat_points_per_level} แต้ม — กด C)`, 4000, true);
    if (m.t === 'bought') toast('ซื้อแล้ว', 1500);
    if (m.t === 'enhanced') toast(`ตีบวกสำเร็จ +${m.level}`, 3000, true);
    if (m.t === 'skillFailed' && m.why === 'exhausted') toast('เหนื่อยเกินไป — พักหรือดื่มน้ำ');
    if (m.t === 'skillFailed' && m.why === 'mp') toast('MP ไม่พอ');
    if (m.t === 'room') { // เข้าห้องใหม่: สลับแผนที่ ล้างของเก่า ย้ายไปจุดเกิด
      room = { kind: m.kind, name: m.name, expiresAt: m.expiresAt };
      setView(m.kind === 'gate_e' ? 'gate_e' : 'lobby');
      others.clear(); mobs.clear(); nodes.clear(); fx.length = 0; player.x = m.x; player.y = m.y; downedAt = 0;
      toast(m.name, 2200);
    }
    if (m.t === 'notice') toast(m.text);
    if (m.t === 'loot') toast(`+ ${m.name}`, 1800);
    if (m.t === 'sold') toast(`ขายของได้ ฿${m.total.toLocaleString()}`, 3000, true);
    if (m.t === 'cleared') toast(`Gate Clear!  +${m.exp.toLocaleString()} EXP  +฿${m.bonus.toLocaleString()}`, 4500, true);
    if (m.t === 'gateFailed') toast('Gate หมดเวลา', 3500, true);
    if (m.t === 'rankResult') toast(m.passed ? `สอบผ่าน! แรงค์ ${m.rank}` : `สอบไม่ผ่าน (${m.burst}/${m.need})`, 4500, true);
    if (m.t === 'nodeHit') { const n = nodes.get(m.id); if (n) n.flash = performance.now(); }
    if (m.t === 'look') looks.set(m.id, m.look);
    if (m.t === 'skill') cds[m.skill] = performance.now() + m.cd * 1000;
    if (m.t === 'assisting') assisting = performance.now() + m.sec * 1000;
    if (m.t === 'assistCancel') assisting = 0;
    if (m.t === 'hit') { const t = mobs.get(m.id); if (t) { t.flash = performance.now(); fx.push({ x: t.x, y: t.y, v: m.v, crit: m.crit, t: performance.now() }); } }
    if (m.t === 'hello') { myId = m.id; player.x = m.x; player.y = m.y; }
    if (m.t !== 's') return;
    const seen = new Set();
    for (const [id, x, y, name, job, , hp, max, down, act, face, fat] of m.p) {
      seen.add(id);
      const o0 = others.get(id); if (o0 && act && !o0.act) o0.atkStart = performance.now(); if (o0) o0.act = act;
      if (id === myId) {
        if (Math.hypot(player.x - x, player.y - y) > 1) { player.x = x; player.y = y; }
        if (down && !stats.state) downedAt = performance.now();
        Object.assign(stats, { hp, max, state: down, fatigue: fat });
        continue;
      }
      const o = others.get(id);
      if (o) { o.tx = x; o.ty = y; o.hp = hp; o.max = max; o.down = down; o.face = face; } else others.set(id, { id, x, y, tx: x, ty: y, name, job, hp, max, down, face });
    }
    for (const id of others.keys()) if (!seen.has(id)) others.delete(id);
    const ms = new Set();
    for (const [id, x, y, hp, max, kind, face] of m.m) {
      ms.add(id); const o = mobs.get(id);
      if (o) Object.assign(o, { tx: x, ty: y, hp, max, face }); else mobs.set(id, { x, y, tx: x, ty: y, hp, max, kind, face });
    }
    for (const id of mobs.keys()) if (!ms.has(id)) mobs.delete(id);
    const ns = new Set();
    for (const [id, x, y, hp, max] of m.n ?? []) { ns.add(id); const o = nodes.get(id); if (o) Object.assign(o, { hp }); else nodes.set(id, { x, y, hp, max }); }
    for (const id of nodes.keys()) if (!ns.has(id)) nodes.delete(id);
  };
}
function sendInput(dx, dy, now) {
  if (ws?.readyState !== 1 || !myId || now - lastSentAt < 100) return; // ≤ 10 msg/วิ (GDD §12.7)
  if (Math.abs(dx - lastSent[0]) < 0.02 && Math.abs(dy - lastSent[1]) < 0.02) return; // ส่งเมื่อทิศเปลี่ยนเท่านั้น
  ws.send(JSON.stringify({ t: 'in', dx: +dx.toFixed(3), dy: +dy.toFixed(3) }));
  lastSent = [dx, dy]; lastSentAt = now;
}

// ---------- โลก 3D (Three.js) + สลับแผนที่ตามห้องที่ server บอก ----------
const world = await createWorld(document.getElementById('gl'), B);
let view = 'lobby';
function setView(kind) {
  const gate = kind === 'gate_e';
  MAP = gate ? makeGateE({ seed: B.gate_e.seed, mobs: B.gate_e.mobs, nodes: B.gate_e.nodes }).rows : LOBBY_ROWS;
  N = MAP.length; gmap = makeMap(MAP); view = gate ? 'gate_e' : 'lobby';
  world.setMap(view, MAP); world.setSolid((x, y) => gmap.solid(x, y)); // กล้องใช้กริดชนเดียวกับเกม
}
setView('lobby');

// ---------- Input: joystick ลอย (สัมผัส/เมาส์) + WASD ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const keys = new Set();
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0 };
const JR = 50;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'enter') return openChat();
  keys.add(k);
  if (e.repeat) return;
  if (k === 'c') return panelFn ? closePanel() : panel(charPanel);
  if (k === 'g') return press('invite');
  if (k === 'escape') return closePanel();
  if (k === '1' || k === '2') press(SKILLS[k - 1]?.id); else if (k === '3') press('potion'); else if (k === 'e') press('assist'); else if (k === 'f') press('ctx');
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const SKILLS = (B.skills[me.job] ?? []).filter((k) => k.level <= me.level);
const buttons = () => { // ปุ่มบนจอ: โจมตี, สกิล 1–2, น้ำมนต์, พยุง (เมื่อมีเพื่อนล้มอยู่ใกล้)
  const W = innerWidth, H = innerHeight, b = [{ id: 'atk', x: W - 80, y: H - 70, r: 42, label: 'โจมตี' }];
  SKILLS.slice(0, 2).forEach((k, i) => b.push({ id: k.id, skill: k, x: W - 175 + i * 0, y: H - 50 - i * 70, r: 30, label: k.name.split(' ')[0], key: i + 1 }));
  b.push({ id: 'potion', x: W - 50, y: H - 150, r: 26, label: 'MP', key: 3 });
  const cx = ctxAction(); if (cx) b.push({ id: 'ctx', x: W - 265, y: H - 60, r: 36, label: cx.label, key: 'F', msg: cx.msg });
  if (downedNear()) b.push({ id: 'assist', x: W - 120, y: H - 170, r: 28, label: 'พยุง', key: 'E' });
  if (inviteTarget()) b.push({ id: 'invite', x: W - 265, y: H - 140, r: 26, label: 'ชวน', key: 'G' });
  b.push({ id: 'char', x: 28, y: 86, r: 18, label: stats.statPoints ? `+${stats.statPoints}` : 'ตัว' }, { id: 'chat', x: 72, y: 86, r: 18, label: 'แชต' });
  return b;
};
function ctxAction() { // ปุ่มตามบริบท: ประตู Gate / ตลาด / สมาคม / ออกจาก Gate
  if (!ws || stats.state) return null;
  const P = B.places, near = ([x, y]) => Math.hypot(player.x - x, player.y - y) <= P.interact_tiles;
  if (room.kind === 'gate_e') return { label: 'ออก', msg: { t: 'leave' } };
  if (room.kind !== 'lobby') return null;
  const gi = P.gates.findIndex(near);
  if (gi >= 0) return { label: 'เข้า Gate', msg: { t: 'enter', gate: gi } };
  if (near(P.market)) return { label: 'ตลาด', open: marketPanel };
  if (near(P.association)) return { label: 'สมาคม', open: assocPanel };
  if (B.taxi.stands.some(near)) return { label: 'วิน', open: taxiPanel };
  return null;
}
// ---------- หน้าต่าง (DOM): ตลาด / สมาคม / วิน / ตัวละคร / คำเชิญ ----------
const ui = document.getElementById('ui'), chatBox = document.getElementById('chat');
let panelFn = null; // ฟังก์ชันสร้างเนื้อหาหน้าต่างที่เปิดอยู่ — เรียกซ้ำเมื่อข้อมูลจาก server เปลี่ยน
const sendMsg = (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o));
function panel(fn) { panelFn = fn; renderPanel(); }
function closePanel() { panelFn = null; ui.style.display = 'none'; }
function renderPanel() {
  if (!panelFn) return;
  const { title, info = '', rows } = panelFn();
  ui.innerHTML = '<div class="card"><h2></h2><div class="info"></div><div class="rows"></div><button class="alt">ปิด</button></div>';
  ui.querySelector('h2').textContent = title; ui.querySelector('.info').textContent = info;
  for (const r of rows) { const b = document.createElement('button'); b.textContent = r.label; b.disabled = !!r.off; b.onclick = () => { r.fn(); if (r.close) closePanel(); }; ui.querySelector('.rows').append(b); }
  ui.querySelector('button.alt').onclick = closePanel; ui.style.display = 'flex';
}
const baht = (n) => '฿' + Math.round(n).toLocaleString(), have = (id) => stats.items[id] ?? 0;
const marketPanel = () => ({ title: 'ตลาด', info: `เงิน ${baht(stats.baht)}`, rows: [
  { label: 'ขายของที่เก็บมาทั้งหมด', fn: () => sendMsg({ t: 'sell' }) },
  ...B.shop.consumables.map((id) => ({ label: `ซื้อ ${B.consumables[id].name} ${baht(B.consumables[id].price)} (มี ${have(id)})`, off: stats.baht < B.consumables[id].price, fn: () => sendMsg({ t: 'buy', item: id }) })),
  ...B.shop.weapons.map((id) => ({ label: `${stats.weapon === id ? '✔ ' : 'ซื้อ '}${B.weapons[id].name} (${B.weapons[id].rank}) ATK ${B.weapons[id].atk} ${baht(B.weapons[id].price)}`, off: stats.weapon === id || stats.baht < B.weapons[id].price, fn: () => sendMsg({ t: 'buy', item: id }) })),
] });
const assocPanel = () => {
  const w = B.weapons[stats.weapon], stone = w && `mana_stone_${w.rank.toLowerCase()}`, need = B.enhancement.materials[stats.enhance];
  return { title: 'สมาคมฮันเตอร์', info: `แรงค์ ${stats.rank} · ${w?.name ?? '-'} +${stats.enhance}`, rows: [
    { label: 'สอบเลื่อนแรงค์ (ตีหุ่น 5 วิ)', fn: () => sendMsg({ t: 'ranktest' }), close: true },
    { label: need ? `ตีบวกเป็น +${stats.enhance + 1} — ใช้${B.items[stone]?.name ?? 'แร่'} ${need} (มี ${have(stone)})` : 'ตีบวกสูงสุดแล้ว', off: !need, fn: () => sendMsg({ t: 'enhance' }) },
  ] };
};
const taxiPanel = () => ({ title: 'วินมอเตอร์ไซค์', info: `เงิน ${baht(stats.baht)} · ค่าโดยสารตามระยะ ลดความเหนื่อย ${B.fatigue.recover.taxi}%`, rows: Object.entries(B.taxi.to).map(([k, v]) => ({ label: `ไป${v.name}`, fn: () => sendMsg({ t: 'taxi', to: k }), close: true })) });
const charPanel = () => ({ title: `${me.username} · ${me.job} Lv.${stats.level}`,
  info: `เงิน ${baht(stats.baht)} · แรงค์ ${stats.rank} · ${B.weapons[stats.weapon]?.name ?? ''} +${stats.enhance} · เหนื่อย ${stats.fatigue}% · แต้มคงเหลือ ${stats.statPoints}${party.length ? ' · ปาร์ตี้: ' + party.map((m) => m[1]).join(', ') : ''}`,
  rows: [
    ...Object.entries({ str: 'STR พลังโจมตี', agi: 'AGI ความเร็ว', vit: 'VIT เลือด', int: 'INT เวท/MP', per: 'PER คริติคอล' }).map(([k, n]) => ({ label: `+ ${n} (${stats.st[k]})`, off: !stats.statPoints, fn: () => sendMsg({ t: 'stat', k }) })),
    ...['water', 'energy_drink'].map((id) => ({ label: `ใช้${B.consumables[id].name} −${B.consumables[id].fatigue}% เหนื่อย (มี ${have(id)})`, off: !have(id), fn: () => sendMsg({ t: 'use', item: id }) })),
    ...(party.length ? [{ label: 'ออกจากปาร์ตี้', fn: () => sendMsg({ t: 'pleave' }) }] : []),
  ] });
const inviteTarget = () => room.kind === 'lobby' && party.length < B.party.max && [...others].find(([id, o]) => !party.some((m) => m[0] === id) && Math.hypot(o.x - player.x, o.y - player.y) <= 3);
function openChat() { chatBox.style.display = 'block'; chatBox.focus(); }
chatBox.addEventListener('keydown', (e) => {
  e.stopPropagation(); // ไม่ให้ปุ่มที่พิมพ์ไปถึงตัวควบคุมเกม (Enter จะเปิดแชตซ้ำ)
  if (e.key !== 'Enter' && e.key !== 'Escape') return;
  const text = chatBox.value.trim();
  if (e.key === 'Enter' && text) sendMsg(text.startsWith('/p ') ? { t: 'chat', ch: 'p', text: text.slice(3) } : { t: 'chat', ch: 'z', text });
  chatBox.value = ''; chatBox.style.display = 'none'; chatBox.blur();
});
const downedNear = () => [...others].find(([, o]) => o.down && Math.hypot(o.x - player.x, o.y - player.y) <= B.downed.assist.range_tiles);
const hit = (e) => buttons().find((b) => Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r + 8);
function press(id) {
  if (ws?.readyState !== 1 || (stats.state && id !== 'chat' && id !== 'char')) return;
  if (id === 'ctx') { const c = ctxAction(); return c && (c.open ? panel(c.open) : ws.send(JSON.stringify(c.msg))); }
  if (id === 'char') return panel(charPanel);
  if (id === 'chat') return openChat();
  if (id === 'invite') { const t = inviteTarget(); return t && sendMsg({ t: 'pinvite', id: t[0] }); }
  if (id === 'potion') return ws.send(JSON.stringify({ t: 'potion' }));
  if (id === 'assist') { const d = downedNear(); return d && ws.send(JSON.stringify({ t: 'assist', id: d[0] })); }
  const k = SKILLS.find((x) => x.id === id);
  if (!k || performance.now() < (cds[id] ?? 0)) return;
  const near = (list, range) => list.map(([i, o]) => [i, Math.hypot(o.x - player.x, o.y - player.y)]).filter(([, d]) => d <= range).sort((a, b) => a[1] - b[1])[0]?.[0];
  let target;
  if (k.kind === 'single' || k.kind === 'teleport_strike') target = near([...mobs], k.range);
  else if (k.kind === 'heal') target = near([...others].filter(([, o]) => !o.down && o.hp < o.max), k.range) ?? undefined; // ไม่มีเพื่อนเจ็บ = ฮีลตัวเอง
  else if (k.kind === 'revive') target = near([...others].filter(([, o]) => o.down), k.range);
  if (['single', 'teleport_strike', 'revive'].includes(k.kind) && !target) return;
  const tm = mobs.get(target) ?? others.get(target); if (tm) faceTo(tm);
  ws.send(JSON.stringify({ t: 'cast', skill: id, id: target })); player.atkStart = performance.now();
}
canvas.addEventListener('pointerdown', (e) => {
  const btn = hit(e);
  if (btn?.id === 'atk') { atkHeld = true; atkPointer = e.pointerId; canvas.setPointerCapture(e.pointerId); return; }
  if (btn) return press(btn.id);
  if (e.button === 2 || e.clientX > innerWidth * 0.6) { if (camDrag) return; camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; } // ขวาของจอ/คลิกขวา = หมุนกล้อง
  if (stick.id !== null) return; // ซ้าย = joystick ลอย
  Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, vx: 0, vy: 0 });
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (camDrag && e.pointerId === camDrag.id) { world.cam.yaw -= (e.clientX - camDrag.x) * 0.0065; world.cam.pitch += (e.clientY - camDrag.y) * 0.0045; camDrag.x = e.clientX; camDrag.y = e.clientY; return; }
  if (e.pointerId !== stick.id) return;
  const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(d, JR) / d;
  stick.x = stick.ox + dx * k; stick.y = stick.oy + dy * k;
  stick.vx = d < 8 ? 0 : dx / d; stick.vy = d < 8 ? 0 : dy / d; // dead zone 8px
});
let atkPointer = null, camDrag = null;
const release = (e) => { if (e.pointerId === atkPointer) { atkHeld = false; atkPointer = null; }
   if (camDrag && e.pointerId === camDrag.id) camDrag = null;
   if (e.pointerId === stick.id) stick.id = null, stick.vx = stick.vy = 0; };
canvas.addEventListener('wheel', (e) => { world.cam.dist *= 1 + Math.sign(e.deltaY) * 0.08; e.preventDefault(); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ทิศบนจอ → ทิศในโลก: "ข้างหน้า" = ทิศที่กล้องมองไป (บุคคลที่สาม)
function inputVector() {
  let sx = stick.vx, sy = stick.vy;
  if (keys.has('a')) sx -= 1;
  if (keys.has('d')) sx += 1;
  if (keys.has('w')) sy -= 1;
  if (keys.has('s')) sy += 1;
  const l = Math.hypot(sx, sy);
  if (!l) return [0, 0];
  sx /= Math.max(l, 1); sy /= Math.max(l, 1);
  const [fx, fz] = world.forward, rx = -fz, rz = fx; // ขวา = (−fz, fx)
  return [fx * -sy + rx * sx, fz * -sy + rz * sx];
}

// ---------- Update: wall sliding แยกแกน X/Y (GDD §9.2) ----------
const ATTACK_RANGE = B.network.action_distance_tiles;
const faceTo = (o) => { player.face = Math.atan2(o.x - player.x, o.y - player.y); };
function autoAttack(now) { // กดค้าง/Space = ตีมอนที่ใกล้ที่สุดในระยะ (server คุม cooldown จริง)
  if (!atkHeld && !keys.has(' ')) return;
  if (ws?.readyState !== 1 || stats.state || now - lastAtk < 250) return;
  let best = null, bd = ATTACK_RANGE;
  for (const [id, m] of mobs) { const d = Math.hypot(m.x - player.x, m.y - player.y); if (d < bd) { bd = d; best = id; } }
  if (best) { faceTo(mobs.get(best)); ws.send(JSON.stringify({ t: 'atk', id: best })); lastAtk = now; if (now - (player.atkStart ?? 0) > 350) player.atkStart = now; return; }
  let node = null, nd = B.gate_e.mining.range_tiles; // ไม่มีมอนในระยะ → ขุดแร่ที่ใกล้สุด
  for (const [id, n] of nodes) { const d = Math.hypot(n.x - player.x, n.y - player.y); if (d < nd) { nd = d; node = id; } }
  if (node) { faceTo(nodes.get(node)); ws.send(JSON.stringify({ t: 'mine', id: node })); lastAtk = now; if (now - (player.atkStart ?? 0) > 350) player.atkStart = now; }
}
function step(dt, now) {
  const c = world.cam; // ลูกศร = หมุน/เงยกล้อง (คอม)
  if (keys.has('arrowleft')) c.yaw -= dt * 1.8; if (keys.has('arrowright')) c.yaw += dt * 1.8; if (keys.has('arrowup')) c.pitch += dt * 1.0; if (keys.has('arrowdown')) c.pitch -= dt * 1.0;
  let [dx, dy] = inputVector();
  const l = Math.hypot(dx, dy);
  if (l) { dx /= l; dy /= l; }
  sendInput(dx, dy, now);
  if (stats.state) { dx = dy = 0; }
  if (l && !stats.state) { gmap.move(player, dx, dy, player.speed * Math.min(dt, 0.05)); player.face = Math.atan2(dx, dy); } // กัน tunnel ตอน frame กระตุก
  player.down = stats.state;
  autoAttack(now);
  for (const o of [...others.values(), ...mobs.values()]) { const k = Math.min(1, dt * 12); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; } // lerp
}

// ---------- Render: โลก 3D วาดโดย Three.js, ชั้นนี้วาดป้ายชื่อ/เลือด/ตัวเลขดาเมจ/ปุ่ม/ข้อความทับ (2D) ----------
function resize() { const dpr = devicePixelRatio || 1; canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
addEventListener('resize', resize); resize();

function label(text, p, { size = 12, color = '#fff' } = {}) {
  if (!p) return;
  ctx.font = `bold ${size}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(text, p[0], p[1]); ctx.fillStyle = color; ctx.fillText(text, p[0], p[1]);
}
function draw(dt, T) {
  for (const o of others.values()) o.look = looks.get(o.id);
  world.update(dt, T, { player, others: others.values(), mobs: mobs.values(), nodes: nodes.values() });
  const dpr = devicePixelRatio || 1, nowT = T;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const l of world.labels()) if (view === 'lobby') label(l.text, world.project(l.x, l.y, l.h), { size: 13, color: '#ffe9a8' });
  if (view === 'lobby') for (const [gx, gy] of B.places.gates) label('Gate E', world.project(gx, gy, 1.55), { color: '#9dffb8' });
  for (const o of others.values()) label(o.name, world.project(o.x, o.y, 1.0), party.some((m) => m[0] === o.id) ? { color: '#9fd0ff' } : {});
  for (const o of [player, ...others.values()]) if (o.sayUntil > T) label(o.say.slice(0, 40), world.project(o.x, o.y, 1.22), { color: '#ffe9a8' }); // ฟองคำพูด 5 วิ
  for (const m of mobs.values()) { // แถบเลือดมอนธรรมดา (บอสมีแถบใหญ่ด้านบน)
    if (m.kind) continue; const p = world.project(m.x, m.y, 0.78); if (!p) continue;
    ctx.fillStyle = '#400'; ctx.fillRect(p[0] - 12, p[1], 24, 4); ctx.fillStyle = '#e33'; ctx.fillRect(p[0] - 12, p[1], 24 * m.hp / m.max, 4);
  }
  for (let i = fx.length - 1; i >= 0; i--) { // ตัวเลขดาเมจลอย
    const f = fx[i], a = (nowT - f.t) / 800;
    if (a >= 1) { fx.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - a; label(String(f.v), world.project(f.x, f.y, 0.7 + a * 0.45), { size: f.crit ? 17 : 13, color: f.crit ? '#ffd23f' : '#fff' }); ctx.globalAlpha = 1;
  }
  // joystick
  ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  if (ws) { // ปุ่ม + แถบ HP/MP/EXP
    ctx.textAlign = 'center';
    for (const b of buttons()) {
      const cd = b.skill ? Math.max(0, ((cds[b.id] ?? 0) - nowT) / 1000) : 0, active = b.id === 'atk' && atkHeld;
      ctx.fillStyle = b.id === 'atk' ? (active ? 'rgba(230,70,70,.85)' : 'rgba(200,50,50,.55)') : b.id === 'potion' ? 'rgba(50,110,200,.65)' : b.id === 'assist' ? 'rgba(60,160,90,.8)' : 'rgba(90,60,160,.65)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      if (cd > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = `bold ${b.r > 35 ? 15 : 12}px system-ui`; ctx.fillText(cd > 0 ? Math.ceil(cd) : b.label, b.x, b.y + 4);
      if (b.key) { ctx.font = '10px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(b.id === 'potion' ? `${b.key} ×${stats.potions}` : b.key, b.x, b.y + b.r - 6); }
    }
    bar(10, 28, 160, 10, stats.hp / stats.max, '#d33'); bar(10, 40, 160, 8, stats.mp / stats.maxMp, '#3a7bd5'); bar(10, 50, 160, 5, stats.exp / stats.next, '#e0b04a'); bar(10, 57, 160, 4, stats.fatigue / 100, stats.fatigue >= B.fatigue.exhausted_at ? '#e33' : '#8a9');
    chatLog.forEach((c, i) => { if (nowT - c.at > 15000) return; ctx.textAlign = 'left'; ctx.font = '12px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const y = 120 + i * 16; ctx.strokeText(c.text, 10, y); ctx.fillStyle = c.p ? '#9fd0ff' : '#fff'; ctx.fillText(c.text, 10, y); });
    ctx.textAlign = 'center';
    if (assisting > nowT) { bar(innerWidth / 2 - 60, innerHeight / 2 + 30, 120, 8, 1 - (assisting - nowT) / (B.downed.assist.channel_sec * 1000), '#3c9'); ctx.fillStyle = '#fff'; ctx.fillText('กำลังพยุง...', innerWidth / 2, innerHeight / 2 + 26); }
    if (stats.state) {
      const left = Math.max(0, B.downed.timer_sec - (nowT - downedAt) / 1000);
      ctx.fillStyle = 'rgba(120,0,0,.35)'; ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.fillText(`ล้มลง — ${Math.ceil(left)} วิ`, innerWidth / 2, innerHeight / 2 - 10);
      giveup.style.display = 'block';
    } else giveup.style.display = 'none';
  }
  const boss = [...mobs.values()].find((m) => m.kind === 1 && Math.hypot(m.x - player.x, m.y - player.y) < 14); // แถบเลือดบอส (เมื่ออยู่ใกล้)
  if (boss) { const w = Math.min(320, innerWidth * 0.4), x0 = (innerWidth - w) / 2; bar(x0, 52, w, 12, boss.hp / boss.max, '#c33'); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText('Goblin Chief', innerWidth / 2, 48); ctx.fillText('Goblin Chief', innerWidth / 2, 48); }
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].until < nowT) toasts.splice(i, 1);
  toasts.slice(-4).forEach((tt, i) => { // ข้อความแจ้งเตือนกลางบน
    ctx.font = `bold ${tt.big ? 22 : 14}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    const y = (boss ? 90 : 70) + i * (tt.big ? 30 : 22); ctx.strokeText(tt.text, innerWidth / 2, y); ctx.fillStyle = tt.big ? '#ffe08a' : '#fff'; ctx.fillText(tt.text, innerWidth / 2, y);
  });
  if (stick.id !== null) {
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, JR, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(stick.x, stick.y, 22, 0, 7); ctx.fill();
  }
}

const hud = document.getElementById('hud');
const giveup = document.getElementById('giveup');
giveup.onclick = () => ws?.send(JSON.stringify({ t: 'giveup' }));
function bar(x, y, w, h, f, color) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.min(1, Math.max(0, f)), h);
}
let last = performance.now(), fps = 0, acc = 0, frames = 0, slowFor = 0;
const autoQ = !new URLSearchParams(location.search).has('q'); // ไม่บังคับคุณภาพ → ลดเองเมื่อ FPS ต่ำต่อเนื่อง 3 วิ (เงา → ของตกแต่ง → พิกเซลเรโช)
function loop(t) {
  const dt = (t - last) / 1000; last = t;
  step(dt, t); draw(dt, t);
  acc += dt; frames++;
  if (acc >= 0.5) { fps = Math.round(frames / acc); acc = frames = 0;
    slowFor = autoQ && t > 4000 && fps < 26 ? slowFor + 0.5 : 0;
    if (slowFor >= 3 && world.quality > 0) { world.setQuality(world.quality - 1); slowFor = 0; toast('ปรับกราฟิกให้เบาลง', 2500); }
    hud.textContent = `${me.username} · ${me.job} Lv.${stats.level} · HP ${stats.hp}/${stats.max} MP ${Math.round(stats.mp)}/${stats.maxMp} · Rank ${stats.rank} · ${baht(stats.baht)} · ${room.name || 'bkk_lobby'}${room.expiresAt && room.kind === 'gate_e' ? ' ' + new Date(Math.max(0, room.expiresAt - Date.now())).toISOString().slice(11, 19) : ''} · ${fps} fps${ws ? ` · ออนไลน์ ${others.size + 1} คน` : ''}${status ? ' · ' + status : ''}`; }
  requestAnimationFrame(loop);
}
requestAnimationFrame((t) => { loop(t); connect(); }); // เชื่อมต่อหลังวาดเฟรมแรกเสร็จ: เฟรมแรกคอมไพล์ shader นานหลายวิบนเครื่องช้า ถ้าต่อก่อน server จะตัดเพราะ auth ไม่ทัน

window.__game = { player, solid: (x, y) => gmap.solid(x, y), step, get MAP() { return MAP; }, others, mobs, nodes, stats, me, world, get view() { return view; } }; // สำหรับทดสอบอัตโนมัติ
