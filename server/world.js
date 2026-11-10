import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { LOBBY, SPAWN, makeMap } from '../shared/lobby.js';
import { validLook } from '../shared/look.js';
import { makeGateE } from '../shared/gate.js';
import { moveSpeed, maxHp, maxMp, expNext } from '../shared/formulas.js';
import { basicDamage, damageTaken, critRate, attackInterval, expMult } from '../shared/combat.js';

const TICK = 0.05;          // 20 Hz  (GDD §12.6)
const BROADCAST_EVERY = 2;  // 10 Hz
const MAX_MSG_PER_SEC = 20; // GDD §11.7
const SAVE_EVERY_MS = 5 * 60 * 1000; // GDD §12.5
const RESUME_MS = 60 * 1000;
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

// ห้อง = แผนที่ + ผู้เล่น + มอน: lobby (ถาวร), gate_e (instance ต่อการเข้า), test (ห้องสอบแรงค์ส่วนตัว)
export function attachWorld(server, { db, verify, B, goblins = B.combat.lobby_goblins, resumeMs = RESUME_MS }) {
  const C = B.combat, M = C.mob, R = B.monsters.E, G = R.normal, GE = B.gate_e, P = B.places; // ก๊อปลิน = มอน rank E (level/def อยู่ที่ R)
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });
  const players = new Map();
  const resume = new Map(); // uid → { room, x, y, at } หลุดแล้วกลับมาภายใน RESUME_MS = เกิดที่เดิม (GDD A3)
  const rooms = new Map();
  const q = {
    user: db.prepare('SELECT * FROM users WHERE id = ?'),
    equip: db.prepare('SELECT weapon_id, weapon_enhance FROM equipment WHERE user_id = ?'),
    items: db.prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ? AND item_type IN ('potion','loot')"),
    setWeapon: db.prepare('UPDATE equipment SET weapon_id = ?, weapon_enhance = ? WHERE user_id = ?'),
    weapons: db.prepare("SELECT item_id, enhance FROM inventory WHERE user_id = ? AND item_type = 'weapon'"),
    keepEnh: db.prepare("UPDATE inventory SET enhance = ? WHERE user_id = ? AND item_id = ? AND item_type = 'weapon'"),
    item: db.prepare('SELECT id FROM inventory WHERE user_id = ? AND item_id = ?'),
    addQty: db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?'),
    slots: db.prepare('SELECT slot_index FROM inventory WHERE user_id = ?'),
    insItem: db.prepare('INSERT INTO inventory (id,user_id,item_type,item_id,quantity,slot_index) VALUES (?,?,?,?,?,?)'),
    loot: db.prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ? AND item_type = 'loot'"),
    delLoot: db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_type = 'loot'"),
    rank: db.prepare('UPDATE users SET hunter_rank = ? WHERE id = ?'),
    setLook: db.prepare('UPDATE users SET skin_tone = ?, hair_style = ?, hair_color = ?, outfit = ? WHERE id = ?'),
    save: db.prepare('UPDATE users SET hp=?, mp=?, exp=?, level=?, stat_points=?, baht=?, debt=?, free_respawn_count=?, str=?, agi=?, vit=?, int_stat=?, per=?, fatigue=?, fatigue_updated_at=unixepoch(), last_login=unixepoch() WHERE id = ?'),
  };
  const save = (p) => q.save.run(Math.max(0, Math.round(p.hp)), p.mp, p.exp, p.level, p.statPoints, p.baht, Math.max(0, -p.baht), p.free, p.str, p.agi, p.vit, p.int_stat, p.per, fatigue(p, Date.now()), p.uid);
  const SK = Object.fromEntries(Object.entries(B.skills).map(([j, l]) => [j, Object.fromEntries(l.map((k) => [k.id, k]))]));

  const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  const bcast = (room, o) => { const s = JSON.stringify(o); for (const p of room.players) if (p.ws.readyState === 1) p.ws.send(s); };
  // Fatigue แบบ lazy (GDD §4.3): ไม่ทำอะไร 5 วิ แล้วลด 1% ทุก 3 วิ — คำนวณจากเวลาเมื่อถูกอ่าน ไม่ต้อง tick
  const fatigue = (p, now) => { const from = Math.max(p.fatAt, p.lastAct + B.fatigue.recover.idle_after_sec * 1000); if (now > from) p.fatigue = Math.max(0, p.fatigue - (now - from) / 3000 * B.fatigue.recover.idle_per_3s); p.fatAt = now; return p.fatigue; };
  const tire = (p, kind, now) => { p.fatigue = Math.min(100, fatigue(p, now) + B.fatigue.gain[kind] * 100 / (100 + p.vit)); p.lastAct = now; };
  const mePayload = (p) => ({ t: 'me', level: p.level, exp: p.exp, next: expNext(p.level), baht: p.baht, free: p.free, statPoints: p.statPoints, mp: Math.round(p.mp), maxMp: p.maxMp, potions: p.items.mp_potion_0 ?? 0, rank: p.rank,
    items: p.items, stats: { str: p.str, agi: p.agi, vit: p.vit, int: p.int_stat, per: p.per }, speed: p.speed, weapon: p.weapon, enhance: p.enhance,
    weapons: q.weapons.all(p.uid).map((w) => [w.item_id, w.item_id === p.weapon ? p.enhance : w.enhance]) }); // อาวุธทุกชิ้นที่มี + ค่าตีบวกของแต่ละชิ้น
  const partyOf = (p) => (p.party ? [...p.party.members] : [p]);
  const sendParty = (party) => { for (const m of party.members) send(m.ws, { t: 'party', leader: party.leader.uid, members: [...party.members].map((x) => [x.uid, x.name]) }); };
  function leaveParty(p) {
    const party = p.party; if (!party) return;
    party.members.delete(p); p.party = null; send(p.ws, { t: 'party', members: [] });
    if (party.members.size < 2) { for (const m of party.members) { m.party = null; send(m.ws, { t: 'party', members: [] }); } return; }
    if (party.leader === p) party.leader = [...party.members][0];
    sendParty(party);
  }
  const notice = (p, text) => send(p.ws, { t: 'notice', text });
  const alive = (p) => p.state === 'alive';
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const near = (p, [x, y]) => dist(p, { x, y }) <= P.interact_tiles;
  const mate = (p, id) => { const t = players.get(id); return t && t.room === p.room ? t : undefined; }; // เป้าหมายต้องอยู่ห้องเดียวกัน

  const mkMob = (id, x, y, st, extra = {}) => ({ id, home: { x, y }, x, y, hp: st.hp, max: st.hp, st, def: R.def, // st = บล็อกสเตตัส (อ่าน atk/exp สดจาก balance)
     dead: false, respawnAt: 0, target: null, atkAt: 0, ...extra });
  const lobby = { id: 'lobby', kind: 'lobby', name: 'bkk_lobby', map: LOBBY, players: new Set(), nodes: [], mobs: goblins.map(([x, y], i) => mkMob(`m${i}`, x, y, G, { respawn: true })) };
  rooms.set('lobby', lobby);

  function openGate(now, gi) {
    const g = makeGateE({ seed: GE.seed, mobs: GE.mobs, nodes: GE.nodes }), id = 'g' + randomUUID().slice(0, 8);
    const room = { id, kind: 'gate_e', name: 'Gate E', gate: gi, map: makeMap(g.rows), players: new Set(), spawn: g.spawn, expiresAt: now + B.gates.table.E.timer_h * 3600 * 1000 };
    room.mobs = [...g.mobSpawns.map(([x, y], i) => mkMob(`m${i}`, x, y, G)), mkMob('boss', g.boss.x, g.boss.y, R.boss, { boss: true })];
    room.nodes = g.nodeSpawns.map(([x, y], i) => ({ id: `n${i}`, x, y, hp: GE.mining.node_hp, max: GE.mining.node_hp, dead: false }));
    rooms.set(id, room);
    return room;
  }

  function enter(p, room, x, y) { // ย้ายผู้เล่นเข้าห้อง + แจ้ง client + แลกหน้าตากับคนในห้อง
    p.room?.players.delete(p); p.room = room; room.players.add(p);
    p.x = x; p.y = y; p.dx = p.dy = 0; p.assist = null;
    send(p.ws, { t: 'room', id: room.id, kind: room.kind, name: room.name, expiresAt: room.expiresAt ?? 0, x, y });
    for (const o of room.players) { send(o.ws, { t: 'look', id: p.uid, look: p.look }); if (o !== p) send(p.ws, { t: 'look', id: o.uid, look: o.look }); }
  }
  const warpOut = (p) => enter(p, lobby, SPAWN.x, SPAWN.y + 1.5);
  const closeRoom = (room) => { for (const p of [...room.players]) warpOut(p); rooms.delete(room.id); };

  function hurt(p, dmg, now) {
    p.hp -= dmg; p.hitAt = now;
    if (p.hp > 0) return;
    if (now - p.revivedAt < B.downed.repeat_window_sec * 1000) return respawn(p); // ถูกกู้แล้วล้มซ้ำใน 120 วิ = ตายทันที (GDD §6.1)
    p.hp = 0; p.state = 'downed'; p.downedAt = now; p.dx = p.dy = 0; // GDD §6.1: ล้มเมื่อโดนดาเมจถึงตาย
  }

  function respawn(p) { // โรงพยาบาล GDD §6.2: 4 ครั้งแรกฟรี หลังจากนั้นคิดตาม Hunter Rank (ติดลบ = ลูกหนี้)
    if (p.free > 0) p.free--; else p.baht -= B.hospital.fee_by_hunter_rank[p.rank];
    p.hp = p.maxHp; p.state = 'alive';
    enter(p, lobby, ...C.hospital); // ตายใน Gate ก็ฟื้นที่ รพ. ในเมือง เข้า Gate ใหม่ได้ทันที (GDD §8.9)
    save(p); send(p.ws, mePayload(p));
  }

  function give(p, type, item, qty) { // เพิ่ม/ลดของในกระเป๋า 30 ช่อง (ซ้อนทับไอเทมเดิม); คืน false ถ้ากระเป๋าเต็ม
    const row = q.item.get(p.uid, item);
    if (row) q.addQty.run(qty, row.id);
    else {
      const used = new Set(q.slots.all(p.uid).map((r) => r.slot_index));
      let slot = 0; while (used.has(slot)) slot++;
      if (slot > 29) { notice(p, 'กระเป๋าเต็ม'); return false; }
      q.insItem.run(randomUUID(), p.uid, type, item, qty, slot);
    }
    if (type !== 'weapon') p.items[item] = (p.items[item] ?? 0) + qty;
    return true;
  }
  function addLoot(p, item, qty) {
    if (!give(p, 'loot', item, qty)) return;
    if (p.room.kind === 'gate_e') p.room.lootValue = (p.room.lootValue ?? 0) + B.items[item].price * qty; // ฐานของโบนัส clear 5% (GDD §8.8)
    send(p.ws, { t: 'loot', item, qty, name: B.items[item].name });
  }

  function gainExp(p, amount) {
    p.exp += amount;
    let up = false;
    while (p.level < B.meta.level_cap && p.exp >= expNext(p.level)) { p.exp -= expNext(p.level); p.level++; p.statPoints += B.stat_points_per_level; up = true; }
    p.maxHp = maxHp(p.vit, p.level);
    if (up) { save(p); send(p.ws, { t: 'levelup', level: p.level }); }
    send(p.ws, mePayload(p));
  }

  function strike(p, mob, mult, now) { // ดาเมจต่อมอน: ใช้ทั้งตีธรรมดาและสกิล (GDD §4.2 Skill Damage = Basic × mult)
    const crit = Math.random() < critRate(B, p.per, p.weapon, p.enhance);
    const raw = basicDamage(B, p, p.weapon, p.enhance) * mult * (crit ? B.formulas.crit_mult : 1);
    const dmg = Math.max(1, Math.round(damageTaken(raw, mob.def, p.level)));
    p.actAt = now;
    if (p.room.kind === 'test') p.room.burst += dmg;      // หุ่นทดสอบแรงค์: นับดาเมจรวม ไม่ตาย
    if (mob.dummy) { bcast(p.room, { t: 'hit', id: mob.id, v: dmg, crit }); return; }
    mob.hp -= dmg; mob.target = p.uid;
    bcast(p.room, { t: 'hit', id: mob.id, v: dmg, crit });
    if (mob.hp <= 0) kill(p, mob, now);
  }

  function revive(t, pct, now) {
    t.state = 'alive'; t.hp = Math.max(1, Math.round(t.maxHp * pct)); t.revivedAt = now; t.hitAt = now;
    send(t.ws, mePayload(t));
  }

  function cast(p, id, targetId, now) {
    const fail = (why) => send(p.ws, { t: 'skillFailed', skill: id, why });
    const k = SK[p.job]?.[id];
    if (!k || p.level < k.level) return fail('unknown');
    if (!alive(p) || !p.weapon) return fail('state');
    if (now < (p.cd[id] ?? 0)) return fail('cooldown');
    if (p.mp < k.mp) return fail('mp');
    if (fatigue(p, now) >= B.fatigue.exhausted_at) return fail('exhausted'); // GDD §4.3
    const mobs = p.room.mobs;
    const mob = ['single', 'teleport_strike'].includes(k.kind) ? mobs.find((x) => x.id === targetId && !x.dead) : null;
    const ally = k.kind === 'heal' ? (targetId ? mate(p, targetId) : p) : k.kind === 'revive' ? mate(p, targetId) : null;
    if (['single', 'teleport_strike'].includes(k.kind) && (!mob || dist(p, mob) > k.range)) return fail('range');
    if (k.kind === 'heal' && (!ally || !alive(ally) || dist(p, ally) > k.range)) return fail('range');
    if (k.kind === 'revive' && (!ally || ally.state !== 'downed' || dist(p, ally) > k.range)) return fail('range');

    p.mp -= k.mp; p.cd[id] = now + k.cd * 1000; p.actAt = now; tire(p, 'skill', now);
    if (k.kind === 'single') strike(p, mob, k.mult, now);
    else if (k.kind === 'teleport_strike') { // วาร์ปไปด้านหลังเป้า (ฝั่งตรงข้ามผู้โจมตี) ถ้าติดกำแพงอยู่ที่เดิม
      const d = dist(p, mob) || 1, nx = mob.x + (mob.x - p.x) / d * 0.9, ny = mob.y + (mob.y - p.y) / d * 0.9;
      if (!p.room.map.blocked(nx, ny)) { p.x = nx; p.y = ny; }
      strike(p, mob, k.mult, now);
    } else if (k.kind === 'aoe') for (const m of mobs) {
      if (m.dead || dist(p, m) > k.radius) continue;
      if (k.stun) m.stunUntil = now + k.stun * 1000;
      strike(p, m, k.mult, now);
    } else if (k.kind === 'taunt') for (const m of mobs) {
      if (!m.dead && !m.dummy && dist(p, m) <= k.radius) { m.target = p.uid; m.tauntUntil = now + k.sec * 1000; }
    } else if (k.kind === 'heal') {
      const w = B.weapons[p.weapon], prof = B.proficiency.matrix[p.job][w.type];
      ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * k.pct * prof * (1 + p.int_stat / 500) * (1 + (w.heal ?? 0))); // GDD §17.8
    } else if (k.kind === 'revive') revive(ally, B.downed.healer_revive_hp_pct / 100, now);
    if (k.stun && mob) mob.stunUntil = now + k.stun * 1000;
    send(p.ws, { t: 'skill', skill: id, cd: k.cd });
    send(p.ws, mePayload(p));
  }

  function kill(p, mob, now) {
    mob.dead = true; mob.respawnAt = now + M.respawn_sec * 1000; mob.target = null;
    const share = partyOf(p).filter((m) => m.room === p.room && dist(m, mob) <= B.party.share_range_tiles), n = share.length || 1; // GDD §16.6
    for (const m of share.length ? share : [p]) gainExp(m, Math.round(mob.st.exp * (1 + 0.1 * (n - 1)) / n * expMult(B, m.level, R.level)));
    if (mob.boss) { addLoot(p, GE.drops.boss.item, GE.drops.boss.qty); clearGate(p.room, now); } // solo = หัวหน้าปาร์ตี้แจกให้ตัวเอง (GDD §18.9)
    else if (mob.brk) { if (Math.random() < GE.drops.mob.chance * B.dungeon_break.reward_mult.drop_rate) addLoot(p, GE.drops.mob.item, 1); breakKilled(p, mob, now); }
    else if (p.room.kind === 'gate_e' && Math.random() < GE.drops.mob.chance) addLoot(p, GE.drops.mob.item, 1);
  }

  function dungeonBreak(room, now) { // Gate หมดเวลาโดยไม่มีใคร clear → มอนทะลักออกมาที่ประตูในเมือง (GDD §18.8)
    const D = B.dungeon_break, S = D.mobs.E, [gx, gy] = P.gates[room.gate] ?? [SPAWN.x, SPAWN.y];
    const live = lobby.mobs.filter((m) => m.brk && !m.dead).length, n = Math.min(S.count, D.mob_cap - live); if (n <= 0) return;
    const brk = { endsAt: now + D.duration_min * 60 * 1000, killers: new Set(), level: S.level }, st = { hp: S.hp, atk: S.atk, exp: G.exp * D.reward_mult.exp };
    for (let i = 0; i < n; i++) {
      let x = gx, y = gy; for (let k = 0; k < 20; k++) { const a = Math.random() * 7, r = 1 + Math.random() * 2.5; x = gx + Math.cos(a) * r; y = gy + Math.sin(a) * r; if (!LOBBY.blocked(x, y)) break; }
      lobby.mobs.push(mkMob(`b${randomUUID().slice(0, 6)}`, x, y, st, { brk, respawn: false }));
    }
    for (const p of lobby.players) notice(p, `Dungeon Break! ${S.name} ${n} ตัวบุกออกมาจาก Gate — กำจัดให้หมดใน ${D.duration_min} นาที`);
  }
  function breakKilled(p, mob, now) { // ฆ่าครบทุกตัวของ break นั้น = clear: +100% EXP ของ Gate ให้คนที่ช่วยฆ่า
    mob.brk.killers.add(p.uid);
    if (lobby.mobs.some((m) => m.brk === mob.brk && !m.dead)) return;
    mob.brk.endsAt = now;
    for (const uid of mob.brk.killers) { const k = players.get(uid); if (!k) continue; const exp = Math.round(B.gates.table.E.exp_clear * expMult(B, k.level, R.level)); gainExp(k, exp); send(k.ws, { t: 'cleared', exp, bonus: 0 }); }
    for (const o of lobby.players) notice(o, 'กำจัด Dungeon Break สำเร็จ เมืองปลอดภัยแล้ว');
  }

  function clearGate(room, now) { // บอสตาย = clear: EXP ทุกคนในห้อง, ค้างอยู่ได้ไม่กี่วิแล้วถูกวาร์ปออก
    room.clearedAt = now;
    const bonus = Math.round((room.lootValue ?? 0) * B.gates.completion_bonus_pct_of_loot / (room.players.size || 1)); // GDD §8.8
    for (const p of room.players) { const exp = Math.round(B.gates.table.E.exp_clear * expMult(B, p.level, R.level)); p.baht += bonus; gainExp(p, exp); send(p.ws, { t: 'cleared', exp, bonus }); }
  }

  function startRankTest(p, now) {
    const next = RANKS[RANKS.indexOf(p.rank) + 1], req = next && B.hunter_ranks.assessment.requirements[next];
    if (!req) return notice(p, 'แรงค์สูงสุดแล้ว');
    if (p.level < req.level) return notice(p, `ต้องเลเวล ${req.level} ก่อนสอบแรงค์ ${next}`);
    const a = B.hunter_ranks.assessment, id = 'test' + randomUUID().slice(0, 6);
    const room = { id, kind: 'test', name: 'ห้องสอบแรงค์', map: LOBBY, players: new Set(), nodes: [], burst: 0, endsAt: now + a.duration_sec * 1000, next, req, expiresAt: now + a.duration_sec * 1000,
      mobs: [{ id: 'dummy', dummy: true, x: 7.2, y: 8, home: { x: 7.2, y: 8 }, hp: 1, max: 1, def: 0, dead: false, target: null }] };
    rooms.set(id, room); enter(p, room, 6, 8);
  }

  function endRankTest(room) {
    const p = [...room.players][0];
    if (p) {
      const need = Math.round(room.req.burst * (B.hunter_ranks.assessment.class_burst_factor[p.job] ?? 1)), passed = room.burst >= need;
      if (passed) { p.rank = room.next; q.rank.run(p.rank, p.uid); }
      send(p.ws, { t: 'rankResult', burst: room.burst, need, passed, rank: p.rank });
      send(p.ws, mePayload(p));
    }
    closeRoom(room);
  }

  wss.on('connection', (ws) => {
    let me = null;
    const authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), 15000); // เผื่อมือถือช้า

    ws.on('message', async (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }

      if (!me) {
        if (m.t !== 'auth' || ws.authing) return;
        ws.authing = true;
        try {
          const uid = await verify(String(m.token));
          const u = q.user.get(uid);
          if (!u) return ws.close(4003, 'no character');
          const eq = q.equip.get(uid);
          players.get(uid)?.ws.close(4000, 'logged in elsewhere');
          clearTimeout(authTimer);
          const mhp = maxHp(u.vit, u.level);
          me = {
            uid, ws, room: null, x: 0, y: 0, dx: 0, dy: 0, speed: moveSpeed(B, u.agi), name: u.username, job: u.job, rank: u.hunter_rank,
            level: u.level, exp: u.exp, statPoints: u.stat_points, baht: u.baht, free: u.free_respawn_count,
            str: u.str, agi: u.agi, vit: u.vit, int_stat: u.int_stat, per: u.per, mp: u.mp,
            hp: Math.min(u.hp || mhp, mhp), maxHp: mhp, maxMp: maxMp(u.int_stat), cd: {}, revivedAt: -Infinity, potionAt: 0, mineAt: 0, assist: null,
            items: Object.fromEntries(q.items.all(uid).map((r) => [r.item_id, r.quantity])), party: null, invite: null, chatAt: 0, lastChat: '', chatRep: 0, chatBlock: 0, taxiAt: 0,
            fatigue: Math.max(0, u.fatigue - (Date.now() / 1000 - u.fatigue_updated_at) / 3), fatAt: Date.now(), lastAct: 0,
            state: 'alive', hitAt: 0, regenAt: 0, atkAt: 0,
            weapon: eq?.weapon_id, enhance: eq?.weapon_enhance ?? 0, n: 0, t: Date.now(),
          };
          if (me.hp <= 0) me.hp = mhp; // ออกตอน HP 0 → กลับมาเต็ม (ไม่ให้ติดล้มข้าม session)
          me.look = { skin_tone: u.skin_tone, hair_style: u.hair_style, hair_color: u.hair_color, outfit: u.outfit };
          players.set(uid, me);
          const r = resume.get(uid); resume.delete(uid);
          if (r && Date.now() - r.at < resumeMs && rooms.get(r.room.id) === r.room) enter(me, r.room, r.x, r.y); else enter(me, lobby, SPAWN.x, SPAWN.y);
          send(ws, { t: 'hello', id: uid, x: me.x, y: me.y });
          send(ws, mePayload(me));
        } catch { ws.close(4002, 'unauthorized'); }
        return;
      }

      const now = Date.now();
      if (now - me.t >= 1000) { me.t = now; me.n = 0; }
      if (++me.n > MAX_MSG_PER_SEC) return;

      if (m.t === 'in' && alive(me)) {
        let { dx, dy } = m;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        me.dx = dx; me.dy = dy;
      } else if (m.t === 'atk' && alive(me)) {
        const mob = me.room.mobs.find((x) => x.id === m.id);
        if (!mob || mob.dead || !me.weapon) return;
        if (dist(me, mob) > B.network.action_distance_tiles) return;                       // GDD §11.3
        if (now - me.atkAt < attackInterval(B, me.agi, me.weapon) * 1000 * 0.9) return;    // GDD §11.2 (เผื่อ jitter 10%)
        me.atkAt = now; tire(me, 'basic_attack', now);
        strike(me, mob, 1, now);
      } else if (m.t === 'cast') cast(me, String(m.skill), m.id && String(m.id), now);
      else if (m.t === 'mine' && alive(me) && me.room.kind === 'gate_e') {
        const node = me.room.nodes.find((x) => x.id === m.id), K = GE.mining;
        if (!node || node.dead || dist(me, node) > K.range_tiles || now - me.mineAt < K.swing_cd_sec * 1000) return;
        me.mineAt = now; me.actAt = now; tire(me, 'mining_swing', now);
        node.hp -= me.job === 'Miner' ? K.swing_damage_miner : K.swing_damage_other;
        bcast(me.room, { t: 'nodeHit', id: node.id });
        if (node.hp <= 0) { node.dead = true; addLoot(me, GE.drops.node.item, GE.drops.node.qty); }
      } else if (m.t === 'potion' && alive(me)) {
        const pot = B.mp_potions.tiers[0];
        if (me.items.mp_potion_0 > 0 && now - me.potionAt >= B.mp_potions.shared_cooldown_sec * 1000 && me.mp < me.maxMp) {
          me.potionAt = now; give(me, 'potion', 'mp_potion_0', -1); me.mp = Math.min(me.maxMp, me.mp + pot.mp);
          send(ws, mePayload(me));
        }
      } else if (m.t === 'use' && alive(me)) { // น้ำเปล่า/ยาชูกำลัง ลด Fatigue (GDD §4.3)
        const c = B.consumables[m.item];
        if (c?.fatigue && me.items[m.item] > 0 && fatigue(me, now) > 0) { give(me, 'potion', m.item, -1); me.fatigue = Math.max(0, me.fatigue - c.fatigue); send(ws, mePayload(me)); }
      } else if (m.t === 'look' && me.room === lobby) { // ตู้เสื้อผ้า: เปลี่ยนผิว/ผม/ชุดได้ฟรีในเมือง
        const err = validLook(m.look, B.appearance); if (err) return notice(me, err);
        const { skin_tone, hair_style, hair_color, outfit } = m.look; me.look = { skin_tone, hair_style, hair_color, outfit };
        q.setLook.run(skin_tone, hair_style, hair_color, outfit, me.uid);
        for (const o of lobby.players) send(o.ws, { t: 'look', id: me.uid, look: me.look });
      } else if (m.t === 'equip' && alive(me) && me.room === lobby) { // สลับอาวุธจากกระเป๋า: ค่าตีบวกติดไปกับอาวุธแต่ละชิ้น
        const w = q.weapons.all(me.uid).find((r) => r.item_id === String(m.item));
        if (!w || w.item_id === me.weapon) return;
        q.keepEnh.run(me.enhance, me.uid, me.weapon); me.weapon = w.item_id; me.enhance = w.enhance; q.setWeapon.run(me.weapon, me.enhance, me.uid);
        send(ws, mePayload(me));
      } else if (m.t === 'stat') { // ลงแต้มสเตตัส (+3/เลเวล, ไม่มี respec — GDD §4.4)
        const k = { str: 'str', agi: 'agi', vit: 'vit', int: 'int_stat', per: 'per' }[m.k];
        if (!k || me.statPoints < 1) return;
        me.statPoints--; me[k]++; me.maxHp = maxHp(me.vit, me.level); me.maxMp = maxMp(me.int_stat); me.speed = moveSpeed(B, me.agi);
        save(me); send(ws, mePayload(me));
      } else if (m.t === 'buy' && alive(me) && me.room === lobby) { // ร้านในตลาด
        if (!near(me, P.market)) return notice(me, 'ต้องยืนใกล้ตลาด');
        const item = String(m.item), isW = B.shop.weapons.includes(item), price = isW ? B.weapons[item].price : B.shop.consumables.includes(item) ? B.consumables[item].price : null;
        if (price === null) return;
        if (isW && q.item.get(me.uid, item)) return notice(me, 'มีอาวุธนี้แล้ว');
        if (me.baht < price) return notice(me, 'เงินไม่พอ');
        if (isW) { // ซื้ออาวุธ = เข้ากระเป๋า (กระเป๋าเก็บอาวุธทุกชิ้นที่มี) แล้วสวมทันที (สลับชิ้นอื่นได้ที่หน้าตัวละคร)
          if (!give(me, 'weapon', item, 1)) return;
          q.keepEnh.run(me.enhance, me.uid, me.weapon); me.weapon = item; me.enhance = 0; q.setWeapon.run(item, 0, me.uid); // ชิ้นเดิมเก็บค่าตีบวกไว้
        } else if (!give(me, 'potion', item, 1)) return;
        me.baht -= price; save(me); send(ws, { t: 'bought', item }); send(ws, mePayload(me));
      } else if (m.t === 'enhance' && alive(me) && me.room === lobby) { // ตีบวก: Rank D+, แร่เกรดตรงกับอาวุธ, สำเร็จ 100% (GDD §7.1)
        if (!near(me, P.association)) return notice(me, 'ต้องยืนใกล้สมาคมฮันเตอร์');
        const E = B.enhancement, w = B.weapons[me.weapon], stone = `mana_stone_${w.rank.toLowerCase()}`, need = E.materials[me.enhance];
        if (RANKS.indexOf(me.rank) < RANKS.indexOf(E.min_hunter_rank)) return notice(me, `ต้องเป็นแรงค์ ${E.min_hunter_rank} ขึ้นไป`);
        if (me.enhance >= E.max_level) return notice(me, 'ตีบวกสูงสุดแล้ว');
        if (!B.items[stone]) return notice(me, 'ยังไม่มีแร่เกรดนี้');
        if ((me.items[stone] ?? 0) < need) return notice(me, `ต้องใช้${B.items[stone].name} ${need} ก้อน`);
        give(me, 'loot', stone, -need); me.enhance++; q.setWeapon.run(me.weapon, me.enhance, me.uid);
        send(ws, { t: 'enhanced', level: me.enhance }); send(ws, mePayload(me));
      } else if (m.t === 'taxi' && alive(me) && me.room === lobby) { // วินมอเตอร์ไซค์ (GDD §7.2)
        const X = B.taxi, to = X.to[m.to];
        if (!to || !X.stands.some((s) => near(me, s))) return notice(me, 'ต้องยืนที่วินมอเตอร์ไซค์');
        if (now - me.taxiAt < X.cooldown_sec * 1000) return notice(me, 'วินยังไม่ว่าง');
        const fare = Math.min(X.fare_max, Math.round(X.fare_base + dist(me, { x: to.pos[0], y: to.pos[1] }) * X.fare_per_tile));
        if (me.baht < fare) return notice(me, 'เงินไม่พอ');
        me.baht -= fare; me.taxiAt = now; me.fatigue = Math.max(0, fatigue(me, now) - B.fatigue.recover.taxi);
        enter(me, lobby, ...to.pos); send(ws, mePayload(me)); notice(me, `ค่าวิน ฿${fare}`);
      } else if (m.t === 'pinvite') { // ปาร์ตี้ (สูงสุด 4 สำหรับ Gate E)
        const t = mate(me, String(m.id));
        if (!t || t === me || dist(me, t) > B.party.invite_range_tiles) return;
        if (t.party) return notice(me, `${t.name} มีปาร์ตี้แล้ว`);
        if (me.party && (me.party.leader !== me || me.party.members.size >= B.party.max)) return notice(me, me.party.leader !== me ? 'เฉพาะหัวหน้าปาร์ตี้ชวนได้' : 'ปาร์ตี้เต็ม');
        t.invite = { from: me.uid, at: now }; send(t.ws, { t: 'pinvited', from: me.uid, name: me.name }); notice(me, `ชวน ${t.name} แล้ว`);
      } else if (m.t === 'paccept') {
        const inv = me.invite, from = inv && players.get(inv.from); me.invite = null;
        if (!from || me.party || now - inv.at > B.party.invite_ttl_sec * 1000) return;
        const party = from.party ??= { leader: from, members: new Set([from]), gate: null };
        if (party.members.size >= B.party.max) return notice(me, 'ปาร์ตี้เต็ม');
        party.members.add(me); me.party = party; sendParty(party);
      } else if (m.t === 'pleave') leaveParty(me);
      else if (m.t === 'chat') { // แชต Zone/Party (GDD §15)
        const K = B.chat, ch = m.ch === 'p' ? 'p' : 'z', spec = K.channels[ch === 'p' ? 'party' : 'zone'];
        let text = typeof m.text === 'string' ? m.text.trim() : '';
        if (!text || [...text].length > K.max_len || now < me.chatBlock || now - me.chatAt < spec.min_interval_sec * 1000) return;
        if (/(https?:\/\/|www\.|\.(com|net|org|io|gg|me|co|xyz)\b)/i.test(text)) return notice(me, 'ห้ามส่งลิงก์');
        me.chatRep = text === me.lastChat ? me.chatRep + 1 : 1; me.lastChat = text; me.chatAt = now;
        if (me.chatRep >= K.spam_repeat_block.repeats) { me.chatBlock = now + K.spam_repeat_block.block_sec * 1000; me.chatRep = 0; return notice(me, 'ส่งข้อความซ้ำ — พักแชต 10 วิ'); }
        for (const w of K.banned) text = text.replaceAll(new RegExp(w, 'gi'), '*'.repeat(w.length));
        if (ch === 'p' && !me.party) return notice(me, 'ยังไม่มีปาร์ตี้');
        for (const o of ch === 'p' ? me.party.members : me.room.players) send(o.ws, { t: 'chat', ch, id: me.uid, name: me.name, text });
      } else if (m.t === 'assist' && alive(me)) { // พยุงเพื่อนร่วมปาร์ตี้ที่ล้ม (ทุกอาชีพ, GDD §6.1)
        const t = mate(me, String(m.id)), A = B.downed.assist;
        if (t && t !== me && me.party && t.party === me.party && t.state === 'downed' && dist(me, t) <= A.range_tiles) { me.assist = { id: t.uid, at: now }; send(ws, { t: 'assisting', id: t.uid, sec: A.channel_sec }); }
      } else if (m.t === 'enter' && alive(me) && me.room === lobby) { // เข้า Gate E ที่ประตูในลาน
        const gate = P.gates[m.gate];
        if (!gate || !near(me, gate)) return notice(me, 'ต้องยืนใกล้ประตู Gate');
        let room = me.party && rooms.get(me.party.gate); // ปาร์ตี้เดียวกัน = instance เดียวกัน
        if (!room || room.clearedAt) {
          if ([...rooms.values()].filter((r) => r.kind === 'gate_e').length >= GE.max_instances) return notice(me, 'Gate เต็ม ลองใหม่ภายหลัง');
          room = openGate(now, m.gate); if (me.party) me.party.gate = room.id;
        }
        enter(me, room, room.spawn.x, room.spawn.y);
      } else if (m.t === 'leave' && alive(me) && me.room.kind === 'gate_e') warpOut(me);
      else if (m.t === 'sell' && alive(me) && me.room === lobby) { // ขายของที่ตลาด (ฝั่งตะวันออก) GDD §9.1
        if (!near(me, P.market)) return notice(me, 'ต้องยืนใกล้ตลาด');
        const rows = q.loot.all(me.uid); let income = rows.reduce((s, r) => s + B.items[r.item_id].price * r.quantity, 0);
        if (!income) return notice(me, 'ไม่มีของให้ขาย');
        q.delLoot.run(me.uid);
        if (me.baht < 0) { const pay = Math.min(income * 0.5, -me.baht); me.baht += pay; income -= pay; } // ลูกหนี้: รายได้ถูกหัก 50% (GDD §6.2)
        me.baht += income; save(me); send(ws, { t: 'sold', total: income }); send(ws, mePayload(me));
      } else if (m.t === 'ranktest' && alive(me) && me.room === lobby) {
        if (!near(me, P.association)) return notice(me, 'ต้องยืนใกล้สมาคมฮันเตอร์');
        startRankTest(me, now);
      } else if (m.t === 'giveup' && me.state === 'downed') respawn(me);
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (me && players.get(me.uid) === me) { resume.set(me.uid, { room: me.room, x: me.x, y: me.y, at: Date.now() }); leaveParty(me); players.delete(me.uid); me.room.players.delete(me); save(me); }
    });
  });

  let tick = 0, lastSave = Date.now();
  const loop = setInterval(() => {
    const now = Date.now();
    for (const p of players.values()) {
      if (p.dx || p.dy) { p.room.map.move(p, p.dx, p.dy, p.speed * TICK); p.face = Math.atan2(p.dx, p.dy); } // หันหน้าตามทิศเดิน (client 3D ใช้หมุนตัว)
      if (p.assist) { // ยกเลิกถ้าขยับ/โดนตี/เป้าหาย; ครบเวลา = ฟื้น 10% (GDD §6.1)
        const a = p.assist, t = mate(p, a.id), A = B.downed.assist;
        if (!t || t.state !== 'downed' || !alive(p) || p.dx || p.dy || p.hitAt >= a.at || dist(p, t) > A.range_tiles * 1.5) { p.assist = null; send(p.ws, { t: 'assistCancel' }); }
        else if (now - a.at >= A.channel_sec * 1000) { p.assist = null; revive(t, A.revive_hp_pct / 100, now); }
      }
      if (p.state === 'downed' && now - p.downedAt >= B.downed.timer_sec * 1000) respawn(p); // หมดเวลา = ตาย
      if (alive(p) && p.hp < p.maxHp && now - p.hitAt >= C.regen_idle_sec * 1000 && now - p.regenAt >= 3000) { // GDD §4.2 HP regen
        p.regenAt = now; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.01 * (1 + p.vit / 200));
      }
    }
    for (const room of [...rooms.values()]) {
      if (room.kind === 'test' && now >= room.endsAt) { endRankTest(room); continue; }
      if (room.kind === 'gate_e') {
        if (now >= room.expiresAt || (room.clearedAt && now - room.clearedAt >= GE.clear_linger_sec * 1000)) {
          const failed = !room.clearedAt; if (failed) bcast(room, { t: 'gateFailed' });
          closeRoom(room); if (failed && B.gates.low_pool.dungeon_break_if_no_clear) dungeonBreak(room, now); // หมดเวลาไม่มีใคร clear = Dungeon Break
          continue;
        }
        if (!room.players.size) { room.emptyAt ??= now; if (now - room.emptyAt > 3000) rooms.delete(room.id); continue; }
        room.emptyAt = null;
      }
      if (room === lobby && lobby.mobs.some((m) => m.brk && now >= m.brk.endsAt)) lobby.mobs = lobby.mobs.filter((m) => !m.brk || now < m.brk.endsAt); // break หมดเวลา/จบ = มอนหาย
      for (const m of room.mobs) {
        if (m.dummy) continue;
        if (m.dead) { if (m.respawn !== false && room.kind === 'lobby' && now >= m.respawnAt) Object.assign(m, { dead: false, hp: m.max, x: m.home.x, y: m.home.y, target: null }); continue; }
        if (now < (m.stunUntil ?? 0)) continue; // ติดสตัน/แช่แข็ง
        let t = players.get(m.target);
        if (t && (t.room !== room || !alive(t) || (dist(m, m.home) > M.leash_tiles && now >= (m.tauntUntil ?? 0)))) t = null;
        if (!t) { // หาเป้าใหม่ในระยะ aggro (ไม่ไล่คนที่ล้มอยู่ — GDD §6.1)
          let best = M.aggro_tiles;
          for (const p of room.players) if (alive(p) && dist(m, p) < best && !(m.brk && p.level < m.brk.level - B.dungeon_break.safe_if_player_level_below_break_level_minus)) { best = dist(m, p); t = p; } // Safe Zone: เลเวลต่ำกว่ามาก = มอน break ไม่ไล่
        }
        m.target = t?.uid ?? null;
        const goal = t ?? m.home, d = dist(m, goal);
        if (d > 0.05) m.face = Math.atan2(goal.x - m.x, goal.y - m.y); // มอนหันหน้าไปทางเป้า
        if (!t && d < 0.1) m.hp = m.max;
        if (t && d <= M.attack_range_tiles) {
          if (now - m.atkAt >= M.attack_interval_sec * 1000) { m.atkAt = now; hurt(t, damageTaken(m.st.atk, 0, R.level), now); }
        } else if (d > 0.1) room.map.move(m, (goal.x - m.x) / d, (goal.y - m.y) / d, Math.min(d, M.speed_tiles_per_sec * TICK));
      }
    }
    if (now - lastSave >= SAVE_EVERY_MS) { lastSave = now; for (const p of players.values()) save(p); }

    if (++tick % BROADCAST_EVERY) return;
    for (const room of rooms.values()) {
      if (!room.players.size) continue;
      bcast(room, {
        t: 's',
        p: [...room.players].map((p) => [p.uid, +p.x.toFixed(2), +p.y.toFixed(2), p.name, p.job, p.level, Math.round(p.hp), p.maxHp, p.state === 'alive' ? 0 : 1, now - (p.actAt ?? 0) < 350 ? 1 : 0, +(p.face ?? 0).toFixed(2), Math.round(fatigue(p, now))]),
        m: room.mobs.filter((m) => !m.dead).map((m) => [m.id, +m.x.toFixed(2), +m.y.toFixed(2), m.hp, m.max, m.boss ? 1 : m.dummy ? 2 : 0, +(m.face ?? 0).toFixed(2)]),
        n: room.nodes.filter((n) => !n.dead).map((n) => [n.id, n.x, n.y, n.hp, n.max]),
      });
    }
  }, TICK * 1000);
  server.on('close', () => { clearInterval(loop); wss.close(); });
  return wss;
}
