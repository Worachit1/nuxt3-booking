# 🔧 คู่มือแก้ปัญหา API Connection

## ❌ ปัญหา: ERROR Fetch handler error: fetch failed (ECONNRESET)

### สาเหตุหลัก:
1. **API Server ไม่ได้เปิดทำงาน** - Backend server ไม่ได้ run
2. **Port ผิด** - API server ใช้ port ที่แตกต่างจากที่ตั้งค่าไว้
3. **IP Address เปลี่ยน** - เครือข่ายเปลี่ยน IP address
4. **CORS ปัญหา** - Backend ไม่อนุญาต request จาก frontend
5. **Firewall/Network** - Firewall หรือ network blocking connection

---

## ✅ วิธีแก้ไข

### 1. ตรวจสอบ API Server

#### ตรวจสอบว่า API Server ทำงานหรือไม่:
```bash
# เปิด browser หรือใช้ Postman ทดสอบ
http://192.168.0.190:8080
http://192.168.0.190:8080/health
http://192.168.0.190:8080/api/v1/users/list
```

#### ถ้า API Server ไม่ทำงาน:
```bash
# ไปที่ folder backend และรัน
cd path/to/your/backend
npm run dev
# หรือ
go run main.go
# หรือ
python app.py
```

---

### 2. ตรวจสอบและแก้ไข API URL

#### ตรวจสอบไฟล์ `.env`:
```env
# ไฟล์: .env
NUXT_PUBLIC_API_BASE=http://192.168.0.190:8080
```

#### เปลี่ยน API URL ตามสถานการณ์:

**สำหรับ Development (เครื่องเดียวกัน):**
```env
NUXT_PUBLIC_API_BASE=http://localhost:8080
```

**สำหรับ Development (เครื่องอื่นในเครือข่ายเดียวกัน):**
```env
# หา IP ของเครื่อง:
# Windows: ipconfig
# Mac/Linux: ifconfig
NUXT_PUBLIC_API_BASE=http://192.168.x.x:8080
```

**สำหรับ Production:**
```env
NUXT_PUBLIC_API_BASE=https://api.yourdomain.com
```

---

### 3. ตรวจสอบ Port

#### ตรวจสอบว่า Backend ใช้ port อะไร:
```bash
# Windows
netstat -ano | findstr :8080

# Mac/Linux
lsof -i :8080
```

#### ถ้า Backend ใช้ port อื่น (เช่น 3001):
```env
NUXT_PUBLIC_API_BASE=http://localhost:3001
```

---

### 4. แก้ปัญหา CORS (Backend)

#### สำหรับ Node.js/Express:
```javascript
// backend/server.js
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://192.168.0.190:3000',
  ],
  credentials: true,
}));
```

#### สำหรับ Go/Gin:
```go
// backend/main.go
import "github.com/gin-contrib/cors"

r := gin.Default()
r.Use(cors.New(cors.Config{
    AllowOrigins: []string{
        "http://localhost:3000",
        "http://192.168.0.190:3000",
    },
    AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
}))
```

---

### 5. รีสตาร์ท Nuxt Application

หลังจากเปลี่ยน `.env`:

```bash
# หยุด dev server (Ctrl+C)
# แล้วรันใหม่
npm run dev
```

---

## 🔍 การ Debug

### 1. ตรวจสอบ Network Tab:
1. เปิด Developer Tools (F12)
2. ไปที่ Tab Network
3. Refresh หน้า
4. ดูว่า request ไป URL ไหน
5. ดู Status Code และ Error Message

### 2. ตรวจสอบ Console:
1. เปิด Developer Tools (F12)
2. ไปที่ Tab Console
3. ดู Error Message ที่แสดง

### 3. ใช้ API Status Banner:
- ระบบจะแสดงแบนเนอร์สีแดงด้านบนหากเชื่อมต่อ API ไม่ได้
- คลิก "ลองอีกครั้ง" เพื่อตรวจสอบการเชื่อมต่อใหม่

---

## 🚀 Quick Fix Steps

### Step 1: เช็ค Backend
```bash
# ตรวจสอบว่า backend ทำงานหรือไม่
curl http://192.168.0.190:8080/health
# หรือเปิดใน browser
```

### Step 2: เช็ค Frontend Config
```bash
# ดูไฟล์ .env
cat .env
# หรือ
notepad .env
```

### Step 3: Restart
```bash
# Restart Nuxt
Ctrl+C
npm run dev
```

---

## 📝 Checklist

- [ ] Backend server กำลังทำงาน
- [ ] Port ถูกต้อง (8080, 3001, etc.)
- [ ] IP Address ถูกต้อง
- [ ] CORS configuration ถูกต้อง
- [ ] Firewall ไม่ได้ block
- [ ] `.env` มีการตั้งค่า `NUXT_PUBLIC_API_BASE`
- [ ] Restart Nuxt หลังเปลี่ยน `.env`

---

## 💡 Tips

### ใช้ localhost แทน IP:
```env
# แทนที่จะใช้
NUXT_PUBLIC_API_BASE=http://192.168.0.190:8080

# ใช้
NUXT_PUBLIC_API_BASE=http://localhost:8080
```
**ข้อดี:** ไม่ต้องเปลี่ยนเมื่อ IP เปลี่ยน

### ใช้ Mock Data:
หากไม่มี Backend ให้ใช้ mock data ชั่วคราว:
```typescript
// store/userStore.ts
async fetchUsers() {
  try {
    const response = await axios.get(`${config.public.apiBase}/api/v1/users/list`);
    this.users = response.data.data;
  } catch (error) {
    // Fallback to mock data
    console.warn('Using mock data');
    this.users = [
      { id: 1, name: 'Test User', email: 'test@example.com' },
    ];
  }
}
```

---

## 🆘 ยังแก้ไม่ได้?

1. **ตรวจสอบ Backend Logs** - ดู error ใน terminal ของ backend
2. **ตรวจสอบ Firewall** - ปิด firewall ชั่วคราวเพื่อทดสอบ
3. **ใช้ Postman** - ทดสอบ API โดยตรง
4. **เช็ค Network** - ตรวจสอบว่าเชื่อมเครือข่ายเดียวกัน

---

## 📞 ติดต่อ Support

หากยังมีปัญหา กรุณาแจ้ง:
- URL ที่พยายามเชื่อมต่อ
- Error message ทั้งหมด
- Screenshot จาก Network Tab
- Backend logs
