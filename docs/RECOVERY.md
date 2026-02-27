# กู้คืน Honor Points ที่หายไป (Recovery Guide)

## ทำไมแต้มถึงหายไปได้ (สาเหตุที่เป็นไปได้)

1. **มีการใช้คำสั่ง `/reset database`**  
   คำสั่งนี้จะลบผู้ใช้ทั้งหมดในฐานข้อมูล ถ้ามีคนกด confirm สองครั้ง ข้อมูลจะถูกลบและผู้ใช้ที่กลับมาใช้บอทจะได้แต้มเริ่มต้นใหม่ (0 แล้วค่อยสะสมใหม่)

2. **การ restore ฐานข้อมูลจาก backup เก่า**  
   ถ้ามีการ restore MongoDB จาก backup ที่เป็น snapshot เก่า (ก่อนที่ผู้ใช้จะสะสมแต้ม) ข้อมูลใน DB จะถูกแทนที่ด้วยข้อมูลใน backup นั้น

3. **MongoDB ถูกเปลี่ยนหรือสร้างใหม่**  
   เช่น เปลี่ยน server, สร้าง DB ใหม่, ลบ collection `users` เอง

4. **การ deploy/ย้ายเครื่องใหม่โดยไม่มี backup**  
   ถ้าไม่มี export และไม่มี mongodump ข้อมูลจะอยู่แค่บนเครื่องเก่า

---

## กู้คืนได้หรือไม่

**กู้คืนได้** ถ้ามีไฟล์ backup ที่ยังเก็บข้อมูล Honor Points ไว้อยู่

โปรเจกต์นี้มี backup อยู่แล้วในโฟลเดอร์ `database-backups/`:

| ไฟล์ | รูปแบบ | วิธีใช้ |
|------|--------|--------|
| `users_export.json` | NDJSON (บรรทัดละ 1 user) | สคริปต์ restore ด้านล่าง หรือแปลงเป็น array แล้วใช้ `/backup import` ใน Discord |
| `honorbot_dump_20260201/` | mongodump (BSON) | ใช้ `mongorestore` |

---

## วิธีที่ 1: กู้จากไฟล์ JSON (users_export.json)

ใช้สคริปต์ที่อ่าน `users_export.json` แล้วอัปเดต MongoDB ตาม `userId` (upsert) — **จะเขียนทับเฉพาะฟิลด์ที่อยู่ใน backup เช่น honorPoints, dailyPoints, streak ฯลฯ**

```bash
cd /root/honorbot-pbz
npx ts-node scripts/restore-from-json-backup.ts
```

หรือระบุ path ไฟล์ backup เอง:

```bash
npx ts-node scripts/restore-from-json-backup.ts /path/to/your/backup.json
```

- ไฟล์ backup ต้องเป็น **JSON array** `[{...}, {...}]` หรือ **NDJSON** (หนึ่งบรรทัดต่อหนึ่ง object)
- ถ้า backup เป็นรูปแบบ MongoDB extended JSON (`$date`, `$oid`) สคริปต์จะแปลงให้ก่อน import

หลังรันเสร็จ ให้ restart บอทหรือรอให้ dashboard โหลดข้อมูลใหม่ แต้มใน Admin Panel ควรตรงกับ backup แล้ว

---

## วิธีที่ 2: กู้จาก mongodump (honorbot_dump_20260201)

ถ้าต้องการ **ย้อนทั้ง collection กลับไปเป็นสภาพตอน dump** (เช่น วันที่ 1 ก.พ. 2026):

```bash
# ต้องมี mongorestore (มาพร้อม MongoDB Tools)
mongorestore --uri="mongodb://localhost:27017" --db=honorbot --collection=users --drop \
  /root/honorbot-pbz/database-backups/honorbot_dump_20260201/honorbot/users.bson
```

- แทน `mongodb://localhost:27017` ด้วย `MONGO_URI` จริงถ้าใช้ Docker/Atlas (เช่น `mongodb://mongodb:27017/honorbot`)
- `--drop` จะลบ collection `users` เดิมก่อน แล้วค่อยใส่ข้อมูลจาก dump

---

## วิธีที่ 3: กู้ผ่าน Discord (/backup import)

ถ้ามีไฟล์ backup เป็น **JSON array** (ไม่ใช่ NDJSON):

1. แปลงไฟล์ให้เป็น array เดียว เช่น `[{...}, {...}]`
2. ใน Discord ใช้คำสั่ง `/backup import` แล้วแนบไฟล์นั้น

ข้อจำกัด: ไฟล์ต้องไม่เกิน 10MB และต้องเป็น `.json`

---

## ย้อนแต้มจากประวัติแชท (Excel export)

ถ้าคุณ **export ประวัติแชท** ของแชนเนลออกมาเป็น Excel (`.xlsx`) เราสามารถใช้สคริปต์ **replay** นับข้อความตามกฎของบอท (สูงสุด 5 ข้อความต่อวันต่อคน) แล้วเพิ่ม Honor Points ให้ตรงกับช่วงนั้นได้

- ไฟล์ Excel ต้องมีคอลัมน์ **วันที่** (เช่น Date, Timestamp, Time) และ **ผู้ส่ง** (Author, Username, User)
- ถ้ามีคอลัมน์ **Author ID** หรือ **User ID** จะใช้แมปกับ Discord user ID ใน DB ได้ตรงกว่า (ชื่ออาจเปลี่ยน)
- กฎเดียวกับบอท: สูงสุด 5 ข้อความต่อวันต่อคน นับแต้ม; แต้มต่อข้อความใช้ค่าเฉลี่ย 2 (แทนการสุ่ม 1–5)

รัน (ใส่ path ไฟล์จริงของคุณ):

```bash
cd /root/honorbot-pbz
npx ts-node scripts/replay-chat-export-to-points.ts "/path/to/PBZ | General Chat (EN)-2.xlsx"
```

คำแนะนำ: ควร **restore จาก backup วันที่ 18 ก.พ. ก่อน** แล้วค่อยรัน replay จาก Excel เพื่อเพิ่มเฉพาะส่วนที่เกิดจากข้อความในแชท (Daily Check-in ยังไม่ได้นับจาก Excel ต้องพึ่ง backup หรือยอมรับว่าช่วงนั้นไม่มีการ replay)

---

## หมายเหตุ: Restore = สถานะ ณ วันที่ backup

เมื่อ restore จาก backup ใดๆ ข้อมูลใน DB จะเป็น **สถานะ ณ วันที่ที่ export backup นั้น**  
บอทไม่ได้เก็บประวัติการแชทหรือการกด Daily Check-in แยกไว้ จึง **ไม่สามารถย้อนเล่น (replay) ประวัติเพื่อให้แต้มเป็น “ปัจจุบัน”** ได้  
ทางเลือกที่เป็นไปได้: restore จาก backup ล่าสุดที่คุณมี แล้วให้ผู้ใช้สะสมแต้มต่อจากจุดนั้น

---

## ป้องกันไม่ให้หายอีก

1. **รัน backup เป็นระยะ**  
   ใช้ `/backup export` ใน Discord แล้วเก็บไฟล์ไว้ หรือตั้ง cron ให้ export ไปที่ `database-backups/` เป็นระยะ

2. **เก็บ mongodump ไว้**  
   รัน `mongodump` ตามช่วงที่ต้องการ (เช่นทุกสัปดาห์) แล้วเก็บโฟลเดอร์ dump ไว้

3. **อย่าให้คนที่ไม่ใช่ admin ใช้ `/reset database`**  
   คำสั่ง reset ต้องกด confirm สองครั้ง แต่ควรใช้เฉพาะ admin จริงเท่านั้น
