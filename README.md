# Thailand Leveling (ไทยแลนด์ เลเวลลิง)

2.5D Isometric Web MMORPG — ฮันเตอร์ในกรุงเทพฯ ที่มี Gate ปรากฏกลางเมือง (Mobile Landscape)

## รัน

ต้องใช้ Node ≥ 22.5

```bash
npm install
npm run dev            # http://localhost:3000
```

เปิด `http://localhost:3000/?dev=Fighter` เพื่อเดินในเมืองได้เลย (ข้าม login — เปลี่ยน `Fighter` เป็น Assassin/Mage/Tank/Healer/Miner ได้)
คุม (กล้องบุคคลที่สาม): **W/A/S/D** หรือแตะ/ลากครึ่งซ้ายของจอ (joystick ลอย) เดินตามทิศที่กล้องมอง · **หมุนกล้อง**: ลากครึ่งขวาของจอ / ลูกศร / ลากเมาส์ขวา · **ซูม**: ล้อเมาส์ · **โจมตี/ขุดแร่**: Space หรือกดปุ่ม · สกิล 1/2, น้ำมนต์ 3, พยุง E, ประตู/ตลาด/สมาคม F
ต้องมี WebGL (เบราว์เซอร์ทั่วไป/มือถือรุ่นใหม่)

## Firebase Auth (เชื่อมแล้ว: โปรเจกต์ `astra-892a8`)

`client/firebase-config.js` ใส่ค่าไว้แล้ว และ server ใช้ project id เดียวกันเป็นค่าเริ่มต้น (`FIREBASE_PROJECT_ID` เปลี่ยนได้)
ต้องเปิดใน Firebase Console ด้วย (ครั้งเดียว):
1. Build → **Authentication** → Sign-in method → เปิด **Email/Password**
2. Authentication → Settings → **Authorized domains** → เพิ่มโดเมนที่ใช้เปิดเกม (`localhost` มีให้แล้ว; ตอนขึ้นจริงเพิ่มโดเมน Vercel)

จากนั้น `npm run dev` → เปิด `http://localhost:3000/` → สมัคร → สร้างตัวละคร

ตัวแปรของ server: `FIREBASE_PROJECT_ID`, `DB_PATH` (ค่าเริ่มต้น `data/game.db`), `ALLOWED_ORIGIN` (CORS, ค่าเริ่มต้น `*`), `PORT`

> ⚠️ ตอนนี้ฐานข้อมูลเป็นไฟล์ SQLite ในเครื่อง ใช้พัฒนาได้ แต่ **Render free ลบดิสก์ทุกครั้งที่ restart** — ก่อนเปิดจริงต้องย้ายไป D1 (PLAN.md)

## ทดสอบ

```bash
npm test               # สูตร + API (token ปลอม/หมดอายุ, สร้างตัวละคร, ชื่อซ้ำ, validation)
npm run validate       # ตัวเลข balance.json สอดคล้องกัน
```

## เอกสาร

| ไฟล์ | เนื้อหา |
| :--- | :--- |
| [`docs/GDD_v5.1.md`](docs/GDD_v5.1.md) | **GDD ฉบับปัจจุบัน** (Changelog จาก v5.0 อยู่ด้านบน) |
| [`docs/GDD_v5.0.md`](docs/GDD_v5.0.md) | ฉบับเดิม เก็บไว้อ้างอิง |
| [`PLAN.md`](PLAN.md) | แผนและสถานะการพัฒนา |
| [`shared/balance.json`](shared/balance.json) | **ตัวเลขเกมทั้งหมด** — client/server อ่านจากไฟล์นี้ |
