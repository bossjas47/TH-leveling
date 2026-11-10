# Game Design Document (GDD) — MASTER
# โครงการ: Thailand Leveling (ไทยแลนด์ เลเวลลิง)

**Version:** 5.1 (Balance & Consistency Fix)
**ฐานจาก:** v5.0 FINAL (`docs/GDD_v5.0.md`)
**Tech Stack:** Render (Singapore) + Cloudflare D1 ผ่าน Worker Gateway + **Firebase Auth** — ดู §1.1
**Level Cap:** 100
**Last Updated:** 2026-11

> **Single Source of Truth:** ตัวเลขเกมทุกตัวอยู่ใน `shared/balance.json`
> ตารางใน GDD นี้สร้าง/ตรวจด้วย `python3 tools/validate_balance.py`
> ถ้าตัวเลขใน GDD กับ `balance.json` ไม่ตรงกัน → **ยึด `balance.json`** แล้วแก้ GDD ตาม

---

## 🆕 Changelog v5.0 → v5.1

| ID | หมวด | สิ่งที่เปลี่ยน | หัวข้อ |
| :-: | :--- | :--- | :-: |
| F1 | 🔴 Tech | D1 เรียกจาก Render ตรงๆ ไม่ได้ → เพิ่ม **Worker DB Gateway**, ล็อก region Singapore, world snapshot ทุก 5 นาที, keep-alive | §1.1, §12, §13 |
| F2 | 🔴 Gate | Gate E/D เป็น **Instanced** และเปิดค้างตลอด (E×2, D×1) — แก้ปัญหามือใหม่ไม่มี Gate เล่น; Gate C+ แยก pool | §8.2 |
| F3 | 🔴 EXP | EXP ของ Gate ทุก rank คำนวณใหม่ให้เข้ากับเส้น EXP (เดิม SSS ให้ EXP มากกว่าทั้งเกม) | §16.4, §19.1 |
| F4 | 🔴 Downed | Revive ย้ายมาเป็นสกิล Healer **Lv.1** + เพิ่ม **พยุง (Assist)** ทุกอาชีพ | §6.1, §17.6 |
| F5 | 🔴 Combat | สูตรเวทใช้สูตรเดียวกับกายภาพ (อาวุธมีผล); Heal เปลี่ยนเป็น % ของ Max HP | §4.2, §17.8 |
| F6 | 🟠 ตัวเลข | ตัวอย่าง Mage ใช้ INT 313 (เป็นไปไม่ได้) → คำนวณใหม่ด้วย Reference Build | §21.5–21.6 |
| F7 | 🟠 ตัวเลข | Stat Bonus ของ Dagger/Staff ในตัวอย่าง Fighter ผิด → แก้ | §21.5 |
| F8 | 🟠 EXP | ตาราง EXP สะสมไม่ตรงสูตร → สร้างใหม่จากสคริปต์ | §16.3 |
| F9 | 🟠 EXP | เส้น EXP กระโดด 6.4× ที่ Lv.30 → เปลี่ยนเป็นสูตรเดียวต่อเนื่อง `100 × L^2.2` | §16.2 |
| F10 | 🟠 Gate | "ทุกเลเวลเข้าได้ทุก Gate" ขัดกับ S+/SS/SSS → เปลี่ยนเป็น **Lv. แนะนำ** ทั้งหมด | §8.1, §19.1 |
| F11 | 🟠 Combat | เพิ่มระบบเกราะ (DEF/HP), สูตร DEF แบบ K, PvP damage ×0.4 | §4.2, §21.10 |
| F12 | 🟠 Monster | เพิ่มตารางสเตตัสมอนสเตอร์ปกติ/Elite/Boss ทุก rank | §18.0 |
| F13 | 🟠 Rank | ใส่เกณฑ์ตัวเลขสอบเลื่อนแรงค์ + ตัวคูณตามอาชีพ | §5 |
| F14 | 🟠 เศรษฐกิจ | ค่ารักษาคิดตาม Hunter Rank (E 2,000 → S 3,000,000) | §6.2 |
| F15 | 🟠 ตัวเลข | ล็อก Fatigue, ช่องกระเป๋า, เพดานตีบวก +10, HP regen, attack speed, move speed, dodge | §4 |
| F16 | 🟠 Downed | Downed เกิดเมื่อ **โดนดาเมจถึงตาย** (ไม่ใช่ HP < 7%) | §6.1 |
| F17 | 🟡 Schema | ลบ `usernames`, ลบ `users.guild_id`, hash refresh token, เพิ่มตารางที่ขาด | §13.1 |
| F18 | 🟡 Docs | Proficiency labels ครบทุกค่า, เลขหัวข้อไม่ชน, ชื่อคอลัมน์ถูก | §21 |
| F19 | 🟡 Auth | เปลี่ยนจาก Custom JWT เป็น **Firebase Auth** (ฟรี) — ตัด `refresh_tokens`, bcrypt, endpoint register/login/refresh | §1.1, §13.1, §13.2 |
| F20 | 🟡 Tank | Starter เปลี่ยนเป็น **กระบองไม้ (Mace E)** — โล่ (off-hand) ยังไม่มีใน MVP | §3.2 |
| F21 | 🟡 Party | เพิ่มกฎแบ่ง EXP ใน party และโทษเลเวลห่าง | §16.6 |
| F22 | 🟡 Rank band | ช่วงเลเวลของแต่ละ rank ใหม่: E 1–10, D 10–20, C 20–35, B 35–50, A 50–70, S 70+ | ทั้งเอกสาร |

---

## 📑 สารบัญ

**PART I — CORE GAME**
1. Project Overview (+ §1.1 Tech Stack Decision)
2. Core Gameplay Loop
3. Character Creation
4. Attributes & Vitals
5. Rank Assessment
6. Death, Hospital & Downed (+ §6.4 PvP Weapon Drop)
7. Economy & Jobs

**PART II — GATE SYSTEM**
8. Gate System (+ Guild Monopoly)
9. Bangkok Map & HUD

**PART III — TECHNICAL**
10. Client Rendering Optimization
11. Server-Side Anti-Cheat
12. Anti-Lag Guardrails
13. Database (D1) & Network Protocol
14. Development Milestones

**PART IV — SYSTEMS**
15. Chat System
16. EXP Curve
17. Class Skill Database (Tier 1)
18. Gate Encounter Design (+ §18.0 Monster Stats)
19. Endgame Content
20. Runestone Tier 2 (Placeholder)

**PART V — WEAPONS & EQUIPMENT**
21. Universal Weapon System (+ §21.9 ดาบ, §21.10 เกราะ)

**PART VI — APPENDIX**
- ตัวเลขสำคัญที่ Lock แล้ว
- ประเด็นเปิด (รอ Playtest)

---

> **ค่าที่ได้จากการลองเล่นจริง (Phase 3):** ก๊อปลิน aggro **3 tiles** (เดิม 5 ทำให้ Lv.1 ถูกรุม 3 ตัวตายใน 5 วิ) · Lv.1 สู้ทีละตัวเสียเลือด ~150/260 ต่อตัว (4 ตัวขึ้นเลเวล) — ตัวเลขใน `balance.json` (`combat.*`) รอปรับหลัง playtest

# PART I — CORE GAME

---

## 1. ข้อมูลภาพรวมโครงการ (Project Overview)

* **ชื่อโครงการ:** Thailand Leveling
* **แนวเกม (Genre):** 2.5D Isometric Web MMORPG
* **ธีม:** แฟนตาซีร่วมสมัยในกรุงเทพฯ มีประตูมิติ (Gate) ปรากฏกลางเมือง ผู้เล่นเป็น "ฮันเตอร์" ที่ปลุกพลัง
* **แพลตฟอร์ม:** Web Browser (Mobile Landscape 100%)
* **สกุลเงิน:** **บาท (THB)**
* **งบประมาณ:** 0 บาท (Free-tier Tech Stack)

### 1.1 Tech Stack Decision (v5.1)

| ส่วน | เลือกใช้ | หมายเหตุ |
| :--- | :--- | :--- |
| **Frontend** | Vercel (HTML5 Canvas 2.5D, Web Audio 8-bit) | CDN ฟรี |
| **Game Server** | Render.com **region Singapore** (Node.js + Express + Socket.io) | ใกล้ไทย ~30–50 ms; free 750 ชม./เดือน พอสำหรับ 1 service 24/7 |
| **Database** | Cloudflare D1 (SQLite) **location hint: APAC** | 5M reads/day, 100K writes/day, 5 GB |
| **DB Gateway** | Cloudflare Worker เล็กๆ 1 ตัว (D1 binding) | Render ส่ง query เป็น batch ผ่าน HTTPS + shared secret; free 100K req/วัน |
| **Auth** | **Firebase Auth** (อีเมล+รหัสผ่าน, Spark plan ฟรี) — client login ด้วย Firebase SDK, server ตรวจ ID token (RS256, JWKS ของ Google) แล้วใช้ `uid` เป็น `users.id` | ไม่ต้องเก็บรหัสผ่าน/refresh token เอง |
| **Dev Env** | GitHub Codespaces + Claude Code | |

**เหตุผล / ข้อจำกัดที่ต้องรู้:**
1. D1 ใช้ผ่าน binding ได้เฉพาะใน Cloudflare Worker → Render ต้องคุยผ่าน **Worker Gateway** (เร็วกว่าและไม่ติด rate limit ของ Cloudflare REST API)
2. Render free จะ **หลับเมื่อไม่มี traffic ~15 นาที** และอาจ restart ได้ทุกเมื่อ →
   * ตั้ง external ping (เช่น UptimeRobot ทุก 5 นาที) ที่ `/health`
   * **World Snapshot** (Gate, Auction ที่ค้าง, Boss loot pending) ลง D1 ทุก 5 นาที และตอน `SIGTERM` → โหลดคืนตอนบูต
   * Floor items / chat history หายได้เมื่อ restart (ยอมรับได้)
3. โค้ดฝั่ง server ต้องแยก **`WorldStore` / `DbClient` interface** เพื่อย้ายไป Cloudflare Durable Objects ได้ภายหลัง

**ทางเลือก B (อนาคต): Cloudflare ทั้งหมด (Workers + Durable Objects + D1)**
* ไม่ช้ากว่า — latency ใกล้เคียงหรือดีกว่า
* แต่ free plan ของ Durable Objects จำกัด **13,000 GB-s/วัน** — DO 128 MB ที่ตื่นตลอด 24 ชม. ใช้ ~10,800 GB-s/วัน และ game loop (AI มอน) ทำให้ DO hibernate ไม่ได้ → ได้ประมาณ **1 room ที่รันตลอด** เท่านั้น และ request 100K/วัน (WebSocket message นับรวม)
* เหมาะเมื่อพร้อมจ่าย Workers Paid ($5/เดือน) → ใช้ "World DO" ตัวเดียวรันทุกแผนที่

---

## 2. แกนลูปการเล่นหลัก (Core Gameplay Loop)

```text
[สร้างตัวละครใหม่ / ปลุกพลังฮันเตอร์]
               │
               ▼
[เกิดที่ bkk_lobby]
               │
               ├─► ตรวจวัดแรงค์ที่สมาคม (E → S)
               ├─► ตีบวก / ซื้อน้ำยา / ฝากของ
               ├─► วินมอเตอร์ไซค์ (Fast Travel)
               ├─► บอร์ดจ้างวาน Miner
               │
               ▼
[Gate]
   ├─ Gate E/D: เปิดค้างตลอด, Instanced ต่อ party (ฟาร์มได้เสมอ)
   └─ Gate C+: สุ่มเกิด, กิลด์ประมูลสิทธิ์, Shared world
               │
               ├─► เข้า Gate (PvP: E ปิด, D+ เปิด)
               │     ├─ สายต่อสู้: ลุยมอน / บอส
               │     └─ สาย Miner: ขุดแร่มานา
               │
               ▼
[โดนดาเมจถึงตาย]
   ├── Downed 45 วิ → Healer Revive / เพื่อนพยุง
   └── หมดเวลา → โรงพยาบาล (ค่ารักษาตาม Rank, 4 ครั้งแรกฟรี)
        │
        ▼
[จบ Gate]
   ├── Clear: รางวัล + EXP, กิลด์รับภาษี
   └── หมดเวลา (C+ / หรือ E-D ที่ไม่มีใคร clear): Dungeon Break (reward ×2)
```

