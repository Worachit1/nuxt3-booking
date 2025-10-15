# 🚨 แก้ไข Error: "Gemini API error"

## ปัญหา:
```
ERROR  AI Search Error: Gemini API error
```

## สาเหตุ:
❌ **ยังไม่ได้ตั้งค่า Gemini API Key**

---

## ✅ วิธีแก้ไข (3 ขั้นตอน):

### ขั้นตอนที่ 1: ขอ API Key (ฟรี!)
1. เปิด: **https://aistudio.google.com/app/apikey**
2. Login ด้วย Google Account
3. คลิก **"Create API Key"**
4. เลือก **"Create API Key in new project"**
5. **คัดลอก API Key** ที่ได้ (รูปแบบ: `AIzaSy...`)

### ขั้นตอนที่ 2: ใส่ API Key ในโค้ด
1. เปิดไฟล์: `server/api/ai-search.post.ts`
2. หาบรรทัดที่ **15** (มีข้อความ `const GEMINI_API_KEY`)
3. แทนที่:
```typescript
// จาก:
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

// เป็น: (ใส่ API Key ที่คัดลอกมา)
const GEMINI_API_KEY = 'AIzaSyC_ใส่_API_KEY_ที่คัดลอกมาตรงนี้';
```

### ขั้นตอนที่ 3: Restart Server
1. กด `Ctrl+C` ใน Terminal เพื่อหยุด dev server
2. รันใหม่:
```bash
npm run dev
```

---

## 🧪 ทดสอบ:

เปิดหน้าหลัก แล้วพิมพ์:
- "ฉันต้องการห้องคอมพิวเตอร์"
- "ห้องบรรยาย 80 คน"
- "ห้องในอาคารบริหาร"

**ถ้าสำเร็จ:** จะเห็นห้องที่ตรงกับคำค้นหา
**ถ้ายังไม่ได้:** ดู Console logs (F12) และ Terminal

---

## 🔍 ตรวจสอบว่า API Key ถูกต้อง:

### ใน Terminal จะเห็น:
**✅ ถูกต้อง:**
```
🔄 กำลังเรียก Gemini AI...
🤖 AI Response: {"filters": {...}, ...}
✅ Found X rooms matching filters
```

**❌ ผิด:**
```
❌ ไม่พบ Gemini API Key!
📝 วิธีแก้:
1. ไปที่: https://aistudio.google.com/app/apikey
...
```

---

## 📊 ตัวอย่าง API Key ที่ถูกต้อง:

```typescript
const GEMINI_API_KEY = 'AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
                        ↑
                    เริ่มต้นด้วย AIza...
                    ยาวประมาณ 39 ตัวอักษร
```

---

## 🆘 ยังไม่ได้?

1. **ตรวจสอบ API Key:**
   - เริ่มต้นด้วย `AIza...`
   - ไม่มีช่องว่างหรือ `'` ซ้อน

2. **ตรวจสอบว่า Restart Server แล้ว:**
   - ต้อง Restart ทุกครั้งหลังแก้ไข server code

3. **ดู Console Logs:**
   - Browser Console (F12)
   - Terminal ที่รัน npm run dev

4. **API Key หมดอายุ:**
   - สร้าง API Key ใหม่ที่ https://aistudio.google.com

---

พร้อมใช้งาน AI Search แล้ว! 🚀
