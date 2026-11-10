# Game Design Document (GDD) — MASTER
# โครงการ: Thailand Leveling (ไทยแลนด์ เลเวลลิง)

**Version:** 5.0 FINAL (Complete Master Edition)
**Tech Stack:** Cloudflare D1 + Custom JWT
**Level Cap:** 100
**Last Updated:** 2026

---

## 📑 สารบัญ

**PART I — CORE GAME**
1. [Project Overview](#1-ข้อมูลภาพรวมโครงการ-project-overview)
2. [Core Gameplay Loop](#2-แกนลูปการเล่นหลัก-core-gameplay-loop)
3. [Character Creation](#3-ระบบสร้างตัวละคร-character-creation-system)
4. [Attributes & Vitals](#4-ระบบตัวละคร-สเตตัส-และทรัพยากร-attributes--vitals)
5. [Rank Assessment](#5-ระบบการประเมินแรงค์สมาคมฮันเตอร์-rank-assessment)
6. [Death, Hospital & Downed](#6-กฎการเสียชีวิต-ระบบโรงพยาบาล-และสถานะบาดเจ็บสาหัส)
7. [PvP Weapon Drop](#64-ระบบอาวุธหล่นจากการตายใน-pvp-pvp-weapon-drop)
8. [Economy & Jobs](#7-ระบบเศรษฐกิจ-การตีบวก-และการสนับสนุนอาชีพ-economy--jobs)

**PART II — GATE SYSTEM**
9. [Gate System](#8-ระบบ-gate-gate-system-v31)
10. [Guild Monopoly](#85-guild-monopoly--auction)
11. [Bangkok Map & HUD](#9-แผนที่เมืองกรุงเทพ-bkk_lobby-และระบบควบคุมสัมผัส)

**PART III — TECHNICAL**
12. [Client Rendering Optimization](#10-มาตรการป้องกันภาพแลคบนมือถือ-client-rendering-optimization)
13. [Server-Side Anti-Cheat](#11-ระบบความปลอดภัยและการป้องกันการโกง-server-side-anti-cheat)
14. [Anti-Lag Guardrails](#12-สรุปมาตรการป้องกันเซิร์ฟเวอร์หน่วง-anti-lag-guardrails-v3)
15. [Database (D1) & Network Protocol](#13-โครงสร้าง-database--network-protocol-cloudflare-d1)
16. [Development Milestones](#14-ลำดับขั้นการพัฒนา-development-milestones)

**PART IV — SYSTEMS**
17. [Chat System](#15-ระบบแชต-chat-system)
18. [EXP Curve & Monster Stats](#16-ระบบ-exp-curve--monster-stats-v31--cap-100)
19. [Class Skill Database (Tier 1)](#17-ระบบสกิลอาชีพ-class-skill-database-tier-1)
20. [Gate Encounter Design](#18-gate-encounter-design-v31)
21. [Endgame Content](#19-endgame-content-lv50100)
22. [Runestone Tier 2 (Placeholder)](#20-runestone-tier-2-skills--placeholder)

**PART V — WEAPONS & EQUIPMENT**
23. [Universal Weapon System](#21-ระบบอาวุธ-universal-weapon-system)
24. [Sword Database](#211-ดาบ-sword-database)
25. [Other Weapons (Preview)](#218-อาวุธอื่น-preview)

**PART VI — APPENDIX**
26. [ตัวเลขสำคัญที่ Lock แล้ว](#appendix-ตัวเลขสำคัญที่-lock-แล้ว)

---

# PART I — CORE GAME

---

## 1. ข้อมูลภาพรวมโครงการ (Project Overview)

* **ชื่อโครงการ:** Thailand Leveling
* **แนวเกม (Genre):** 2.5D Isometric Web MMORPG
* **ธีม:** แฟนตาซีร่วมสมัยอิง Solo Leveling ในกรุงเทพฯ มีประตูมิติ (Gate) ปรากฏกลางเมือง
* **แพลตฟอร์ม:** Web Browser (Mobile Landscape 100%)
* **สกุลเงิน:** **บาท (THB)**
* **งบประมาณ:** 0 บาท (Free-tier Tech Stack)
* **Tech Stack:**
  * **Frontend:** Vercel (HTML5 Canvas 2.5D Isometric, Web Audio 8-bit)
  * **Backend:** Render.com (Node.js + Express + Socket.io)
  * **Database:** **Cloudflare D1 (SQLite)** — 5M reads/day, 100K writes/day, 5GB
  * **Auth:** **Custom JWT** (bcrypt + access 15m + refresh 30d)
  * **Dev Env:** GitHub Codespaces + Claude Code CLI

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
[Gate สุ่มปรากฏ / กิลด์ประมูลสิทธิ์]
               │
               ├─► เข้า Gate (PvP: E ปิด, D+ เปิด)
               │     ├─ สายต่อสู้: ลุยก็อปลิน / บอส
               │     └─ สาย Miner: ขุดแร่มานา
               │
               ▼
[บาดเจ็บสาหัส / เสียชีวิต]
   ├── HP < 7% → Downed (drain 0.15%/วิ, 45 วิ timer)
   └── ตาย → โรงพยาบาล (1M, 4 ครั้งแรกฟรี)
        │
        ▼
[ผลรอบ 24 ชม.]
   ├── ชนะ: ปิด Gate, กิลด์รับภาษี + EXP
   └── แพ้: Dungeon Break (reward ×2)
```

---

## 3. ระบบสร้างตัวละคร (Character Creation System)

### 3.1 ขั้นตอน

1. **ตั้งชื่อ:** 3–12 ตัวอักษร → INSERT `usernames` (atomic)
2. **รูปลักษณ์:** เพศ × โทนผิว × ทรงผม (4×5 สี) × ชุด (3 แบบ)
3. **เลือกอาชีพ (6):** แสดง stat + starter weapon
4. **Awakening Cutscene:** บัตร Rank E → บันทึก D1 → เข้า bkk_lobby

### 3.2 ค่าสเตตัสเริ่มต้น (รวม 50 แต้ม)

| อาชีพ | STR | AGI | VIT | INT | PER | HP | MP | Starter Weapon | Prof |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :-: |
| **Fighter** | 14 | 9 | 12 | 6 | 9 | 260 | 90 | ดาบเหล็กสั้นสนิม (E) | 1.0 |
| **Assassin** | 9 | 15 | 8 | 6 | 12 | 180 | 90 | มีดสั้นพกพา (E) | 1.0 |
| **Mage** | 6 | 8 | 8 | 16 | 12 | 180 | 240 | คทาไม้ฝึกหัด (E) | 1.0 |
| **Tank** | 11 | 7 | 16 | 7 | 9 | 340 | 105 | ดาบสั้น + โล่ไม้ (E) | 1.0 |
| **Healer** | 6 | 8 | 11 | 14 | 11 | 240 | 210 | หนังสือสวดมนต์ (E) | 1.0 |
| **Miner** | 12 | 8 | 14 | 6 | 10 | 300 | 90 | อีเตอร์เก่า (E) | 1.0 |

*(Monarch of Shadow — GM only)*

---

## 4. ระบบตัวละคร สเตตัส และทรัพยากร

### 4.1 สเตตัสหลัก

| Stat | ผล |
| :--- | :--- |
| **STR** | ATK กายภาพ + Max Weight |
| **AGI** | ความเร็วเดิน + animation + หลบหลีก |
| **VIT** | Max HP + HP regen + ลด Fatigue |
| **INT** | Max MP + ATK เวท |
| **PER** | Crit rate + vision + โอกาสแร่หายาก |

### 4.2 สูตรคำนวณหลัก

$$\text{Max HP} = (\text{VIT} + \text{Level}) \times 20$$
$$\text{Max MP} = \text{INT} \times 15$$
$$\text{Max Weight} = 50 + (\text{STR} \times 5)\text{ กก.}$$
$$\text{Effective ATK} = \text{weapon\_atk} \times \text{prof} \times (1 + N \times 0.05)$$
$$\text{Stat Bonus} = \text{scaling\_stat} \times 0.5 \times \text{prof}$$
$$\text{Basic Damage} = \text{Effective ATK} + \text{Stat Bonus}$$
$$\text{Crit Rate} = \text{PER} \times 0.5\% \quad (\text{cap } 50\%)$$
$$\text{Crit Damage} = \text{Damage} \times 1.5$$
$$\text{Damage Taken} = \text{Incoming} \times \frac{100}{100 + \text{DEF}}$$

> **Proficiency (prof):** ดู §21 — 1.0 = ถนัด, 0.4 = ไม่ถนัด, 0.2 = ผิดสาย
> **Max Weight ใช้ร่วมกันทั้งเกม** (inventory เดียว)

### 4.3 ทรัพยากร

* **HP:** ตายเมื่อ 0 → Downed → Hospital
* **MP:** **ฟื้นจากโพชั่นเท่านั้น**
* **Fatigue (0–100%):**
  * ตี/สกิล/กลิ้ง/ขุด → เพิ่ม
  * **≥ 90%** = Exhausted (ใช้สกิลไม่ได้)
  * ฟื้น: นิ่ง −1%/3วิ, นั่ง −1%/1วิ, น้ำเปล่า −15%, ยาชูกำลัง −40–80%
  * **Lazy Evaluation:** Δt-based

### 4.4 Stat Points

* **+3 แต้ม/เลเวล** → Lv.100 ได้รวม **297 แต้ม**
* ไม่จำกัดเพดาน stat
* ไม่มี Respec ใน MVP

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

---

## 5. ระบบการประเมินแรงค์ (Rank Assessment)

การเลื่อนระดับแรงค์ (E → D → C → B → A → S) ที่สมาคมฮันเตอร์:

1. **เกณฑ์สเตตัส/เลเวล** ต้องถึงขั้นต่ำ
2. **Dummy Burst Test (Isolated):**
   * `socket.join("dummy_" + socket.id)`
   * นับถอยหลัง 5 วิ ระดมโจมตี
   * Total Burst Damage ถึงเกณฑ์ → ได้ตราแรงค์ใหม่
3. **ไม่มี PvP** → ไม่มี weapon drop

---

## 6. กฎการเสียชีวิต ระบบโรงพยาบาล และ Downed

### 6.1 Downed State (HP < 7%)

* ทรุดลง เคลื่อนที่ช้า 15% ใช้สกิล/ไอเทมไม่ได้
* **HP drain 0.15%/วิ** → ตายที่ ~45 วิ
* **PvP Immunity** ระหว่าง Downed
* **Healer เท่านั้น** กู้ได้
* หมดเวลา = ตาย → โรงพยาบาล

### 6.2 โรงพยาบาล

* ค่ารักษา **1,000,000 บาท** — **4 ครั้งแรกฟรี**
* ถ้าเงินไม่พอ → ติดลบ + "ลูกหนี้"
  * ความเร็ว −15%
  * รายได้ถูกหัก 50% ชำระหนี้

### 6.3 กฎของตก

* ตาย PvE: ของ/เงินไม่หาย
* ตาย PvP: อาวุธในมือหล่น (ดู §6.4)
* **Floor Item Cap:** 60 ชิ้น/แผนที่ (FIFO)
* เงินตกในจุดเดียวกันยุบรวมเป็นถุงเดียว

---

## 6.4 ระบบอาวุธหล่นจาก PvP (PvP Weapon Drop)

### 6.4.1 เงื่อนไขการหล่น

ต้องครบทุกข้อ:
1. HP = 0 จากผู้เล่นคนอื่น
2. Last Hit = player
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
* มีช่องกระเป๋าว่าง ≥ 1
* น้ำหนักไม่เกิน Max Weight
* **Priority ข้าม Gate ได้** (ผูก killerId ไม่ผูก map)

### 6.4.7 Anti-Exploit

* Win trading: kill ซ้ำ > 3/ชม. → flag GM
* Suicide: killerId = self → ไม่หล่น
* DoT: killerId = player → หล่น ✓

### 6.4.8 Party Protection

Party เดียวกัน = safe จาก PvP

---

## 7. ระบบเศรษฐกิจ การตีบวก และการสนับสนุนอาชีพ

### 7.1 ระบบตีบวก (Mana Enhancement)

* เฉพาะ **Rank D ขึ้นไป**
* **แร่เกรดตรงกับอุปกรณ์**
* **อัตราสำเร็จ 100%**
* สูตร:
  * +1 ถึง +5: $2^{N-1}$ → 1, 2, 4, 8, 16
  * +6 ขึ้นไป: ×3 → 48, 144, 432, 1,296, 3,888...

**Enhancement Bonus:**

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

### 7.2 วินมอเตอร์ไซค์ (Fast Travel)

* **50–1,000 บาท** ตามระยะ
* ลด Fatigue 10%
* Cooldown กันสแปม

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

| Rank | ขนาด | มูลค่า | Party | PvP | Timer | Timer หลัง 22:00 |
| :---: | :-: | :-: | :-: | :-: | :-: | :-: |
| **E** | 42×42 | 25K–50K | 1–4 | ❌ | 2 ชม. | **3 ชม.** |
| **D** | 48×48 | 75K–130K | 2–6 | ✅ | 4 ชม. | **6 ชม.** |
| **C** | 54×54 | 2.5M–7.8M | 4–10 | ✅ Auction | 8 ชม. | **12 ชม.** |
| **B** | 60×60 | 13M–39M | 8–20 | ✅ Auction | 12 ชม. | **18 ชม.** |
| **A** | 66×66 | 130M–520M | 15–20 | ✅ Auction | 18 ชม. | **27 ชม.** |
| **S** | 72×72+ | หลายพันล้าน | 20 (invite) | ✅ Invite | 24 ชม. | **36 ชม.** |

> **ทุกเลเวลเข้าได้ทุก Gate** (ไม่มี level requirement)

### 8.2 กฎการเกิด Gate

- Spawn: 1 Gate/ชม.
- Max Concurrent: 5
- **Cooldown หลัง Clear: 30 นาที**
- **Night Boost:** Gate spawn หลัง 22:00 ICT → timer +50%

**Rank Distribution:**

| Gate ที่มี | Rank |
| :-: | :--- |
| 0–1 | E 50%, D 30%, C 20% |
| 2 | D 40%, C 35%, B 20%, A 5% |
| 3 | C 40%, B 35%, A 20%, S 5% |
| 4 | B 35%, A 40%, S 25% |
| 5 | A 50%, S 50% |

### 8.3 การเข้าถึง Gate

| Rank | เงื่อนไข |
| :---: | :--- |
| **E–D** | ใครก็เข้าได้ |
| **C–A** | Auction (ถ้ามี bid) |
| **S** | Invitation from server |

### 8.4 Gate Auction & No-Bid

- Gate C+ เปิด Auction **5 นาที**
- RAM → บันทึก D1 ตอนจบ
- ราคาเริ่มต้น = 10% ของมูลค่า Gate
- **ถ้าไม่มีคน bid** → **"Public Gate"**
  * ใครก็เข้าได้
  * Drop ปกติ
  * ไม่มีภาษีกิลด์
  * PvP ยังเปิด

### 8.5 Guild Monopoly & Auction

- **ก่อตั้ง:** Rank B+ + **50,000,000 บาท** (cap 20)
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
  - **Dungeon Break** → มอนบุก bkk_lobby
  - ผู้เล่นใน Gate ถูกวาร์ปออก
- **Clear สำเร็จ:**
  - Gate ปิดถาวร
  - ภาษี 5% เข้า guild treasury
  - Spawn slot ใหม่หลัง 30 นาที

### 8.8 Completion Bonus

**5% ของ loot ที่ดรอปจริง** แจกเป็น baht ให้ทุกคนใน party เท่ากัน

- ตัวอย่าง: Gate C drop 5M → Bonus 250K ÷ 10 = 25K/คน

### 8.9 Death & Re-entry

- ตาย → respawn โรงพยาบาล
- **กลับเข้า Gate ได้ทันที** (ไม่มี CD)
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
| **กลาง** | ลานวงเวียนใหญ่ (spawn, Gate) |

**ขนาดแผนที่:**

| แผนที่ | Tiles |
| :--- | :-: |
| bkk_lobby | 24×24 |
| Gate E–S | 42×42 → 72×72+ |

### 9.2 กราฟิก Isometric

* Tile: 64×32 px (2:1)
* 8 ทิศ + Horizontal Mirroring (5 sprites)
* Collision แยกแกน X/Y (wall sliding)

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

---

# PART III — TECHNICAL

---

## 10. Client Rendering Optimization

1. **Sprite Sheet / Texture Atlas**
2. **Offscreen Canvas Pre-rendering** (ประหยัด ~70%)
3. **ขนาด Assets:** tile ≤ 64×32, ตัวละคร ≤ 64×64
4. **Vercel CDN**
5. **Tile Culling** (±2 tiles)

---

## 11. Server-Side Anti-Cheat

1. **Speed Hack:** $(\Delta x)^2 + (\Delta y)^2 \le (\text{MaxSpeed} \times \Delta t)^2$
   * Whitelist: taxi, respawn, gate enter/exit
2. **Attack CD:** `lastAttackTime`
3. **Action Distance:** ≤ 2.5 tiles
4. **Skill Validation:**
   * Shadow Step (3), Teleport (5), Charge (4) → distance + LoS
   * Burrow / Revive → flag + distance
   * Taunt → server aggro เท่านั้น
5. **Client → `{ skillId, targetId }`** เท่านั้น
6. **Silent GM:** token hash ใน env, log ทุกครั้ง
7. **Rate Limit:** 20 msg/วิ/ผู้เล่น

---

## 12. Anti-Lag Guardrails v3

1. **Socket.io Rooms** แยกตามแผนที่
2. **Dungeon Break Cap:** 20 ตัว
3. **Floor Item Cap:** 60/แผนที่
4. **Lazy Fatigue:** Δt-based
5. **In-Memory Buffer:** ขุด/ประมูล ใน RAM → D1 ตอนสรุป
   * Save cadence: login, levelup, rankup, disconnect, ทุก 5 นาที
   * **Target:** < 30 writes/ชม./ผู้เล่น
6. **Movement Sync:** 10–12 Hz + Lerp
7. **Shadow Minions:** tethered + client render

---

## 13. Database (D1) & Network Protocol

### 13.1 D1 SQL Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  gender TEXT CHECK(gender IN ('male','female')),
  job TEXT CHECK(job IN ('Fighter','Assassin','Mage','Tank','Healer','Miner')),
  hunter_rank TEXT DEFAULT 'E',
  is_monarch INTEGER DEFAULT 0,
  guild_id TEXT,
  current_title TEXT,
  skin_tone INTEGER DEFAULT 1,
  hair_style INTEGER DEFAULT 1,
  hair_color TEXT DEFAULT '#1a1a1a',
  outfit TEXT DEFAULT 'street_hoodie',
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  str INTEGER DEFAULT 0,
  agi INTEGER DEFAULT 0,
  vit INTEGER DEFAULT 0,
  int_stat INTEGER DEFAULT 0,
  per INTEGER DEFAULT 0,
  hp INTEGER,
  max_hp INTEGER,
  mp INTEGER,
  max_mp INTEGER,
  fatigue REAL DEFAULT 0,
  debt INTEGER DEFAULT 0,
  baht INTEGER DEFAULT 10000,
  mana_crystals INTEGER DEFAULT 0,
  loadout_slot1 TEXT,
  loadout_slot2 TEXT,
  loadout_slot3 TEXT,
  free_respawn_count INTEGER DEFAULT 4,
  created_at INTEGER DEFAULT (unixepoch()),
  last_login INTEGER,
  last_daily_reset INTEGER,
  is_banned INTEGER DEFAULT 0
);
CREATE INDEX idx_users_guild ON users(guild_id);
CREATE INDEX idx_users_rank ON users(hunter_rank);

CREATE TABLE usernames (
  name TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  revoked INTEGER DEFAULT 0
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE equipment (
  user_id TEXT PRIMARY KEY,
  weapon_id TEXT, weapon_enhance INTEGER DEFAULT 0,
  armor_id TEXT, armor_enhance INTEGER DEFAULT 0,
  helmet_id TEXT, helmet_enhance INTEGER DEFAULT 0,
  boots_id TEXT, boots_enhance INTEGER DEFAULT 0,
  accessory_id TEXT, accessory_enhance INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  enhance INTEGER DEFAULT 0,
  slot_index INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_inventory_user ON inventory(user_id);

CREATE TABLE storage_box (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  enhance INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE guilds (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  leader_id TEXT NOT NULL,
  member_cap INTEGER DEFAULT 20,
  treasury INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE guild_members (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at INTEGER DEFAULT (unixepoch()),
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
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_tx_user ON transactions(user_id);
```

### 13.2 Socket Events

| Event | From | Payload |
| :--- | :--- | :--- |
| `register` / `login` | Client | credentials |
| `authOk` / `authFail` | Server | result |
| `tokenRefresh` | Client | refreshToken |
| `joinMap` | Client | `{ mapId }` |
| `playerMove` / `playerMoved` | C/S | `{ x, y, dir }` |
| `castSkill` | Client | `{ skillId, targetId }` |
| `skillCast` / `skillFailed` | Server | result |
| `setLoadout` / `loadoutSaved` | C/S | `{ slots }` |
| `skillUnlocked` | Server | `{ skillId, level }` |
| `itemDropped` / `itemDespawned` | Server | item info |
| `pickupItem` / `pickupSuccess` / `pickupFailed` | C/S | item |
| `itemPriorityExpired` | Server | itemId |
| `chatMessage` / `chatReceived` | C/S | `{ channel, text }` |
| `reportPlayer` | Client | `{ targetId, reason }` |
| `requestEnhance` | Client | `{ itemId, materialId }` |
| `takeTaxi` | Client | `{ targetZoneId }` |
| `createContract` | Client | `{ gateId, rewardBaht }` |
| `adminCommand` | Client | `{ token, command, target }` |
| `gateSpawned` | Server | `{ gateId, rank, x, y }` |
| `enterGate` | Client | `{ gateId }` |
| `gateCleared` / `gateFailed` | Server | result |
| `auctionBid` | Client | `{ gateId, amount }` |
| `dungeonBreak` | Server | `{ gateRank, mobs }` |

---

## 14. Development Milestones

| Phase | เนื้อหา |
| :--- | :--- |
| **Phase 1: Core Base** | Canvas 2.5D, Dynamic Joystick, Map 24×24, Wall Sliding |
| **Phase 2: Character & Auth** | Character Creation, **D1 + Custom JWT**, HP/MP/Fatigue |
| **Phase 3: Combat & Death** | Goblin AI, Anti-Cheat, Downed, Revive, Hospital, PvP Drop |
| **Phase 4: Gate & Guild** | Gate spawn, Auction, Mining, Contract Board, Dungeon Break |
| **Phase 5: Enhancement & GM** | ตีบวก, วิน, ฉายา, Silent GM, **Weapon System** |
| **Phase 6: Endgame** | S+/SS/SSS gates, PvP ranking |
| **Phase 7: Polish** | Cosmetic, Achievement, Guild Wars |

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
* **RAM 50 msg/ช่อง**
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

## 16. ระบบ EXP Curve & Monster Stats — Cap 100

### 16.1 หลักการ

| หัวข้อ | ค่า |
| :--- | :--- |
| Level Cap | **100** |
| Total EXP Lv.1→100 | **~61,873,750** |
| Playtime Lv.1→100 | **250–400 ชั่วโมง** |
| Playtime Lv.1→50 | 150–250 ชม. |
| Playtime Lv.50→100 | 100–150 ชม. |

### 16.2 สูตร EXP

```
Lv.1–9:   EXP_next(L) = 100 × L
Lv.10–29: EXP_next(L) = 50 × L²
Lv.30–49: EXP_next(L) = 300 × L²
Lv.50–99: EXP_next(L) = 50 × L² + 750,000
```

### 16.3 ตาราง EXP Highlights

| Level | EXP to Next | Cumulative |
| :-: | :-: | :-: |
| 1 | 100 | 100 |
| 10 | 5,000 | 9,500 |
| 20 | 20,000 | 133,750 |
| 30 | 270,000 | 688,000 |
| 40 | 480,000 | 4,493,500 |
| 50 | 875,000 | 9,994,000 |
| 60 | 930,000 | 18,997,750 |
| 70 | 995,000 | 28,658,750 |
| 80 | 1,070,000 | 39,002,000 |
| 90 | 1,155,000 | 50,077,500 |
| 99 | 1,240,050 | 61,873,750 |
| **100** | **CAP** | |

### 16.4 EXP จาก Gate

| Rank | EXP/Clear |
| :---: | :-: |
| **E** | **1,000** |
| **D** | **8,000** |
| **C** | **80,000** |
| B | 500,000 |
| A | 3,000,000 |
| S | 10,000,000 |

### 16.5 EXP จากมอนสเตอร์

| Rank | Normal | Elite | Boss | World Boss |
| :---: | :-: | :-: | :-: | :-: |
| E | 15 | 50 | 100 | — |
| D | 80 | 300 | 800 | — |
| C | 300 | 1,500 | 3,000 | — |
| B | 1,500 | 8,000 | 20,000 | — |
| A | 8,000 | 40,000 | 150,000 | — |
| S | 30,000 | 150,000 | 800,000 | 3,000,000 |

---

## 17. ระบบสกิลอาชีพ (Class Skill Database — Tier 1)

### 17.1 หลักการ

| หัวข้อ | กฎ |
| :--- | :--- |
| จำนวน | **6 สกิล/อาชีพ** |
| ช่องติดตั้ง | **3 ช่อง** |
| ปลดล็อค | Lv.1, 1, 10, 20, 30, 40 |
| Upgrade | ❌ ไม่มีใน MVP |
| MP | โพชั่นเท่านั้น |
| Fatigue | ทุกสกิลกิน |

### 17.2 Fighter

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Slash | 1 | 5 | 2s | 1.5× | ดาเมจเป้าเดียว |
| 2 | Whirlwind | 1 | 20 | 8s | 1.8× | AoE รอบตัว |
| 3 | Charge | 10 | 15 | 10s | 1.5× | พุ่ง + stun 1s |
| 4 | Ground Slam | 20 | 30 | 15s | 2.0× | AoE + slow 30% |
| 5 | Berserk | 30 | 40 | 45s | — | +40% ATK 15s |
| 6 | Last Stand | 40 | 60 | 90s | — | HP<30% → ฟื้น 40% |

### 17.3 Assassin

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Stab | 1 | 5 | 2s | 1.5× | เป้าเดียว |
| 2 | Shadow Step | 1 | 25 | 10s | 2.5× | วาร์ปหลัง + backstab |
| 3 | Poison Blade | 10 | 20 | 12s | DoT | 10/วิ × 5 + −DEF |
| 4 | Smoke Bomb | 20 | 30 | 20s | — | Blind + invisible |
| 5 | Backstab | 30 | 35 | 25s | 3.0× | crit 100% |
| 6 | Assassinate | 40 | 70 | 90s | 4.0× | Execute (<20% HP) |

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

### 17.6 Healer

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Heal | 1 | 15 | 3s | INT×3 | HP |
| 2 | Purify | 1 | 20 | 10s | — | ล้าง debuff |
| 3 | Blessing | 10 | 30 | 15s | INT×2 | AoE heal |
| 4 | Sanctuary | 20 | 40 | 30s | — | Area 5%/วิ |
| 5 | Divine Light | 30 | 45 | 25s | INT×5 | Heavy heal |
| 6 | Revive | 40 | 80 | 60s | — | กู้ Downed |

### 17.7 Miner

| # | ชื่อ | Lv. | MP | CD | Mult | เอฟเฟกต์ |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | Pick Strike | 1 | 5 | 2s | 1.5× | เป้าเดียว |
| 2 | Mining Boost | 1 | 15 | 30s | — | +50% ขุด 30s |
| 3 | Vein Sense | 10 | 20 | 20s | — | แสดงแร่ 5s |
| 4 | Stone Skin | 20 | 30 | 30s | — | +100% DEF |
| 5 | Burrow | 30 | 25 | 15s | — | หายตัว 3s |
| 6 | Earthquake | 40 | 60 | 60s | 2.5× | AoE + stun 1.5s |

### 17.8 Skill Damage & Proficiency

**Physical Skills** (Fighter/Assassin/Tank/Miner):
$$\text{Skill Damage} = (\text{Effective ATK} + \text{Stat Bonus}) \times \text{multiplier}$$

**Magic Skills** (Mage/Healer):
$$\text{Magic Damage} = \text{INT} \times \text{multiplier} \times \text{prof}$$

**Healing Skills** (Healer):
$$\text{Heal} = \text{INT} \times \text{multiplier} \times \text{prof}$$

> Healer ถือ Tome (prof 1.0) = heal เต็ม, ถือดาบ (prof 0.4) = heal 40%

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

### 18.1 Gate E — Green Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 2 ชม. (3 ชม. หลัง 22:00) |
| PvP | ❌ |
| Monster | 20–25 |
| Mining | 10 nodes (Mana Stone E) |
| EXP | 1,000 |
| Loot | 30K avg |

**Boss:** Goblin Chief (Lv.8) — **Leader distribute** 1 Boss Ear

---

### 18.2 Gate D — Blue Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 4 ชม. (6 ชม. หลัง 22:00) |
| Mining | 15 nodes (Mana Stone D) |
| EXP | 8,000 |
| Loot | 100K avg |

**Boss:** Goblin Lord (Lv.15)

---

### 18.3 Gate C — Yellow Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 8 ชม. (12 ชม. หลัง 22:00) |
| Mining | 20 nodes (Mana Crystal C) |
| EXP | 80,000 |
| Loot | 5M avg |

**Boss:** Spider Queen (Lv.25) — **Boss Mana Core C 250K**

---

### 18.4 Gate B — Red Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 12 ชม. (18 ชม. หลัง 22:00) |
| Mining | 40 nodes (Mana Crystal B + Rune Shard) |
| EXP | 500,000 |
| Loot | 25M avg |

**Boss:** Demon Knight + Demon Lord — **Boss Core B ×3 (Leader distribute)**

---

### 18.5 Gate A — Black Gate

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 18 ชม. (27 ชม. หลัง 22:00) |
| Mining | 60 nodes (Mana Crystal A + Runestone A) |
| EXP | 3,000,000 |
| Loot | 300M avg |

**Special:**
- 3 layers: Mini → Mid → Final
- Dragon mechanics (fly/breath/adds)
- **Enrage Timer:** 15 นาที/Boss → +200% ATK, +50% Speed

---

### 18.6 Gate S — Disaster Class

| หัวข้อ | ค่า |
| :--- | :--- |
| Timer | 24 ชม. (36 ชม. หลัง 22:00) |
| Party | 20 (Invite) |
| Mining | 100 nodes (God-tier) |
| EXP | 10,000,000 |
| **World Boss HP** | **10,000,000** |
| Loot | หลายพันล้าน |

**World Boss:**
- 20 คน × ~250 DPS × ~2,100 วิ = **~35 นาที**
- 3 phases (100%, 50%, 20% HP)
- Phase 2: +10 adds
- Phase 3: Enrage
- **HP Regen:** 1%/วิ ถ้าไม่มีคนโจมตี 30 วิ

**Special:**
- Server-wide broadcast
- Title "Gate Breaker"
- ภาษี 10% จากทั้งเซิร์ฟ 1 สัปดาห์

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

**เมื่อ Gate หมดเวลา:**

| Rank | Mob | Lv | HP | ATK | Count |
| :---: | :--- | :-: | :-: | :-: | :-: |
| E | Lesser Goblin | 5 | 80 | 5 | 10 |
| D | Goblin Warrior | 12 | 400 | 20 | 15 |
| C | Orc Soldier | 22 | 1,500 | 60 | 18 |
| B | Demon Soldier | 32 | 8,000 | 200 | 20 |
| A | Demon Captain | 42 | 25,000 | 400 | 20 |
| S | Ancient Dragon + adds | 50 | 5M + 500K×5 | 2,000 | 1+5 |

**Reward:** ฆ่ามอน = **EXP × 2 + drop rate × 2**

**Safe Zone:** Lv < (Break Lv − 10) → immune
**Duration:** 30 นาที
**Clear:** +100% EXP Gate นั้น + achievement

---

### 18.9 Boss Drop Distribution

**Leader Distribute:**
- Guild/Party Leader แจก Boss drops
- UI: loot roll → leader เลือก
- **24 ชม.** ถ้าไม่แจก → random อัตโนมัติ
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

## 19. Endgame Content (Lv.50–100)

### 19.1 Gate Tiers เพิ่มเติม

| Rank | Lv. | Timer | EXP | Loot |
| :---: | :-: | :-: | :-: | :-: |
| **S+** | 60+ | 30 ชม. | 30,000,000 | 5–10 พันล้าน |
| **SS** | 75+ | 36 ชม. | 80,000,000 | 20–50 พันล้าน |
| **SSS** | 90+ | 48 ชม. | 200,000,000 | 100+ พันล้าน |

**Spawn:**
- S+: ทุก 6 ชม. (max 2)
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

> **Status:** 🔜 รอออกแบบ

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

### 21.2 Proficiency Matrix

**Scale:** 1.0 = ถนัด / 0.7 = ใช้ได้ / 0.4 = ไม่ถนัด / 0.2 = ผิดสาย

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

### 21.5 ตัวอย่าง: Fighter Lv.50 (STR 161)

| อาวุธ | Base ATK | Prof | Effective ATK | Stat Bonus | **Total** |
| :--- | :-: | :-: | :-: | :-: | :-: |
| Shortsword +10 (S) | 1,200 | 1.0 | 1,800 | 80.5 | **1,880** |
| **Longsword +10 (S)** | 1,800 | 1.0 | 2,700 | 80.5 | **2,780** |
| **Greatsword +10 (S)** | 2,800 | 1.0 | 4,200 | 80.5 | **4,280** |
| Dagger +10 (S) | 1,000 | 0.7 | 1,050 | 35 | 1,085 |
| Staff +10 (S) | 1,500 | 0.3 | 675 | 7.5 | 682 |

### 21.6 ตัวอย่าง: Mage Lv.50 (INT 313)

| อาวุธ | Base ATK | Prof | Effective ATK | Stat Bonus | **Total** |
| :--- | :-: | :-: | :-: | :-: | :-: |
| Shortsword +10 (S) | 1,200 | 0.4 | 720 | 1.2 | 721 |
| Greatsword +10 (S) | 2,800 | 0.2 | 840 | 0.6 | 841 |
| **Staff +10 (S)** | 1,500 | **1.0** | 2,250 | 156.5 | **2,406** |
| Dagger +10 (S) | 1,000 | 0.4 | 600 | 4 | 604 |

> Mage ถือ Greatsword = 841 (ใช้ได้แต่ไม่คุ้ม) — **Staff ดีกว่า 3 เท่า**

### 21.7 Starter Weapons Damage (Lv.1)

| อาชีพ | Starter | ATK | Prof | Stat | **Lv.1 Damage** |
| :--- | :--- | :-: | :-: | :-: | :-: |
| Fighter (STR 14) | Shortsword E | 5 | 1.0 | 7.0 | **12.0** |
| Assassin (AGI 15) | Dagger E | 5 | 1.0 | 7.5 | **12.5** |
| Mage (INT 16) | Staff E | 4 | 1.0 | 8.0 | **12.0** |
| Tank (STR 11) | Shortsword E | 4 | 1.0 | 5.5 | **9.5** |
| Healer (INT 14) | Tome E | 3 | 1.0 | 7.0 | **10.0** |
| Miner (STR 12) | Pickaxe E | 5 | 1.0 | 6.0 | **11.0** |

---

## 21.1 ดาบ (Sword Database)

### ประเภทอาวุธ

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

### Rank C (Lv.20–30)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบมานาสั้น** | Short | **40** | 3 kg | +10% AS, +5% crit, +5% mana | 1,000,000 | Orc Captain 15% |
| **ดาบคริสตัลยาว** | Long | **55** | 7 kg | +5% crit | 1,500,000 | Orc Captain 10%, Spider Queen 20% |
| **ดาบใหญ่คริสตัล** | Great | **80** | 14 kg | −10% AS, +15% vs boss | 2,500,000 | Spider Queen 15% |

### Rank B (Lv.30–40)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบรูนสั้น** | Short | **100** | 3 kg | +10% AS, +10% crit | 5,000,000 | Demon Captain 10% |
| **ดาบปีศาจยาว** | Long | **150** | 8 kg | +10% crit, **Lifesteal 3%** | 10,000,000 | Demon Mage 8%, Demon Lord 20% |
| **ดาบใหญ่ปีศาจ** | Great | **220** | 15 kg | −10% AS, +25% vs boss, **Bleed 5/วิ × 5 วิ** | 20,000,000 | Demon Lord 15% |

### Rank A (Lv.40–50)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบมังกรสั้น** | Short | **350** | 4 kg | +15% AS, +15% crit, +10% fire | 80,000,000 | Dragon 10% |
| **ดาบมังกรยาว** | Long | **500** | 8 kg | +15% crit, **Lifesteal 5%**, +15% fire | 150,000,000 | Dragon 15% |
| **ดาบใหญ่มังกร** | Great | **750** | 16 kg | −10% AS, **+40% vs boss**, +20% fire | 250,000,000 | Dragon Lord 10% |

### Rank S (Lv.50+)

| ชื่อ | Type | ATK | Weight | Passive | ราคา | Drop |
| :--- | :-: | :-: | :-: | :--- | :-: | :--- |
| **ดาบเงาสั้น** *(Monarch's Edge)* | Short | **1,200** | 3 kg | +20% AS, +25% crit, Lifesteal 8%, +20% shadow | 2,000,000,000 | Gate S 5% |
| **ดาบสวรรค์ยาว** *(Celestial Blade)* | Long | **1,800** | 8 kg | +25% crit, Lifesteal 10%, +30% holy | 3,000,000,000 | Gate S 5% |
| **ดาบทำลายล้าง** *(Ragnarok)* | Great | **2,800** | 18 kg | −5% AS, +60% vs boss, +30% crit dmg | 5,000,000,000 | Gate S 3% |

### Damage Scaling ตัวอย่าง (Fighter Lv.50, STR 161, prof 1.0)

| ดาบ | ATK Base | Effective ATK | Stat Bonus | **Basic** | Skill 1.5× | Crit 1.5× |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| ดาบเหล็กสั้น +0 (E) | 5 | 5 | 80.5 | 85.5 | 128 | 192 |
| ดาบฮันเตอร์ยาว +5 (D) | 27.5 | 27.5 | 80.5 | 108 | 162 | 243 |
| ดาบคริสตัลยาว +10 (C) | 82.5 | 82.5 | 80.5 | 163 | 245 | 367 |
| ดาบปีศาจยาว +10 (B) | 225 | 225 | 80.5 | 305 | 458 | 687 |
| ดาบมังกรยาว +10 (A) | 750 | 750 | 80.5 | 830 | 1,245 | 1,868 |
| ดาบสวรรค์ยาว +10 (S) | 2,700 | 2,700 | 80.5 | 2,780 | 4,170 | 6,255 |

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

## 21.8 อาวุธอื่น (Preview)

> **Phase 5+** — ยังไม่ implement ใน MVP

### Dagger (มีดสั้น) — Assassin สาย
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | มีดสั้นพกพา | 5 | +15% AS, +10% crit |
| D | มีดเหล็กกล้า | 12 | +15% AS, +15% crit |
| C | มีดมานา | 35 | +20% AS, +20% crit, Poison |
| B | มีดปีศาจ | 90 | +25% AS, +25% crit, Lifesteal 3% |
| A | มีดมังกร | 300 | +30% AS, +30% crit, +shadow |
| S | มีดเงา | 1,000 | +40% AS, +40% crit, Lifesteal 8% |

### Staff (คทา) — Mage สาย
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | คทาไม้ฝึกหัด | 4 | +5% magic dmg |
| D | คทาคริสตัล | 15 | +10% magic dmg |
| C | คทามานา | 45 | +15% magic dmg, +5% MP |
| B | คทาปีศาจ | 130 | +20% magic dmg, +10% MP |
| A | คทามังกร | 400 | +30% magic dmg, +15% MP |
| S | คทาสวรรค์ | 1,500 | +40% magic dmg, +20% MP |

### Tome (หนังสือสวด) — Healer สาย
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | หนังสือสวดมนต์ | 3 | +10% heal |
| D | ตำราศักดิ์สิทธิ์ | 10 | +15% heal |
| C | ตำรามานา | 30 | +20% heal, +5% MP |
| B | ตำราปีศาจ | 80 | +25% heal, +10% MP |
| A | ตำรามังกร | 250 | +35% heal, +15% MP |
| S | ตำราสวรรค์ | 800 | +50% heal, +25% MP |

### Mace (กระบอง) — Tank สาย
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | กระบองไม้ | 6 | +5% stun |
| D | กระบองเหล็ก | 20 | +10% stun |
| C | กระบองมานา | 55 | +15% stun, +5% DEF |
| B | กระบองปีศาจ | 160 | +20% stun, +10% DEF |
| A | กระบองมังกร | 500 | +25% stun, +15% DEF |
| S | กระบองสวรรค์ | 1,500 | +30% stun, +25% DEF |

### Pickaxe (อีเตอร์) — Miner สาย
| Rank | ชื่อ | ATK | Passive |
| :---: | :--- | :-: | :--- |
| E | อีเตอร์เก่า | 5 | +10% mining speed |
| D | อีเตอร์เหล็ก | 18 | +15% mining speed |
| C | อีเตอร์มานา | 50 | +25% mining speed, +5% rare |
| B | อีเตอร์ปีศาจ | 140 | +35% mining speed, +10% rare |
| A | อีเตอร์มังกร | 450 | +50% mining speed, +20% rare |
| S | อีเตอร์สวรรค์ | 1,300 | +75% mining speed, +30% rare |

---

## 21.9 Endgame Weapons (Phase 6+)

| ชื่อ | Tier | ATK | Passive |
| :--- | :-: | :-: | :--- |
| **Void Blade** | S+ | 3,000 | +30% crit, +20% dmg vs S+ |
| **Astral Sword** | SS | 5,000 | +40% crit, +30% dmg vs SS |
| **Genesis Sword** | SSS | **10,000** | **Unique World Item** |

**Drop:** Gate S+ / SS / SSS world boss (3–5%)

---

# PART VI — APPENDIX

---

## Appendix: ตัวเลขสำคัญที่ Lock แล้ว

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
| ค่ารักษา | 1,000,000 (4 ครั้งแรกฟรี) |
| ค่าตั้งกิลด์ | 50,000,000 |
| ค่าวิน | 50–1,000 |

### Combat
| รายการ | ค่า |
| :--- | :-: |
| Downed threshold | HP < 7% |
| Downed drain | 0.15%/วิ |
| Downed timer | 45 วิ |
| PvP Priority | 15 วิ |
| Floor despawn | 15 นาที |
| Floor cap | 60/แผนที่ |
| Crit cap | 50% |

### Level/EXP
| รายการ | ค่า |
| :--- | :-: |
| Level cap | **100** |
| Stat/Level | +3 |
| EXP Lv.1→50 | 9,994,000 |
| EXP Lv.50→100 | 51,879,750 |
| **EXP Lv.1→100** | **~61,873,750** |
| Playtime | 250–400 ชม. |

### Gate
| รายการ | ค่า |
| :--- | :-: |
| Gate E PvP | ปิด |
| Cooldown หลัง clear | 30 นาที |
| Night boost | +50% (spawn หลัง 22:00) |
| Level req | **ไม่มี** |
| No-bid Gate C+ | ฟรี |
| Re-entry หลังตาย | ทันที |
| Enrage timer | 15 นาที/Boss |
| Dungeon Break reward | ×2 |
| Completion Bonus | 5% ของ drop จริง |

### Weapons (Sword)
| Rank | Longsword ATK | ราคา |
| :---: | :-: | :-: |
| E | 8 | 5,000 |
| D | 22 | 80,000 |
| C | 55 | 1.5M |
| B | 150 | 10M |
| A | 500 | 150M |
| S | 1,800 | 3B |

### Proficiency
| Scale | ความหมาย |
| :-: | :--- |
| 1.0 | ถนัด |
| 0.9 | เกือบถนัด |
| 0.7 | ใช้ได้ |
| 0.4 | ไม่ถนัด |
| 0.2 | ผิดสาย |

### D1 Quota Target
| รายการ | Target |
| :--- | :-: |
| Writes/player/hour | < 30 |
| Reads/player/hour | < 100 |
| Save cadence | login, levelup, rankup, disconnect, ทุก 5 นาที |

---

**END OF GDD v5.0 MASTER FINAL**