---

## 3. ระบบสร้างตัวละคร (Character Creation System)

### 3.1 ขั้นตอน

1. **ตั้งชื่อ:** 3–12 ตัวอักษร → INSERT `users` (UNIQUE `username` COLLATE NOCASE = atomic)
2. **รูปลักษณ์:** เพศ × โทนผิว × ทรงผม (4×5 สี) × ชุด (3 แบบ)
3. **เลือกอาชีพ (6):** แสดง stat + starter weapon
4. **Awakening Cutscene:** บัตร Rank E → บันทึก D1 → เข้า bkk_lobby

### 3.2 ค่าสเตตัสเริ่มต้น (รวม 50 แต้ม)

HP/MP คำนวณจากสูตร §4.2 ที่ Lv.1 (ไม่มีเกราะ)

| อาชีพ | STR | AGI | VIT | INT | PER | HP | MP | Starter Weapon | Prof |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :-: |
| **Fighter** | 14 | 9 | 12 | 6 | 9 | 260 | 90 | ดาบเหล็กสั้นสนิม (Shortsword E) | 1.0 |
| **Assassin** | 9 | 15 | 8 | 6 | 12 | 180 | 90 | มีดสั้นพกพา (Dagger E) | 1.0 |
| **Mage** | 6 | 8 | 8 | 16 | 12 | 180 | 240 | คทาไม้ฝึกหัด (Staff E) | 1.0 |
| **Tank** | 11 | 7 | 16 | 7 | 9 | 340 | 105 | **กระบองไม้ (Mace E)** 🆕 | 1.0 |
| **Healer** | 6 | 8 | 11 | 14 | 11 | 240 | 210 | หนังสือสวดมนต์ (Tome E) | 1.0 |
| **Miner** | 12 | 8 | 14 | 6 | 10 | 300 | 90 | อีเตอร์เก่า (Pickaxe E) | 1.0 |

*(Monarch of Shadow — GM only)*
*(โล่ / off-hand → Phase 5+)*

---

## 4. ระบบตัวละคร สเตตัส และทรัพยากร

### 4.1 สเตตัสหลัก

| Stat | ผล |
| :--- | :--- |
| **STR** | ATK กายภาพ (อาวุธ STR) + Max Weight |
| **AGI** | ATK (Dagger) + ความเร็วเดิน + ความเร็วตี + หลบหลีก |
| **VIT** | Max HP + HP regen + ลด Fatigue |
| **INT** | Max MP + ATK (Staff/Tome) + ความแรง Heal |
| **PER** | Crit rate + vision + โอกาสแร่หายาก |

### 4.2 สูตรคำนวณหลัก

$$\text{Max HP} = (\text{VIT} + \text{Level}) \times 20 + \text{armor\_hp}$$
$$\text{Max MP} = \text{INT} \times 15$$
$$\text{Max Weight} = 50 + (\text{STR} \times 5)\text{ กก.}$$
$$\text{Effective ATK} = \text{weapon\_atk} \times \text{prof} \times (1 + N \times 0.05)$$
$$\text{Stat Bonus} = \text{scaling\_stat} \times 0.5 \times \text{prof}$$
$$\text{Basic Damage} = \text{Effective ATK} + \text{Stat Bonus}$$
$$\text{Skill Damage} = \text{Basic Damage} \times \text{skill\_mult} \quad \text{(ทุกอาชีพ รวม Mage — F5)}$$
$$\text{Crit Rate} = \min(50\%,\ \text{PER} \times 0.5\% + \text{weapon\_crit} + N \times 0.5\%)$$
$$\text{Crit Damage} = \text{Damage} \times 1.5$$
$$\text{Damage Taken} = \text{Incoming} \times \frac{K}{K + \text{DEF}},\quad K = 100 + \text{attacker\_level} \times 20$$
$$\text{PvP Damage} = \text{Damage} \times 0.4$$

> **K-based DEF (F11):** เดิม `100/(100+DEF)` ทำให้ DEF ระดับ S (1,200) กันดาเมจ ~92% → ใหม่ K โตตามเลเวลผู้โจมตี DEF ตาม rank กันได้ ~5–40%
> **Proficiency (prof):** ดู §21.2 · **N** = ระดับตีบวก

**สเตตัสรอง (F15):**

| ค่า | สูตร |
| :--- | :--- |
| Move Speed | 4.0 tiles/วิ × min(1.5, 1 + AGI/400) |
| Attack Interval | 1.0 วิ ÷ ((1 + AGI/500) × (1 + weapon_attack_speed)) |
| Dodge | min(30%, AGI × 0.2%) |
| HP Regen | นอกการต่อสู้ (ไม่โดนตี 10 วิ): 1% Max HP ทุก 3 วิ × (1 + VIT/200) · ในการต่อสู้: 0 |

### 4.3 ทรัพยากร

* **HP:** โดนดาเมจถึงตาย → Downed (§6.1) → Hospital
* **MP:** **ฟื้นจากโพชั่นเท่านั้น** (ดู ประเด็นเปิด P1)
* **Fatigue (0–100%) (F15):**

| การกระทำ | Fatigue ที่เพิ่ม |
| :--- | :-: |
| ตีปกติ | +0.1% |
| ใช้สกิล | +0.5% |
| กลิ้งหลบ | +0.5% |
| ขุด 1 ครั้ง | +0.2% |

  * ค่าที่เพิ่ม × `100 / (100 + VIT)`
  * **≥ 90%** = Exhausted (ใช้สกิลไม่ได้)
  * ฟื้น: นิ่ง (ไม่ทำอะไร 5 วิ) −1%/3 วิ, นั่ง −1%/วิ, น้ำเปล่า −15%, ยาชูกำลัง −40–80%, นั่งวิน −10%
  * เป้าหมาย: สู้ต่อเนื่อง ~5 นาที → ต้องพัก/นั่ง ~1.5 นาที
  * **Lazy Evaluation:** คำนวณจาก Δt ตอนมี action ไม่ต้อง tick

### 4.4 Stat Points

* **+3 แต้ม/เลเวล** → Lv.100 ได้รวม **297 แต้ม**
* ไม่จำกัดเพดาน stat
* ไม่มี Respec ใน MVP
* **Reference Build (ใช้คำนวณ balance):** ทุกเลเวล main stat +2, VIT +1

### 4.5 MP Potion Tiers

| ระดับ | ฟื้น MP | ราคา | Lv. |
| :--- | :-: | :-: | :-: |
| น้ำมนต์เล็ก | 50 | 500 | 1+ |
| น้ำมนต์กลาง | 150 | 2,000 | 10+ |
| น้ำมนต์ใหญ่ | 400 | 8,000 | 25+ |
| น้ำมนต์เทพ | 1,000 | 30,000 | 40+ |
| น้ำมนต์มหาเทพ | 2,000 | 80,000 | 55+ |
| น้ำมนต์อมตะ | 4,000 | 200,000 | 70+ |
| น้ำมนต์วาระสุดท้าย | 8,000 | 500,000 | 85+ |

> Cooldown: **8 วินาที** (ใช้ร่วมกัน)

### 4.6 กระเป๋า (F15)

* **กระเป๋า 30 ช่อง** + จำกัดน้ำหนักตาม Max Weight (inventory เดียวทั้งเกม)
* **คลัง (storage_box) 100 ช่อง** ที่ตลาดฝั่งตะวันออก

---

## 5. ระบบการประเมินแรงค์ (Rank Assessment)

การเลื่อนระดับแรงค์ (E → D → C → B → A → S) ที่สมาคมฮันเตอร์:

1. **เลเวลขั้นต่ำ** ต้องถึง
2. **Dummy Burst Test (Isolated):**
   * `socket.join("dummy_" + socket.id)`
   * นับถอยหลัง → ระดมโจมตี **5 วินาที** (Dummy DEF = 0, crit นับ)
   * Total Burst Damage ≥ เกณฑ์ × ตัวคูณอาชีพ → ได้ตราแรงค์ใหม่
3. **ไม่มี PvP** → ไม่มี weapon drop
4. สอบตก → สอบใหม่ได้ทันที (ฟรี)

**เกณฑ์ (F13):**

| เลื่อนเป็น | Lv. ขั้นต่ำ | Burst 5 วิ (ฐาน) | ปลดล็อก |
| :-: | :-: | :-: | :--- |
| **D** | 10 | 180 | ตีบวก |
| **C** | 20 | 400 | — |
| **B** | 35 | 900 | ตั้งกิลด์ |
| **A** | 50 | 2,000 | — |
| **S** | 70 | 6,000 | — |

**ตัวคูณตามอาชีพ:** Fighter / Assassin / Mage ×1.0 · Miner ×0.85 · Tank ×0.7 · Healer ×0.33

> เกณฑ์ตั้งจาก Reference Build Fighter ถืออาวุธ rank ก่อนหน้า (+5~+7) ตี 5 ครั้ง + สกิล 2 ครั้ง — ตรวจด้วย `validate_balance.py` (playtest)

---

## 6. กฎการเสียชีวิต ระบบโรงพยาบาล และ Downed

### 6.1 Downed State (F4, F16)

* **เกิดเมื่อ:** โดนดาเมจที่ทำให้ HP ≤ 0
* ทรุดลง เคลื่อนที่ช้าเหลือ 15% ใช้สกิล/ไอเทมไม่ได้
* **ตัวจับเวลา 45 วิ** (แถบนับถอยหลังแทนแถบ HP)
* **PvP Immunity** และ **มอนสเตอร์เลิก aggro** ระหว่าง Downed
* ปุ่ม **"ยอมแพ้"** → ตายทันทีไปโรงพยาบาล
* **การกู้:**

| วิธี | ใคร | เงื่อนไข | HP หลังฟื้น |
| :--- | :--- | :--- | :-: |
| **Revive** (สกิล) | Healer **Lv.1+** | ระยะ 2 tiles, cast 1.5 วิ | 30% |
| **พยุง (Assist)** 🆕 | สมาชิก party/guild ทุกอาชีพ | ยืนติดกัน (1.5 tiles) กดค้าง 10 วิ, โดนตี = ยกเลิก | 10% |

* ถ้าถูกกู้แล้ว **โดนดาเมจถึงตายอีกภายใน 120 วิ → ตายทันที** (ไม่เข้า Downed ซ้ำ)
* หมดเวลา = ตาย → โรงพยาบาล

### 6.2 โรงพยาบาล (F14)

* **4 ครั้งแรกฟรี** (ตลอดอายุตัวละคร)
* หลังจากนั้น ค่ารักษาตาม **Hunter Rank**:

| Rank | ค่ารักษา |
| :-: | :-: |
| E | 2,000 |
| D | 10,000 |
| C | 100,000 |
| B | 500,000 |
| A | 1,000,000 |
| S | 3,000,000 |

* ถ้าเงินไม่พอ → ติดลบ + สถานะ "ลูกหนี้"
  * ความเร็ว −15%
  * รายได้ถูกหัก 50% ชำระหนี้จนหมด

### 6.3 กฎของตก

* ตาย PvE: ของ/เงินไม่หาย
* ตาย PvP: อาวุธในมือหล่น (ดู §6.4)
* **Floor Item Cap:** 60 ชิ้น/แผนที่ (FIFO)
* เงินตกในจุดเดียวกันยุบรวมเป็นถุงเดียว

---

## 6.4 ระบบอาวุธหล่นจาก PvP (PvP Weapon Drop)

### 6.4.1 เงื่อนไขการหล่น

ต้องครบทุกข้อ:
1. ตาย (Downed หมดเวลา หรือกดยอมแพ้) จากดาเมจผู้เล่นคนอื่น
2. Last Hit (ก่อน Downed) = player
3. ไม่อยู่ใน Safe Zone
4. Gate PvP เปิด (Rank D+)
5. มีอาวุธสวมอยู่

### 6.4.2 สิ่งที่หล่น

| รายการ | ค่า |
| :--- | :--- |
| ไอเทม | เฉพาะอาวุธในมือ |
| Enhancement | คงเดิม 100% |
| ไอเทมในกระเป๋า | ❌ |
| เงิน | ❌ |

### 6.4.3 ตำแหน่งหล่น

พิกัดตาย ±1 tile (scatter 8 ทิศ)

### 6.4.4 Priority Window

