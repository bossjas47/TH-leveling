import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// SQLite = แคชทำงานจริง · ข้อมูลถาวรอยู่ที่ Cloudflare D1 เมื่อตั้ง D1_GATEWAY_URL (ดู d1sync.js) — ไม่ตั้ง = หายเมื่อ Render restart
export function openDb(path = process.env.DB_PATH ?? 'data/game.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
