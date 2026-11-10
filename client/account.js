import { maxHp, maxMp } from '/shared/formulas.js';

// login (Firebase Auth) → โหลด/สร้างตัวละคร (GDD §3). ?dev=Fighter ข้ามทั้งหมดเพื่อทดสอบ client อย่างเดียว
const ui = document.getElementById('ui');
const h = (html) => { ui.innerHTML = `<div class="card">${html}</div>`; ui.style.display = 'flex'; return ui.firstChild; };

export async function ensureCharacter(B) {
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev && B.classes[dev]) {
    const c = B.classes[dev], hp = maxHp(c.vit, 1), mp = maxMp(c.int);
    return { username: 'dev', job: dev, level: 1, ...c, int_stat: c.int, hp, mp, max_hp: hp, max_mp: mp };
  }

  const { firebaseConfig, API } = await import('./firebase-config.js');
  const V = 'https://www.gstatic.com/firebasejs/10.14.1';
  const { initializeApp } = await import(`${V}/firebase-app.js`);
  const A = await import(`${V}/firebase-auth.js`);
  const auth = A.getAuth(initializeApp(firebaseConfig));

  const user = await new Promise((ok) => {
    const form = h(`<h2>Thailand Leveling</h2><input id=e type=email placeholder=อีเมล><input id=p type=password placeholder="รหัสผ่าน (6+ ตัว)">
      <p id=m class=err></p><button id=in>เข้าสู่ระบบ</button><button id=up class=alt>สมัครใหม่</button>`);
    const go = (fn) => async () => {
      try { ok((await fn(auth, form.querySelector('#e').value, form.querySelector('#p').value)).user); }
      catch (e) { form.querySelector('#m').textContent = e.code?.replace('auth/', '') ?? e.message; }
    };
    form.querySelector('#in').onclick = go(A.signInWithEmailAndPassword);
    form.querySelector('#up').onclick = go(A.createUserWithEmailAndPassword);
  });

  const call = async (path, body) => {
    const r = await fetch(API + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { authorization: `Bearer ${await user.getIdToken()}` } });
    return [r.status, await r.json()];
  };
  const withToken = (m) => Object.assign(m, { getToken: () => user.getIdToken() });
  let [status, me] = await call('/api/me');
  if (status === 200) return withToken(me);

  const a = B.appearance;
  const jobs = Object.entries(B.classes).map(([j, c]) =>
    `<label class=job><input type=radio name=job value=${j} ${j === 'Fighter' ? 'checked' : ''}>${j}<small>STR ${c.str} AGI ${c.agi} VIT ${c.vit} INT ${c.int} PER ${c.per}</small></label>`).join('');
  const f = h(`<h2>สร้างตัวละคร</h2><input id=n maxlength=24 placeholder="ชื่อ (3–12 ตัวอักษร)">
    <div class=row><label><input type=radio name=g value=male checked>ชาย</label><label><input type=radio name=g value=female>หญิง</label></div>
    <div class=jobs>${jobs}</div>
    <p id=m class=err></p><button id=ok>ปลุกพลัง</button>`);
  const q = (s) => f.querySelector(s);
  return new Promise((done) => {
    q('#ok').onclick = async () => {
      [status, me] = await call('/api/character', {
        username: q('#n').value.trim(), gender: f.querySelector('[name=g]:checked').value, job: f.querySelector('[name=job]:checked').value,
        look: { skin_tone: 1, hair_style: 1, hair_color: a.hair_colors[0], outfit: a.outfits[0] }, // หน้าตาใช้โมเดลตามอาชีพ (KayKit) ค่านี้เก็บไว้เพื่อ schema
      });
      if (status === 201) done(withToken(me)); else q('#m').textContent = me.error;
    };
  });
}
