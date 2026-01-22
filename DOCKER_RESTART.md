# Docker Restart Guide

## หลังจากเปลี่ยน .env และโค้ด

### วิธีที่ 1: Rebuild และ Restart (แนะนำ)

```bash
docker-compose up --build -d
```

คำสั่งนี้จะ:
- ✅ Rebuild Docker image (compile โค้ดใหม่)
- ✅ Restart container (อ่าน .env ใหม่)
- ✅ Start services ทั้งหมด

### วิธีที่ 2: Restart แค่ Container (ถ้าแค่เปลี่ยน .env)

```bash
docker-compose restart app
```

**⚠️ หมายเหตุ:** วิธีนี้จะไม่ rebuild image ใหม่ ถ้าโค้ดเปลี่ยนต้องใช้วิธีที่ 1

### วิธีที่ 3: Stop และ Start ใหม่

```bash
docker-compose down
docker-compose up --build -d
```

## ตรวจสอบ Logs

หลังจาก restart แล้ว ตรวจสอบ logs:

```bash
# ดู logs ทั้งหมด
docker-compose logs -f

# ดู logs แค่ bot
docker-compose logs -f app

# ดู logs แค่ MongoDB
docker-compose logs -f mongodb
```

## ตรวจสอบว่า Bot ทำงานถูกต้อง

ใน logs ควรเห็น:
```
[UserInteractionService] Initializing user interaction service...
[UserInteractionService] Setting up all persistent buttons...
[UserInteractionService] ✓ profile button message sent successfully
[UserInteractionService] ✓ status button message sent successfully
[UserInteractionService] ✓ leaderboard button message sent successfully
[UserInteractionService] ✓ gamble button message sent successfully
[UserInteractionService] ✓ help button message sent successfully
```

## Troubleshooting

### ถ้า Buttons ไม่ปรากฏ

1. ตรวจสอบ Channel IDs ใน .env ว่าถูกต้อง
2. ตรวจสอบว่า Bot มี permissions ใน channels
3. ดู logs ว่ามี error อะไร

### ถ้า Container ไม่ Start

```bash
# ดู logs เพื่อหาสาเหตุ
docker-compose logs app

# ลบ container และ volumes (ระวัง: จะลบข้อมูล)
docker-compose down -v

# Build และ Start ใหม่
docker-compose up --build -d
```
