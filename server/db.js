import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// shortcut: SQLite ไฟล์ในเครื่อง (Render free ลบดิสก์ทุก restart), ก่อนเปิดจริงสลับเป็น D1 ผ่าน Worker Gateway (GDD §1.1)
export function openDb(path = process.env.DB_PATH ?? 'data/game.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
