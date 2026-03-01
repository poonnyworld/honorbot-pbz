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

## ตรวจสาเหตุหลังข้อมูลหาย (Root cause checks)

หลังกู้คืนแล้ว ถ้าต้องการสืบหาสาเหตุที่แต้มหาย แนะนำให้ตรวจตามลำดับนี้:

1. **Discord Audit Log**  
   ในเซิร์ฟเวอร์ Discord: Server Settings → Audit Log  
   - ค้นหาการใช้คำสั่ง `/reset` หรือการลบข้อความที่เกี่ยวกับ backup  
   - ดูว่ามีผู้มีสิทธิ์ Administrator ใช้คำสั่ง reset หรือไม่

2. **ประวัติคำสั่ง Docker บนโฮสต์**  
   - ตรวจว่ามีการรัน `docker-compose down -v` หรือ `docker compose down -v` หรือไม่ (ตัว `-v` จะลบ volume ทำให้ข้อมูล MongoDB หาย)  
   - ตรวจ `docker volume ls` ว่ามี volume `*mongodb_data*` ของโปรเจกต์นี้อยู่หรือไม่

3. **Log ของ container บอท**  
   - รัน `docker compose logs app` (หรือ `docker-compose logs honorbot-app`) แล้วค้นหาบรรทัด `[Reset] Database reset completed by`  
   - ถ้ามี แสดงว่ามีการกด confirm คำสั่ง `/reset database` จาก Discord

---

## ฟีเจอร์อัตโนมัติที่เกี่ยวกับคะแนน (ไม่มีการรีเซ็ตแต้มโดยตรง)

ตรวจสอบแล้วว่า **ไม่มี feature อัตโนมัติที่ลบหรือรีเซ็ต `honorPoints` ทั้งดาต้าเบส**:

| Feature | ตารางเวลา / ทริกเกอร์ | การเขียน DB | ผลต่อ honorPoints |
|--------|---------------------------|-------------|---------------------|
| **BackupSchedulerService** | 00:00 และ 12:00 น. (ไทย) | ไม่เขียน — แค่ export อ่านแล้วส่งไปช่อง | ไม่กระทบ |
| **LeaderboardService (รายวัน)** | 00:00 UTC ทุกวัน | ไม่เขียน User — แค่อัปเดตข้อความใน Discord | ไม่กระทบ |
| **LeaderboardService (รายเดือน)** | 00:00 น. วันที่ 1 (ไทย) | อัปเดตเฉพาะ `honorPointsAtMonthStart` และ `lastMonthlySnapshotAt` **ไม่แก้ `honorPoints`** | ไม่กระทบ |
| **UserInteractionService** | ทุก 3 นาที | ไม่เขียน User — แค่ตรวจ/สร้างปุ่มในช่อง | ไม่กระทบ |
| **การแจกแต้มจากข้อความ (messageCreate)** | ทุกข้อความในแชท | บวกแต้มด้วย `$inc` (ถ้า deploy โค้ดล่าสุด) | ถ้า **ยังใช้ image เก่า** (ยังไม่ build ใหม่) โค้ดเก่าจะใช้ read-modify-write + `save()` → อาจทำให้แต้มหายเมื่อมีหลายเหตุการณ์พร้อมกัน |

สาเหตุที่แต้มดูเหมือนถูกรีเซ็ตบ่อยมักเป็นแบบใดแบบหนึ่งต่อไปนี้:

1. **ยังไม่ได้ build container ใหม่หลังแก้โค้ด** — บอทยังรัน image เก่าที่ใช้ `user.save()` หลังบวกแต้ม → มีโอกาส lost update เมื่อมีหลายข้อความหรือหลาย event พร้อมกัน  
   → **ควร build ใหม่แล้วขึ้น app ใหม่:** `docker compose build app && docker compose up -d app`