```
[T=0s]   🔒 Killer Priority (ขอบแดง)
[T=15s]  🔓 Free-for-All (ขอบทอง)
[T=15m]  🗑️ Despawn
```

### 6.4.5 สิทธิ์การเก็บ

| ความสัมพันธ์ | Priority (0–15s) | FFA (15s–15m) |
| :--- | :-: | :-: |
| Killer / Party / Guild | ✅ | ✅ |
| เหยื่อ / Party / Guild | ❌ | ✅ |
| คนอื่น | ❌ | ✅ |

### 6.4.6 ข้อจำกัด

* ระยะ 1.5 tiles
* มีช่องกระเป๋าว่าง ≥ 1 (จาก 30 ช่อง)
* น้ำหนักไม่เกิน Max Weight
* **Priority ข้าม Gate ได้** (ผูก killerId ไม่ผูก map)

### 6.4.7 Anti-Exploit

* Win trading: kill คู่เดิมซ้ำ > 3/ชม. → flag GM (ตาราง `pvp_kills`)
* Suicide: killerId = self → ไม่หล่น
* DoT: killerId = player → หล่น ✓

### 6.4.8 Party Protection

Party เดียวกัน / Guild เดียวกัน = โจมตีกันไม่ได้

---

## 7. ระบบเศรษฐกิจ การตีบวก และการสนับสนุนอาชีพ

### 7.1 ระบบตีบวก (Mana Enhancement)

* เฉพาะ **Rank D ขึ้นไป**
* **แร่เกรดตรงกับอุปกรณ์**
* **อัตราสำเร็จ 100%**
* **เพดาน +10** (MVP) (F15)
* จำนวนแร่ต่อขั้น:

| ขั้น | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| แร่ | 1 | 2 | 4 | 8 | 16 | 48 | 144 | 432 | 1,296 | 3,888 |

**Enhancement Bonus:** ATK ×(1 + N×0.05), Crit +N×0.5%

| ระดับ | ATK Mult | Crit Bonus |
| :-: | :-: | :-: |
| +0 | ×1.00 | +0% |
| +1 | ×1.05 | +0.5% |
| +2 | ×1.10 | +1.0% |
| +3 | ×1.15 | +1.5% |
| +4 | ×1.20 | +2.0% |
| +5 | ×1.25 | +2.5% |
| +6 | ×1.30 | +3.0% |
| +7 | ×1.35 | +3.5% |
| +8 | ×1.40 | +4.0% |
| +9 | ×1.45 | +4.5% |
| +10 | ×1.50 | +5.0% |

> ดู ประเด็นเปิด P2 (ต้นทุน +6 ขึ้นไป)

### 7.2 วินมอเตอร์ไซค์ (Fast Travel)

* **50–1,000 บาท** ตามระยะ
* ลด Fatigue 10%
* Cooldown 30 วิ กันสแปม

### 7.3 บอร์ดจ้างวาน Miner

* Escrow + 5% ภาษีกิลด์
* **Safe Passage:** 🛡️ PvP immunity, −100% PvP damage
  * ถ้าโจมตีก่อน → หายทันที
* สัญญาไม่ทำ = ไม่ได้เงิน + เสียชื่อเสียง

### 7.4 ฉายาและออร่า

* 1 ฉายาใต้ชื่อ
* Server ส่งรหัส → Client render เอง

---

# PART II — GATE SYSTEM

---

## 8. ระบบ Gate (Gate System)

### 8.1 ตาราง Gate

| Rank | ขนาด | มูลค่า | Party | PvP | เข้าถึง | Timer | หลัง 22:00 | **Lv. แนะนำ** |
| :---: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **E** | 42×42 | 25K–50K | 1–4 | ❌ | เปิด (Instanced) | 2 ชม. | 3 ชม. | 1–10 |
| **D** | 48×48 | 75K–130K | 2–6 | ✅ | เปิด (Instanced) | 4 ชม. | 6 ชม. | 10–20 |
| **C** | 54×54 | 2.5M–7.8M | 4–10 | ✅ | Auction | 8 ชม. | 12 ชม. | 20–35 |
| **B** | 60×60 | 13M–39M | 8–20 | ✅ | Auction | 12 ชม. | 18 ชม. | 35–50 |
| **A** | 66×66 | 130M–520M | 15–20 | ✅ | Auction | 18 ชม. | 27 ชม. | 50–70 |
| **S** | 72×72+ | 3–8 พันล้าน | 20 | ✅ | Invite | 24 ชม. | 36 ชม. | 70+ |

> **ไม่มี level requirement ทุก Gate** — มีแค่ "Lv. แนะนำ" (F10)

### 8.2 กฎการเกิด Gate (F2)

Gate แบ่งเป็น 2 pool:

**Low Pool — Gate E / D (Instanced)**
* เปิดค้างไว้ใน lobby ตลอด: **Gate E × 2, Gate D × 1**
* แต่ละ party ที่เข้า ได้ **instance ของตัวเอง** (มอน/แร่/บอสแยก) → หลาย party เล่นพร้อมกันได้
* รับรางวัล clear ได้ **1 ครั้ง/Gate/คน** (กันวนฟาร์ม clear ซ้ำ) — มอน/แร่ได้ตามปกติ
* หมดเวลา → Gate หาย → เกิดใหม่หลัง 5 นาที
* ถ้าหมดเวลาแล้ว **ไม่มี party ไหน clear ได้เลย** → Dungeon Break

**High Pool — Gate C / B / A / S (Shared world)**
* Spawn: ทุก **2 ชม.**
* Max Concurrent: **3**
* **Cooldown หลัง Clear: 30 นาที** (ต่อ slot)
* อัตรา: **C 50%, B 30%, A 15%, S 5%**
* Gate S เกิดได้สูงสุด **1 ครั้ง / 24 ชม.** (ถ้าสุ่มได้ S ระหว่าง cooldown → เปลี่ยนเป็น A)
* Clear → Gate ปิดถาวร · หมดเวลา → Dungeon Break

**Night Boost:** Gate ที่ spawn หลัง 22:00 ICT → timer ×1.5

### 8.3 การเข้าถึง Gate

| Rank | เงื่อนไข |
| :---: | :--- |
| **E–D** | ใครก็เข้าได้ (instance ต่อ party) |
| **C–A** | Auction (ถ้ามี bid) |
| **S** | Invitation from server (20 คน: เลือกจาก Hunter Rank S/A ที่ online, ให้สิทธิ์กิลด์ที่มี treasury สูงสุดก่อน) |

### 8.4 Gate Auction & No-Bid

- Gate C+ เปิด Auction **5 นาที**
- Bid เก็บใน RAM → บันทึก D1 ตอนจบ (+ อยู่ใน World Snapshot)
- ราคาเริ่มต้น = 10% ของมูลค่า Gate
- **ถ้าไม่มีคน bid** → **"Public Gate"**
  * ใครก็เข้าได้
  * Drop ปกติ
  * ไม่มีภาษีกิลด์
  * PvP ยังเปิด

### 8.5 Guild Monopoly & Auction

- **ก่อตั้ง:** Rank B+ + **50,000,000 บาท** (สมาชิกสูงสุด 20)
- **Treasury ใช้สำหรับ:** ประมูล Gate เท่านั้น (MVP)
- **Friendly Fire:** กิลด์เดียวกันโจมตีไม่ได้
- **ภาษี:** 5% ของ loot เข้า treasury

### 8.6 Contract Miner

- กิลด์โพสต์จ้าง (สูงสุด 2 ชม.)
- Safe Passage: PvP immunity
- Escrow + ภาษี 5%

### 8.7 Gate Timer & Failure

- Timer นับตั้งแต่ spawn
- **หมดเวลา:**
  - **Dungeon Break** → มอนบุก bkk_lobby (เงื่อนไขตาม pool §8.2)
  - ผู้เล่นใน Gate ถูกวาร์ปออก
- **Clear สำเร็จ (High Pool):**
  - Gate ปิดถาวร
  - ภาษี 5% เข้า guild treasury
  - Spawn slot ใหม่หลัง 30 นาที

### 8.8 Completion Bonus

**5% ของ loot ที่ดรอปจริง** แจกเป็น baht ให้ทุกคนใน party เท่ากัน

- ตัวอย่าง: Gate C drop 5M → Bonus 250K ÷ 10 = 25K/คน

### 8.9 Death & Re-entry

- ตาย → respawn โรงพยาบาล
- **กลับเข้า Gate ได้ทันที** (ไม่มี CD) — Gate E/D กลับเข้า instance เดิมของ party
- ไม่จำกัดจำนวนครั้ง

### 8.10 Killer Priority ข้าม Gate

ผูกที่ `(killerId, floorItemId)` → ออก/กลับเข้าได้ภายใน 15 วิ

---

## 9. แผนที่เมืองกรุงเทพฯ และ HUD

### 9.1 ผังเมือง

| ทิศ | สถานที่ |
| :--- | :--- |
| **เหนือ** | สมาคมฮันเตอร์ (Dummy Test, ตีบวก) |
| **ตะวันตก** | โรงพยาบาล |
| **ตะวันออก** | ตลาด, คลัง, บอร์ดจ้าง |
| **ใต้** | วินมอเตอร์ไซค์ |
| **กลาง** | ลานวงเวียนใหญ่ (spawn, Gate E×2 + D×1 ถาวร, slot Gate C+) |

**ขนาดแผนที่:**

| แผนที่ | Tiles |
| :--- | :-: |
| bkk_lobby | 24×24 |
| Gate E–S | 42×42 → 72×72+ |

### 9.2 กราฟิก 3D กล้องบุคคลที่สาม (เปลี่ยนจาก Isometric 2.5D — v5.1.1)

* **Three.js** วาดโลก 3D: พื้น/ถนน/ลานจากภาพ top-down ที่วาดด้วยโค้ด, ตึกจากโมเดล GLB (Kenney City Kit, CC0) แบบ instanced, ต้นสน instanced, แสง Hemisphere + Directional (เงานุ่ม ตามผู้เล่น) + แสงขอบ, หมอก
* **ผู้เล่น:** โมเดลมีโครงกระดูก KayKit Adventurers (CC0) 1 แบบต่ออาชีพ — Fighter=Barbarian, Tank=Knight, Mage=Mage, Assassin=Rogue_Hooded, Healer=Ranger, Miner=Rogue — ถืออาวุธตามอาชีพ, ท่ายืน/วิ่ง/ล้ม จากชุดท่าของ KayKit, ท่าฟันซ้อนบนกระดูกแขนเอง (ชุดฟรีไม่มีท่าโจมตี) · ตัวเลือกผม/ผิว/ชุดตอนสร้างตัวละครถูกตัด (ไม่มีผลกับโมเดลที่ใช้)
* **มอน/แร่/ประตู** สร้างจากทรงพื้นฐานของ Three.js (ก๊อปลิน, บอส, คริสตัล, หุ่นสอบ, วงประตู) — ชุด KayKit ไม่มีก๊อปลิน
* **ธรรมชาติ:** Kenney Nature Kit — ป่าขอบเกาะ/ต้นไม้และหินใน Gate (ช่องทึบ) + ของตกแต่ง (หญ้า ดอกไม้ เห็ด พุ่ม หิน) ไม่มีผลต่อการชน ปิดได้เมื่อเครื่องช้า
* **กล้องไม่ทะลุตึก/ต้นไม้:** เดินเส้นตรงจากผู้เล่นไปกล้องบนกริดชน ชนช่องทึบแล้วหดเข้า (ต่ำสุด 0.55) แล้วค่อยๆ ถอยกลับ
* **คุณภาพอัตโนมัติ:** FPS < 26 ต่อเนื่อง 3 วิ → ลดระดับ (เงา+ของตกแต่ง → เงา → พิกเซลเรโชต่ำสุด); บังคับด้วย `?q=2|1|0`
* **กล้อง:** ตามหลังผู้เล่น (ระยะ 2.4–11, เงย 10°–72°) หมุนด้วยการลากครึ่งขวา/ลูกศร/เมาส์ขวา; joystick เดินตามทิศกล้อง
* **ตรรกะเกมยังเป็นกริด 2D (x, y)** บน server เหมือนเดิม (ชน/เดิน/ต่อสู้) — 3D เป็นเรื่องการแสดงผลเท่านั้น; server ส่งทิศหันหน้า (`face`) ให้ client หมุนตัว
* **งบประสิทธิภาพ (วัดจำนวน ยังไม่ได้วัด FPS บนมือถือจริง):** ลาน ≈ 90 draw call / 300K สามเหลี่ยม, Gate ≈ 180–200 draw call / 230–240K สามเหลี่ยม; เงา 1024 px บนจอสัมผัส, pixel ratio ≤ 1.5
* ตัด: sprite 8 ทิศ, tile 64×32, offscreen canvas pre-render (§10 ข้อ 1–3 ใช้ไม่ได้แล้ว)

