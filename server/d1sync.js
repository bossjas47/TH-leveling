// เก็บถาวรลง Cloudflare D1 ผ่าน Worker Gateway โดยไม่แตะโค้ดที่ใช้ SQLite แบบ sync:
//  • SQLite ในหน่วยความจำ/ดิสก์ = แคชทำงานจริง (เร็ว) · ทุกคำสั่งเขียนถูกจดไว้แล้วส่งขึ้น D1 เป็นชุด (write-behind)
//  • ตอนเริ่ม server: ดึงข้อมูลทั้งหมดจาก D1 มาใส่ SQLite  → restart แล้วข้อมูลไม่หาย
// shortcut: รองรับ game server ตัวเดียว (ตามแผน Render 1 instance); หลาย instance ต้องย้ายไป Durable Objects
const TABLES = ['users', 'equipment', 'inventory'];

export function withD1(db, { url, token, fetchImpl = fetch, intervalMs = 2000, onError = (e) => console.error('d1 flush:', e.message) }) {
  const queue = []; let tx = null, flushing = null;
  const rec = (sql, params) => (tx ?? queue).push({ sql, params });
  const call = async (path, init) => {
    const r = await fetchImpl(url + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    if (!r.ok) throw new Error(`gateway ${path} → ${r.status}`);
    return r.json();
  };

  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const st = prepare(sql);
    if (!/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)) return st;
    const run = st.run.bind(st);
    st.run = (...params) => { const r = run(...params); rec(sql, params); return r; };
    return st;
  };
  const exec = db.exec.bind(db);
  db.exec = (sql) => {
    exec(sql);
    const s = sql.trim().toUpperCase();
    if (s === 'BEGIN') tx = [];
    else if (s === 'COMMIT') { if (tx) queue.push(...tx); tx = null; }
    else if (s === 'ROLLBACK') tx = null;
  };

  db.d1 = {
    async hydrate() { // D1 → SQLite (เรียกครั้งเดียวตอนเริ่ม ก่อนรับผู้เล่น)
      const dump = await call('/dump');
      exec('PRAGMA foreign_keys = OFF');
      for (const t of TABLES) for (const row of dump[t] ?? []) {
        const cols = Object.keys(row);
        prepare(`INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => row[c]));
      }
      exec('PRAGMA foreign_keys = ON');
      return Object.fromEntries(TABLES.map((t) => [t, (dump[t] ?? []).length]));
    },
    flush() { // ส่งคิวขึ้น D1; ล้มเหลว = คงคิวไว้ลองใหม่ (ลำดับไม่เปลี่ยน)
      flushing ??= (async () => {
        try {
          while (queue.length) {
            const batch = queue.slice(0, 200);
            await call('/batch', { method: 'POST', body: JSON.stringify({ statements: batch }) });
            queue.splice(0, batch.length);
          }
        } catch (e) { onError(e); } finally { flushing = null; }
      })();
      return flushing;
    },
    pending: () => queue.length,
  };
  const timer = setInterval(() => db.d1.flush(), intervalMs); timer.unref?.();
  db.d1.stop = () => clearInterval(timer);
  return db;
}
