import { randomUUID } from 'node:crypto';
import { maxHp, maxMp } from '../shared/formulas.js';
import { validLook } from '../shared/look.js';

const json = (res, code, body) =>
  res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));

const readBody = async (req) => {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 4096) throw new Error('too large'); }
  return JSON.parse(s || '{}');
};

const NAME = /^[\p{L}\p{M}\p{N}_]+$/u; // \p{M} = สระ/วรรณยุกต์ไทย
const nameLen = (s) => [...new Intl.Segmenter().segment(s)].length; // นับตัวที่เห็นบนจอ (GDD §3.1: 3–12)
const validName = (s) => typeof s === 'string' && s.length <= 48 && NAME.test(s) && /\p{L}/u.test(s) && nameLen(s) >= 3 && nameLen(s) <= 12;

export function validateCharacter(b, B) {
  const a = B.appearance;
  if (!validName(b.username)) return 'ชื่อต้องยาว 3–12 ตัวอักษร (ตัวอักษร/ตัวเลข/_)';
  if (!['male', 'female'].includes(b.gender)) return 'เพศไม่ถูกต้อง';
  if (!Object.hasOwn(B.classes, b.job)) return 'อาชีพไม่ถูกต้อง';
  return validLook(b.look, a);
}

export function makeApi({ db, verify, B, origin = '*' }) {
  const find = db.prepare('SELECT * FROM users WHERE id = ?');
  const insUser = db.prepare(`INSERT INTO users (id,username,gender,job,skin_tone,hair_style,hair_color,outfit,str,agi,vit,int_stat,per,hp,mp)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insEquip = db.prepare('INSERT INTO equipment (user_id, weapon_id) VALUES (?, ?)');
  const insItem = db.prepare('INSERT INTO inventory (id,user_id,item_type,item_id,quantity,slot_index) VALUES (?,?,?,?,?,?)');

  const view = (u) => u && { ...u, max_hp: maxHp(u.vit, u.level), max_mp: maxMp(u.int_stat) };

  const handler = async (req, res) => {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'authorization,content-type');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/health') return json(res, 200, { ok: true });
    if (path !== '/api/me' && path !== '/api/character') return json(res, 404, { error: 'not found' });

    let uid;
    try { uid = await verify((req.headers.authorization ?? '').replace(/^Bearer /, '')); }
    catch { return json(res, 401, { error: 'unauthorized' }); }

    if (path === '/api/me' && req.method === 'GET') {
      const u = find.get(uid);
      return u ? json(res, 200, view(u)) : json(res, 404, { error: 'no character' });
    }

    if (path === '/api/character' && req.method === 'POST') {
      if (find.get(uid)) return json(res, 409, { error: 'มีตัวละครแล้ว' });
      let b;
      try { b = await readBody(req); } catch { return json(res, 400, { error: 'bad json' }); }
      const err = validateCharacter(b, B);
      if (err) return json(res, 400, { error: err });

      const c = B.classes[b.job], weapon = c.starter_weapon, l = b.look;
      try {
        db.exec('BEGIN');
        insUser.run(uid, b.username, b.gender, b.job, l.skin_tone, l.hair_style, l.hair_color, l.outfit,
          c.str, c.agi, c.vit, c.int, c.per, maxHp(c.vit, 1), maxMp(c.int));
        insEquip.run(uid, weapon);
        insItem.run(randomUUID(), uid, 'weapon', weapon, 1, 0);
        insItem.run(randomUUID(), uid, 'potion', 'mp_potion_0', B.starter_potions, 1); // น้ำมนต์เล็ก (GDD §4.5)
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        if (/UNIQUE/.test(e.message)) return json(res, 409, { error: 'ชื่อนี้ถูกใช้แล้ว' });
        throw e;
      }
      return json(res, 201, view(find.get(uid)));
    }
    return json(res, 405, { error: 'method not allowed' });
  };
  handler.db = db;
  return handler;
}
