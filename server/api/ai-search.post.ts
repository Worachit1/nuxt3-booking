// AI Smart Search - ไม่ต้องใช้ API ภายนอก
// ใช้ Natural Language Processing แบบ Pattern Matching
export default defineEventHandler(async (event) => {
  try {
  const body = await readBody(event);
  const { query, rooms, buildings, roomTypes } = body;

    console.log('🔍 AI Smart Search Query:', query);
    
    // ===== AI Pattern Matching - ไม่ต้องใช้ External API =====
    
    const queryLower = query.toLowerCase();
    
    // 1. วิเคราะห์จำนวนคน - รองรับทั้ง min และ max
    let capacity_min = null;
    let capacity_max = null;
    
    const capacityMatch = query.match(/(\d+)\s*(คน|ที่นั่ง|seat)/i);
    if (capacityMatch) {
      
      // เช็คว่าเป็น max หรือ min
        const numberRaw = parseInt(capacityMatch[1]);
        const number = Number.isNaN(numberRaw) ? null : numberRaw;

        if (number !== null) {
    // ตรวจจับสำนวนแบบเคร่ง (strict) vs รวม (inclusive)
    // NOTE: \b word-boundary does not work reliably with Thai; use includes() for Thai words.
    const isStrictLess = (queryLower.includes('น้อยกว่า') || queryLower.includes('ต่ำกว่า') || /<(?!=)/.test(query));
    const isLessOrEqual = (queryLower.includes('ไม่เกิน') || queryLower.includes('สูงสุด') || queryLower.includes('max') || /<=/.test(query));

    const isStrictGreater = (queryLower.includes('มากกว่า') || />(?!=)/.test(query));
    const isGreaterOrEqual = (queryLower.includes('อย่างน้อย') || queryLower.includes('ขั้นต่ำ') || queryLower.includes('min') || />=/.test(query));

    const isAround = (queryLower.includes('ประมาณ') || queryLower.includes('ราว') || queryLower.includes('around') || queryLower.includes('about'));

          // กำหนดค่า min/max ตามนิยามของคำที่ผู้ใช้ใช้
          if (isStrictLess) {
            // "น้อยกว่า 50" => capacity < 50 => max = 49
            capacity_max = Math.max(0, number - 1);
          } else if (isLessOrEqual) {
            // "ไม่เกิน 50" หรือ "<=50" => capacity <= 50
            capacity_max = number;
          } else if (isGreaterOrEqual) {
            // "อย่างน้อย 50" => capacity >= 50
            capacity_min = number;
          } else if (isStrictGreater) {
            // "มากกว่า 50" => capacity > 50 => min = 51
            capacity_min = number + 1;
          } else if (isAround) {
            // "ประมาณ 40" ให้หาแบบ +/- 20%
            capacity_min = Math.floor(number * 0.8);
            capacity_max = Math.ceil(number * 1.2);
          } else {
            // default: ถ้าไม่ระบุ ให้เป็น min (ต้องรองรับได้อย่างน้อยเท่านี้)
            capacity_min = number;
          }

    // เก็บหมายเลขดั้งเดิมเพื่อใช้แสดงคำอธิบาย (explanation)
    // (ถ้าต้องการแสดงว่าเป็น "น้อยกว่า N" แทนการแสดง "ไม่เกิน M")
    (globalThis as any).__lastParsedCapacity = { number, isStrictLess, isLessOrEqual, isStrictGreater, isGreaterOrEqual, isAround };

    // Debug log: show how capacity was parsed for this query
    console.log('🔎 Parsed capacity:', (globalThis as any).__lastParsedCapacity, '=>', { capacity_min, capacity_max });
      }
    }
    
    // 2. แมพคำค้นหากับประเภทห้อง (Synonym Mapping)
    const roomTypePatterns = {
      'คอมพิวเตอร์': ['คอมพิวเตอร์', 'คอม', 'ปฏิบัติการคอมพิวเตอร์', 'ห้องคอม', 'computer'],
      'บรรยาย': ['บรรยาย', 'เรียน', 'lecture', 'ห้องเรียน'],
      'ประชุม': ['ประชุม', 'meeting', 'ห้องประชุม'],
      'ปฏิบัติการ': ['ปฏิบัติการ', 'lab', 'แล็บ'],
      'สัมมนา': ['สัมมนา', 'seminar'],
      'กีฬา': ['กีฬา', 'ห้องกีฬา', 'ฟิตเนส', 'ออกกำลังกาย', 'sport', 'gym'],
    };
    
    // 3. แมพอาคาร
    const buildingPatterns = {
      'บริหาร': ['บริหาร', 'administration'],
      'เฉลิม': ['เฉลิม', 'chaloem'],
      'วิทยาศาสตร์': ['วิทยาศาสตร์', 'science'],
    };
    
    // 4. ตรวจจับชื่อห้อง/รหัสห้อง (เช่น "NK 1201", "ห้อง 101")
    const roomNameMatch = query.match(/(?:ห้อง\s*)?([A-Z]{1,3}\s*\d{3,4}|\d{3,4})/i);
    let searchByRoomName = false;
    
    // 5. หา keywords ที่ตรงกัน
    let keywords: string[] = [];
    let explanation = '';
    
    // ถ้าค้นหาด้วยชื่อห้อง
    if (roomNameMatch) {
      let roomName = roomNameMatch[1].toUpperCase().trim();
      
      // สร้าง variations ของชื่อห้อง
      const variations = new Set<string>();
      
      // ถ้ามีช่องว่างอยู่แล้ว (เช่น "NK 1201")
      if (roomName.includes(' ')) {
        variations.add(roomName);                    // "NK 1201"
        variations.add(roomName.replace(/\s/g, ''));  // "NK1201"
        variations.add(roomName.replace(/\s/g, '-')); // "NK-1201"
      } 
      // ถ้าไม่มีช่องว่าง (เช่น "NK1201")
      else {
        variations.add(roomName);                    // "NK1201"
        // แทรกช่องว่างระหว่างตัวอักษรกับตัวเลข
        const withSpace = roomName.replace(/([A-Z]+)(\d+)/, '$1 $2'); // "NK 1201"
        variations.add(withSpace);
        variations.add(roomName.replace(/([A-Z]+)(\d+)/, '$1-$2')); // "NK-1201"
      }
      
      keywords = Array.from(variations);
      explanation = `ค้นหาห้อง ${roomName}`;
      searchByRoomName = true;
      
      console.log('🔍 Room name variations:', keywords);
    }
    
    // เช็คประเภทห้อง (ถ้าไม่ใช่การค้นหาด้วยชื่อห้อง)
    let matchedTypeKey: string | null = null;
    if (!searchByRoomName) {
      for (const [type, patterns] of Object.entries(roomTypePatterns)) {
        if (patterns.some(p => queryLower.includes(p))) {
          keywords.push(...patterns);
          explanation = `ค้นหาห้อง${type}`;
          matchedTypeKey = type; // เก็บประเภทที่ตรวจพบ เช่น 'กีฬา'
          break;
        }
      }
    }
    
    // เช็คอาคาร
    for (const [building, patterns] of Object.entries(buildingPatterns)) {
      if (patterns.some(p => queryLower.includes(p))) {
        keywords.push(...patterns);
        explanation += (explanation ? ' ใน' : 'ค้นหาใน') + `อาคาร${building}`;
        break;
      }
    }
    
    // ถ้าไม่เจอ pattern ให้ใช้คำค้นหาทั้งหมด
    if (keywords.length === 0) {
      keywords = query.split(/\s+/).filter((w: string) => w.length > 1);
      explanation = `ค้นหาห้องที่เกี่ยวข้องกับ "${query}"`;
    }
    
    // สร้าง explanation สำหรับจำนวนคน (รองรับการแสดงสำนวน "น้อยกว่า/ไม่เกิน/มากกว่า/อย่างน้อย")
    const lastParsed = (globalThis as any).__lastParsedCapacity || null;
    if (capacity_max && capacity_min) {
      explanation += ` สำหรับ ${capacity_min}-${capacity_max} คน`;
    } else if (capacity_max) {
      if (lastParsed && lastParsed.isStrictLess) {
        explanation += ` น้อยกว่า ${lastParsed.number} คน`;
      } else {
        explanation += ` ไม่เกิน ${capacity_max} คน`;
      }
    } else if (capacity_min) {
      if (lastParsed && lastParsed.isStrictGreater) {
        explanation += ` มากกว่า ${lastParsed.number} คน`;
      } else {
        explanation += ` อย่างน้อย ${capacity_min} คน`;
      }
    }
    
    console.log('🤖 AI Analysis:', { 
      capacity_min, 
      capacity_max, 
      keywords, 
      explanation,
      searchByRoomName 
    });
    
    // Debug: แสดงข้อมูลห้องทั้งหมดที่ได้รับมา
    console.log('📊 Total rooms received:', rooms.length);
    if (rooms.length > 0) {
      console.log('📝 Sample room:', {
        name: rooms[0].name,
        description: rooms[0].description,
        capacity: rooms[0].capacity,
        building: rooms[0].building,
        is_available: rooms[0].is_available
      });
    }
    
    // ===== จบการวิเคราะห์ =====

    // กรองห้องตาม filters ที่วิเคราะห์ได้
    let filteredRooms = rooms;
    
    // ถ้าค้นหาแบบทั่วไป (ไม่ใช่ชื่อห้อง) ให้กรองเฉพาะห้องว่าง
    // แต่เปลี่ยนเป็นกรองเฉพาะเมื่อผู้ใช้ระบุไว้ในคำค้นหา เช่น 'ว่าง' / 'พร้อมใช้งาน' / 'available'
    const wantOnlyAvailable = /\b(ว่าง|พร้อมใช้งาน|available|free|vacant)\b/.test(queryLower);
    if (!searchByRoomName && wantOnlyAvailable) {
      filteredRooms = filteredRooms.filter((room: any) => {
        const available = room.is_available;
        return available === true || available === 1 || available === '1' || String(available).toLowerCase() === 'true';
      });
    }

    // กรองตาม capacity (รองรับทั้ง min และ max)
    if (capacity_min) {
      filteredRooms = filteredRooms.filter((r: any) => r.capacity >= capacity_min);
    }
    if (capacity_max) {
      filteredRooms = filteredRooms.filter((r: any) => r.capacity <= capacity_max);
    }

    // ถ้ามีการจับประเภทที่ตรงกับคำค้นหา และ client ส่ง roomTypes มาด้วย
    // ให้แปลงชื่อประเภทเป็น room_type_id เพื่อแมตช์กับ rooms ที่มีเฉพาะ id
    let matchedTypeIds: string[] = [];
    if (matchedTypeKey && Array.isArray(roomTypes) && roomTypes.length > 0) {
      const keyLower = matchedTypeKey.toLowerCase();
      matchedTypeIds = roomTypes
        .filter((rt: any) => (rt.name || '').toString().toLowerCase().includes(keyLower))
        .map((rt: any) => rt.id)
        .filter(Boolean);
    }

    // ค้นหาตาม keywords (ค้นหาใน name, description, building, typeName และ typeId)
    if (keywords && keywords.length > 0) {
      filteredRooms = filteredRooms.filter((r: any) => {
        const typeNames = (r.room_type?.name || r.room_type_name || r.type || r.type_name || '').toString();
        const typeIds = (r.room_type_id || r.roomTypeId || '').toString();
        const searchText = `${r.name || ''} ${r.description || ''} ${r.building || ''} ${typeNames} ${typeIds}`.toLowerCase();
        const textMatch = keywords.some((keyword: string) => searchText.includes(keyword.toLowerCase()));
        const typeIdMatch = matchedTypeIds.length > 0 && matchedTypeIds.includes(String(r.room_type_id || r.roomTypeId || ''));
        return textMatch || typeIdMatch;
      });
    }

    // เรียงลำดับตาม relevance (ยิ่ง capacity ใกล้เคียงยิ่งดี)
    if (capacity_min || capacity_max) {
      const targetCapacity = capacity_min || capacity_max || 0;
      filteredRooms.sort((a: any, b: any) => {
        const diffA = Math.abs(a.capacity - targetCapacity);
        const diffB = Math.abs(b.capacity - targetCapacity);
        return diffA - diffB;
      });
    }

    console.log(`✅ Found ${filteredRooms.length} rooms matching filters`);

    return {
      success: true,
      rooms: filteredRooms,
      filters: {
        capacity_min,
        capacity_max,
        keywords
      },
      explanation,
      total: filteredRooms.length
    };

  } catch (error: any) {
    console.error('AI Search Error:', error);
    return {
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการค้นหา',
      rooms: []
    };
  }
});
