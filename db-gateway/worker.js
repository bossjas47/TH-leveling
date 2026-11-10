// Worker Gateway (GDD §1.1): game server → Worker → D1. ต้องมี header `authorization: Bearer <GATEWAY_TOKEN>`
// POST /batch  { statements: [{ sql, params }] }  → รันเป็นทรานแซกชันเดียว (D1 batch)
// GET  /dump                                      → แถวทั้งหมดของทุกตาราง (ใช้ตอน game server เริ่ม)
export const TABLES = ['users', 'equipment', 'inventory']; // ลำดับตาม foreign key
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

function same(a, b) { // เทียบแบบเวลาคงที่
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(req, env) {
    const token = env.GATEWAY_TOKEN;
    if (!token || !same(req.headers.get('authorization') ?? '', `Bearer ${token}`)) return json({ error: 'unauthorized' }, 401);
    const { pathname } = new URL(req.url);
    if (req.method === 'GET' && pathname === '/dump') {
      const out = {};
      for (const t of TABLES) out[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
      return json(out);
    }
    if (req.method === 'POST' && pathname === '/batch') {
      const { statements } = await req.json();
      if (!Array.isArray(statements) || statements.length > 500) return json({ error: 'bad batch' }, 400);
      for (const s of statements) if (typeof s.sql !== 'string' || !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(s.sql)) return json({ error: 'only INSERT/UPDATE/DELETE' }, 400);
      if (statements.length) await env.DB.batch(statements.map((s) => env.DB.prepare(s.sql).bind(...(s.params ?? []))));
      return json({ ok: true, n: statements.length });
    }
    return json({ error: 'not found' }, 404);
  },
};
