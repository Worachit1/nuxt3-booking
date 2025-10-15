# 🔍 AI Search Flow - คู่มือเข้าใจการทำงาน

## 📊 Flow การทำงานทั้งหมด

### 1️⃣ User พิมพ์คำค้นหา
```
Input: "ฉันต้องการห้องคอมพิวเตอร์"
```

### 2️⃣ Frontend รวบรวมข้อมูล (index.vue)
```javascript
// รวบรวมห้องทั้งหมดจากทุกอาคาร
const allRooms = [
  {
    id: "fe781e21-...",
    name: "NK 1201",
    description: "ห้องเรียนสำหรับการบรรยาย ชั้นที่2 ห้องที่1",
    capacity: 40,
    building: "อาคารบริหาร",
    is_available: false
  },
  {
    id: "08503ff8-...",
    name: "NK 1202",
    description: "ห้องเรียนสำหรับการบรรยาย ชั้นที่2 ห้องที่2",
    capacity: 80,
    building: "อาคารบริหาร",
    is_available: true
  }
  // ... ห้องอื่นๆ
]
```

### 3️⃣ ส่งไปที่ Backend API
```http
POST /api/ai-search
Content-Type: application/json

{
  "query": "ฉันต้องการห้องคอมพิวเตอร์",
  "rooms": [...allRooms],
  "buildings": [...buildings]
}
```

### 4️⃣ Backend สร้าง Prompt สำหรับ AI
```
คุณเป็น AI ผู้ช่วยค้นหาห้องในระบบจองห้อง

ข้อมูลห้อง:
- NK 1201: ห้องเรียนสำหรับการบรรยาย
- NK 1202: ห้องเรียนสำหรับการบรรยาย
- Lab 301: ห้องปฏิบัติการคอมพิวเตอร์  👈 ตัวนี้จะถูกเลือก!

User ถาม: "ฉันต้องการห้องคอมพิวเตอร์"

วิเคราะห์และส่งคืน JSON:
{
  "filters": {
    "keywords": ["คอมพิวเตอร์", "คอม", "ปฏิบัติการ"]
  },
  "explanation": "คุณต้องการห้องที่มีคอมพิวเตอร์"
}
```

### 5️⃣ Gemini AI วิเคราะห์และตอบ
```json
{
  "filters": {
    "capacity_min": null,
    "capacity_max": null,
    "keywords": ["คอมพิวเตอร์", "คอม", "ปฏิบัติการ"]
  },
  "explanation": "คุณต้องการห้องที่มีคอมพิวเตอร์หรือห้องปฏิบัติการคอมพิวเตอร์"
}
```

### 6️⃣ Backend กรองห้อง
```javascript
// ค้นหาห้องที่ description มีคำว่า
// "คอมพิวเตอร์" หรือ "คอม" หรือ "ปฏิบัติการ"

filteredRooms = rooms.filter(room => {
  const searchText = `${room.name} ${room.description} ${room.building}`.toLowerCase();
  
  return keywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
});

// ผลลัพธ์:
// ✅ Lab 301 - ห้องปฏิบัติการคอมพิวเตอร์
// ✅ Lab 302 - ห้องคอมพิวเตอร์
// ❌ NK 1201 - ห้องเรียนบรรยาย (ไม่มี keyword)
```

### 7️⃣ ส่งผลลัพธ์กลับ Frontend
```json
{
  "success": true,
  "rooms": [
    {
      "id": "...",
      "name": "Lab 301",
      "description": "ห้องปฏิบัติการคอมพิวเตอร์",
      "capacity": 40,
      "building": "อาคารเทคโนโลยี"
    }
  ],
  "filters": { ... },
  "explanation": "คุณต้องการห้องที่มีคอมพิวเตอร์",
  "total": 1
}
```

### 8️⃣ Frontend แสดงผลลัพธ์
```
✅ พบ 1 ห้องที่ตรงกับความต้องการ

🔍 AI เข้าใจว่า: คุณต้องการห้องที่มีคอมพิวเตอร์

📍 Lab 301
   🏢 อาคารเทคโนโลยี
   👥 40 คน
   📝 ห้องปฏิบัติการคอมพิวเตอร์
```

---

## ❌ ปัญหาที่พบ: "Gemini API error"

### สาเหตุ:
```javascript
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // ❌ ยังไม่ได้แทนที่
```

### วิธีแก้:
1. ไปขอ API Key: https://aistudio.google.com/app/apikey
2. แทนที่ในไฟล์: `server/api/ai-search.post.ts`
```javascript
const GEMINI_API_KEY = 'AIzaSyC_YOUR_REAL_API_KEY'; // ✅ ใส่ API Key จริง
```

---

## 🎯 ตัวอย่างการค้นหาต่างๆ

### ตัวอย่างที่ 1: ค้นหาห้องคอมพิวเตอร์
```
Input: "ฉันต้องการห้องคอมพิวเตอร์"

AI แปลงเป็น:
{
  "keywords": ["คอมพิวเตอร์", "คอม", "ปฏิบัติการ"]
}

ผลลัพธ์: ห้องที่ description มี "คอมพิวเตอร์" หรือ "ปฏิบัติการ"
```

### ตัวอย่างที่ 2: ค้นหาห้องบรรยาย
```
Input: "ห้องเรียนบรรยาย 80 คน"

AI แปลงเป็น:
{
  "capacity_min": 80,
  "keywords": ["บรรยาย", "เรียน"]
}

ผลลัพธ์: ห้องที่ capacity >= 80 และมี "บรรยาย" ใน description
```

### ตัวอย่างที่ 3: ค้นหาตามอาคาร
```
Input: "ห้องในอาคารบริหาร"

AI แปลงเป็น:
{
  "keywords": ["บริหาร"]
}

ผลลัพธ์: ห้องที่ building = "อาคารบริหาร"
```

---

## 🔍 วิธี Debug

### 1. เปิด Browser Console (F12)
```javascript
// จะเห็น logs:
📊 Total rooms to search: 15
🔍 Search query: ฉันต้องการห้องคอมพิวเตอร์
✅ AI Response: { success: true, rooms: [...], ... }
```

### 2. เปิด Terminal (Dev Server)
```javascript
// จะเห็น logs:
🤖 AI Response: { "filters": { "keywords": ["คอมพิวเตอร์"] }, ... }
🔍 Parsed Filters: { keywords: ["คอมพิวเตอร์", "คอม"] }
✅ Found 2 rooms matching filters
```

### 3. ตรวจสอบว่า API Key ถูกต้อง
```javascript
// ถ้า API Key ผิดจะเห็น:
❌ Gemini API error

// ถ้า API Key ถูกจะเห็น:
✅ Found X rooms matching filters
```

---

## 📝 สรุป Flow สั้นๆ

```
User Input 
  → Frontend รวบรวมข้อมูล
  → ส่งไปที่ Backend API
  → Backend สร้าง Prompt
  → ส่งไปที่ Gemini AI
  → AI วิเคราะห์และส่ง JSON กลับ
  → Backend กรองห้องตาม keywords
  → ส่งผลลัพธ์กลับ Frontend
  → แสดงห้องที่พบ
```

**กุญแจสำคัญ:** 
- AI จะวิเคราะห์คำค้นหาและแปลงเป็น `keywords`
- Backend ค้นหาใน `name`, `description`, `building` ตาม keywords
- ห้องที่มี keyword ใดๆ จะถูกแสดงผล

---

ถ้าใส่ API Key แล้วยังไม่ได้ ให้ดู Console logs จะบอกว่าติดตรงไหน! 🔍
