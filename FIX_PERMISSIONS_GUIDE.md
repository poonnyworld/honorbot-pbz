# 🔧 คู่มือแก้ไข Permissions และ Missing Access

## 📊 สรุปปัญหาจาก Logs

### ❌ ปัญหาที่พบ:

1. **Missing Access (50001)** - บอทไม่สามารถเข้าถึง channels:
   - Profile channel: `1463915386750894154`
   - Tasks channel: `1464941957464985787`
   - Gamble channel: `1463915315229491261`
   - Instruction channel: `1463915118860439751`
   - Status channel: `1463599272199983221`

2. **Bot lacks required permissions** - บอทไม่มี permissions:
   - ❌ SendMessages=false (ต้องเป็น true)
   - ❌ ManageMessages=false (ต้องเป็น true)
   - ✅ ViewChannel=true (ดีแล้ว)

---

## 🔍 ขั้นตอนการแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบว่า Channels ยังมีอยู่

1. เปิด Discord Server
2. ตรวจสอบว่า channels เหล่านี้ยังมีอยู่:
   - `#honor-leaderboard` (ID: 1463915474566905921)
   - Daily checking channel (ID: 1463915589042044949)
   - Profile channel (ID: 1463915386750894154)
   - Tasks channel (ID: 1464941957464985787)
   - Gamble channel (ID: 1463915315229491261)
   - Instruction channel (ID: 1463915118860439751)
   - Status channel (ID: 1463599272199983221)

3. **ถ้า channel หายไป:**
   - สร้าง channel ใหม่
   - อัพเดท Channel ID ใน `.env` file

---

### ขั้นตอนที่ 2: ตั้งค่า Permissions ในแต่ละ Channel

#### วิธีที่ 1: ตั้งค่า Channel-Specific Permissions (แนะนำ)

สำหรับแต่ละ channel ที่มีปัญหา:

1. **คลิกขวาที่ Channel** → **Edit Channel**
2. ไปที่แท็บ **Permissions**
3. คลิก **Add Role or Member**
4. เลือกบอท (Honor Keeper)
5. ติ๊ก permissions ต่อไปนี้:
   - ✅ **View Channel** (ต้องมี)
   - ✅ **Send Messages** (สำคัญมาก!)
   - ✅ **Manage Messages** (สำคัญมาก!)
   - ✅ **Read Message History**
   - ✅ **Embed Links**
   - ✅ **Attach Files**

6. คลิก **Save Changes**

#### วิธีที่ 2: ตั้งค่า Role Permissions (สำหรับทุก Channel)

1. ไปที่ **Server Settings** → **Roles**
2. หา role ของบอท (ชื่อ: Honor Keeper หรือชื่อบอท)
3. คลิกที่ role → ไปที่ **Permissions**
4. ติ๊ก permissions:
   - ✅ **View Channels**
   - ✅ **Send Messages**
   - ✅ **Manage Messages**
   - ✅ **Read Message History**
   - ✅ **Embed Links**
   - ✅ **Attach Files**
5. คลิก **Save Changes**

---

### ขั้นตอนที่ 3: ตรวจสอบว่า Bot อยู่ใน Server

1. ไปที่ **Server Settings** → **Members**
2. ตรวจสอบว่าบอท "Honor Keeper" อยู่ใน member list
3. **ถ้าไม่มี:**
   - เชิญบอทใหม่ด้วยลิงก์:
     ```
     https://discord.com/api/oauth2/authorize?client_id=1463909626792775680&permissions=125952&scope=bot%20applications.commands
     ```

---

### ขั้นตอนที่ 4: ตรวจสอบ Channel Visibility

บาง channel อาจถูกซ่อนจากบอท:

1. ไปที่ **Channel Settings** → **Permissions**
2. ตรวจสอบว่า **@everyone** หรือ role ของบอทมี:
   - ✅ **View Channel** permission
3. **ถ้า channel ถูกซ่อน:**
   - เพิ่มบอทใน **Permissions** และให้ **View Channel**

---

### ขั้นตอนที่ 5: Restart Bot

หลังจากแก้ไข permissions แล้ว:

```bash
cd /root/honorbot-pbz
docker-compose restart app
```

ตรวจสอบ logs:

```bash
docker-compose logs -f app
```

ควรเห็น:
- ✅ `Bot permissions: SendMessages=true, ViewChannel=true, ManageMessages=true`
- ✅ ไม่มี error "Missing Access"
- ✅ ไม่มี error "Bot lacks required permissions"

---

## 📋 Checklist การแก้ไข

### สำหรับแต่ละ Channel:

- [ ] Channel ยังมีอยู่
- [ ] Bot มี **View Channel** permission
- [ ] Bot มี **Send Messages** permission
- [ ] Bot มี **Manage Messages** permission
- [ ] Bot มี **Read Message History** permission
- [ ] Bot มี **Embed Links** permission
- [ ] Bot มี **Attach Files** permission

### Channels ที่ต้องตรวจสอบ:

- [ ] Leaderboard Channel (1463915474566905921)
- [ ] Daily Checking Channel (1463915589042044949)
- [ ] Profile Channel (1463915386750894154)
- [ ] Tasks Channel (1464941957464985787)
- [ ] Gamble Channel (1463915315229491261)
- [ ] Instruction Channel (1463915118860439751)
- [ ] Status Channel (1463599272199983221)

---

## 🚨 ปัญหาที่พบบ่อย

### ปัญหา: Missing Access (50001)

**สาเหตุ:**
- Channel ถูกซ่อนจากบอท
- Bot ไม่มี View Channel permission
- Channel ถูกลบไปแล้ว

**แก้ไข:**
1. ตรวจสอบว่า channel ยังมีอยู่
2. เพิ่มบอทใน channel permissions
3. ให้ **View Channel** permission

### ปัญหา: SendMessages=false

**สาเหตุ:**
- Bot ไม่มี Send Messages permission

**แก้ไข:**
1. ไปที่ channel settings
2. เพิ่มบอทใน permissions
3. ติ๊ก **Send Messages**

### ปัญหา: ManageMessages=false

**สาเหตุ:**
- Bot ไม่มี Manage Messages permission

**แก้ไข:**
1. ไปที่ channel settings
2. เพิ่มบอทใน permissions
3. ติ๊ก **Manage Messages**

---

## ✅ วิธีตรวจสอบว่าแก้ไขสำเร็จ

หลังจากแก้ไขและ restart bot แล้ว ตรวจสอบ logs:

```bash
docker-compose logs -f app | grep -E "(permissions|Missing Access|lacks required)"
```

ควรเห็น:
- ✅ `SendMessages=true`
- ✅ `ManageMessages=true`
- ✅ ไม่มี error "Missing Access"
- ✅ ไม่มี error "Bot lacks required permissions"

---

## 📞 Quick Fix Script

สร้างสคริปต์เพื่อตรวจสอบ permissions:

```bash
# ตรวจสอบ bot status
docker-compose ps app

# ดู logs ล่าสุด
docker-compose logs --tail=50 app | grep -i "permission\|access"

# Restart bot
docker-compose restart app

# ดู logs แบบ real-time
docker-compose logs -f app
```

---

**หมายเหตุ:** หลังจากแก้ไข permissions แล้ว ต้อง restart bot เพื่อให้การเปลี่ยนแปลงมีผล
