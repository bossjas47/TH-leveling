// เอฟเฟกต์ pixel art จาก pixelfx (MIT, github.com/patch-gg/pixelfx) แปะเป็น billboard ในโลก 3D
// sheet = PNG ตาราง + JSON เล็กๆ (w,h,cols,n,fps,loop,pivot) ใน assets/fx/ · โหลดตอนใช้ครั้งแรก
import * as THREE from 'three';

const PX = 1 / 44; // 1 พิกเซลของเอฟเฟกต์ = กี่หน่วยโลก (1 หน่วย = 1 tile)
const loaded = new Map();

export function createVfx(scene, camera) {
  const live = new Set();
  const load = (id) => {
    if (!loaded.has(id)) loaded.set(id, (async () => {
      const [meta, tex] = await Promise.all([
        fetch(`assets/fx/${id}.json`).then((r) => r.json()),
        new THREE.TextureLoader().loadAsync(`assets/fx/${id}.png`),
      ]);
      tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; // พิกเซลคมชัด
      return { meta, tex };
    })().catch((e) => { console.warn('vfx', id, e.message); return null; }));
    return loaded.get(id);
  };

  // play: เล่นครั้งเดียว (ลบเองเมื่อจบ) · loop: true = วนจนเรียก stop() · to: [x,y] = บินไปหาเป้าหมายตลอดอายุเอฟเฟกต์
  async function play(id, x, y, { h = 0.05, scale = 1, flip = false, loop = false, to = null, speed = 1, opacity = 1 } = {}) {
    if (live.size > 28 && !loop) return null; // กันเอฟเฟกต์ล้นจอ/เครื่องช้า
    const d = await load(id); if (!d) return null;
    const { meta: m } = d, tex = d.tex.clone(); tex.needsUpdate = true;
    tex.repeat.set(m.w / m.sheet[0], m.h / m.sheet[1]);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity });
    const sp = new THREE.Sprite(mat);
    sp.center.set(m.pivot[0] / m.w, 1 - m.pivot[1] / m.h); // จุดอ้างอิงของเอฟเฟกต์ (เช่นเท้า) อยู่ที่ตำแหน่งที่สั่ง
    sp.scale.set(m.w * PX * scale * (flip ? -1 : 1), m.h * PX * scale, 1);
    sp.position.set(x, h, y); sp.renderOrder = 20;
    const e = { sp, m, tex, t: 0, loop, from: [x, y], to, speed, dead: false, stop() { e.dead = true; } };
    scene.add(sp); live.add(e); setFrame(e, 0);
    return e;
  }
  function setFrame(e, i) {
    const { m } = e, c = i % m.cols, r = Math.floor(i / m.cols);
    e.tex.offset.set((c * m.w) / m.sheet[0], 1 - ((r + 1) * m.h) / m.sheet[1]);
  }
  function update(dt) {
    for (const e of live) {
      e.t += dt * e.speed;
      let f = e.t * e.m.fps;
      if (e.to) { const k = Math.min(1, e.t / (e.m.n / e.m.fps)); e.sp.position.x = e.from[0] + (e.to[0] - e.from[0]) * k; e.sp.position.z = e.from[1] + (e.to[1] - e.from[1]) * k; }
      if (f >= e.m.n) { if (e.loop && !e.dead) { f %= e.m.n; e.t = f / e.m.fps; } else e.dead = true; }
      if (e.dead) { scene.remove(e.sp); e.sp.material.dispose(); e.tex.dispose(); live.delete(e); continue; }
      setFrame(e, Math.floor(f));
    }
  }
  return { play, update, preload: (ids) => ids.forEach(load) };
}