### 9.3 HUD (Mobile Landscape)

```text
+-----------------------------------------------------------------------+
| [Lv. HP/MP/Fatigue]                       [Guild/Rank]   [Mini-map]   |
|                                                                       |
| [Zone Banner / Chat Overlay]                                          |
|                                                                       |
|                                      (Popup Modals: Half Right)       |
|                                                +--------------------+ |
|                                                | [Bag]              | |
|     (Dynamic Joystick)                         | [Stats / Equip]    | |
|         [ O ]                                  +--------------------+ |
|                                                    [Skill 1] [Skill 2]|
|                                             [Potion]   [ ATTACK ]     |
|                                                        [Skill 3]      |
+-----------------------------------------------------------------------+
```

Downed: แถบ HP เปลี่ยนเป็นตัวนับ 45 วิ + ปุ่ม "ยอมแพ้" · เพื่อนเห็นปุ่ม "พยุง" เมื่อเข้าใกล้

---

# PART III — TECHNICAL

---

## 10. Client Rendering Optimization

1. **Sprite Sheet / Texture Atlas**
2. **Offscreen Canvas Pre-rendering** (ประหยัด ~70%)
3. **ขนาด Assets:** tile ≤ 64×32, ตัวละคร ≤ 64×64
4. **Vercel CDN**
5. **Tile Culling** (±2 tiles นอกจอ)

---

## 11. Server-Side Anti-Cheat

1. **Speed Hack:** $(\Delta x)^2 + (\Delta y)^2 \le (\text{MaxSpeed} \times \Delta t \times 1.1)^2$ (เผื่อ 10% สำหรับ jitter)
   * Whitelist: taxi, respawn, gate enter/exit, Teleport/Charge/Shadow Step
2. **Attack CD:** `lastAttackTime` เทียบกับ Attack Interval (§4.2)
3. **Action Distance:** ≤ 2.5 tiles
4. **Skill Validation:**
   * Shadow Step (3), Teleport (5), Charge (4) → distance + LoS
   * Burrow / Revive / Assist → flag + distance
   * Taunt → server aggro เท่านั้น
5. **Client → `{ skillId, targetId }`** เท่านั้น — server คำนวณดาเมจเองทั้งหมด
6. **Silent GM:** token hash ใน env, log ทุกครั้ง (`gm_logs`)
7. **Rate Limit:** 20 msg/วิ/ผู้เล่น

---

## 12. Anti-Lag Guardrails v3.1

1. **Socket.io Rooms** แยกตามแผนที่ / instance
2. **Dungeon Break Cap:** 20 ตัว
3. **Floor Item Cap:** 60/แผนที่
4. **Lazy Fatigue:** Δt-based
5. **In-Memory Buffer:** ขุด/ประมูล ใน RAM → D1 ตอนสรุป
   * Save cadence: login, levelup, rankup, disconnect, ทุก 5 นาที
   * **Target:** < 30 writes/ชม./ผู้เล่น (ส่งเป็น batch ผ่าน Worker Gateway)
6. **Server Tick 20 Hz**, broadcast state **10 Hz** + client Lerp
7. **Client Input:** ส่งเฉพาะเมื่อทิศ joystick เปลี่ยน, ไม่เกิน 10 Hz
8. **Shadow Minions:** tethered + client render
9. **World Snapshot:** ทุก 5 นาที + ตอน SIGTERM (§1.1) 🆕

---

## 13. Database (D1) & Network Protocol

### 13.1 D1 SQL Schema (F17)

การเปลี่ยนแปลงจาก v5.0:
* ลบ `usernames` (ซ้ำกับ `users.username UNIQUE`)
* ลบ `email`, `password_hash`, `refresh_tokens` (Firebase Auth จัดการ) และ `users.id` = Firebase uid
* ลบ `users.guild_id` (ใช้ `guild_members` ที่เดียว, `user_id UNIQUE`)
* ลบ `max_hp` / `max_mp` (คำนวณจากสูตร ไม่เก็บ)
* ลบ `mana_crystals` (แร่เป็นไอเทมใน inventory)
* stat ไม่มี DEFAULT 0 — ต้องใส่ตอนสร้างตัวละคร
* เพิ่ม: `gates`, `gate_auctions`, `contracts`, `pvp_kills`, `boss_loot_pending`, `reports`, `user_titles`, `gm_logs`, `world_snapshot`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male','female')),
  job TEXT NOT NULL CHECK(job IN ('Fighter','Assassin','Mage','Tank','Healer','Miner')),
  hunter_rank TEXT NOT NULL DEFAULT 'E' CHECK(hunter_rank IN ('E','D','C','B','A','S')),
  is_monarch INTEGER NOT NULL DEFAULT 0,
  current_title TEXT,
  skin_tone INTEGER NOT NULL DEFAULT 1,
  hair_style INTEGER NOT NULL DEFAULT 1,
  hair_color TEXT NOT NULL DEFAULT '#1a1a1a',
  outfit TEXT NOT NULL DEFAULT 'street_hoodie',
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  stat_points INTEGER NOT NULL DEFAULT 0,
  str INTEGER NOT NULL,
  agi INTEGER NOT NULL,
  vit INTEGER NOT NULL,
  int_stat INTEGER NOT NULL,
  per INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  mp INTEGER NOT NULL,
  fatigue REAL NOT NULL DEFAULT 0,
  fatigue_updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  debt INTEGER NOT NULL DEFAULT 0,
  baht INTEGER NOT NULL DEFAULT 10000,
  loadout_slot1 TEXT,
  loadout_slot2 TEXT,
  loadout_slot3 TEXT,
  free_respawn_count INTEGER NOT NULL DEFAULT 4,
  last_map TEXT NOT NULL DEFAULT 'bkk_lobby',
  last_x REAL, last_y REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login INTEGER,
  last_daily_reset INTEGER,
  is_banned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_users_rank ON users(hunter_rank);
CREATE INDEX idx_users_level ON users(level DESC);

