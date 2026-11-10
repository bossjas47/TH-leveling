-- Phase 2: เฉพาะตารางที่ใช้ตอนนี้ (ตารางอื่นใน GDD §13.1 เพิ่มทีละ Phase)
-- users.id = Firebase uid (ไม่เก็บรหัสผ่าน/refresh token — Firebase จัดการ)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  gender TEXT NOT NULL CHECK(gender IN ('male','female')),
  job TEXT NOT NULL CHECK(job IN ('Fighter','Assassin','Mage','Tank','Healer','Miner')),
  hunter_rank TEXT NOT NULL DEFAULT 'E' CHECK(hunter_rank IN ('E','D','C','B','A','S')),
  is_monarch INTEGER NOT NULL DEFAULT 0,
  skin_tone INTEGER NOT NULL,
  hair_style INTEGER NOT NULL,
  hair_color TEXT NOT NULL,
  outfit TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  stat_points INTEGER NOT NULL DEFAULT 0,
  str INTEGER NOT NULL, agi INTEGER NOT NULL, vit INTEGER NOT NULL, int_stat INTEGER NOT NULL, per INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  mp INTEGER NOT NULL,
  fatigue REAL NOT NULL DEFAULT 0,
  fatigue_updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  debt INTEGER NOT NULL DEFAULT 0,
  baht INTEGER NOT NULL DEFAULT 10000,
  free_respawn_count INTEGER NOT NULL DEFAULT 4,
  last_map TEXT NOT NULL DEFAULT 'bkk_lobby',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login INTEGER,
  is_banned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_rank ON users(hunter_rank);

CREATE TABLE IF NOT EXISTS equipment (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weapon_id TEXT, weapon_enhance INTEGER NOT NULL DEFAULT 0,
  armor_id TEXT, armor_enhance INTEGER NOT NULL DEFAULT 0,
  helmet_id TEXT, helmet_enhance INTEGER NOT NULL DEFAULT 0,
  boots_id TEXT, boots_enhance INTEGER NOT NULL DEFAULT 0,
  accessory_id TEXT, accessory_enhance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  enhance INTEGER NOT NULL DEFAULT 0,
  slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 29),
  UNIQUE (user_id, slot_index)
);
