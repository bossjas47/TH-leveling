#!/usr/bin/env python3
"""ตรวจความสอดคล้องของ shared/balance.json และพิมพ์ตารางที่ GDD อ้างถึง

ใช้: python3 tools/validate_balance.py          # ตรวจ + พิมพ์ตาราง
     python3 tools/validate_balance.py --quiet  # ตรวจอย่างเดียว (ใช้ใน CI)

ตาราง EXP / ดาเมจ / Lv.1 ใน GDD v5.1 ต้องตรงกับผลของสคริปต์นี้เสมอ
ถ้าแก้ balance.json แล้วตัวเลขเปลี่ยน ให้อัปเดต GDD ตาม
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
B = json.loads((ROOT / "shared" / "balance.json").read_text(encoding="utf-8"))
QUIET = "--quiet" in sys.argv
errors = []


def check(cond, msg):
    if not cond:
        errors.append(msg)


def out(*a):
    if not QUIET:
        print(*a)


def round_sig(x, sig=3):
    if x == 0:
        return 0
    d = int(math.floor(math.log10(abs(x)))) - sig + 1
    return int(round(x / 10 ** d) * 10 ** d) if d > 0 else int(round(x))


def exp_next(level):
    return round_sig(100 * level ** 2.2, 3)


def effective_atk(atk, prof, enh):
    return atk * prof * (1 + enh * B["enhancement"]["atk_bonus_per_level"])


def basic_damage(atk, prof, enh, stat):
    return effective_atk(atk, prof, enh) + stat * 0.5 * prof


def ref_main(cls, level):
    c = B["classes"][cls]
    return c[c["main_stat"]] + B["reference_build"]["main_per_level"] * (level - 1)


# ---- 1. ค่าเริ่มต้นอาชีพ ----
out("== §3.2 ค่าสเตตัสเริ่มต้น ==")
for name, c in B["classes"].items():
    total = c["str"] + c["agi"] + c["vit"] + c["int"] + c["per"]
    check(total == B["starting_stat_total"], f"{name}: stat รวม {total} != 50")
    check(c["starter_weapon"] in B["weapons"], f"{name}: ไม่พบ starter weapon {c['starter_weapon']}")
    hp = (c["vit"] + 1) * 20
    mp = c["int"] * 15
    out(f"{name:9s} HP {hp:4d}  MP {mp:4d}")

# ---- 2. Lv.1 damage ----
out("\n== §21.7 Lv.1 Damage (starter +0) ==")
for name, c in B["classes"].items():
    w = B["weapons"][c["starter_weapon"]]
    prof = B["proficiency"]["matrix"][name][w["type"]]
    stat = c[B["proficiency"]["scaling_stat"][w["type"]]]
    check(prof == 1.0, f"{name}: starter weapon prof ต้องเป็น 1.0 (ได้ {prof})")
    out(f"{name:9s} {w['name']:<16s} ATK {w['atk']:>2d}  stat {stat:>2d}  dmg {basic_damage(w['atk'], prof, 0, stat):.1f}")

# ---- 3. EXP curve ----
out("\n== §16.3 EXP ==")
cum = 0
hours = 0.0
highlights = {1, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 99}
cum_at = {}
for lv in range(1, B["meta"]["level_cap"]):
    cum += exp_next(lv)
    hours += 0.06 * lv
    cum_at[lv] = cum
    if lv in highlights:
        out(f"Lv{lv:3d}  next {exp_next(lv):>10,}  cum(→Lv{lv + 1}) {cum:>12,}  ~{hours:6.1f} h")
out(f"TOTAL Lv1→100 = {cum:,}  (~{hours:.0f} h)")
prev = 0
for lv in range(1, 100):
    check(exp_next(lv) > prev, f"EXP curve ไม่เพิ่มขึ้นที่ Lv{lv}")
    if lv > 5:  # ช่วง Lv1–5 ตัวเลขเล็ก อัตราส่วนสูงเป็นปกติ
        check(exp_next(lv) / prev < 1.6, f"EXP กระโดดเกิน 1.6x ที่ Lv{lv}")
    prev = exp_next(lv)

# ---- 4. Gate EXP sanity: clear หนึ่งครั้งต้องไม่เกิน 1 เลเวลที่ Lv แนะนำต่ำสุด (ยกเว้น E) ----
out("\n== Gate clear EXP เทียบ EXP_next ที่ Lv แนะนำ ==")
for rank, g in B["gates"]["table"].items():
    lo = max(1, g["recommended_level"][0])
    ratio = g["exp_clear"] / exp_next(lo)
    out(f"Gate {rank:3s} clear {g['exp_clear']:>9,} = {ratio:.2f} เลเวลที่ Lv{lo}")
    if rank != "E":
        check(ratio <= 1.0, f"Gate {rank}: EXP clear เกิน 1 เลเวลที่ Lv{lo}")
for rank, g in B["gates"]["endgame"].items():
    lv = min(99, g["recommended_level"])
    ratio = g["exp_clear"] / exp_next(lv)
    out(f"Gate {rank:3s} clear {g['exp_clear']:>9,} = {ratio:.2f} เลเวลที่ Lv{lv}")
    check(ratio <= 1.0, f"Gate {rank}: EXP clear เกิน 1 เลเวล")
check(sum(B["gates"]["high_pool"]["distribution"].values()) == 1.0, "high_pool distribution รวมไม่เท่ากับ 1")

# ---- 5. Monster time-to-kill (reference Fighter, longsword rank เดียวกัน +5) ----
out("\n== Monster TTK (Fighter reference build, Longsword +5) ==")
for rank in ["E", "D", "C", "B", "A", "S"]:
    m = B["monsters"][rank]
    lv = m["level"]
    w = B["weapons"][f"sword_long_{rank.lower()}"]
    dmg = basic_damage(w["atk"], 1.0, 5, ref_main("Fighter", lv))
    k = 100 + lv * 20
    dmg_after_def = dmg * k / (k + m["def"])
    hits = m["normal"]["hp"] / dmg_after_def
    vit = B["classes"]["Fighter"]["vit"] + (lv - 1)
    hp = (vit + lv) * 20 + B["armor_sets"][rank]["hp"]
    taken = m["normal"]["atk"] * k / (k + B["armor_sets"][rank]["def"])
    out(f"{rank}: Lv{lv:2d} dmg {dmg:7.1f} → ตีมอนปกติ {hits:4.1f} ครั้ง | HP ผู้เล่น {hp:6,} โดนตี {taken / hp * 100:4.1f}%/ครั้ง")
    check(2.5 <= hits <= 7, f"Monster {rank}: TTK {hits:.1f} hits นอกช่วง 2.5–7")
    check(0.03 <= taken / hp <= 0.10, f"Monster {rank}: ดาเมจต่อ HP {taken / hp:.3f} นอกช่วง 3–10%")

# ---- 6. Rank assessment ผ่านได้จริงด้วย reference build ----
out("\n== Rank Assessment (Fighter reference, อาวุธ rank ก่อนหน้า Longsword) ==")
prev_rank = {"D": "E", "C": "D", "B": "C", "A": "B", "S": "A"}
enh_for = {"D": 0, "C": 5, "B": 7, "A": 7, "S": 7}
for rank, req in B["hunter_ranks"]["assessment"]["requirements"].items():
    lv = req["level"]
    w = B["weapons"][f"sword_long_{prev_rank[rank].lower()}"]
    dmg = basic_damage(w["atk"], 1.0, enh_for[rank], ref_main("Fighter", lv))
    burst = dmg * (5 + 1.5 + 1.8)
    out(f"→{rank}: Lv{lv} burst ~{burst:,.0f} vs เกณฑ์ {req['burst']:,}")
    check(burst >= req["burst"], f"Rank {rank}: reference build ทำ burst ไม่ถึงเกณฑ์")

# ---- 7. Enhancement ----
mats = B["enhancement"]["materials"]
check(len(mats) == B["enhancement"]["max_level"], "จำนวนขั้นวัตถุดิบตีบวกไม่ตรงกับ max_level")
check(mats[:5] == [2 ** i for i in range(5)], "+1..+5 ต้องเป็น 2^(N-1)")
check(all(mats[i] == mats[i - 1] * 3 for i in range(5, len(mats))), "+6 ขึ้นไปต้อง x3")

# ---- 8. Proficiency ครบทุกช่อง ----
types = set(B["proficiency"]["scaling_stat"])
for cls, row in B["proficiency"]["matrix"].items():
    check(set(row) == types, f"{cls}: proficiency ไม่ครบทุกประเภทอาวุธ")
    for v in row.values():
        check(f"{v:.1f}" in B["proficiency"]["labels"], f"{cls}: ค่า prof {v} ไม่มี label")

if errors:
    print("\n❌ พบปัญหา:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("\n✅ balance.json ผ่านการตรวจทั้งหมด" if not QUIET else "OK")
