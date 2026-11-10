// โลก 3D ด้วย Three.js: พื้น/ถนน/ตึก (GLB)/ต้นสน/แสงเงา/กล้องบุคคลที่สาม + ตัวละคร มอน แร่ ประตู
// พิกัด: grid (x,y) ของเกม = Three (X, Z), แกน Y = ความสูง — server ยังคิดตำแหน่งแบบ 2D เหมือนเดิม
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadAdventurers, buildAdventurer, buildMonster, animateAdventurer } from './adventurers.js';
import { buildNode, buildDummy, buildPortal, mat } from './rigs.js';

const hash = (x, y, k = 0) => (Math.imul(x * 374761393 + y * 668265263 + k * 1013904223, 1274126177) >>> 0) / 4294967296;
const BLD = { H: 'สมาคมฮันเตอร์', M: 'ตลาด', P: 'โรงพยาบาล', T: 'วินมอเตอร์ไซค์' };
const LOTS = ['a', 'b', 'c', 'd', 'f', 'g', 'h'];
const PX = 48; // พิกเซลต่อ tile ของพื้น

export async function createWorld(canvas, B) {
  const coarse = matchMedia('(pointer:coarse)').matches;
  const qParam = new URLSearchParams(location.search).get('q'); // ?q=2|1|0 บังคับคุณภาพ (ไม่ใส่ = ปรับอัตโนมัติตาม FPS)
  let quality = qParam === null ? (coarse ? 1 : 2) : +qParam;   // 2 = เงา+ของตกแต่ง, 1 = เงา, 0 = ต่ำสุด
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const sky = document.createElement('canvas'); sky.width = 2; sky.height = 256; // พื้นหลังไล่สีท้องฟ้า
  { const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5b9be0'); gr.addColorStop(0.55, '#a9d6f5'); gr.addColorStop(1, '#e9f4ff'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256); }
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace; scene.background = skyTex;
  scene.fog = new THREE.Fog(0xcfe6f7, 16, 46);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x6b8f4a, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 3.0); sun.castShadow = true; // แสงหลัก + เงา (ตามผู้เล่น)
  const SM = coarse ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 0.9); rim.position.set(8, 6, -10); scene.add(rim); // แสงขอบจากด้านตรงข้าม ให้ตัวละครมีมิติ

  // ---------- โมเดลตึก (Kenney City Kit Commercial, CC0) ----------
  const loader = new GLTFLoader(), models = {};
  const NATURE_COLOR = { grass: '#68ad45', leafsGreen: '#4e9a3a', leafsDark: '#2f7a3a', woodBark: '#6b4a2b', woodBarkDark: '#58391f', woodInner: '#d8b98a', dirt: '#8a6a45', stone: '#9aa3ad' };
  const meshesOf = (gltf) => { gltf.scene.updateMatrixWorld(true); const out = []; gltf.scene.traverse((o) => { if (o.isMesh) { if (o.material.metalness === 1) { o.material.metalness = 0; o.material.roughness = 0.9; } // ไฟล์ Nature Kit ตั้ง metallic=1 → ดำเข้มเหมือนโลหะ
      if (NATURE_COLOR[o.material.name]) o.material.color.set(NATURE_COLOR[o.material.name]); // ชุดนี้ตั้งใจใช้โทนฟ้าอมเขียว-ส้ม → แปลงเป็นสีธรรมชาติให้เข้ากับโลกเรา
      out.push({ geo: o.geometry, mat: o.material, m: o.matrixWorld.clone() }); } }); return out; };
  const NATURE = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD', 'tree_default', 'tree_oak', 'tree_fat', 'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_smallA', 'rock_smallB', 'stone_smallA', 'stone_smallB',
    'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB', 'mushroom_red', 'mushroom_redGroup', 'mushroom_tan', 'plant_bush', 'plant_bushLarge', 'plant_bushSmall', 'log', 'stump_old'];
  await Promise.all([
    loadAdventurers(),
    ...[...LOTS.map((k) => 'assets/models/building-' + k), 'assets/models/building-skyscraper-c'].map(async (u) => { models[u.split('/').pop().replace('.glb', '')] = meshesOf(await loader.loadAsync(u + '.glb')); }),
    ...NATURE.map(async (n) => { models[n] = meshesOf(await loader.loadAsync(`assets/nature/${n}.glb`)); }),
  ]);
  const Y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
  const mtx = (x, y, s, rot = 0, lift = 0, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, lift, y), _q.setFromAxisAngle(Y, rot), new THREE.Vector3(s, sy, s));
  function flush(group, put) { // วางโมเดลแบบ instanced: 1 InstancedMesh ต่อ (โมเดล, เมช)
    for (const [name, list] of Object.entries(put)) for (const mm of models[name]) {
      const im = new THREE.InstancedMesh(mm.geo, mm.mat, list.length); im.castShadow = im.receiveShadow = true; im.userData.shared = true;
      list.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(p, mm.m))); group.add(im);
    }
  }

  // ---------- ภาพพื้นมองจากบน (วาดด้วยโค้ด) ----------
  function paintGround(rows, lobby) {
    const N = rows.length, c = document.createElement('canvas'); c.width = c.height = N * PX; const g = c.getContext('2d');
    const road = (x, y) => lobby && (y === 5 || y === 6 || ((x === 10 || x === 11) && y >= 7));
    const plaza = (x, y) => lobby && (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) <= 3.4 || rows[y][x] === 'G');
    const base = lobby ? [111, 174, 76] : [88, 150, 66];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = hash(x, y), X = x * PX, Y = y * PX;
      if (plaza(x, y)) { const v = ((x + y) % 2 ? 201 : 185) + (r - 0.5) * 14; g.fillStyle = `rgb(${v},${v - 4},${v - 16})`; g.fillRect(X, Y, PX, PX); g.strokeStyle = 'rgba(0,0,0,.14)'; g.strokeRect(X + 0.5, Y + 0.5, PX - 1, PX - 1); }
      else if (road(x, y)) { const v = 62 + r * 14; g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.fillRect(X, Y, PX, PX); }
      else { const k = 0.95 + r * 0.1; g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; g.fillRect(X, Y, PX, PX);
        g.strokeStyle = 'rgba(25,70,25,.45)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 6; i++) { const bx = X + hash(x, y, i + 1) * PX, by = Y + hash(x, y, i + 9) * PX; g.moveTo(bx, by); g.lineTo(bx + 1, by - 5); } g.stroke(); }
    }
    for (let i = 0; i < N * N * 0.5; i++) { // ปื้นสีนุ่มๆ ให้พื้นหญ้าดูเป็นธรรมชาติ ไม่เป็นลายตาราง
      const x = hash(i, 1, 21) * N, y = hash(i, 2, 22) * N, r = (0.8 + hash(i, 3, 23) * 1.8) * PX;
      if (lobby && (road(Math.floor(x), Math.floor(y)) || plaza(Math.floor(x), Math.floor(y)))) continue;
      const gr = g.createRadialGradient(x * PX, y * PX, 0, x * PX, y * PX, r), dark = hash(i, 4, 24) < 0.5;
      gr.addColorStop(0, dark ? 'rgba(20,70,25,.16)' : 'rgba(190,235,110,.14)'); gr.addColorStop(1, dark ? 'rgba(20,70,25,0)' : 'rgba(190,235,110,0)'); // ปลายทางสีเดียวกันแต่โปร่งใส (ไม่ใช่ดำ ไม่งั้นสีเข้มสะสม) g.fillStyle = gr; g.fillRect(x * PX - r, y * PX - r, r * 2, r * 2);
    }
    if (lobby) { // เส้นกลางถนน + ตราวงเวียน
      g.strokeStyle = 'rgba(255,230,120,.9)'; g.lineWidth = 3; g.setLineDash([PX * 0.5, PX * 0.5]);
      g.beginPath(); g.moveTo(0, 6 * PX); g.lineTo(N * PX, 6 * PX); g.moveTo(11 * PX, 7 * PX); g.lineTo(11 * PX, N * PX); g.stroke(); g.setLineDash([]);
      const cx = 12 * PX, cy = 12 * PX;
      for (const [r, fill, stroke] of [[1.9, 'rgba(40,60,90,.35)', '#d8b44a'], [1.2, 'rgba(255,255,255,.1)', 'rgba(216,180,74,.8)']]) { g.beginPath(); g.arc(cx, cy, r * PX, 0, 7); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }

  // ---------- แผนที่ปัจจุบัน ----------
  let mapGroup = null, portals = [], labels = [], decor = null, solidFn = () => false;
  const dispose = (o) => o.traverse((c) => { if (c.isMesh && c.geometry && !c.userData.shared) c.geometry.dispose?.(); });
  function setMap(kind, rows) {
    if (mapGroup) { scene.remove(mapGroup); dispose(mapGroup); }
    const lobby = kind !== 'gate_e', N = rows.length, g = new THREE.Group(); mapGroup = g; portals = []; labels = [];
    const road = (x, y) => lobby && (y === 5 || y === 6 || ((x === 10 || x === 11) && y >= 7)), plaza = (x, y) => lobby && (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) <= 3.4 || rows[y][x] === 'G');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshStandardMaterial({ map: paintGround(rows, lobby), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, 0, N / 2); ground.receiveShadow = true; g.add(ground);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(N, 1.4, N), [mat('#6b4a2b'), mat('#6b4a2b'), mat('#7a8f4a'), mat('#4a3320'), mat('#6b4a2b'), mat('#6b4a2b')]); // เกาะลอย
    soil.position.set(N / 2, -0.703, N / 2); soil.receiveShadow = true; g.add(soil);

    // ป่าขอบเกาะ '#' + ต้นไม้/หินใน Gate 'R' (Kenney Nature Kit) — ช่องทึบทุกช่องมีโมเดลทับ
    const put = {}, add = (n, x, y, s, rot, lift) => (put[n] ??= []).push(mtx(x, y, s, rot, lift));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ch = rows[y][x]; if (ch !== '#' && ch !== 'R') continue;
      const r = hash(x, y, 4), jx = x + 0.5 + (hash(x, y, 5) - 0.5) * 0.35, jy = y + 0.5 + (hash(x, y, 6) - 0.5) * 0.35, rot = hash(x, y, 7) * 6.28;
      if (ch === 'R' && r < 0.4) add(['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_tallA', 'rock_tallB', 'rock_tallC'][Math.floor(hash(x, y, 9) * 6)], jx, jy, 0.9 + hash(x, y, 10) * 0.7, rot, 0);
      else add(r < 0.62 ? ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD'][Math.floor(hash(x, y, 9) * 4)] : r < 0.82 ? 'tree_default' : r < 0.92 ? 'tree_oak' : 'tree_fat', jx, jy, 0.85 + hash(x, y, 10) * 0.5, rot, 0);
    }
    flush(g, put);
    decor = new THREE.Group(); g.add(decor); decor.visible = quality >= 2; // ของตกแต่งเล็กๆ (หญ้า/ดอกไม้/เห็ด/พุ่ม/หิน) ไม่มีผลต่อการชน — ปิดได้เมื่อเครื่องช้า
    const dp = {}, dadd = (n, x, y, s, rot) => (dp[n] ??= []).push(mtx(x, y, s, rot));
    const clear = (x, y) => (lobby ? [...B.places.gates, [12, 12]].some(([gx, gy]) => Math.hypot(gx - x, gy - y) < 1.4) : Math.hypot(21.5 - x, 38.5 - y) < 3);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (rows[y][x] !== '.' || (lobby && (road(x, y) || plaza(x, y))) || clear(x + 0.5, y + 0.5)) continue;
      const r = hash(x, y, 31), px = x + 0.15 + hash(x, y, 32) * 0.7, py = y + 0.15 + hash(x, y, 33) * 0.7, rot = hash(x, y, 34) * 6.28, s = 0.9 + hash(x, y, 35) * 0.5;
      if (r < 0.16) dadd(['grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge'][Math.floor(hash(x, y, 36) * 4)], px, py, s, rot);
      else if (r < 0.23) dadd(['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB'][Math.floor(hash(x, y, 36) * 5)], px, py, s * 1.2, rot);
      else if (r < 0.26) dadd(['mushroom_red', 'mushroom_redGroup', 'mushroom_tan'][Math.floor(hash(x, y, 36) * 3)], px, py, s, rot);
      else if (r < 0.285) dadd(['plant_bush', 'plant_bushLarge', 'plant_bushSmall'][Math.floor(hash(x, y, 36) * 3)], px, py, s * 0.9, rot);
      else if (r < 0.3) dadd(['rock_smallA', 'rock_smallB', 'stone_smallA', 'stone_smallB'][Math.floor(hash(x, y, 36) * 4)], px, py, s, rot);
      else if (r < 0.305) dadd(hash(x, y, 37) < 0.5 ? 'log' : 'stump_old', px, py, s, rot);
    }
    flush(decor, dp);

    if (lobby) { // ตึก: 1 ช่อง = 1 หลัง (instanced ต่อโมเดล) + ป้ายชื่ออาคาร
      const place = {}; // ชื่อโมเดล → [matrix...]
      const seen = new Set(), clusters = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const ch = rows[y][x]; if (!BLD[ch] || seen.has(x + ',' + y)) continue;
        const tiles = [], st = [[x, y]]; seen.add(x + ',' + y);
        while (st.length) { const [a, b] = st.pop(); tiles.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = a + dx + ',' + (b + dy); if (rows[b + dy]?.[a + dx] === ch && !seen.has(k)) { seen.add(k); st.push([a + dx, b + dy]); } } }
        const cx = tiles.reduce((s, t) => s + t[0], 0) / tiles.length, cy = tiles.reduce((s, t) => s + t[1], 0) / tiles.length;
        const center = [...tiles].sort((p, r) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(r[0] - cx, r[1] - cy))[0];
        clusters.push({ ch, cx: cx + 0.5, cy: cy + 0.5, tiles, center: center.join(',') });
      }
      for (const c of clusters) {
        labels.push({ text: BLD[c.ch], x: c.cx, y: c.cy, h: c.ch === 'H' ? 3.6 : 1.9 });
        for (const [x, y] of c.tiles) {
          const tower = c.ch === 'H' && c.center === x + ',' + y, name = tower ? 'building-skyscraper-c' : 'building-' + LOTS[Math.floor(hash(x, y, 3) * LOTS.length)], s = tower ? 0.85 : 1.12;
          (place[name] ??= []).push(mtx(x + 0.5, y + 0.5, s, Math.floor(hash(x, y, 11) * 4) * Math.PI / 2));
        }
      }
      flush(g, place);
      for (const [gx, gy] of B.places.gates) { const p = buildPortal(); p.position.set(gx, 0, gy); g.add(p); portals.push(p); }
    }
    scene.add(g);
  }

  // ---------- เอนทิตี (ตัวละคร/มอน/แร่) ----------
  const ents = new Map();
  const syncKind = (kind, list, make, upd, dt, T) => { // ลบเฉพาะเอนทิตีชนิดเดียวกันที่หายไป
    const seen = new Set(list);
    for (const [e, en] of ents) if (en.kind === kind && !seen.has(e)) { scene.remove(en.rig.root); ents.delete(e); }
    for (const e of list) {
      let en = ents.get(e); const key = e.job ?? ''; // หน้าตาผูกกับอาชีพ (โมเดล KayKit 1 แบบต่ออาชีพ)
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
  const cam = { yaw: 0.6, pitch: 0.62, dist: 4.2, eff: 4.2, tx: 12, ty: 12, init: false };
  const clampCam = () => { cam.pitch = Math.max(0.18, Math.min(1.25, cam.pitch)); cam.dist = Math.max(2.4, Math.min(11, cam.dist)); };
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = h > w ? 62 : 52; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  function update(dt, T, s) { // s = { player, others, mobs, nodes }
    dt = Math.min(dt, 0.1);
    sync0(s, dt, T);
    for (const p of portals) { const u = p.userData; u.r1.rotation.z = T * 0.0012; u.r2.rotation.z = -T * 0.0018; u.r1.position.y = 0.7 + Math.sin(T * 0.002) * 0.04; u.disc.material.opacity = 0.3 + Math.sin(T * 0.003) * 0.08; u.r1.rotation.y = u.r2.rotation.y = u.disc.rotation.y = cam.yaw; }
    clampCam();
    const P = s.player; if (!cam.init || Math.hypot(P.x - cam.tx, P.y - cam.ty) > 4) { cam.tx = P.x; cam.ty = P.y; cam.init = true; }
    const k = Math.min(1, dt * 9); cam.tx += (P.x - cam.tx) * k; cam.ty += (P.y - cam.ty) * k;
    const cp = Math.cos(cam.pitch), look = new THREE.Vector3(cam.tx, 0.4, cam.ty), hx = Math.sin(cam.yaw) * cp, hz = Math.cos(cam.yaw) * cp;
    let want = cam.dist; // กล้องไม่ทะลุตึก/ต้นไม้: เดินเส้นตรงจากผู้เล่นไปตำแหน่งกล้องบนกริด ชนช่องทึบแล้วถอยเข้า
    for (let d = 0.3; d <= cam.dist; d += 0.2) if (solidFn(cam.tx + hx * d, cam.ty + hz * d)) { want = Math.max(0.55, d - 0.3); break; }
    cam.eff += (want - cam.eff) * Math.min(1, dt * (want < cam.eff ? 16 : 3));
    camera.position.set(look.x + hx * cam.eff, look.y + Math.sin(cam.pitch) * cam.eff, look.z + hz * cam.eff); camera.lookAt(look);
    sun.position.set(look.x - 7, 13, look.z + 5); sun.target.position.set(look.x, 0, look.z); // เงาตามผู้เล่น
    renderer.render(scene, camera);
  }
  function sync0(s, dt, T) {
    const hum = (e) => buildAdventurer(e.job);
    syncKind('me', [s.player], hum, (r, e, mv) => animateAdventurer(r, { dt, moving: mv, swing: swingOf(e, T), down: e.down }), dt, T);
    syncKind('pl', [...s.others], hum, (r, e, mv) => animateAdventurer(r, { dt, moving: mv, swing: swingOf(e, T), down: e.down }), dt, T);
    syncKind('mob', [...s.mobs].filter((m) => m.kind !== 2), (e) => buildMonster(e.kind === 1), (r, e, mv) => { animateAdventurer(r, { dt, moving: mv, swing: -1, down: false }); r.root.scale.setScalar(r.base * (T - (e.flash ?? -1e9) < 110 ? 1.12 : 1)); }, dt, T); // โดนตี = ตัวพองแวบหนึ่ง
    syncKind('dummy', [...s.mobs].filter((m) => m.kind === 2), () => buildDummy(), () => {}, dt, T);
    syncKind('node', [...s.nodes], () => buildNode(), (r, e, mv, t) => { r.m.emissiveIntensity = T - (e.flash ?? -1e9) < 120 ? 3 : 0.9 + Math.sin(t * 0.003 + e.x) * 0.25; }, dt, T);
  }

  const v = new THREE.Vector3();
  const api = {
    setMap, update, camera, cam, labels: () => labels, info: renderer.info, sun, renderer,
    setSolid: (f) => { solidFn = f; }, get quality() { return quality; },
    setQuality(q) { quality = q; sun.castShadow = q >= 1; if (decor) decor.visible = q >= 2; renderer.setPixelRatio(q >= 2 ? Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2) : 1); resize(); },
    get forward() { return [-Math.sin(cam.yaw), -Math.cos(cam.yaw)]; }, // ทิศ "ข้างหน้า" ของกล้องบนระนาบเกม (x,y)
    project(x, y, h = 0) { v.set(x, h, y).project(camera); return v.z > 1 ? null : [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; },
  };
  api.setQuality(quality);
  return api;
}
