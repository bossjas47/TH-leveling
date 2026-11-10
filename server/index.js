import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { openDb } from './db.js';
import { withD1 } from './d1sync.js';
import { makeVerifier } from './auth.js';
import { makeApi } from './api.js';
import { attachWorld } from './world.js';

// dev server เล็กๆ: เสิร์ฟ client/ ที่ / และ shared/ ที่ /shared/ (ตอนขึ้นจริง client อยู่ Vercel)
const root = join(fileURLToPath(import.meta.url), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const B = JSON.parse(readFileSync(join(root, 'shared', 'balance.json'), 'utf8'));

export function makeServer(api, { verify, B: balance, worldOpts } = {}) {
  const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path.startsWith('/api/') || path === '/health') {
    try { return await api(req, res); } catch (e) { console.error(e); return res.headersSent || res.writeHead(500).end(); }
  }
  const rel = path.startsWith('/shared/') ? path : join('/client', path === '/' ? 'index.html' : path);
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file); // อ่านก่อนแล้วค่อยส่ง header
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
  });
  if (verify) attachWorld(server, { db: api.db, verify, B: balance, ...worldOpts });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { // รันตรงๆ เท่านั้น (ไม่ใช่ตอนถูก import ในเทสต์)
  const port = process.env.PORT ?? 3000;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? 'astra-892a8'; // Firebase project (ค่าสาธารณะ) — เปลี่ยนด้วย env ได้
  const verify = projectId ? makeVerifier(projectId) : async () => { throw new Error('no FIREBASE_PROJECT_ID'); };
  const db = openDb();
  if (process.env.D1_GATEWAY_URL) { // เก็บถาวรลง Cloudflare D1 (ดู db-gateway/ และ README)
    withD1(db, { url: process.env.D1_GATEWAY_URL.replace(/\/$/, ''), token: process.env.D1_GATEWAY_TOKEN ?? '' });
    console.log('D1 โหลดข้อมูล:', await db.d1.hydrate());
    const bye = async () => { await db.d1.flush(); process.exit(0); }; // Render ส่ง SIGTERM ก่อนปิด
    process.on('SIGTERM', bye); process.on('SIGINT', bye);
  } else console.warn('ไม่ได้ตั้ง D1_GATEWAY_URL — ข้อมูลอยู่ในไฟล์ในเครื่องเท่านั้น (หายเมื่อ Render restart)');
  const api = makeApi({ db, verify, B, origin: process.env.ALLOWED_ORIGIN ?? '*' });
  makeServer(api, { verify, B }).listen(port, '0.0.0.0', () => console.log(`http://localhost:${port}`));
}
