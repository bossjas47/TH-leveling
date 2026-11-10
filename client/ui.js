// ไอคอน = ชื่อไฟล์ใน client/assets/icons/ (Lucide, ISC) · ข้อมูลหน้าตา UI ที่ใช้ร่วมกัน (ไอคอน/คำอธิบายอาชีพ ไอคอนสกิล) — ตัวเลขเกมยังอยู่ใน shared/balance.json
export const JOB = {
  Fighter: { icon: 'swords', th: 'นักสู้', desc: 'ด่านหน้าสายบุก ดาเมจสูง เลือดอึด' },
  Assassin: { icon: 'sword', th: 'นักลอบสังหาร', desc: 'เร็ว คริสูง วาร์ปเข้าไปจบเป้าหมาย' },
  Mage: { icon: 'wand-sparkles', th: 'จอมเวทย์', desc: 'ยิงไกล ระเบิดหมู่ ใช้ MP เยอะ' },
  Tank: { icon: 'shield', th: 'แทงก์', desc: 'ยั่วยุศัตรู ทนทานที่สุดของปาร์ตี้' },
  Healer: { icon: 'heart-pulse', th: 'ฮีลเลอร์', desc: 'ฮีลเพื่อน ชุบคนล้ม ขาดไม่ได้ในทีม' },
  Miner: { icon: 'pickaxe', th: 'นักขุด', desc: 'ขุดแร่มานาได้เร็ว ขายดีในตลาด' },
};
export const SKILL_ICON = { atk: 'swords', potion: 'flask-conical', assist: 'hand-helping', ctx: 'sparkles', invite: 'users', char: 'clipboard-list', chat: 'message-circle', slash: 'sword', whirlwind: 'tornado', stab: 'slice', shadow_step: 'wind',
  fireball: 'flame', ice_nova: 'snowflake', shield_bash: 'shield', taunt: 'megaphone', heal: 'heart-pulse', revive: 'sparkles', pick_strike: 'pickaxe' };
const ICON_DIR = '/assets/icons/';
export const ic = (name, cls = '') => `<img class="ic ${cls}" src="${ICON_DIR}${name}.svg" alt="" draggable="false">`; // ไอคอนใน DOM
const imgs = {};
export const icImg = (name) => imgs[name] ??= Object.assign(new Image(), { src: `${ICON_DIR}${name}.svg` }); // ไอคอนสำหรับวาดบน canvas
