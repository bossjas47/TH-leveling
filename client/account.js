import { maxHp, maxMp } from '/shared/formulas.js';
import { JOB, ic } from './ui.js';
import { lookEditor } from './dresser.js';

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
    const form = h(`<div class=logo><b>THAILAND<br>LEVELING</b><small>ฮันเตอร์แห่งกรุงเทพฯ</small></div>
      <input id=e type=email placeholder=อีเมล autocomplete=email><input id=p type=password placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" autocomplete=current-password>
      <p id=m class=err></p><button id=in class=cta>เข้าสู่ระบบ</button><button id=up class=alt>สมัครใหม่</button>`);
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

  const jobs = Object.entries(B.classes).map(([j, c]) =>
    `<label class=job><input type=radio name=job value=${j} ${j === 'Fighter' ? 'checked' : ''}><div><span class=t><em>${ic(JOB[j]?.icon ?? 'star')}</em>${j}</span><p>${JOB[j]?.desc ?? ''}</p>
      <span class=st>${['str', 'agi', 'vit', 'int', 'per'].map((k) => `<span>${k.toUpperCase()}</span><b style="width:${Math.min(100, c[k] * 5)}%"></b>`).join('')}</span></div></label>`).join('');
  const f = h(`<h2>สร้างตัวละคร</h2><div class=create><div class=dslot></div><div class=side><input id=n maxlength=24 placeholder="ชื่อ (3–12 ตัวอักษร)">
    <div class=row><label class=seg><input type=radio name=g value=male checked><span>${ic('mars')} ชาย</span></label><label class=seg><input type=radio name=g value=female><span>${ic('venus')} หญิง</span></label></div>
    <div class=jobs>${jobs}</div></div></div>
    <p id=m class=err></p><button id=ok class=cta>${ic('zap')} ปลุกพลัง</button>`);
  const q = (s) => f.querySelector(s), job = () => f.querySelector('[name=job]:checked').value;
  const ed = lookEditor(B.appearance, {}, job); q('.dslot').append(ed.el);
  return new Promise((done) => {
    q('#ok').onclick = async () => {
      [status, me] = await call('/api/character', { username: q('#n').value.trim(), gender: f.querySelector('[name=g]:checked').value, job: job(), look: ed.look() });
      if (status === 201) done(withToken(me)); else q('#m').textContent = me.error;
    };
  });
}
