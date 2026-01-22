# MongoDB Connection Troubleshooting

## ปัญหา: "Database connection is not available"

### วิธีแก้ไขทีละขั้นตอน

## 1. ตรวจสอบว่า MongoDB Container รันอยู่หรือไม่

```bash
# ตรวจสอบสถานะ containers
docker-compose ps

# หรือ
docker ps | grep mongodb
```

**ควรเห็น:**
```
honorbot-mongodb    Up   27017/tcp
```

**ถ้าไม่เห็น:**
```bash
# Start MongoDB container
docker-compose up -d mongodb

# หรือ start ทั้งหมด
docker-compose up -d
```

## 2. ตรวจสอบ MONGO_URI ใน .env

**สำหรับ Docker Compose ต้องใช้:**
```env
MONGO_URI=mongodb://mongodb:27017/honorbot
```

**❌ ผิด:**
```env
MONGO_URI=mongodb://localhost:27017/honorbot  # ใช้ไม่ได้ใน Docker!
MONGO_URI=mongodb://127.0.0.1:27017/honorbot  # ใช้ไม่ได้ใน Docker!
```

**✅ ถูกต้อง:**
```env
MONGO_URI=mongodb://mongodb:27017/honorbot
```

**หมายเหตุ:** `mongodb` คือชื่อ service ใน docker-compose.yml

## 3. ตรวจสอบ Logs

```bash
# ดู logs ของ MongoDB
docker-compose logs mongodb

# ดู logs ของ Bot
docker-compose logs app | grep -i mongo
```

**ควรเห็น:**
```
✓ MongoDB connected successfully
```

**ถ้าเห็น error:**
```
❌ MongoDB connection error: ...
ECONNREFUSED
```

## 4. ตรวจสอบ Network Connection

```bash
# Test connection จาก app container ไป mongodb
docker-compose exec app ping -c 3 mongodb

# หรือ test MongoDB connection โดยตรง
docker-compose exec app node -e "require('mongoose').connect('mongodb://mongodb:27017/honorbot').then(() => console.log('Connected!')).catch(e => console.error('Error:', e.message))"
```

## 5. Restart ทั้งหมด

```bash
# Stop ทั้งหมด
docker-compose down

# Start ใหม่ (จะรอ MongoDB พร้อมก่อน)
docker-compose up -d

# ดู logs
docker-compose logs -f app
```

## 6. ตรวจสอบ Health Check

MongoDB container ต้องผ่าน health check ก่อน app จะ start:

```bash
# ดู health status
docker inspect honorbot-mongodb | grep -A 10 Health
```

**ควรเห็น:**
```json
"Health": {
    "Status": "healthy"
}
```

## 7. แก้ไข .env File

ตรวจสอบว่า `.env` มี:

```env
# MongoDB (สำหรับ Docker)
MONGO_URI=mongodb://mongodb:27017/honorbot

# Discord
DISCORD_TOKEN=your_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# Channels
LEADERBOARD_CHANNEL_ID=your_channel_id
DAILYCHECKING_CHANNEL_ID=your_channel_id
PROFILE_CHANNEL_ID=your_channel_id
STATUS_CHANNEL_ID=your_channel_id
LEADERBOARD_BUTTON_CHANNEL_ID=your_channel_id
GAMBLE_CHANNEL_ID=your_channel_id
HELP_CHANNEL_ID=your_channel_id

# Dashboard
PORT=3000
WEB_USER=admin
WEB_PASS=your_password
```

## 8. Rebuild และ Restart

```bash
# Rebuild และ restart
docker-compose up --build -d

# ดู logs เพื่อตรวจสอบ
docker-compose logs -f app
```

**ควรเห็น:**
```
[MongoDB] Attempting to connect to MongoDB at mongodb://mongodb:27017/honorbot...
✓ MongoDB connected successfully
```

## 9. ถ้ายังไม่ได้ผล - ลบและสร้างใหม่

```bash
# ⚠️ ระวัง: จะลบข้อมูลทั้งหมด!
docker-compose down -v

# Build และ start ใหม่
docker-compose up --build -d
```

## Quick Fix Script

```bash
#!/bin/bash
# Quick fix สำหรับ MongoDB connection

echo "1. Stopping containers..."
docker-compose down

echo "2. Checking .env file..."
if ! grep -q "MONGO_URI=mongodb://mongodb:27017/honorbot" .env; then
    echo "⚠️  Fixing MONGO_URI in .env..."
    sed -i.bak 's|MONGO_URI=.*|MONGO_URI=mongodb://mongodb:27017/honorbot|g' .env
    echo "✅ Fixed!"
fi

echo "3. Starting MongoDB..."
docker-compose up -d mongodb

echo "4. Waiting for MongoDB to be ready..."
sleep 10

echo "5. Starting app..."
docker-compose up -d app

echo "6. Checking logs..."
docker-compose logs -f app
```

## Common Issues

### Issue 1: MONGO_URI ใช้ localhost
**แก้:** เปลี่ยนเป็น `mongodb://mongodb:27017/honorbot`

### Issue 2: MongoDB container ไม่ start
**แก้:** 
```bash
docker-compose up -d mongodb
docker-compose logs mongodb
```

### Issue 3: App start ก่อน MongoDB พร้อม
**แก้:** docker-compose มี `depends_on` อยู่แล้ว แต่ถ้ายังมีปัญหา:
```bash
docker-compose restart app
```

### Issue 4: Network issue
**แก้:**
```bash
docker network ls
docker network inspect honorbot-pbz_default
```

## ตรวจสอบว่าแก้ไขแล้ว

หลังจากแก้ไขแล้ว ตรวจสอบ:

1. **Bot logs:**
```bash
docker-compose logs app | grep MongoDB
```
ควรเห็น: `✓ MongoDB connected successfully`

2. **Test button:**
- กดปุ่ม Profile ใน Discord
- ควรแสดงข้อมูลได้ ไม่มี error

3. **Dashboard:**
- เปิด http://localhost:3000
- ควรเห็นข้อมูล users ได้