2. **มีคนใช้ `/reset database`** หรือ **ใช้ Dashboard แก้คะแนน** (เช่น ตั้งเป็น 0 หรือค่าต่ำ)  
   → ตรวจ Discord Audit Log และตรวจว่าใครเข้า Dashboard

3. **Volume MongoDB ถูกลบ** (เช่น รัน `docker compose down -v`)  
   → ตรวจประวัติคำสั่ง Docker

---

## การให้แต้มและความคงที่ของคะแนน (หลังแก้แล้ว)

หลังแก้โค้ดแล้ว **เมื่อผู้ใช้พิมพ์ข้อความแล้วได้แต้ม คะแนนในตารางจะไม่ถูกรีเซ็ตอีก** จากสาเหตุเดิม (race condition หรือ snapshot รายเดือน)

- **การให้แต้มจากข้อความ:** ใช้ atomic update (`User.findOneAndUpdate` + `$inc`) ใน `messageCreate.ts` — แต้มจะถูกบวกเพิ่มเข้า `honorPoints` โดยไม่มีการ read-modify-write ที่อาจทำให้แต้มหายเมื่อมีหลายข้อความพร้อมกัน  
- **ตาราง leaderboard รายเดือน:** คำนวณจาก `honorPoints - honorPointsAtMonthStart` เท่านั้น ฟังก์ชัน `updateMonthlySnapshot()` แค่ copy ค่าไปเก็บเป็น baseline **ไม่แก้หรือรีเซ็ต `honorPoints`**  
- สิ่งที่ "รีเซ็ต" ในระบบ (เช่น daily message count 5 ข้อความ/วัน, snapshot ต้นเดือนสำหรับมุมมองรายเดือน) **ไม่กระทบแต้มรวม** — มีเฉพาะคำสั่ง `/reset database` หรือการลบ volume ที่จะทำให้ข้อมูลหาย และต้องมีคนกด confirm เอง

ถ้า deploy โค้ดล่าสุด (ใช้ atomic update) และไม่มีการกด reset หรือลบ volume คะแนนจากการพิมพ์จะคงที่และสะสมต่อได้ตามปกติ

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

**ตัวเลือก `--after-date`:** ถ้า restore จาก backup ณ เวลาหนึ่ง (เช่น 7:22 น.) และต้องการนับเฉพาะข้อความที่ส่ง *หลัง* เวลานั้น ให้ใส่ `--after-date=ISO_DATE` (เวลาเป็น UTC):

```bash
npx ts-node scripts/replay-chat-export-to-points.ts "/path/to/export.xlsx" --after-date=2026-02-28T00:22:00
```

คำแนะนำ: ควร **restore จาก backup ก่อน** แล้วค่อยรัน replay จาก Excel เพื่อเพิ่มเฉพาะส่วนที่เกิดจากข้อความในแชท (Daily Check-in ยังไม่ได้นับจาก Excel ต้องพึ่ง backup หรือยอมรับว่าช่วงนั้นไม่มีการ replay)

---

## หมายเหตุ: Restore = สถานะ ณ วันที่ backup

เมื่อ restore จาก backup ใดๆ ข้อมูลใน DB จะเป็น **สถานะ ณ วันที่ที่ export backup นั้น**  
บอทไม่ได้เก็บประวัติการแชทหรือการกด Daily Check-in แยกไว้ จึง **ไม่สามารถย้อนเล่น (replay) ประวัติเพื่อให้แต้มเป็น “ปัจจุบัน”** ได้  
ทางเลือกที่เป็นไปได้: restore จาก backup ล่าสุดที่คุณมี แล้วให้ผู้ใช้สะสมแต้มต่อจากจุดนั้น

---

## ทำไม restart container แล้วข้อมูลหายหมด

โดยปกติ **การ restart container ไม่ควรทำให้ข้อมูลใน MongoDB หาย** เพราะข้อมูลอยู่ใน **volume** (`honorbot-pbz_mongodb_data`) ไม่ได้อยู่ใน container