CREATE TABLE refresh_tokens (
  token_hash TEXT PRIMARY KEY,           -- SHA-256(token)
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE equipment (
  user_id TEXT PRIMARY KEY,
  weapon_id TEXT, weapon_enhance INTEGER NOT NULL DEFAULT 0,
  armor_id TEXT, armor_enhance INTEGER NOT NULL DEFAULT 0,
  helmet_id TEXT, helmet_enhance INTEGER NOT NULL DEFAULT 0,
  boots_id TEXT, boots_enhance INTEGER NOT NULL DEFAULT 0,
  accessory_id TEXT, accessory_enhance INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,                 -- อ้างอิง key ใน balance.json
  quantity INTEGER NOT NULL DEFAULT 1,
  enhance INTEGER NOT NULL DEFAULT 0,
  slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 29),
  UNIQUE (user_id, slot_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE storage_box (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  enhance INTEGER NOT NULL DEFAULT 0,
  slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 99),
  UNIQUE (user_id, slot_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  leader_id TEXT NOT NULL,
  member_cap INTEGER NOT NULL DEFAULT 20,
  treasury INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE guild_members (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,          -- 1 คน 1 กิลด์
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('leader','officer','member')),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, user_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  amount INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tx_user ON transactions(user_id);

-- 🆕 v5.1 -----------------------------------------------------------

CREATE TABLE gates (
  id TEXT PRIMARY KEY,
  rank TEXT NOT NULL,
  pool TEXT NOT NULL CHECK(pool IN ('low','high','endgame')),
  status TEXT NOT NULL CHECK(status IN ('auction','open','cleared','failed','expired')),
  owner_guild_id TEXT,
  spawned_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  closed_at INTEGER,
  loot_total INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_gates_status ON gates(status);

CREATE TABLE gate_auctions (
  gate_id TEXT PRIMARY KEY,
  winner_guild_id TEXT,
  winning_bid INTEGER,
  bid_count INTEGER NOT NULL DEFAULT 0,
  ended_at INTEGER,
  FOREIGN KEY (gate_id) REFERENCES gates(id)
);

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  miner_id TEXT,
  reward_baht INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','accepted','done','failed','expired')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

CREATE TABLE pvp_kills (
  id TEXT PRIMARY KEY,
  killer_id TEXT NOT NULL,
  victim_id TEXT NOT NULL,
  gate_id TEXT,
  weapon_dropped TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_pvp_pair ON pvp_kills(killer_id, victim_id, created_at);

CREATE TABLE boss_loot_pending (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL,
  leader_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  eligible_user_ids TEXT NOT NULL,       -- JSON array
  assigned_to TEXT,
  deadline_at INTEGER NOT NULL,          -- +24 ชม. แล้ว random อัตโนมัติ
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  context TEXT,                          -- JSON (chat log ล่าสุด ฯลฯ)
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE user_titles (
  user_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, title_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE gm_logs (
  id TEXT PRIMARY KEY,
  gm_token_hash TEXT NOT NULL,
  command TEXT NOT NULL,
  target TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE world_snapshot (
  key TEXT PRIMARY KEY,                  -- 'gates', 'auctions', ...
  data TEXT NOT NULL,                    -- JSON
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 13.2 Auth (Firebase) (F19)

* Client login/สมัครด้วย Firebase SDK (อีเมล+รหัสผ่าน) → ได้ **ID token** (หมดอายุ 1 ชม., SDK ต่ออายุเอง)
* ส่ง `Authorization: Bearer <idToken>` ทุกคำขอ → server ตรวจลายเซ็น/issuer/audience/วันหมดอายุ
* ชื่อตัวละครแยกจากอีเมล: ตั้งตอนสร้างตัวละคร (3–12 ตัวอักษรที่เห็นบนจอ, ไทย/อังกฤษ/ตัวเลข/_)

| Method | Path | ผล |
| :--- | :--- | :--- |
| GET | `/api/me` | ตัวละครของ uid นี้ · 404 = ยังไม่มี → ไปหน้าสร้างตัวละคร |
| POST | `/api/character` | `{ username, gender, job, look }` → 201 · 400 ข้อมูลผิด · 409 ชื่อซ้ำ/มีตัวละครแล้ว |
| GET | `/health` | keep-alive |

Realtime ใช้ **WebSocket พื้นฐาน (`ws`) ที่ `/ws`** แทน Socket.io (client ไม่ต้องโหลดไลบรารี, ห้องแยกตามแผนที่ทำเองด้วย Map) — ข้อความแรกต้องเป็น `{t:'auth', token}` (ภายใน 5 วิ) · server กำหนด stat/HP/MP/เงิน/อาวุธเริ่มต้นเอง ไม่รับจาก client

### 13.3 Realtime Messages (Phase 2.5 — ทำแล้ว)

| ข้อความ | จาก | Payload |
| :--- | :--- | :--- |
| `auth` | Client | `{ token }` (Firebase ID token) — ผิด→ปิด 4002, ไม่มีตัวละคร→4003, login ซ้ำ→เตะเซสชันเก่า 4000 |
| `hello` | Server | `{ id, x, y }` |
| `in` | Client | `{ dx, dy }` ทิศ (server normalize ≤1 แล้วคิดความเร็วเอง), ≤10/วิ, ข้อความเกิน 20/วิ ถูกทิ้ง |
| `atk` | Client | `{ id }` มอนเป้าหมาย — server เช็คระยะ ≤ 2.5 tiles, cooldown ตาม Attack Interval (เผื่อ 10%), คำนวณดาเมจ/crit เอง |
| `giveup` | Client | ยอมแพ้ตอนล้ม → โรงพยาบาลทันที |
| `enter` / `leave` | Client | `{ gate: 0\|1 }` เข้า Gate E (ต้องยืนใกล้ประตู, ได้ instance ของตัวเอง) / ออกจาก Gate |
| `mine` | Client | `{ id }` ขุดแร่ในระยะ 1.6 tiles, cooldown 0.8 วิ (Miner 40 ดาเมจ/ครั้ง, อาชีพอื่น 25) |
| `sell` | Client | ขายของ `loot` ทั้งหมดที่ตลาด (รายได้ถูกหัก 50% ถ้าเป็นลูกหนี้) |
| `ranktest` | Client | สอบแรงค์ที่สมาคม: ห้องส่วนตัว 5 วิ ตีหุ่น นับดาเมจรวม |
| `stat` | Client | `{ k: str\|agi\|vit\|int\|per }` ลงแต้ม 1 แต้ม |
| `buy` / `use` | Client | `{ item }` ซื้อที่ตลาด (น้ำมนต์ 500, น้ำเปล่า 100, ยาชูกำลัง 3,000, ดาบ E–D) / ใช้น้ำเปล่า (−15% เหนื่อย) ยาชูกำลัง (−60%) |
| `enhance` | Client | ตีบวกอาวุธที่สมาคม (แรงค์ D+, แร่เกรดตรงอาวุธ ตามตาราง §7.1) |
| `taxi` | Client | `{ to }` วินไปสมาคม/ตลาด/โรงพยาบาล/ลาน: ค่าโดยสาร 50 + 40/tile (สูงสุด 1,000), cooldown 30 วิ, −10% เหนื่อย |
| `pinvite` / `paccept` / `pleave` | Client | ปาร์ตี้สูงสุด 4: ชวนคนในระยะ 5 tiles (เฉพาะหัวหน้า), คำเชิญอายุ 30 วิ; ปาร์ตี้เดียวกันเข้า Gate instance เดียวกัน |
| `chat` | C/S | `{ ch: z\|p, text }` Zone/Party: 1 ข้อความ/วิ, ≤200 ตัว, กรองคำหยาบ, กันลิงก์, ซ้ำ 3 ครั้งพัก 10 วิ |
| `party` / `pinvited` / `levelup` / `bought` / `enhanced` | Server | สถานะปาร์ตี้ / คำเชิญ / เลเวลอัป / ซื้อแล้ว / ตีบวกแล้ว |
| `room` / `notice` / `loot` / `sold` / `cleared` / `gateFailed` / `rankResult` / `nodeHit` | Server | เปลี่ยนห้อง / ข้อความแจ้ง / ของที่ได้ / ขายแล้ว / Gate clear / หมดเวลา / ผลสอบ / แร่โดนขุด |
| `hit` | Server | `{ id, v, crit }` ดาเมจที่มอนได้รับ (ไว้ขึ้นตัวเลขลอย) |
| `me` | Server | `{ level, exp, next, baht, free, statPoints }` เมื่อ EXP/เงิน/เลเวลเปลี่ยน |
| `s` | Server | `{ p: [[id,x,y,name,job,level,hp,maxHp,downed],…], m: [[id,x,y,hp,maxHp],…] }` 10 Hz (server tick 20 Hz) |

### 13.4 Socket Events (แผนข้างหน้า — ชื่อเดิมจาก v5.0)

| Event | From | Payload |
| :--- | :--- | :--- |
| `reauth` | Client | `{ idToken }` (เมื่อ token ใกล้หมดอายุ) |
| `authExpired` | Server | — |
| `joinMap` | Client | `{ mapId }` |
| `playerInput` | Client | `{ dx, dy, seq }` (ทิศ joystick) |
| `state` | Server | snapshot ผู้เล่น/มอนในห้อง 10 Hz |
| `attack` | Client | `{ targetId }` |
| `castSkill` | Client | `{ skillId, targetId }` |
| `skillCast` / `skillFailed` | Server | result |
| `setLoadout` / `loadoutSaved` | C/S | `{ slots }` |
| `skillUnlocked` | Server | `{ skillId, level }` |
| `playerDowned` | Server | `{ userId, expiresAt }` 🆕 |
| `assistStart` / `assistCancel` | Client | `{ targetId }` 🆕 |
| `playerRevived` | Server | `{ userId, hp }` 🆕 |
| `giveUp` | Client | — 🆕 |
| `rankTestStart` / `rankTestResult` | C/S | `{ rank }` / `{ burst, passed }` 🆕 |
| `itemDropped` / `itemDespawned` | Server | item info |
| `pickupItem` / `pickupSuccess` / `pickupFailed` | C/S | item |
| `itemPriorityExpired` | Server | itemId |
| `chatMessage` / `chatReceived` | C/S | `{ channel, text }` |
| `reportPlayer` | Client | `{ targetId, reason }` |
| `requestEnhance` | Client | `{ itemId, materialId }` |
| `takeTaxi` | Client | `{ targetZoneId }` |
| `createContract` | Client | `{ gateId, rewardBaht }` |
| `adminCommand` | Client | `{ token, command, target }` |
| `gateSpawned` | Server | `{ gateId, rank, pool, x, y, expiresAt }` |
| `enterGate` | Client | `{ gateId }` |
| `gateCleared` / `gateFailed` | Server | result |
| `auctionBid` | Client | `{ gateId, amount }` |
| `dungeonBreak` | Server | `{ gateRank, mobs }` |

---

## 14. Development Milestones

| Phase | เนื้อหา | Definition of Done |
| :--- | :--- | :--- |
| **Phase 0: Setup** 🆕 | Monorepo `client/ server/ shared/ db-gateway/`, CI, `balance.json` + validator, unit test สูตร | CI เขียว, สูตรทุกตัวมี test |
| **Phase 1: Core Base** | Canvas 2.5D, Dynamic Joystick, Map 24×24, Wall Sliding, Tile Culling | 60 fps บนมือถือกลางๆ |
| **Phase 2: Character & Auth** | Firebase Auth, SQLite (dev) → D1 + Worker Gateway, Character Creation, HP/MP/Fatigue | สมัคร→สร้างตัว→เข้า lobby→ออก→กลับมาข้อมูลอยู่ครบ |
| **Phase 2.5: Multiplayer** ✅ | Rooms, 20 Hz tick, 10 Hz broadcast + Lerp, Speed check, Rate limit | 2 เครื่องเห็นกันเดินลื่น |
| **Phase 3: Combat & Death (PvE)** (🔶 ทำแล้ว: ตีมอน/EXP/เลเวลอัป/Downed/โรงพยาบาล · เหลือ: สกิล, Revive/Assist) | Goblin AI, สูตรดาเมจ, สกิล Tier 1 (2 สกิลแรก), Downed / Revive / Assist, Hospital | ตีมอน-ตาย-ฟื้นได้ครบ loop |
| **Phase 3.5: Gate E (MVP Launch)** ✅ | Low Pool instanced, Mining, Boss, Loot, Rank Test D | **ปล่อยให้คนเล่นจริงครั้งแรก** |
| **Phase 4: Gate & Guild** | Gate D, PvP + Weapon Drop, High Pool C, Auction, Guild, Contract Board, Dungeon Break | |
| **Phase 5: Enhancement & GM** | ตีบวก, วิน, ฉายา, Silent GM, Weapon System ครบ, เกราะ | |
| **Phase 6: Endgame** | Gate B/A/S, World Boss, S+/SS/SSS, Tier 2, PvP ranking | |
| **Phase 7: Polish** | Cosmetic, Achievement, Guild Wars | |

---

# PART IV — SYSTEMS

---

## 15. ระบบแชต (Chat System)

### 15.1 ช่องแชต

| ช่อง | คำสั่ง | Rate Limit |
| :--- | :--- | :--- |
| Global | `/g` | 1/3s, 20/นาที |
| Zone | `/z` | 1/s, 30/นาที |
| Party | `/p` | 1/s |
| Guild | `/gc` | 1/s |
| Whisper | `/w` | 1/s |
| Trade | `/t` | 1/5s |

### 15.2 ข้อกำหนด

* 1–200 ตัวอักษร
* **RAM 50 msg/ช่อง** (หายเมื่อ server restart — ยอมรับได้)
* Profanity filter (ไทย+อังกฤษ)
* Anti-spam: ซ้ำ 3 → block 10 วิ
* Anti-link: block URL
* Mute list (localStorage)
* Overhead bubble 5 วิ

### 15.3 UI

* ปุ่มแชตมุมซ้ายล่าง
* Half-screen overlay ซ้าย
* Tab: Global/Zone/Party/Guild/Whisper

---

## 16. ระบบ EXP Curve — Cap 100

### 16.1 หลักการ

| หัวข้อ | ค่า |
| :--- | :--- |
| Level Cap | **100** |
| Total EXP Lv.1→100 | **77,249,119** |
| เวลาเล่น (เล่นเต็มประสิทธิภาพ) | **~300 ชม.** (เล่นทั่วไป 300–400 ชม.) |
| Lv.1→50 | ~75 ชม. |
| Lv.50→100 | ~220 ชม. |
| เป้าเวลาต่อเลเวล | ≈ 0.06 × L ชม. (Lv.10 ≈ 36 นาที, Lv.50 ≈ 3 ชม., Lv.99 ≈ 6 ชม.) |

### 16.2 สูตร EXP (F9)

```
EXP_next(L) = round_3sig(100 × L^2.2)     สำหรับ L = 1..99
```

สูตรเดียวต่อเนื่อง ไม่มีจุดกระโดด (ทุกเลเวลหลัง Lv.5 เพิ่มไม่เกิน ~1.5× จากเลเวลก่อน)

### 16.3 ตาราง EXP Highlights (F8 — สร้างจาก `validate_balance.py`)

| Level | EXP to Next | สะสมถึงเลเวลถัดไป | ชม. สะสม (โดยประมาณ) |
| :-: | :-: | :-: | :-: |
| 1 | 100 | 100 | 0.1 |
| 5 | 3,450 | 7,239 | 0.9 |
| 10 | 15,800 | 57,719 | 3.3 |
| 15 | 38,700 | 201,019 | 7.2 |
| 20 | 72,800 | 492,219 | 12.6 |
| 25 | 119,000 | 990,119 | 19.5 |
| 30 | 178,000 | 1,757,119 | 27.9 |
| 35 | 249,000 | 2,855,119 | 37.8 |
| 40 | 335,000 | 4,352,119 | 49.2 |
| 50 | 547,000 | 8,819,119 | 76.5 |
| 60 | 816,000 | 15,720,119 | 109.8 |
| 70 | 1,150,000 | 25,659,119 | 149.1 |
| 80 | 1,540,000 | 39,219,119 | 194.4 |
| 90 | 1,990,000 | 57,039,119 | 245.7 |
| 99 | 2,460,000 | 77,249,119 | 297.0 |
| **100** | **CAP** | | |

### 16.4 EXP จาก Gate (F3)

หลักการ: EXP clear ≈ 30% ของ EXP/ชม. ที่ Lv. แนะนำ และ **ไม่เกิน 1 เลเวล** ที่ Lv. แนะนำต่ำสุด (ยกเว้น Gate E ที่ตั้งใจให้มือใหม่ขึ้นเร็ว)

| Rank | EXP/Clear | เทียบ (Lv. แนะนำต่ำสุด) |
| :---: | :-: | :-: |
| **E** | **3,500** | ~1 เลเวลที่ Lv.5 |
| **D** | **13,000** | 0.82 เลเวลที่ Lv.10 |
| **C** | **26,000** | 0.36 เลเวลที่ Lv.20 |
| **B** | **45,000** | 0.18 เลเวลที่ Lv.35 |
| **A** | **70,000** | 0.13 เลเวลที่ Lv.50 |
| **S** | **300,000** | 0.26 เลเวลที่ Lv.70 (raid 20 คน) |

### 16.5 EXP จากมอนสเตอร์

| Rank | Normal | Elite | Boss | World Boss |
| :---: | :-: | :-: | :-: | :-: |
| E | 25 | 130 | 500 | — |
| D | 100 | 500 | 2,000 | — |
| C | 210 | 1,000 | 4,000 | — |
| B | 350 | 1,800 | 7,000 | — |
| A | 540 | 2,700 | 11,000 | — |
| S | 730 | 3,600 | 15,000 | 200,000 |

### 16.6 การแบ่ง EXP และโทษเลเวลห่าง (F21)

* **Party:** สมาชิกที่อยู่ในระยะ 15 tiles ได้คนละ `mob_exp × (1 + 0.1 × (n − 1)) / n`
  * เช่น 4 คน → คนละ 32.5% ของ EXP มอน (รวม 130%)
* **EXP clear Gate:** ได้เต็มทุกคน
* **โทษเลเวลห่าง** (ผู้เล่นเลเวลสูงกว่ามอน):
  * ห่าง ≥ 10 → EXP ×0.5
  * ห่าง ≥ 20 → EXP ×0.1

---

## 17. ระบบสกิลอาชีพ (Class Skill Database — Tier 1)

### 17.1 หลักการ

| หัวข้อ | กฎ |
| :--- | :--- |
| จำนวน | **6 สกิล/อาชีพ** |
| ช่องติดตั้ง | **3 ช่อง** |
| ปลดล็อก | Lv.1, 1, 10, 20, 30, 40 |
| Upgrade | ❌ ไม่มีใน MVP |
| MP | โพชั่นเท่านั้น |
| Fatigue | ทุกสกิล +0.5% (× VIT modifier) |
| Damage | `Basic Damage × Mult` (§4.2) — ใช้สูตรเดียวทุกอาชีพ |

### 17.2 Fighter

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Slash | 1 | 5 | 2s | 1.5× | ดาเมจเป้าเดียว |
| 2 | Whirlwind | 1 | 20 | 8s | 1.8× | AoE รอบตัว |
| 3 | Charge | 10 | 15 | 10s | 1.5× | พุ่ง 4 tiles + stun 1s |
| 4 | Ground Slam | 20 | 30 | 15s | 2.0× | AoE + slow 30% |
| 5 | Berserk | 30 | 40 | 45s | — | +40% ATK 15s |
| 6 | Last Stand | 40 | 60 | 90s | — | HP<30% → ฟื้น 40% |

### 17.3 Assassin

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Stab | 1 | 5 | 2s | 1.5× | เป้าเดียว |
| 2 | Shadow Step | 1 | 25 | 10s | 2.5× | วาร์ปไปหลังเป้า (≤3 tiles) + โจมตี |
| 3 | Poison Blade | 10 | 20 | 12s | DoT | 0.3× Basic/วิ × 5 วิ + −20% DEF |
| 4 | Smoke Bomb | 20 | 30 | 20s | — | Blind + invisible 3s |
| 5 | Backstab | 30 | 35 | 25s | 3.0× | crit 100% (ต้องอยู่หลังเป้า) |
| 6 | Assassinate | 40 | 70 | 90s | 4.0× | Execute (<20% HP) |

> Poison Blade เดิม "10/วิ" ไม่ scale → เปลี่ยนเป็น % ของ Basic Damage

### 17.4 Mage

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Fireball | 1 | 10 | 3s | 1.8× | + burn |
| 2 | Ice Nova | 1 | 30 | 10s | 2.0× | Freeze 1.5s |
| 3 | Teleport | 10 | 25 | 12s | — | วาร์ป 5 tiles |
| 4 | Mana Shield | 20 | 40 | 30s | — | MP แทน HP |
| 5 | Arcane Blast | 30 | 45 | 20s | 2.5× | −30% DEF |
| 6 | Meteor | 40 | 80 | 120s | 4.0× | AoE + knockback |

### 17.5 Tank

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Shield Bash | 1 | 5 | 2s | 1.2× | + stun 0.5s |
| 2 | Taunt | 1 | 15 | 8s | — | Aggro 5s |
| 3 | Iron Wall | 10 | 25 | 25s | — | DEF ×3 10s |
| 4 | Provoke | 20 | 30 | 20s | — | Aggro + −ATK |
| 5 | Fortify | 30 | 35 | 40s | — | ฟื้น 30% + กัน dmg |
| 6 | Guardian's Oath | 40 | 60 | 90s | — | รับ dmg แทน party |

> Shield Bash ใช้ได้กับอาวุธทุกชนิด (ชื่อคงไว้; โล่จริงมาใน Phase 5+)

### 17.6 Healer (F4 — เรียงใหม่)

| # | ชื่อ | Lv. | MP | CD | Heal | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Heal | 1 | 15 | 3s | 15% | เป้าเดียว |
| 2 | **Revive** ⬆️ | **1** | 40 | 60s | — | กู้ Downed → HP 30% (ระยะ 2, cast 1.5s) |
| 3 | Blessing | 10 | 30 | 15s | 8% | AoE heal รัศมี 3 tiles |
| 4 | **Purify** ⬇️ | **20** | 20 | 10s | — | ล้าง debuff |
| 5 | Sanctuary | 30 | 40 | 30s | 3%/วิ | พื้นที่ 3 tiles, 6 วิ |
| 6 | **Divine Light** ⬇️ | **40** | 45 | 25s | 40% | Heavy heal |

### 17.7 Miner

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Pick Strike | 1 | 5 | 2s | 1.5× | เป้าเดียว |
| 2 | Mining Boost | 1 | 15 | 30s | — | +50% ขุด 30s |
| 3 | Vein Sense | 10 | 20 | 20s | — | แสดงแร่ 5s |
| 4 | Stone Skin | 20 | 30 | 30s | — | +100% DEF 8s |
| 5 | Burrow | 30 | 25 | 15s | — | หายตัว 3s |
| 6 | Earthquake | 40 | 60 | 60s | 2.5× | AoE + stun 1.5s |

### 17.8 Skill Damage & Healing (F5)

**ดาเมจ (ทุกอาชีพ):**
$$\text{Skill Damage} = (\text{Effective ATK} + \text{Stat Bonus}) \times \text{mult}$$

Mage ใช้ Staff (scale INT) → ATK ของ Staff มีผลแล้ว ไม่มีสูตรเวทแยก

**Heal (Healer):**
$$\text{Heal} = \text{target\_MaxHP} \times \text{heal\%} \times \text{prof} \times (1 + \text{INT}/500) \times (1 + \text{weapon\_heal\_bonus})$$

> เป็น % ของ Max HP เป้าหมาย → ใช้ได้ทุกช่วงเลเวลโดยไม่ต้องตามสูตรดาเมจ
> Healer ถือ Tome (prof 1.0) = heal เต็ม, ถือดาบสั้น (prof 0.5) = heal 50%

### 17.9 Loadout UI

```
┌──────────────────────────────────┐
│  ⚔️ SKILL LOADOUT                │
│  [ช่อง 1]  [ช่อง 2]  [ช่อง 3]   │
│  ─── คลังสกิล (ลากไปใส่) ───     │
│  [บันทึก]  [รีเซ็ต]              │
└──────────────────────────────────┘
```

---

## 18. Gate Encounter Design

### 18.0 Monster Stats (F12)

ค่าที่ Lv. กลางของแต่ละ rank — ออกแบบให้ Reference Build ถืออาวุธ rank เดียวกัน +5 ตีมอนปกติตาย **~4–5 ครั้ง** และโดนมอนปกติตีครั้งละ **~6% HP** (playtest)

| Rank | Lv | DEF | Normal HP / ATK | Elite HP / ATK | Boss HP / ATK |
| :-: | :-: | :-: | :-: | :-: | :-: |
| E | 5 | 20 | 85 / 30 | 320 / 50 | 3,200 / 100 |
| D | 15 | 40 | 200 / 65 | 750 / 110 | 7,500 / 220 |
| C | 27 | 65 | 400 / 130 | 1,500 / 210 | 15,000 / 430 |
| B | 42 | 95 | 950 / 250 | 3,500 / 410 | 35,000 / 830 |
| A | 60 | 130 | 2,800 / 550 | 10,000 / 920 | 100,000 / 1,800 |
| S | 77 | 165 | 9,300 / 1,400 | 35,000 / 2,300 | 350,000 / 4,600 |
| World Boss S | 80 | 200 | **100,000,000** / 6,000 | — | — |

### 18.1 Gate E — Green Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 2 ชม. (3 ชม. หลัง 22:00) |
| ระบบ | Instanced ต่อ party |
| PvP | ❌ |
| Monster | 20–25 |
| Mining | 10 nodes (Mana Stone E) |
| EXP clear | 3,500 |
| Loot | 30K avg |

**Boss:** Goblin Chief (Lv.8) — **Leader distribute** 1 Boss Ear

---

### 18.2 Gate D — Blue Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 4 ชม. (6 ชม. หลัง 22:00) |
| ระบบ | Instanced ต่อ party |
| Monster | 25–30 |
| Mining | 15 nodes (Mana Stone D) |
| EXP clear | 13,000 |
| Loot | 100K avg |

**Boss:** Goblin Lord (Lv.18)

---

### 18.3 Gate C — Yellow Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 8 ชม. (12 ชม. หลัง 22:00) |
| Monster | 30–40 |
| Mining | 20 nodes (Mana Crystal C) |
| EXP clear | 26,000 |
| Loot | 5M avg |

**Boss:** Spider Queen (Lv.32) — **Boss Mana Core C 250K**

---

### 18.4 Gate B — Red Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 12 ชม. (18 ชม. หลัง 22:00) |
| Monster | 40–50 |
| Mining | 40 nodes (Mana Crystal B + Rune Shard) |
| EXP clear | 45,000 |
| Loot | 25M avg |

**Boss:** Demon Knight + Demon Lord (Lv.47) — **Boss Core B ×3 (Leader distribute)**

---

### 18.5 Gate A — Black Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 18 ชม. (27 ชม. หลัง 22:00) |
| Monster | 50–60 |
| Mining | 60 nodes (Mana Crystal A + Runestone A) |
| EXP clear | 70,000 |
| Loot | 300M avg |

**Special:**
- 3 layers: Mini → Mid → Final (Dragon Lord Lv.67)
- Dragon mechanics (fly/breath/adds)
- **Enrage Timer:** 15 นาที/Boss → +200% ATK, +50% Speed

---

### 18.6 Gate S — Disaster Class

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 24 ชม. (36 ชม. หลัง 22:00) |
| Party | 20 (Invite) |
| Mining | 100 nodes (God-tier) |
| EXP clear | 300,000 (+ World Boss 200,000) |
| **World Boss HP** | **100,000,000** |
| Loot | 3–8 พันล้าน |

**World Boss (คำนวณใหม่):**
- ผู้เล่น S (Lv.77, ดาบ S +5) Basic ~2,300 → DPS รวมสกิล ~3,900/คน
- 20 คน × 3,900 × ~0.6 (DEF + เวลาหลบ/เดิน) ≈ 47,000 DPS → **~35 นาที**
- 3 phases (100%, 50%, 20% HP)
- Phase 2: +10 adds
- Phase 3: Enrage
- **HP Regen:** 1%/วิ ถ้าไม่มีคนโจมตี 30 วิ

**Special:**
- Server-wide broadcast
- Title "Gate Breaker"
- ภาษี 10% จากทั้งเซิร์ฟ 1 สัปดาห์ (ตกเป็นของกิลด์ผู้ clear)

---

### 18.7 Mining Nodes Scaling

| Rank | Nodes | Type | HP | Swings | Drop |
| :---: | :-: | :--- | :-: | :-: | :--- |
| E | 10 | Mana Stone E | 100 | 2–3 | 100% |
| D | 15 | Mana Stone D | 300 | 3–4 | 100% |
| C | 20 | Mana Crystal C | 500 | 3–5 | 70% C |
| B | 40 | Crystal B + Rune | 2,000 | 5–8 | 50% B |
| A | 60 | Crystal A + Rune | 8,000 | 8–12 | 40% A |
| S | 100 | God-tier | 30,000 | 10–15 | Unique |

**PER Bonus:** +1% rare drop per 10 PER (cap +50%)

---

### 18.8 Dungeon Break

**เกิดเมื่อ:** Gate C+ หมดเวลา หรือ Gate E/D หมดเวลาโดยไม่มี party ไหน clear (§8.2)

| Rank | Mob | Lv | HP | ATK | Count |
| :---: | :--- | :-: | :-: | :-: | :-: |
| E | Lesser Goblin | 5 | 130 | 30 | 10 |
| D | Goblin Warrior | 15 | 300 | 65 | 15 |
| C | Orc Soldier | 27 | 600 | 130 | 18 |
| B | Demon Soldier | 42 | 1,400 | 250 | 20 |
| A | Demon Captain | 60 | 4,200 | 550 | 20 |
| S | Ancient Dragon + adds | 77 | 50M + 2M×5 | 4,600 / 2,300 | 1+5 |

> HP มอน Dungeon Break = Normal ×1.5 ของ rank นั้น (§18.0)

**Reward:** ฆ่ามอน = **EXP × 2 + drop rate × 2**
**Safe Zone:** Lv < (Break Lv − 10) → immune
**Duration:** 30 นาที
**Clear:** +100% EXP Gate นั้น + achievement

---

### 18.9 Boss Drop Distribution

**Leader Distribute:**
- Guild/Party Leader แจก Boss drops
- UI: loot roll → leader เลือก
- **24 ชม.** ถ้าไม่แจก → random อัตโนมัติ (ตาราง `boss_loot_pending`)
- **Anti-abuse:** log ทุกครั้ง (GM reviewable)

| Rank | Drop Count | Value/each |
| :---: | :-: | :-: |
| E | 1 | ~5,680 |
| D | 1 | ~20,000 |
| C | 2 | ~250,000 |
| B | 3 | ~1,500,000 |
| A | 3 | ~30,000,000 |
| S | 5 | ~200,000,000 |

---

## 19. Endgame Content (Lv.70–100)

### 19.1 Gate Tiers เพิ่มเติม (F3, F10)

| Rank | **Lv. แนะนำ** | Timer | EXP clear | Loot |
| :---: | :-: | :-: | :-: | :-: |
| **S+** | 80+ | 30 ชม. | 500,000 | 5–10 พันล้าน |
| **SS** | 90+ | 36 ชม. | 800,000 | 20–50 พันล้าน |
| **SSS** | 100 | 48 ชม. | 1,500,000 | 100–150 พันล้าน |

> ไม่มี level requirement (เหมือน Gate ปกติ) — เดิม SSS ให้ 200M EXP (มากกว่าทั้งเกม) แก้แล้ว

**Spawn:**
- S+: ทุก 6 ชม. (max 1)
- SS: ทุก 12 ชม. (max 1)
- SSS: ทุก 24 ชม. (max 1) — server event

### 19.2 Level 100 Endgame

**ที่ Lv.100:**
- ❌ ไม่มี Prestige (cap 100 = จบ)
- ✅ Farm SSS gates
- ✅ PvP ranking (leaderboard)
- ✅ Guild wars (Phase 7)
- ✅ Achievement hunting

---

## 20. Runestone Tier 2 Skills — PLACEHOLDER

> **Status:** 🔜 รอออกแบบ (ต้องเสร็จก่อน Phase 6 — ดู ประเด็นเปิด P4)

**โครงร่าง:**
- Runestone Tier 2 ดรอปจาก Gate B+
- Rank สูง → สกิลดีขึ้น + หายากขึ้น
- เรียนสกิลพิเศษ **นอกเหนือจาก 6 Tier 1**
- **Consumable:** ใช้แล้วหาย
- **Tradeable:** ก่อนใช้ / Bound หลังเรียน
- **2 ช่อง Tier 2** (แยกจาก 3 ช่อง Tier 1)
- CD ยาว (60–180 วิ) แต่ effect ทรงพลัง

**ระหว่างรอ Tier 2:** Runestone = ขายได้เท่านั้น

---

# PART V — WEAPONS & EQUIPMENT

---

## 21. ระบบอาวุธ (Universal Weapon System)

### 21.1 หลักการ

| หัวข้อ | กฎ |
| :--- | :--- |
| **Restriction** | ❌ **ทุกอาชีพใช้ได้** |
| **Proficiency** | ✅ Matrix กำหนด % |
| **Damage** | `effective_atk + stat_bonus` (ดู §4.2) |
| **Starter** | ต่างกันตามอาชีพ |
| **ค่าพลังเริ่มต้น** | **ไม่เท่ากัน** (ตาม prof + stat) |
| **ช่วงเลเวลตาม Rank** | E 1–10 · D 10–20 · C 20–35 · B 35–50 · A 50–70 · S 70+ (F22) |

### 21.2 Proficiency Matrix (F18)

**Scale:** 1.0 ถนัด · 0.9 เกือบถนัด · 0.7 ใช้ได้ · 0.6 พอใช้ · 0.5 ค่อนข้างไม่ถนัด · 0.4 ไม่ถนัด · 0.3 แย่ · 0.2 ผิดสาย

| อาชีพ | Shortsword | Longsword | Greatsword | Dagger | Staff | Mace | Pickaxe | Tome |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Fighter** | 1.0 | 1.0 | 1.0 | 0.7 | 0.3 | 0.9 | 0.7 | 0.3 |
| **Assassin** | 0.9 | 0.7 | 0.4 | **1.0** | 0.3 | 0.6 | 0.5 | 0.3 |
| **Mage** | 0.4 | 0.3 | 0.2 | 0.4 | **1.0** | 0.3 | 0.3 | 0.7 |
| **Tank** | 1.0 | 0.9 | 0.7 | 0.6 | 0.4 | **1.0** | 0.6 | 0.4 |
| **Healer** | 0.5 | 0.4 | 0.3 | 0.5 | 0.7 | 0.5 | 0.4 | **1.0** |
| **Miner** | 0.7 | 0.6 | 0.5 | 0.5 | 0.3 | 0.7 | **1.0** | 0.3 |

> **Fix ตลอด MVP** — ไม่มี proficiency level up

### 21.3 Scaling Stat ตามประเภทอาวุธ

| อาวุธ | Scaling Stat |
| :--- | :-: |
| Shortsword / Longsword / Greatsword / Mace / Pickaxe | **STR** |
| Dagger | **AGI** |
| Staff / Tome | **INT** |

### 21.4 Damage Formula

$$\text{effective\_atk} = \text{weapon\_atk} \times \text{prof} \times (1 + N \times 0.05)$$
$$\text{stat\_bonus} = \text{scaling\_stat} \times 0.5 \times \text{prof}$$
$$\text{Basic Damage} = \text{effective\_atk} + \text{stat\_bonus}$$

### 21.5 ตัวอย่าง: Fighter Lv.70 Reference Build (STR 152, AGI 9, INT 6) (F7)

| อาวุธ | Base ATK | Prof | Effective ATK | Stat Bonus | **Total** |
| :--- | :-: | :-: | :-: | :-: | :-: |
| Shortsword +10 (S) | 1,200 | 1.0 | 1,800 | 76 (STR) | **1,876** |
| **Longsword +10 (S)** | 1,800 | 1.0 | 2,700 | 76 (STR) | **2,776** |
| **Greatsword +10 (S)** | 2,800 | 1.0 | 4,200 | 76 (STR) | **4,276** |
| Dagger +10 (S) | 1,000 | 0.7 | 1,050 | 3.2 (AGI) | 1,053 |
| Staff +10 (S) | 1,500 | 0.3 | 675 | 0.9 (INT) | 676 |

### 21.6 ตัวอย่าง: Mage Lv.70 Reference Build (INT 154, STR 6, AGI 8) (F6)

| อาวุธ | Base ATK | Prof | Effective ATK | Stat Bonus | **Total** |
| :--- | :-: | :-: | :-: | :-: | :-: |
| Shortsword +10 (S) | 1,200 | 0.4 | 720 | 1.2 (STR) | 721 |
| Greatsword +10 (S) | 2,800 | 0.2 | 840 | 0.6 (STR) | 841 |
| **Staff +10 (S)** | 1,500 | **1.0** | 2,250 | 77 (INT) | **2,327** |
| Dagger +10 (S) | 1,000 | 0.4 | 600 | 1.6 (AGI) | 602 |

> Mage ถือ Greatsword = 841 (ใช้ได้แต่ไม่คุ้ม) — **Staff ดีกว่า ~2.8 เท่า**
> หมายเหตุ: ช่วงท้ายเกม ATK อาวุธมีน้ำหนักมากกว่า stat มาก (ดู ประเด็นเปิด P3)

### 21.7 Starter Weapons Damage (Lv.1)

| อาชีพ | Starter | ATK | Prof | Stat Bonus | **Lv.1 Damage** |
| :--- | :--- | :-: | :-: | :-: | :-: |
| Fighter (STR 14) | Shortsword E | 5 | 1.0 | 7.0 | **12.0** |
| Assassin (AGI 15) | Dagger E | 5 | 1.0 | 7.5 | **12.5** |
| Mage (INT 16) | Staff E | 4 | 1.0 | 8.0 | **12.0** |
| Tank (STR 11) | **Mace E** | 6 | 1.0 | 5.5 | **11.5** |
| Healer (INT 14) | Tome E | 3 | 1.0 | 7.0 | **10.0** |
| Miner (STR 12) | Pickaxe E | 5 | 1.0 | 6.0 | **11.0** |

---

## 21.9 ดาบ (Sword Database)

### ประเภทดาบ

| ประเภท | น้ำหนัก | Attack Speed | Passive | Style |
| :--- | :-: | :-: | :--- | :--- |
| **Shortsword** | 3–4 kg | **+10%** | **+5% crit** | เร็ว, crit สูง, dmg ต่ำ |
| **Longsword** | 6–8 kg | baseline | — (สมดุล) | balanced |
| **Greatsword** | 12–18 kg | **−10%** | **+15% dmg vs boss** | ช้า, ดาเมจหนัก |

### Rank E (Lv.1–10)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบเหล็กสั้นสนิม** | Short | **5** | 3 kg | +10% AS, +5% crit | — | Starter (Fighter) |
| **ดาบเหล็กฮันเตอร์** | Long | **8** | 6 kg | — | 5,000 | Goblin Warrior 10% |
| **ดาบใหญ่ฝึกหัด** | Great | **12** | 12 kg | −10% AS, +15% vs boss | 8,000 | Goblin Chief 20% |

### Rank D (Lv.10–20)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบเหล็กกล้า** | Short | **15** | 3 kg | +10% AS, +5% crit | 50,000 | Goblin Lord 15% |
| **ดาบฮันเตอร์ยาว** | Long | **22** | 7 kg | — | 80,000 | Goblin Lord 10%, Shop |
| **ดาบใหญ่ทหาร** | Great | **30** | 14 kg | −10% AS, +15% vs boss | 120,000 | Orc Soldier 3% |

### Rank C (Lv.20–35)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบมานาสั้น** | Short | **40** | 3 kg | +10% AS, +5% crit, +5% mana | 1,000,000 | Orc Captain 15% |
| **ดาบคริสตัลยาว** | Long | **55** | 7 kg | +5% crit | 1,500,000 | Orc Captain 10%, Spider Queen 20% |
| **ดาบใหญ่คริสตัล** | Great | **80** | 14 kg | −10% AS, +15% vs boss | 2,500,000 | Spider Queen 15% |

### Rank B (Lv.35–50)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบรูนสั้น** | Short | **100** | 3 kg | +10% AS, +10% crit | 5,000,000 | Demon Captain 10% |
| **ดาบปีศาจยาว** | Long | **150** | 8 kg | +10% crit, **Lifesteal 3%** | 10,000,000 | Demon Mage 8%, Demon Lord 20% |
| **ดาบใหญ่ปีศาจ** | Great | **220** | 15 kg | −10% AS, +25% vs boss, **Bleed 0.1× Basic/วิ × 5 วิ** | 20,000,000 | Demon Lord 15% |

### Rank A (Lv.50–70)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบมังกรสั้น** | Short | **350** | 4 kg | +15% AS, +15% crit, +10% fire | 80,000,000 | Dragon 10% |
| **ดาบมังกรยาว** | Long | **500** | 8 kg | +15% crit, **Lifesteal 5%**, +15% fire | 150,000,000 | Dragon 15% |
| **ดาบใหญ่มังกร** | Great | **750** | 16 kg | −10% AS, **+40% vs boss**, +20% fire | 250,000,000 | Dragon Lord 10% |

### Rank S (Lv.70+)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบเงาสั้น** *(Monarch's Edge)* | Short | **1,200** | 3 kg | +20% AS, +25% crit, Lifesteal 8%, +20% shadow | 2,000,000,000 | Gate S 5% |
| **ดาบสวรรค์ยาว** *(Celestial Blade)* | Long | **1,800** | 8 kg | +25% crit, Lifesteal 10%, +30% holy | 3,000,000,000 | Gate S 5% |
| **ดาบทำลายล้าง** *(Ragnarok)* | Great | **2,800** | 18 kg | −5% AS, +60% vs boss, +30% crit dmg | 5,000,000,000 | Gate S 3% |

### Damage Scaling ตัวอย่าง (Fighter Lv.70 Reference, STR 152, prof 1.0) (F18)

| ดาบ | **Effective ATK** | Stat Bonus | **Basic** | Skill 1.5× | Skill 1.5× + Crit |
| :--- | :-: | :-: | :-: | :-: | :-: |
| ดาบเหล็กสั้น +0 (E) | 5 | 76 | 81 | 122 | 182 |
| ดาบฮันเตอร์ยาว +5 (D) | 27.5 | 76 | 104 | 155 | 233 |
| ดาบคริสตัลยาว +10 (C) | 82.5 | 76 | 159 | 238 | 357 |
| ดาบปีศาจยาว +10 (B) | 225 | 76 | 301 | 452 | 677 |
| ดาบมังกรยาว +10 (A) | 750 | 76 | 826 | 1,239 | 1,859 |
| ดาบสวรรค์ยาว +10 (S) | 2,700 | 76 | 2,776 | 4,164 | 6,246 |

### Drop Summary

| Rank | Boss Drop | Elite Drop |
| :---: | :--- | :--- |
| **E** | Goblin Chief 20% (Great) | Goblin Warrior 10% (Long) |
| **D** | Goblin Lord 15% (Short), 10% (Long) | Orc Soldier 3% (Great) |
| **C** | Spider Queen 20% (Long), 15% (Great) | Orc Captain 15% (Short), 10% (Long) |
| **B** | Demon Lord 20% (Long), 15% (Great) | Demon Captain 10% (Short), Demon Mage 8% (Long) |
| **A** | Dragon Lord 10% (Great) | Dragon 15% (Long), 10% (Short) |
| **S** | — (world boss only) | Gate S boss 5% / 5% / 3% |

---

## 21.10 เกราะ (Armor) 🆕 (F11)

* 3 ช่อง: **เสื้อ (50%) / หมวก (25%) / รองเท้า (25%)** ของค่ารวมทั้งเซ็ต
* ทุกอาชีพใส่ได้ ไม่มี proficiency
* ตีบวกได้เหมือนอาวุธ: DEF/HP ×(1 + N×0.05)
* Accessory → Phase 5+

| Rank | DEF (ทั้งเซ็ต) | HP (ทั้งเซ็ต) | ราคา (ทั้งเซ็ต) |
| :-: | :-: | :-: | :-: |
| E | 10 | 50 | 3,000 |
| D | 30 | 200 | 50,000 |
| C | 80 | 600 | 900,000 |
| B | 200 | 1,500 | 6,000,000 |
| A | 500 | 4,000 | 90,000,000 |
| S | 1,200 | 10,000 | 1,800,000,000 |

> ใช้กับสูตร K-based DEF (§4.2): เกราะตรง rank กันดาเมจจากมอนเลเวลเดียวกันได้ ~5% (E) ถึง ~42% (S)

---

## 21.11 อาวุธอื่น (Preview)

> **Phase 5+** — ยังไม่ implement ใน MVP ยกเว้น **ระดับ E (starter)** ที่ต้องมีตั้งแต่ Phase 2

### Dagger (มีดสั้น) — สาย Assassin
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | มีดสั้นพกพา | 5 | +15% AS, +10% crit |
| D | มีดเหล็กกล้า | 12 | +15% AS, +15% crit |
| C | มีดมานา | 35 | +20% AS, +20% crit, Poison |
| B | มีดปีศาจ | 90 | +25% AS, +25% crit, Lifesteal 3% |
| A | มีดมังกร | 300 | +30% AS, +30% crit, +shadow |
| S | มีดเงา | 1,000 | +40% AS, +40% crit, Lifesteal 8% |

### Staff (คทา) — สาย Mage
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | คทาไม้ฝึกหัด | 4 | +5% magic dmg |
| D | คทาคริสตัล | 15 | +10% magic dmg |
| C | คทามานา | 45 | +15% magic dmg, +5% MP |
| B | คทาปีศาจ | 130 | +20% magic dmg, +10% MP |
| A | คทามังกร | 400 | +30% magic dmg, +15% MP |
| S | คทาสวรรค์ | 1,500 | +40% magic dmg, +20% MP |

### Tome (หนังสือสวด) — สาย Healer
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | หนังสือสวดมนต์ | 3 | +10% heal |
| D | ตำราศักดิ์สิทธิ์ | 10 | +15% heal |
| C | ตำรามานา | 30 | +20% heal, +5% MP |
| B | ตำราปีศาจ | 80 | +25% heal, +10% MP |
| A | ตำรามังกร | 250 | +35% heal, +15% MP |
| S | ตำราสวรรค์ | 800 | +50% heal, +25% MP |

### Mace (กระบอง) — สาย Tank
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | กระบองไม้ | 6 | +5% stun |
| D | กระบองเหล็ก | 20 | +10% stun |
| C | กระบองมานา | 55 | +15% stun, +5% DEF |
| B | กระบองปีศาจ | 160 | +20% stun, +10% DEF |
| A | กระบองมังกร | 500 | +25% stun, +15% DEF |
| S | กระบองสวรรค์ | 1,500 | +30% stun, +25% DEF |

### Pickaxe (อีเตอร์) — สาย Miner
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | อีเตอร์เก่า | 5 | +10% mining speed |
| D | อีเตอร์เหล็ก | 18 | +15% mining speed |
| C | อีเตอร์มานา | 50 | +25% mining speed, +5% rare |
| B | อีเตอร์ปีศาจ | 140 | +35% mining speed, +10% rare |
| A | อีเตอร์มังกร | 450 | +50% mining speed, +20% rare |
| S | อีเตอร์สวรรค์ | 1,300 | +75% mining speed, +30% rare |

---

## 21.12 Endgame Weapons (Phase 6+)

| ชื่อ | Tier | ATK | Passive |
| :--- | :-: | :-: | :--- |
| **Void Blade** | S+ | 3,000 | +30% crit, +20% dmg vs S+ |
| **Astral Sword** | SS | 5,000 | +40% crit, +30% dmg vs SS |
| **Genesis Sword** | SSS | **10,000** | **Unique World Item** |

**Drop:** Gate S+ / SS / SSS world boss (3–5%)

---

# PART VI — APPENDIX

---

## Appendix A: ตัวเลขสำคัญที่ Lock แล้ว (v5.1)

### เศรษฐกิจ
| รายการ | ค่า |
| :--- | :-: |
| เงินเริ่มต้น | 10,000 บาท |
| หูก็อปลิน | 568 (Boss 5,680) |
| Mana Stone E | 208 |
| Mana Stone D | ~500 |
| Mana Crystal C | 100K |
| Boss Mana Core C | 250K |
| Rune Shard C | 500K |
| Mana Crystal B | 300K |
| Runestone B | 1.5M |
| Mana Crystal A | 2M |
| Runestone A | 10M |
| Boss Core A | 30M |
| ค่ารักษา | ตาม Rank: E 2K / D 10K / C 100K / B 500K / A 1M / S 3M (4 ครั้งแรกฟรี) |
| ค่าตั้งกิลด์ | 50,000,000 |
| ค่าวิน | 50–1,000 |

### Combat
| รายการ | ค่า |
| :--- | :-: |
| Downed trigger | โดนดาเมจถึงตาย |
| Downed timer | 45 วิ |
| Revive ซ้ำภายใน | 120 วิ = ตายทันที |
| Healer Revive | Lv.1, HP 30% |
| พยุง (Assist) | 10 วิ, HP 10% |
| PvP damage | ×0.4 |
| DEF formula | K/(K+DEF), K = 100 + Lv×20 |
| PvP Priority | 15 วิ |
| Floor despawn | 15 นาที |
| Floor cap | 60/แผนที่ |
| Crit cap | 50% |
| Attack interval ฐาน | 1.0 วิ |
| Move speed ฐาน | 4.0 tiles/วิ |
| กระเป๋า | 30 ช่อง |
| คลัง | 100 ช่อง |
| ตีบวกสูงสุด | +10 |

### Level/EXP
| รายการ | ค่า |
| :--- | :-: |
| Level cap | **100** |
| Stat/Level | +3 |
| สูตร | `round_3sig(100 × L^2.2)` |
| EXP Lv.1→50 | 8,272,119 |
| EXP Lv.50→100 | 68,977,000 |
| **EXP Lv.1→100** | **77,249,119** |
| Playtime | ~300 ชม. (เต็มประสิทธิภาพ) / 300–400 ชม. (ทั่วไป) |

### Gate
| รายการ | ค่า |
| :--- | :-: |
| Gate E/D | Instanced, เปิดค้าง E×2 + D×1 |
| Gate C+ | ทุก 2 ชม., max 3, C50/B30/A15/S5 |
| Gate S | สูงสุด 1 ครั้ง/24 ชม. |
| Gate E PvP | ปิด |
| Cooldown หลัง clear (C+) | 30 นาที |
| Night boost | ×1.5 (spawn หลัง 22:00) |
| Level req | **ไม่มี** (มีแค่ Lv. แนะนำ) |
| No-bid Gate C+ | Public Gate |
| Re-entry หลังตาย | ทันที |
| Enrage timer | 15 นาที/Boss |
| Dungeon Break reward | ×2 |
| Completion Bonus | 5% ของ drop จริง |
| World Boss HP | 100,000,000 |

### Weapons (Sword)
| Rank | Lv. | Longsword ATK | ราคา |
| :---: | :-: | :-: | :-: |
| E | 1–10 | 8 | 5,000 |
| D | 10–20 | 22 | 80,000 |
| C | 20–35 | 55 | 1.5M |
| B | 35–50 | 150 | 10M |
| A | 50–70 | 500 | 150M |
| S | 70+ | 1,800 | 3B |

### Proficiency
| Scale | ความหมาย |
| :-: | :--- |
| 1.0 | ถนัด |
| 0.9 | เกือบถนัด |
| 0.7 | ใช้ได้ |
| 0.6 | พอใช้ |
| 0.5 | ค่อนข้างไม่ถนัด |
| 0.4 | ไม่ถนัด |
| 0.3 | แย่ |
| 0.2 | ผิดสาย |

### D1 Quota Target
| รายการ | Target |
| :--- | :-: |
| Writes/player/hour | < 30 |
| Reads/player/hour | < 100 |
| Save cadence | login, levelup, rankup, disconnect, ทุก 5 นาที |
| World snapshot | ทุก 5 นาที + SIGTERM |

---

## Appendix B: ประเด็นเปิด (รอ Playtest / ตัดสินใจภายหลัง)

| ID | ประเด็น | ข้อสังเกต | ตัดสินใจเมื่อ |
| :-: | :--- | :--- | :-: |
| P1 | **MP จากโพชั่นเท่านั้น** | Mage/Healer ใช้ MP เยอะ อาจเปลืองเงินเกินไปช่วงต้นเกม — ตัวเลือก: ฟื้น MP ตอนนั่งในเมือง | Playtest Phase 3.5 |
| P2 | **ต้นทุนตีบวก +6 ขึ้นไป (×3)** | +10 ต้องใช้แร่รวม 5,839 ก้อน (E ≈ 1.2M บาท, A ≈ 11.7 พันล้าน) — อาจสูงเกินไปสำหรับ rank สูง | Phase 5 |
| P3 | **ATK อาวุธกลบ stat ช่วงท้าย** | Lv.70 Staff S +10 = 2,250 vs INT bonus 77 → stat แทบไม่มีผล | Phase 5 |
| P4 | **ไม่มีสกิลใหม่หลัง Lv.40** | ช่วง Lv.40–100 (~250 ชม.) ไม่มีอะไรปลดล็อก → ต้องมี Tier 2 ก่อน Phase 6 | ก่อน Phase 6 |
| P5 | **มูลค่า Gate D → C กระโดด ~30×** | ตั้งใจให้ C เป็น "เกมกิลด์" แต่ผู้เล่นเดี่ยวอาจรู้สึกตัน | Playtest Phase 4 |
| P6 | **Tank/Healer สอบแรงค์** | ใช้ตัวคูณ 0.7/0.33 — ทางเลือก: ทดสอบแบบอื่น (กันดาเมจ / ฮีล) | Playtest Phase 3.5 |
| P7 | **Render free sleep** | ถ้า keep-alive ไม่พอ/เกิน quota → ย้ายไป Cloudflare DO (Workers Paid $5/เดือน) | หลัง MVP |

---

**END OF GDD v5.1**
