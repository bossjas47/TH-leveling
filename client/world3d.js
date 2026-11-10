// โลก 3D ด้วย Three.js: พื้น/ถนน/ตึก (GLB)/ต้นสน/แสงเงา/กล้องบุคคลที่สาม + ตัวละคร มอน แร่ ประตู
// พิกัด: grid (x,y) ของเกม = Three (X, Z), แกน Y = ความสูง — server ยังคิดตำแหน่งแบบ 2D เหมือนเดิม
import * as THREE from 'three';
import { tint, hash, paintGround, wallTex, roofTex, billboards, texOf, propSheet } from './pixel.js';
import { charSheet, CW, CH, FEET, FRAMES, VIEW } from './paperdoll.js';
import { createVfx } from './vfx.js';

const BLD = { H: 'สมาคมฮันเตอร์', M: 'ตลาด', P: 'โรงพยาบาล', T: 'วินมอเตอร์ไซค์' };

export async function createWorld(canvas, B) {
  const coarse = matchMedia('(pointer:coarse)').matches;
  const qParam = new URLSearchParams(location.search).get('q'); // ?q=2|1|0 บังคับคุณภาพ (ไม่ใส่ = ปรับอัตโนมัติตาม FPS)
  let quality = qParam === null ? (coarse ? 1 : 2) : +qParam;   // 2 = เงา+ของตกแต่ง, 1 = เงา, 0 = ต่ำสุด
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const skyOf = (stops) => { const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); g.fillStyle = gr; g.fillRect(0, 0, 2, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  scene.fog = new THREE.Fog(0, 1, 2);
  // บรรยากาศต่อแผนที่: เมืองยามค่ำ (มืด แสงจันทร์ฟ้า) · Gate E = ป่ากลางคืน มืดกว่า หมอกหนา
  const ENV = { lobby: { sky: skyOf(['#05070f', '#0d1428', '#1c2340']), fog: [0x141a2c, 9, 30], hemi: [0x5a6a98, 0x101a14, 0.7], moon: [0x9fb4ff, 1.3], rim: 0.6, tint: [0.62, 0.66, 0.82], chr: [0.85, 0.88, 1] },
    gate_e: { sky: skyOf(['#020306', '#060c12', '#0c161c']), fog: [0x0a1216, 4.5, 15], hemi: [0x40566a, 0x05080a, 0.45], moon: [0x7f9ac8, 0.75], rim: 0.35, tint: [0.5, 0.58, 0.66], chr: [0.72, 0.78, 0.88] } };
  let chrTint = new THREE.Color(1, 1, 1);
  function setEnv(kind) { const e = ENV[kind] ?? ENV.lobby; scene.background = e.sky; scene.fog.color.setHex(e.fog[0]); scene.fog.near = e.fog[1]; scene.fog.far = e.fog[2];
    hemi.color.setHex(e.hemi[0]); hemi.groundColor.setHex(e.hemi[1]); hemi.intensity = e.hemi[2]; sun.color.setHex(e.moon[0]); sun.intensity = e.moon[1]; rim.intensity = e.rim; tint.value.setRGB(...e.tint); chrTint = new THREE.Color(...e.chr); }

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x6b8f4a, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 3.0); sun.castShadow = true; // แสงหลัก + เงา (ตามผู้เล่น)
  const SM = coarse ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 0.9); rim.position.set(8, 6, -10); scene.add(rim); // แสงขอบจากด้านตรงข้าม ให้ตัวละครมีมิติ

  // ---------- แผนที่ปัจจุบัน (พิกเซลทั้งหมด วาดด้วยโค้ดใน pixel.js) ----------
  let mapGroup = null, portalFx = [], labels = [], decor = null, solidFn = () => false;
  const dispose = (o) => o.traverse((c) => { if (c.isMesh && c.geometry && !c.userData.shared) c.geometry.dispose?.(); });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const sm = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
  function setMap(kind, rows) {
    if (mapGroup) { scene.remove(mapGroup); dispose(mapGroup); }
    portalFx.forEach((p) => p.then((e) => e?.stop())); portalFx = []; setEnv(kind);
    const lobby = kind !== 'gate_e', N = rows.length, g = new THREE.Group(); mapGroup = g; labels = [];
    const road = (x, y) => lobby && (y === 5 || y === 6 || ((x === 10 || x === 11) && y >= 7)), plaza = (x, y) => lobby && (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) <= 3.4 || rows[y][x] === 'G');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshStandardMaterial({ map: paintGround(rows, lobby), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, 0, N / 2); ground.receiveShadow = true; g.add(ground);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(N, 1.4, N), [sm('#6b4a2b'), sm('#6b4a2b'), sm('#7a8f4a'), sm('#4a3320'), sm('#6b4a2b'), sm('#6b4a2b')]); // เกาะลอย
    soil.position.set(N / 2, -0.703, N / 2); soil.receiveShadow = true; g.add(soil);

    // ป่าขอบเกาะ '#' + ต้นไม้/หินใน Gate 'R' = billboard พิกเซล (1 draw call ต่อชนิด)
    const put = {}, add = (k, x, y, s) => (put[k] ??= []).push({ x, y, s });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ch = rows[y][x]; if (ch !== '#' && ch !== 'R') continue;
      const r = hash(x, y, 4), jx = x + 0.5 + (hash(x, y, 5) - 0.5) * 0.4, jy = y + 0.5 + (hash(x, y, 6) - 0.5) * 0.4, s = 0.95 + hash(x, y, 7) * 0.45;
      if (ch === 'R' && r < 0.4) add('rock', jx, jy, s * 1.3); else add(r < 0.62 ? 'pine' : r < 0.9 ? 'oak' : 'bush', jx, jy, s);
    }
    for (const [k, list] of Object.entries(put)) g.add(billboards(k, list));
    decor = new THREE.Group(); g.add(decor); decor.visible = quality >= 2; // ของตกแต่งเล็กๆ ปิดเมื่อเครื่องช้า
    const dp = {}, dadd = (k, x, y, s) => (dp[k] ??= []).push({ x, y, s });
    const clear = (x, y) => (lobby ? [...B.places.gates, [12, 12]].some(([gx, gy]) => Math.hypot(gx - x, gy - y) < 1.4) : Math.hypot(21.5 - x, 38.5 - y) < 3);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (rows[y][x] !== '.' || (lobby && (road(x, y) || plaza(x, y))) || clear(x + 0.5, y + 0.5)) continue;
      const r = hash(x, y, 31), px = x + 0.15 + hash(x, y, 32) * 0.7, py = y + 0.15 + hash(x, y, 33) * 0.7, s = 0.9 + hash(x, y, 35) * 0.4;
      if (r < 0.14) dadd('tuft', px, py, s); else if (r < 0.2) dadd(['flowerR', 'flowerY', 'flowerP'][Math.floor(hash(x, y, 36) * 3)], px, py, s);
      else if (r < 0.225) dadd('mush', px, py, s); else if (r < 0.25) dadd('bush', px, py, s * 0.8); else if (r < 0.265) dadd('rock', px, py, s * 0.6);
    }
    for (const [k, list] of Object.entries(dp)) decor.add(billboards(k, list));

    if (lobby) { // ตึก = กล่องผนังพิกเซล (instanced ต่อ ชนิด+จำนวนแถวหน้าต่าง) + ป้ายชื่ออาคาร
      const place = {}, seen = new Set(), clusters = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const ch = rows[y][x]; if (!BLD[ch] || seen.has(x + ',' + y)) continue;
        const tiles = [], st = [[x, y]]; seen.add(x + ',' + y);
        while (st.length) { const [a, b] = st.pop(); tiles.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = a + dx + ',' + (b + dy); if (rows[b + dy]?.[a + dx] === ch && !seen.has(k)) { seen.add(k); st.push([a + dx, b + dy]); } } }
        const cx = tiles.reduce((s, t) => s + t[0], 0) / tiles.length, cy = tiles.reduce((s, t) => s + t[1], 0) / tiles.length;
        const center = [...tiles].sort((p, r) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(r[0] - cx, r[1] - cy))[0];
        clusters.push({ ch, cx: cx + 0.5, cy: cy + 0.5, tiles, center: center.join(',') });
      }
      for (const c of clusters) {
        labels.push({ text: BLD[c.ch], x: c.cx, y: c.cy, h: c.ch === 'H' ? 5.4 : 2.9 });
        for (const [x, y] of c.tiles) {
          const tower = c.ch === 'H' && c.center === x + ',' + y, h = tower ? 5 : [1.7, 2.2, 2.7][Math.floor(hash(x, y, 3) * 3)], rowsW = tower ? 8 : 3;
          (place[c.ch + rowsW] ??= []).push({ x: x + 0.5, y: y + 0.5, h, rot: Math.floor(hash(x, y, 11) * 4) * Math.PI / 2 });
        }
      }
      for (const [key, list] of Object.entries(place)) {
        const w = wallTex(key[0], +key.slice(1)), wm = new THREE.MeshStandardMaterial({ map: w, roughness: 1 }), rm = new THREE.MeshStandardMaterial({ map: roofTex(), roughness: 1 });
        const im = new THREE.InstancedMesh(boxGeo, [wm, wm, rm, wm, wm, wm], list.length); im.castShadow = im.receiveShadow = true; im.userData.shared = true;
        list.forEach((b, i) => im.setMatrixAt(i, _m.compose(new THREE.Vector3(b.x, b.h / 2, b.y), _q.setFromAxisAngle(Y, b.rot), new THREE.Vector3(0.94, b.h, 0.94)))); g.add(im);
      }
      for (const [gx, gy] of B.places.gates) portalFx.push(vfx.play('portal', gx, gy, { loop: true, scale: 0.9, h: 0.02 }));
    }
    scene.add(g);
  }

  const vfx = createVfx(scene, camera);

  // ---------- sprite พิกเซลของเอนทิตี: sheet (canvas) → Sprite ตั้งตรง หันเข้ากล้อง + เงากลมบนพื้น ----------
  const shadowGeo = new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2);
  function spriteRig(sheet, cw, ch, feetY, scale) {
    const tex = texOf(sheet); tex.repeat.set(cw / sheet.width, ch / sheet.height);
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, fog: true }), sp = new THREE.Sprite(mat);
    sp.center.set(0.5, (ch - 1 - feetY + 0.5) / ch); sp.scale.set(cw * scale, ch * scale, 1);
    const sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); sh.position.y = 0.015; sh.scale.setScalar(scale * 24 * 0.9);
    const root = new THREE.Group(); root.add(sh, sp);
    return { root, sp, mat, sx: sp.scale.x, sy: sp.scale.y, set(col, row, flip) { tex.offset.set((col * cw) / sheet.width, 1 - ((row + 1) * ch) / sheet.height); sp.scale.x = flip ? -this.sx : this.sx; } };
  }
  const relView = (e) => { const rel = (e.face ?? 0) - cam.yaw, sn = Math.sin(rel); return [Math.abs(sn) > 0.7 ? 's' : Math.cos(rel) < 0 ? 'b' : 'f', sn < 0]; }; // มุมมองตัวละครเทียบกล้อง + กลับด้านเมื่อหันซ้าย
  const buildChar = (e) => spriteRig(charSheet(e.job, e.look), CW, CH, FEET, 1 / 32);
  function animChar(r, e, mv, T, sw) {
    r.mat.color.copy(chrTint);
    const [view, flip] = relView(e);
    const col = e.down ? FRAMES.down : sw >= 0 ? FRAMES.atk + Math.min(2, Math.floor(sw * 3)) : mv ? FRAMES.walk + (Math.floor(T / 110) % 4) : Math.floor(T / 450) % 2;
    r.set(col, e.down ? 0 : VIEW[view], view === 's' && flip);
  }
  const buildProp = (kind, scale) => { const d = propSheet(kind); return spriteRig(d.canvas, d.w, d.h, d.h - 1, scale); };
  const hitFlash = (r, e, T) => { const f = T - (e.flash ?? -1e9) < 110; r.mat.color.copy(chrTint); if (f) r.mat.color.setRGB(1, 0.4, 0.4); };

  // ---------- เอนทิตี (ตัวละคร/มอน/แร่) ----------
  const ents = new Map();
  const syncKind = (kind, list, make, upd, dt, T) => { // ลบเฉพาะเอนทิตีชนิดเดียวกันที่หายไป
    const seen = new Set(list);
    for (const [e, en] of ents) if (en.kind === kind && !seen.has(e)) { scene.remove(en.rig.root); ents.delete(e); }
    for (const e of list) {
      let en = ents.get(e); const key = (e.job ?? '') + (e.kind ?? '') + (e.look ? `|${e.look.skin_tone}|${e.look.hair_style}|${e.look.hair_color}|${e.look.equip ?? ''}` : ''); // หน้าตา/ชนิดเปลี่ยน = สร้าง sprite ใหม่
      if (en && en.key !== key) { scene.remove(en.rig.root); ents.delete(e); en = null; }
      if (!en) { en = { kind, key, rig: make(e), lx: e.x, ly: e.y, mv: 0, yaw: e.face ?? 0 }; scene.add(en.rig.root); ents.set(e, en); }
      const sp = Math.hypot(e.x - en.lx, e.y - en.ly) / Math.max(dt, 1e-3); en.lx = e.x; en.ly = e.y; en.mv += ((sp > 0.4 ? 1 : 0) - en.mv) * Math.min(1, dt * 12);
      en.rig.root.position.x = e.x; en.rig.root.position.z = e.y;
      let d = (e.face ?? en.yaw) - en.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); en.yaw += d * Math.min(1, dt * 14); en.rig.root.rotation.y = en.yaw;
      upd(en.rig, e, en.mv > 0.5, T, dt);
    }
  };
  const swingOf = (e, T) => (e.atkStart && T - e.atkStart < 320 ? (T - e.atkStart) / 320 : -1);

  // ---------- กล้องบุคคลที่สาม ----------
  const cam = { yaw: 0.6, pitch: 0.62, dist: 5.6, eff: 5.6, tx: 12, ty: 12, init: false };
  const clampCam = () => { cam.pitch = Math.max(0.18, Math.min(1.25, cam.pitch)); cam.dist = Math.max(2.4, Math.min(11, cam.dist)); };
  // สไตล์ pixel: เรนเดอร์ความละเอียดต่ำ (สูง ~PIXEL_H พิกเซล) แล้วให้ CSS ขยายแบบ nearest (image-rendering:pixelated) · ?px=N บังคับขนาดพิกเซลจอ
  const px = () => +new URLSearchParams(location.search).get('px') || Math.max(2, Math.round(innerHeight / 270)) * (quality >= 2 ? 1 : 1.5);
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(Math.ceil(w / px()), Math.ceil(h / px()), false); camera.aspect = w / h; camera.fov = h > w ? 62 : 52; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  function update(dt, T, s) { // s = { player, others, mobs, nodes }
    dt = Math.min(dt, 0.1);
    sync0(s, dt, T); vfx.update(dt);
    clampCam();
    const P = s.player; if (!cam.init || Math.hypot(P.x - cam.tx, P.y - cam.ty) > 4) { cam.tx = P.x; cam.ty = P.y; cam.init = true; }
    const k = Math.min(1, dt * 9); cam.tx += (P.x - cam.tx) * k; cam.ty += (P.y - cam.ty) * k;
    const cp = Math.cos(cam.pitch), look = new THREE.Vector3(cam.tx, 0.75, cam.ty), hx = Math.sin(cam.yaw) * cp, hz = Math.cos(cam.yaw) * cp;
    let want = cam.dist; // กล้องไม่ทะลุตึก/ต้นไม้: เดินเส้นตรงจากผู้เล่นไปตำแหน่งกล้องบนกริด ชนช่องทึบแล้วถอยเข้า
    for (let d = 0.3; d <= cam.dist; d += 0.2) if (solidFn(cam.tx + hx * d, cam.ty + hz * d)) { want = Math.max(0.55, d - 0.3); break; }
    cam.eff += (want - cam.eff) * Math.min(1, dt * (want < cam.eff ? 16 : 3));
    camera.position.set(look.x + hx * cam.eff, look.y + Math.sin(cam.pitch) * cam.eff, look.z + hz * cam.eff); camera.lookAt(look);
    sun.position.set(look.x - 7, 13, look.z + 5); sun.target.position.set(look.x, 0, look.z); // เงาตามผู้เล่น
    renderer.render(scene, camera);
  }
  function sync0(s, dt, T) {
    const chr = (r, e, mv) => animChar(r, e, mv, T, swingOf(e, T));
    syncKind('me', [s.player], buildChar, chr, dt, T);
    syncKind('pl', [...s.others], buildChar, chr, dt, T);
    syncKind('mob', [...s.mobs].filter((m) => m.kind !== 2), (e) => buildProp(e.kind === 1 ? 'boss' : 'goblin', e.kind === 1 ? 1 / 12 : 1 / 22),
      (r, e, mv) => { r.set(mv ? Math.floor(T / 160) % 2 : 0, 0, relView(e)[1]); hitFlash(r, e, T); }, dt, T);
    syncKind('dummy', [...s.mobs].filter((m) => m.kind === 2), () => buildProp('dummy', 1 / 18), (r, e) => hitFlash(r, e, T), dt, T);
    syncKind('node', [...s.nodes], () => buildProp('node', 1 / 18), (r, e) => { const k = T - (e.flash ?? -1e9) < 120 ? 1.18 : 1 + Math.sin(T * 0.004 + e.x) * 0.04; r.sp.scale.set(r.sx * k, r.sy * k, 1); }, dt, T);
  }

  const v = new THREE.Vector3();
  const api = {
    setMap, update, camera, cam, vfx, labels: () => labels, info: renderer.info, sun, renderer,
    setSolid: (f) => { solidFn = f; }, get quality() { return quality; },
    setQuality(q) { quality = q; sun.castShadow = q >= 1; if (decor) decor.visible = q >= 2; renderer.setPixelRatio(1); resize(); },
    get forward() { return [-Math.sin(cam.yaw), -Math.cos(cam.yaw)]; }, // ทิศ "ข้างหน้า" ของกล้องบนระนาบเกม (x,y)
    project(x, y, h = 0) { v.set(x, h, y).project(camera); return v.z > 1 ? null : [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; },
  };
  api.setQuality(quality);
  return api;
}