ข้อมูลจะหายได้เมื่อเกิดแบบใดแบบหนึ่งต่อไปนี้:

1. **รัน `docker-compose down -v`**  
   ตัว **`-v`** จะลบ volumes ด้วย ดังนั้น `mongodb_data` จะถูกลบ ครั้งถัดไปที่รัน `up` MongoDB จะเริ่มด้วยข้อมูลเปล่า  
   → **ห้ามใช้ `-v` ถ้าต้องการเก็บข้อมูล** ใช้แค่ `docker-compose down` แล้วค่อย `docker-compose up -d`

2. **รันจากโฟลเดอร์หรือ project ละตัว**  
   ถ้ารัน `docker-compose` จากคนละโฟลเดอร์หรือคนละชื่อ project Docker จะสร้าง volume คนละตัว (เช่น `honorbot-pbz_mongodb_data` กับ `otherfolder_mongodb_data`)  
   → ต้องรันจากโฟลเดอร์โปรเจกต์เดิมเสมอ (เช่น `honorbot-pbz`) เพื่อให้ใช้ volume เดิม

3. **Bot ชี้ไปที่ database คนละตัว**  
   เช่น Local ใช้ `honorbot_local` แต่ VPS ใช้ `honorbot` หรือคนละเครื่องกัน  
   → ตรวจว่า Discord ที่คุณดูอยู่ต่อกับบอทตัวที่ชี้ไปที่ MongoDB ตัวที่คุณ restore ไว้

4. **Volume ถูกลบด้วยคำสั่งอื่น**  
   เช่น `docker volume rm` หรือ `docker system prune -a --volumes`  
   → หลีกเลี่ยงการลบ volume ของโปรเจกต์นี้

**ถ้าข้อมูลหายแล้ว:** ใช้ backup ล่าสุด restore กลับมา (เช่น `phantom_backup_2026-02-27-2.json`) แล้วตั้งค่าให้ชัดเจนว่า Local ใช้ `honorbot_local` VPS ใช้ `honorbot` และอย่าใช้ `down -v` อีก

---

## แยกข้อมูล Local กับ VPS (ไม่ให้ตีกัน)

ถ้าคุณรันบอททั้งบน **เครื่อง Local** (ทดสอบ) และบน **VPS** (production) โดยชี้ไปที่ MongoDB ตัวเดียวกัน หรือใช้ DB ชื่อเดียวกัน ข้อมูลจะทับกัน (ใครรันทีหลังจะเขียนทับอีกฝั่ง)

**วิธีแก้: ใช้คนละ database name**

- **บน VPS (production):** ใช้ database ชื่อ `honorbot` ตามเดิม  
  ```env
  MONGO_URI=mongodb://mongodb:27017/honorbot
  ```
- **บน Local (ทดสอบ):** ใช้ database อีกชื่อ เช่น `honorbot_local` หรือ `honorbot_dev`  
  ```env
  MONGO_URI=mongodb://localhost:27017/honorbot_local
  ```

เมื่อแยกแบบนี้ Local กับ VPS จะใช้ collection `users` คนละฐานข้อมูล ข้อมูลไม่ทับกัน  
ถ้าอยาก copy ข้อมูลจาก VPS มาเทสบน Local ให้ export backup จาก VPS แล้วรัน restore script บน Local โดยชี้ `MONGO_URI` ไปที่ `honorbot_local`

---

## ป้องกันไม่ให้หายอีก

1. **รัน backup เป็นระยะ**  
   ใช้ `/backup export` ใน Discord แล้วเก็บไฟล์ไว้ หรือตั้ง cron ให้ export ไปที่ `database-backups/` เป็นระยะ

2. **เก็บ mongodump ไว้**  
   รัน `mongodump` ตามช่วงที่ต้องการ (เช่นทุกสัปดาห์) แล้วเก็บโฟลเดอร์ dump ไว้

