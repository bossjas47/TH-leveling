// สูตรต่อสู้ (GDD §4.2, §21.4) — ตัวเลขทั้งหมดมาจาก balance.json
const STAT = { str: 'str', agi: 'agi', int: 'int_stat' };

// u = แถว users (job, str, agi, int_stat, ...)
export function basicDamage(B, u, weaponId, enhance = 0) {
  const w = B.weapons[weaponId], prof = B.proficiency.matrix[u.job][w.type];
  const stat = u[STAT[B.proficiency.scaling_stat[w.type]]];
  return w.atk * prof * (1 + enhance * B.enhancement.atk_bonus_per_level) + stat * 0.5 * prof;
}

export const damageTaken = (incoming, def, attackerLevel) => {
  const K = 100 + attackerLevel * 20;
  return (incoming * K) / (K + def);
};

export const critRate = (B, per, weaponId, enhance = 0) =>
  Math.min(0.5, per * 0.005 + (B.weapons[weaponId].crit ?? 0) + enhance * B.enhancement.crit_bonus_per_level);

export const attackInterval = (B, agi, weaponId) =>
  1 / ((1 + agi / 500) * (1 + (B.weapons[weaponId].attack_speed ?? 0)));

// โทษเลเวลห่าง (GDD §16.6): ผู้เล่นสูงกว่ามอน ≥10 → ×0.5, ≥20 → ×0.1
export const expMult = (B, playerLevel, mobLevel) => {
  const d = playerLevel - mobLevel;
  return [...B.exp_curve.level_diff_penalty].reverse().find((r) => d >= r.player_above_mob_by)?.mult ?? 1;
};