3. **อย่าให้คนที่ไม่ใช่ admin ใช้ `/reset database`**  
   คำสั่ง reset ต้องกด confirm สองครั้ง แต่ควรใช้เฉพาะ admin จริงเท่านั้น

---

## เปิดใช้ Auto Backup (00:00 และ 12:00 น. เวลาไทย)

Backup อัตโนมัติจะทำงานก็ต่อเมื่อ:

1. **ตั้งค่า `BACKUP_DATABASE_CHANNEL_ID` ใน `.env` ของ production**  
   - ใช้ Channel ID ของช่อง Discord ที่ต้องการรับไฟล์ backup (คลิกขวาที่ช่อง → Copy Channel ID)  
   - ค่าต้องเป็นตัวเลข 17–19 หลัก  
   - หลังแก้ `.env` ให้ restart container: `docker compose restart app`

2. **บอทต้องทำงานอยู่ตอน 00:00 และ 12:00 น. (Asia/Bangkok)**  
   - ถ้า container หยุดหรือ restart ในช่วงนั้น backup จะไม่รัน  
   - ตรวจว่า container `honorbot-app` มี uptime ครอบคลุมทั้งสองเวลา

3. **ถ้า backup ยังไม่รัน**  
   - ดู log ตอนสตาร์ทว่ามีข้อความ `[BackupScheduler] BACKUP_DATABASE_CHANNEL_ID not set or invalid` หรือไม่  
   - ถ้ามี แสดงว่า env ยังไม่ถูกต้องหรือไม่ได้ส่งเข้า container

---

## Export แต้มรายเดือนไปช่อง Backup (เที่ยงคืนสิ้นเดือน)

เมื่อตั้งค่า **`BACKUP_LEADERBOARD_CHANNEL_ID`** ใน `.env` (Channel ID ของช่องที่ต้องการรับไฟล์รายเดือน) บอทจะส่ง **export ข้อมูลแต้มรายเดือน** ไปที่ช่องนั้นอัตโนมัติทุกครั้งที่ถึง **เที่ยงคืนของวันสิ้นเดือน** (เวลา 00:00 น. วันที่ 1 ของเดือนถัดไป เวลาไทย)

- ส่งเป็น **ไฟล์ JSON** (สรุป Top 10 แต้มรายเดือน + ข้อมูลเดือนที่ export)
- ส่ง **embed** แสดงอันดับรายเดือนในช่องเดียวกัน

ถ้าไม่ตั้ง `BACKUP_LEADERBOARD_CHANNEL_ID` ฟีเจอร์นี้จะไม่ทำงาน (ดู log ตอนสตาร์ทว่า `BACKUP_LEADERBOARD_CHANNEL_ID` เป็น not set หรือไม่)

---

## ระยะยาว: แยก DB ต่อแอปและ backup จากโฮสต์

- **แยก database ต่อแอป:** โปรเจกต์อื่น (เช่น pbz-bounty, phantom-melody) ที่ใช้ MongoDB ตัวเดียวกันกับ Honor Bot ใช้ database ชื่อ `honorbot` และ collection `users` ร่วมกัน เพื่อลดความเสี่ยงการเขียนทับหรือ schema ไม่ตรงกัน แนะนำให้แยก database เช่น ให้ Honor Bot ใช้ `honorbot` เหมือนเดิม และให้แอปอื่นใช้ชื่ออื่น (เช่น `honorbot_bounty`, `phantom_radio`) แล้วตั้ง `MONGO_URI` ของแต่ละแอปให้ชี้ไปที่ database ของตัวเอง

- **Backup จากโฮสต์ (cron):** ถ้าต้องการไม่พึ่งแค่ process บอท สามารถตั้ง cron บนโฮสต์ให้รัน export เป็นระยะได้ เช่น สร้างสคริปต์ที่ต่อ MongoDB แล้วเรียก logic export (หรือใช้ `mongodump`) แล้วเขียนไฟล์ลง `database-backups/` หรือส่งไปที่เก็บอื่น
