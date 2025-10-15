<script setup>
import LoadingPage from "~/components/Loading.vue";

import { useBookingStore } from "@/store/bookingStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useRoomStore } from "@/store/roomStore";
import { useRoom_Types } from "@/store/room_typeStore";
import { useUserStore } from "@/store/userStore";

import { ElSelect, ElOption } from "element-plus";
import "element-plus/dist/index.css";

definePageMeta({
  middleware: ["load-user"], // เอา user-only ออก
});

const router = useRouter();
const bookingStore = useBookingStore();
const buildingStore = useBuildingStore();
const roomStore = useRoomStore();
const roomTypesStore = useRoom_Types();
const userStore = useUserStore();

const buildings = ref([]);
const selectedBuilding = ref(null);
const buildingRooms = ref([]);
const selectedRoom = ref(null);

// Search states
const searchRoomName = ref("");
const searchCapacity = ref("");
const searchRoomTypeId = ref("");
const showRoomDropdown = ref(false);

// AI Search states
const aiSearchQuery = ref("");
const aiSearchLoading = ref(false);
const aiSearchResults = ref([]);
const aiSearchExplanation = ref("");
const showAiResults = ref(false);

// Room types hint สำหรับแสดงใน UI
const roomTypeHints = computed(() => {
  // ใช้ roomTypes (ไม่ใช่ room_types) ตามที่ store กำหนด
  if (roomTypesStore.roomTypes && roomTypesStore.roomTypes.length > 0) {
    return roomTypesStore.roomTypes
      .map(rt => rt.name || rt.type_name || rt.type || 'ไม่ระบุ')
      .join(', ');
  }
  return 'กำลังโหลดประเภทห้อง...';
});

// Modal states
const roomModalVisible = ref(false);

const loading = ref(false);

// 🔥 เช็ค role ใน component แทนที่จะใช้ middleware
onMounted(async () => {
  // เช็คว่าเป็น admin หรือไม่ - redirect ทันทีโดยไม่แสดง Alert
  if (userStore.currentUser?.role_name === 'Admin') {
    window.location.replace('/admin/dashboard');
    return;
  }
  
  loading.value = true;
  try {
    await buildingStore.fetchBuildings();
    buildings.value = buildingStore.buildings;
    console.log("Buildings data:", buildings.value); // Debug
    // Load room types for filtering
    await roomTypesStore.fetchRoomTypes();
  } catch (error) {
    console.error("onMounted error:", error);
  } finally {
    loading.value = false;
  }
});

// Building and Room functions
const handleBuildingClick = async (building) => {
  loading.value = true;
  try {
    selectedBuilding.value = building;
    // Enrich from rooms API to ensure operational fields are available
    await roomStore.fetchAllRooms(1, 1000);
    const allRooms = Array.isArray(roomStore.rooms) ? roomStore.rooms : [];
    const baseRooms = Array.isArray(building.rooms) ? building.rooms : [];
    buildingRooms.value = baseRooms.map((r) => {
      const full = allRooms.find((ar) => ar.id === r.id) || {};
      return { ...r, ...full };
    });
    console.log("Building rooms (enriched):", buildingRooms.value); // Debug
  } catch (error) {
    console.error("Error fetching building rooms:", error);
  } finally {
    loading.value = false;
  }
};

const handleRoomClick = async (room) => {
  loading.value = true;
  try {
    selectedRoom.value = room;
    roomModalVisible.value = true;
    console.log("Selected room:", selectedRoom.value); // Debug
  } catch (error) {
    console.error("Error fetching room details:", error);
  } finally {
    loading.value = false;
  }
};

const goToRoomBooking = (roomId) => {
  router.push(`/user/bookings/bookingroom/${roomId}`);
};

const closeRoomModal = () => {
  roomModalVisible.value = false;
  selectedRoom.value = null;
};

const goBackToBuildings = () => {
  selectedBuilding.value = null;
  buildingRooms.value = [];
  // Reset search when going back
  searchRoomName.value = "";
  searchCapacity.value = "";
  showRoomDropdown.value = false;
};

// Search functionality
const selectedBuildingId = ref("");
const selectedRoomId = ref("");
const filteredRooms = computed(() => {
  const building = buildings.value.find(
    (b) => b.id === selectedBuildingId.value
  );
  return building?.rooms || [];
});

// Filtered rooms for dropdown
const filteredRoomOptions = computed(() => {
  if (!buildingRooms.value.length) return [];

  return buildingRooms.value.filter((room) =>
    room.name.toLowerCase().includes(searchRoomName.value.toLowerCase())
  );
});

// Filtered rooms based on search criteria
const filteredBuildingRooms = computed(() => {
  if (!buildingRooms.value.length) return [];

  return buildingRooms.value.filter((room) => {
    // Filter by room name
    const nameMatch =
      !searchRoomName.value ||
      room.name.toLowerCase().includes(searchRoomName.value.toLowerCase());

    // Filter by capacity (greater than or equal to search value)
    const capacityMatch =
      !searchCapacity.value ||
      (room.capacity && room.capacity >= parseInt(searchCapacity.value));

    // Filter by room type id
    const typeId =
      room.room_type_id ?? room.roomTypeId ?? room.type_id ?? room.typeId;
    const typeMatch =
      !searchRoomTypeId.value ||
      String(typeId || "") === String(searchRoomTypeId.value || "");

    return nameMatch && capacityMatch && typeMatch;
  });
});

// Clear search filters
const clearSearch = () => {
  searchRoomName.value = "";
  searchCapacity.value = "";
  searchRoomTypeId.value = "";
  showRoomDropdown.value = false;
};

// Handle room selection from dropdown
const selectRoom = (roomName) => {
  searchRoomName.value = roomName;
  showRoomDropdown.value = false;
};

// Handle input focus
const handleRoomInputFocus = () => {
  showRoomDropdown.value = true;
};

// Handle click outside to close dropdown
const handleClickOutside = (event) => {
  if (!event.target.closest(".room-name-search")) {
    showRoomDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

// Helpers: time format and availability
const secondsToHHMM = (secs) => {
  if (secs === null || secs === undefined) return "-";
  const n = Number(secs);
  if (!Number.isFinite(n) || n < 0) return "-";
  const h = Math.floor(n / 3600) % 24;
  const m = Math.floor((n % 3600) / 60);
  const pad = (v) => (v < 10 ? `0${v}` : String(v));
  return `${pad(h)}:${pad(m)}`;
};
const isAvailable = (v) => {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return !!v;
};
const orBlank = (v) =>
  v === null || v === undefined || v === "" ? "ว่าง" : String(v);

// AI Search function
const handleAiSearch = async () => {
  if (!aiSearchQuery.value.trim()) {
    return;
  }

  aiSearchLoading.value = true;
  showAiResults.value = false;

  try {
    // ดึงข้อมูลห้องทั้งหมดจาก roomStore
    await roomStore.fetchAllRooms();
    const allRooms = roomStore.rooms || [];

    console.log('📊 Total rooms to search:', allRooms.length);
    console.log('🔍 Search query:', aiSearchQuery.value);

    // เรียก AI API
    const response = await $fetch('/api/ai-search', {
      method: 'POST',
      body: {
        query: aiSearchQuery.value,
        rooms: allRooms,
        buildings: buildings.value
      }
    });

    console.log('✅ AI Response:', response);

    if (response.success) {
      aiSearchResults.value = response.rooms;
      aiSearchExplanation.value = response.explanation || '';
      showAiResults.value = true;
    } else {
      aiSearchResults.value = [];
      
      // ถ้าเป็นการตั้งค่าไม่ครบ ให้แสดงคำแนะนำ
      if (response.needSetup) {
        aiSearchExplanation.value = `⚠️ ${response.error}\n\n📝 วิธีตั้งค่า:\n1. ไปที่ https://aistudio.google.com/app/apikey\n2. คลิก "Create API Key"\n3. แทนที่ค่าใน server/api/ai-search.post.ts บรรทัดที่ 15\n4. Restart dev server`;
      } else {
        aiSearchExplanation.value = response.error || 'ไม่พบผลลัพธ์';
      }
      showAiResults.value = true;
    }
  } catch (error) {
    console.error('AI Search Error:', error);
    aiSearchResults.value = [];
    aiSearchExplanation.value = `❌ เกิดข้อผิดพลาด: ${error?.message || 'ไม่สามารถเชื่อมต่อ AI ได้'}`;
    showAiResults.value = true;
  } finally {
    aiSearchLoading.value = false;
  }
};

// Clear AI search
const clearAiSearch = () => {
  aiSearchQuery.value = '';
  aiSearchResults.value = [];
  aiSearchExplanation.value = '';
  showAiResults.value = false;
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="loading" />
  </teleport>
  <div class="app-container">
    <div class="main-content">
      <!-- หัวข้อหลัก -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <i class="fa-solid fa-building"></i>
            </div>
            <div class="header-text">
              <h1>ระบบจองห้อง</h1>
              <p class="subtitle">เลือกอาคารและห้องที่ต้องการจอง พร้อมระบบค้นหาด้วยการพิมพ์</p>
            </div>
          </div>
          <div class="refresh-indicator">
            <i class="fa-solid fa-building"></i>
            <span>{{ buildings.length }} อาคาร</span>
            <span>•</span>
            <i class="fa-solid fa-door-open"></i>
            <span>{{ buildings.reduce((total, b) => total + (b.rooms?.length || 0), 0) }} ห้อง</span>
          </div>
        </div>
      </div>

      <!-- 🤖 AI Smart Search Section -->
      <div class="ai-search-section">
        <div class="ai-search-header">
          <h2>
            <i class="fa-solid fa-robot" style="color: #f59e0b"></i>
            ค้นหาด้วยการพิมพ์
          </h2>
          <p>ถามเป็นภาษาไทยธรรมดา เช่น "อยากได้ห้องเรียนบรรยายใหญ่ 50 คน" หรือ "ต้องการห้องคอม"</p>
          <div class="room-type-hints">
            <i class="fa-solid fa-lightbulb"></i>
            <span style="color: #78716c; font-weight: 600;">ประเภทห้องที่มี:</span>
            <span style="color: #b45309; font-weight: 700; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">{{ roomTypeHints }}</span>
          </div>
        </div>        <div class="ai-search-box">
          <div class="search-input-wrapper">
            <i class="fa-solid fa-sparkles search-icon"></i>
            <input
              v-model="aiSearchQuery"
              type="text"
              placeholder="พิมพ์คำถามหรือคำอธิบายห้องที่ต้องการ..."
              class="ai-search-input"
              @keyup.enter="handleAiSearch"
              :disabled="aiSearchLoading"
            />
            <button 
              v-if="aiSearchQuery" 
              @click="clearAiSearch" 
              class="clear-search-btn"
              :disabled="aiSearchLoading"
            >
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
          <button 
            @click="handleAiSearch" 
            class="ai-search-btn"
            :disabled="!aiSearchQuery.trim() || aiSearchLoading"
          >
            <i class="fa-solid fa-magnifying-glass" v-if="!aiSearchLoading"></i>
            <i class="fa-solid fa-spinner fa-spin" v-else></i>
            <span>{{ aiSearchLoading ? 'กำลังค้นหา...' : 'ค้นหา' }}</span>
          </button>
        </div>

        <!-- AI Search Results -->
        <div v-if="showAiResults" class="ai-results-container">
          <div class="ai-explanation">
            <i class="fa-solid fa-lightbulb"></i>
            <span>{{ aiSearchExplanation }}</span>
          </div>
          
          <div v-if="aiSearchResults.length > 0" class="ai-results-header">
            <h3>พบ {{ aiSearchResults.length }} ห้องที่ตรงกับความต้องการ</h3>
          </div>

          <div v-if="aiSearchResults.length > 0" class="ai-rooms-grid">
            <div
              v-for="room in aiSearchResults"
              :key="room.id"
              class="ai-room-card"
              @click="handleRoomClick(room)"
            >
              <div class="room-image">
                <img
                  :src="room.image_url || '/default-room.jpg'"
                  :alt="room.name"
                />
                <div v-if="!isAvailable(room.is_available)" class="unavailable-badge">
                  กำลังปรับปรุง
                </div>
              </div>
              <div class="room-info">
                <h3>{{ room.name }}</h3>
                <p class="building-name">
                  <i class="fa-solid fa-building"></i>
                  {{ room.building || 'ไม่ระบุอาคาร' }}
                </p>
                <p>{{ room.description || "ไม่มีรายละเอียด" }}</p>
                <div class="room-stats">
                  <span class="capacity">
                    <i class="fa-solid fa-users"></i>
                    {{ room.capacity || 0 }} คน
                  </span>
                  <span
                    class="time-range"
                    v-if="room.start_room != null && room.end_room != null"
                  >
                    <i class="fa-regular fa-clock"></i>
                    {{ secondsToHHMM(room.start_room) }} - {{ secondsToHHMM(room.end_room) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-ai-results">
            <i class="fa-solid fa-search" style="font-size: 3rem; color: #6c757d"></i>
            <h3>ไม่พบห้องที่ตรงกับความต้องการ</h3>
            <p>ลองปรับคำค้นหาหรือเลือกดูจากอาคารด้านล่าง</p>
          </div>
        </div>
      </div>

      <!-- 🏠 ค้นหาห้อง (Element Plus - ซ่อนไว้ก่อน) -->
      <div class="search-section" style="display: none">
        <div class="search-container">
          <label style="margin-right: 7px; font-weight: bold"
            >เลือกอาคาร:</label
          >
          <el-select
            v-model="selectedBuildingId"
            placeholder="--- กรุณาเลือกอาคาร ---"
            style="width: 200px; margin-right: 10px"
            filterable
            disabled
          >
            <el-option
              v-for="building in buildings"
              :key="building.id"
              :label="building.name"
              :value="building.id"
            />
          </el-select>

          <label style="margin-right: 7px; font-weight: bold">เลือกห้อง:</label>
          <el-select
            v-model="selectedRoomId"
            placeholder="--- กรุณาเลือกห้อง ---"
            style="width: 200px; margin-right: 10px"
            disabled
          >
            <el-option
              v-for="room in filteredRooms"
              :key="room.id"
              :label="room.name"
              :value="room.id"
            />
          </el-select>
        </div>
      </div>

      <!-- เนื้อหาหลัก -->
      <div class="page-container">
        <div class="container">
          <!-- แสดงรายการอาคาร -->
          <div v-if="!selectedBuilding" class="buildings-list-modern">
            <div class="buildings-grid">
              <div
                v-for="building in buildings"
                :key="building.id"
                class="building-card"
                @click="handleBuildingClick(building)"
              >
                <div class="card-image">
                  <img
                    :src="building.image_url || '/default-building.jpg'"
                    :alt="building.name"
                  />
                  <div class="building-badge">
                    <i class="fa-solid fa-door-open"></i>
                    {{ building.rooms?.length || 0 }} ห้อง
                  </div>
                </div>
                <div class="card-body">
                  <h3 class="building-name">{{ building.name }}</h3>
                  <div class="building-action">
                    <div class="view-rooms-btn">
                      <i class="fa-solid fa-arrow-right"></i>
                      ดูห้องทั้งหมด
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- แสดงห้องในอาคาร -->
          <div v-else class="rooms-list">
          <div class="rooms-header">
            <button @click="goBackToBuildings" class="back-button">
              <i class="fa-solid fa-arrow-left"></i> กลับไปยังรายการอาคาร
            </button>

            <!-- Search Section -->
            <div class="room-search-section">
              <div class="search-header">
                <h3>
                  <i class="fa-solid fa-search" style="color: #2d6cdf"></i>
                  ค้นหาห้อง
                </h3>
              </div>
              <div class="search-inputs">
                <div class="search-input-group room-name-search">
                  <label for="searchRoomName">ชื่อห้อง:</label>
                  <div class="dropdown-container">
                    <input
                      id="searchRoomName"
                      v-model="searchRoomName"
                      type="text"
                      placeholder="ค้นหาจากชื่อห้อง..."
                      class="search-input"
                      @focus="handleRoomInputFocus"
                      @input="showRoomDropdown = true"
                    />
                    <div
                      v-if="showRoomDropdown && filteredRoomOptions.length > 0"
                      class="dropdown-menu"
                    >
                      <div
                        v-for="room in filteredRoomOptions"
                        :key="room.id"
                        class="dropdown-item"
                        @click="selectRoom(room.name)"
                      >
                        <div class="room-option">
                          <span class="room-name">{{ room.name }}</span>
                          <span class="room-capacity">
                            <i class="fa-solid fa-users"></i>
                            {{ room.capacity || 0 }} คน
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="search-input-group">
                  <label for="searchCapacity">จำนวนคน:</label>
                  <input
                    id="searchCapacity"
                    v-model="searchCapacity"
                    type="number"
                    placeholder="จำนวนคนขั้นต่ำ..."
                    class="search-input"
                    min="1"
                  />
                </div>
                <div class="search-input-group">
                  <label for="searchRoomType">ประเภทห้อง:</label>
                  <select
                    id="searchRoomType"
                    v-model="searchRoomTypeId"
                    class="search-input"
                  >
                    <option value="">ทั้งหมด</option>
                    <option
                      v-for="rt in roomTypesStore.roomTypes"
                      :key="rt.id"
                      :value="rt.id"
                    >
                      {{ rt.name || rt.type || rt.id }}
                    </option>
                  </select>
                </div>
                <button @click="clearSearch" class="clear-button">
                  <i class="fa-solid fa-times"></i> ล้างการค้นหา
                </button>
              </div>
            </div>

            <div class="section-header">
              <h2>
                <i class="fa-solid fa-door-open" style="color: #28a745"></i>
                ห้องใน {{ selectedBuilding.name }}
              </h2>
              <p>
                แสดง {{ filteredBuildingRooms.length }} ห้อง
                {{
                  buildingRooms.length !== filteredBuildingRooms.length
                    ? `จากทั้งหมด ${buildingRooms.length} ห้อง`
                    : ""
                }}
              </p>
            </div>
          </div>

          <!-- No results message -->
          <div v-if="filteredBuildingRooms.length === 0" class="no-results">
            <i
              class="fa-solid fa-search"
              style="font-size: 3rem; color: #6c757d; margin-bottom: 1rem"
            ></i>
            <h3>ไม่พบห้องที่ตรงกับเงื่อนไข</h3>
            <p>กรุณาลองปรับเงื่อนไขการค้นหา</p>
            <button @click="clearSearch" class="clear-button">
              <i class="fa-solid fa-refresh"></i> ล้างการค้นหา
            </button>
          </div>

          <!-- Rooms grid -->
          <div v-else class="rooms-grid">
            <div
              v-for="room in filteredBuildingRooms"
              :key="room.id"
              class="room-card"
              @click="handleRoomClick(room)"
            >
              <div class="room-image">
                <img
                  :src="room.image_url || '/default-room.jpg'"
                  :alt="room.name"
                />
                <div
                  v-if="!isAvailable(room.is_available)"
                  class="unavailable-badge"
                >
                  กำลังปรับปรุง
                </div>
              </div>
              <div class="room-info">
                <h3>{{ room.name }}</h3>
                <p>{{ room.description || "ไม่มีรายละเอียด" }}</p>
                <div class="room-stats">
                  <span class="capacity">
                    <i class="fa-solid fa-users"></i>
                    {{ room.capacity || 0 }} คน
                  </span>
                  <span
                    class="time-range"
                    v-if="room.start_room != null && room.end_room != null"
                  >
                    <i class="fa-regular fa-clock"></i>
                    เวลาที่จองได้: {{ secondsToHHMM(room.start_room) }} -
                    {{ secondsToHHMM(room.end_room) }} น.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Room Details Modal -->
    <teleport to="body">
      <div v-if="roomModalVisible" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>
              <i class="fa-solid fa-door-open" style="color: #28a745"></i>
              รายละเอียดห้อง {{ selectedRoom?.name }}
            </h3>
            <button @click="closeRoomModal" class="close-button">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="room-detail-image">
              <img
                :src="selectedRoom?.image_url || '/default-room.jpg'"
                :alt="selectedRoom?.name"
              />
            </div>
            <div class="room-details">
              <p><strong>ชื่อห้อง:</strong> {{ selectedRoom?.name }}</p>
              <p>
                <strong>รายละเอียด:</strong>
                {{ selectedRoom?.description || "ไม่มีรายละเอียด" }}
              </p>
              <p>
                <strong>ความจุ:</strong>
                {{ selectedRoom?.capacity || 0 }} ที่นั่ง
              </p>
              <p v-if="selectedRoom">
                <strong>เวลาเปิด-ปิด:</strong>
                {{ secondsToHHMM(selectedRoom.start_room) }} -
                {{ secondsToHHMM(selectedRoom.end_room) }}
              </p>
              <p>
                <strong>สถานะห้อง:</strong>
                <span
                  class="status-pill"
                  :class="
                    isAvailable(selectedRoom?.is_available)
                      ? 'available'
                      : 'unavailable'
                  "
                >
                  <span
                    class="status-dot"
                    :class="
                      isAvailable(selectedRoom?.is_available) ? 'green' : 'red'
                    "
                  ></span>
                  {{
                    isAvailable(selectedRoom?.is_available)
                      ? "พร้อมใช้งาน"
                      : "ไม่พร้อมใช้งาน"
                  }}
                </span>
              </p>
              <div
                v-if="!isAvailable(selectedRoom?.is_available)"
                class="maintenance-box"
              >
                <p class="maintenance-title">กำลังปรับปรุง</p>
                <p>
                  <strong>หมายเหตุ:</strong>
                  {{ orBlank(selectedRoom?.maintenance_note) }}
                </p>
                <p>
                  <strong>คาดว่าจะเสร็จ:</strong>
                  {{ orBlank(selectedRoom?.maintenance_eta) }}
                </p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              @click="goToRoomBooking(selectedRoom.id)"
              class="booking-button"
              :disabled="!isAvailable(selectedRoom?.is_available)"
              :class="{ disabled: !isAvailable(selectedRoom?.is_available) }"
            >
              <i class="fa-solid fa-calendar-plus"></i>
              {{
                isAvailable(selectedRoom?.is_available)
                  ? "ไปยังหน้าจองห้อง"
                  : "กำลังปรับปรุง"
              }}
            </button>
            <button @click="closeRoomModal" class="cancel-button">
              <i class="fa-solid fa-xmark"></i> ปิด
            </button>
          </div>
        </div>
      </div>
    </teleport>
    </div>
  </div>
</template>

<style scoped>
/* Page Container */
.app-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 0;
}

.main-content {
  max-width: 100%;
  margin: 0;
  background: #f5f5f5;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
}

.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 0 20px 40px 20px;
}

/* Hero Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 20px;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.header-content {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: white;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
}

.header-text h1 {
  margin: 0;
  font-size: 32px;
  color: white;
  font-weight: 700;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.refresh-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.refresh-indicator i {
  font-size: 14px;
}

/* Container */
.container {
  max-width: 1400px;
  margin: 0 auto;
}

/* Buildings Grid */
.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.building-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease;
  cursor: pointer;
}

@keyframes fadeIn {
  from {
    opacity: 0.7;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.building-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

/* Card Image */
.card-image {
  position: relative;
  width: 100%;
  height: 240px;
  overflow: hidden;
  background: #f3f4f6;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.building-card:hover .card-image img {
  transform: scale(1.05);
}

.building-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #2d2d2d;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* Card Body */
.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.building-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
  line-height: 1.3;
}

.building-action {
  display: flex;
  justify-content: center;
}

.view-rooms-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.building-card:hover .view-rooms-btn {
  transform: translateX(3px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

.page-header-modern {
  position: relative;
  text-align: center;
  padding: 50px 20px 60px 20px;
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 50%, #2d2d2d 100%);
  color: white;
  overflow: hidden;
}

.header-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.4;
}

.header-content-wrapper {
  position: relative;
  z-index: 2;
  max-width: 600px;
  margin: 0 auto;
}

.header-icon-large {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  font-size: 1.8rem;
  margin-bottom: 16px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.page-header-modern h1 {
  font-size: 2.2rem;
  margin: 0 0 8px 0;
  font-weight: 700;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.page-header-modern p {
  font-size: 1rem;
  margin: 0 0 24px 0;
  opacity: 0.9;
  font-weight: 400;
  line-height: 1.5;
}

.header-stats {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-weight: 600;
  font-size: 0.9rem;
  transition: transform 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.stat-item i {
  font-size: 1rem;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .page-header-modern {
    padding: 60px 20px 80px 20px;
  }
  
  .page-header-modern h1 {
    font-size: 2.5rem;
  }
  
  .page-header-modern p {
    font-size: 1.2rem;
  }
  
  .header-stats {
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }
  
  .stat-item {
    width: fit-content;
  }
}

/* AI Smart Search Section */
.ai-search-section {
  max-width: 1200px;
  margin: 40px auto;
  padding: 0 20px;
}

.ai-search-header {
  text-align: center;
  margin-bottom: 30px;
}

.ai-search-header h2 {
  font-size: 2rem;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #2d2d2d;
  font-weight: 700;
}

.ai-search-header p {
  color: #666;
  font-size: 1rem;
  margin: 0;
  line-height: 1.6;
}

.room-type-hints {
  margin-top: 20px;
  padding: 16px 24px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
  border: 2px solid rgba(251, 191, 36, 0.3);
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  line-height: 1.6;
  backdrop-filter: blur(12px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
  max-width: 100%;
  flex-wrap: wrap;
  gap: 10px;
  position: relative;
  overflow: hidden;
}

.room-type-hints::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s;
}

.room-type-hints:hover::before {
  left: 100%;
}

.room-type-hints:hover {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%);
  border-color: rgba(251, 191, 36, 0.5);
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(251, 191, 36, 0.25);
}

.room-type-hints i {
  color: #f59e0b;
  font-size: 1.2rem;
  animation: shimmer 2.5s infinite;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.5));
}

@keyframes shimmer {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.ai-search-box {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(45, 45, 45, 0.3);
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 20px;
  color: #f59e0b;
  font-size: 20px;
  pointer-events: none;
}

.ai-search-input {
  width: 100%;
  padding: 16px 50px 16px 55px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  background: #ffffff;
  color: #2d2d2d;
  outline: none;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.ai-search-input:focus {
  box-shadow: 0 6px 20px rgba(251, 191, 36, 0.3);
  transform: translateY(-2px);
}

.ai-search-input::placeholder {
  color: #999;
}

.ai-search-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.clear-search-btn {
  position: absolute;
  right: 15px;
  background: #e5e7eb;
  border: none;
  color: #6b7280;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-search-btn:hover {
  background: #d1d5db;
  transform: rotate(90deg);
}

.ai-search-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  white-space: nowrap;
}

.ai-search-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(251, 191, 36, 0.6);
}

.ai-search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* AI Results Container */
.ai-results-container {
  margin-top: 40px;
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-explanation {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1e40af;
  font-weight: 500;
}

.ai-explanation i {
  font-size: 20px;
  color: #3b82f6;
}

.ai-results-header {
  margin-bottom: 24px;
}

.ai-results-header h3 {
  font-size: 1.5rem;
  color: #2d2d2d;
  margin: 0;
  font-weight: 700;
}

.ai-rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

.ai-room-card {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.ai-room-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.2);
  border-color: #f59e0b;
}

.building-name {
  color: #f59e0b;
  font-weight: 600;
  font-size: 0.9rem;
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.no-ai-results {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.no-ai-results h3 {
  margin: 20px 0 10px 0;
  font-size: 1.5rem;
  color: #333;
}

.no-ai-results p {
  margin: 0;
  font-size: 1.1rem;
}

.search-section {
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.search-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}

.content-section {
  padding: 40px 30px;
  background: #f5f5f5;
}

.section-header {
  text-align: center;
  margin-bottom: 40px;
}

.section-header h2 {
  font-size: 2.2rem;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #2d2d2d;
  font-weight: 700;
}

.section-header p {
  color: #666;
  font-size: 1.1rem;
  margin: 0;
}

.action-section {
  text-align: center;
  padding: 30px;
  background: #ffffff;
  border-top: 1px solid #e0e0e0;
}

.create-booking-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #4a4a4a 0%, #5a5a5a 100%);
  color: #f0f0f0;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 25px;
  font-weight: 500;
  font-size: 1rem;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 1px solid #666;
}

.create-booking-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
  background: linear-gradient(135deg, #5a5a5a 0%, #6a6a6a 100%);
  color: #ffffff;
}

/* Room Search Section */
.room-search-section {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 30px;
  border-radius: 16px;
  margin-bottom: 30px;
  border: 2px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}

.search-header {
  text-align: center;
  margin-bottom: 24px;
}

.search-header h3 {
  margin: 0;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 700;
}

.search-inputs {
  display: flex;
  align-items: end;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.search-input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.search-input-group label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.search-input {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.95rem;
  width: 200px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: #ffffff;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.search-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
  transform: translateY(-2px);
}

/* Dropdown Styles */
.dropdown-container {
  position: relative;
  width: 200px;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  backdrop-filter: blur(8px);
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 1px solid #f1f5f9;
  color: #333;
}

.dropdown-item:hover {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  transform: translateX(4px);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.room-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-name {
  font-weight: 600;
  color: #2d2d2d;
}

.room-capacity {
  font-size: 0.85rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
}

.clear-button {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
  height: fit-content;
  box-shadow: 0 4px 16px rgba(251, 191, 36, 0.3);
}

.clear-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.5);
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

/* Custom Scrollbar for Dropdown */
.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 0 0 8px 0;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* No Results */
.no-results {
  text-align: center;
  padding: 80px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  border: 2px solid #e2e8f0;
  margin: 20px 0;
}

.no-results h3 {
  margin: 0 0 12px 0;
  font-size: 1.6rem;
  color: #2d2d2d;
  font-weight: 700;
}

.no-results p {
  margin: 0 0 24px 0;
  font-size: 1.1rem;
  color: #64748b;
}

/* Buildings List Styles */
.buildings-list {
  width: 100%;
}

.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 25px;
}

.building-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.building-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.building-image {
  width: 100%;
  height: 220px;
  overflow: hidden;
}

.building-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.building-info {
  padding: 20px;
}

.building-info h3 {
  margin: 0 0 12px 0;
  color: #2d2d2d;
  font-size: 1.4rem;
  font-weight: 700;
}

.building-info p {
  margin: 0 0 16px 0;
  color: #555;
  line-height: 1.6;
  font-size: 0.95rem;
}

.building-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.room-count {
  color: #2d2d2d;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
}

/* Rooms List Styles */
.rooms-list {
  width: 100%;
}

.rooms-header {
  margin-bottom: 30px;
}

.back-button {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: #ffffff;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(45, 45, 45, 0.3);
}

.back-button:hover {
  background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
  color: #ffffff;
  transform: translateX(-5px) translateY(-2px);
  box-shadow: 0 8px 24px rgba(45, 45, 45, 0.4);
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

.room-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  overflow: hidden;
}

.room-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(251, 191, 36, 0.2);
  border-color: #f59e0b;
}

.room-image img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 0;
  margin-bottom: 0;
}

.room-info {
  padding: 16px;
}

.room-info h3 {
  margin: 0 0 10px 0;
  color: #2d2d2d;
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.3;
}

.room-info p {
  margin: 0 0 15px 0;
  color: #666;
  line-height: 1.5;
  font-size: 0.9rem;
}

.capacity {
  color: #f59e0b;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #ffffff;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: none;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border-radius: 16px 16px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  padding: 5px;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: rotate(90deg);
  color: #ffffff;
}

.modal-body {
  padding: 25px;
}

.room-detail-image img {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.room-details p {
  margin: 15px 0;
  color: #555;
  font-size: 1rem;
  line-height: 1.7;
}

.room-details strong {
  color: #2d2d2d;
  font-weight: 600;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.booking-button {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(251, 191, 36, 0.4);
}

.booking-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.6);
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.cancel-button {
  background: #ffffff;
  color: #666;
  padding: 12px 24px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
}

.cancel-button:hover {
  background: #f9fafb;
  transform: translateY(-2px);
  color: #333;
  border-color: #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Unavailable badge on room card */
.room-image {
  position: relative;
}
.unavailable-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  backdrop-filter: blur(4px);
}

/* Time range snippet */
.time-range {
  color: #64748b;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

/* Disabled booking state */
.booking-button.disabled,
.booking-button:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  opacity: 1;
}

/* Status pill in modal: make unavailable red text */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.status-pill.available {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
  border: 2px solid #22c55e;
}
.status-pill.unavailable {
  background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
  color: #b91c1c;
  border: 2px solid #ef4444;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.green {
  background: #198754;
}
.status-dot.red {
  background: #dc3545;
}

/* Maintenance info box */
.maintenance-box {
  border: 1px solid #dc3545;
  background: #fff5f5;
  color: #842029;
  padding: 12px;
  border-radius: 8px;
}
.maintenance-title {
  margin: 0 0 8px 0;
  font-weight: 800;
}

/* Removed animations for minimal design */

/* Responsive */
@media (max-width: 768px) {
  .app-container {
    padding: 10px;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .content-section-modern {
    padding: 20px;
  }

  .buildings-grid-modern {
    grid-template-columns: 1fr;
  }

  .search-container {
    flex-direction: column;
    align-items: stretch;
  }

  .search-container > * {
    width: 100%;
    margin-bottom: 10px;
  }

  .search-inputs {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input,
  .dropdown-container {
    width: 100%;
  }

  .search-input-group {
    margin-bottom: 15px;
  }
}

/* Modern UI Styles */
.content-section-modern {
  padding: 40px 20px;
  background: #f8fafc;
  min-height: 60vh;
}

.buildings-list-modern {
  max-width: 1200px;
  margin: 0 auto;
}

.section-header-modern {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
  text-align: center;
}

.header-icon-circle {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.3);
  border: 2px solid white;
}

.header-content h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
  letter-spacing: -0.3px;
}

.header-content p {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
  font-weight: 400;
}

.buildings-grid-modern {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-top: 32px;
}

.building-card-modern {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(30, 41, 59, 0.06);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(226, 232, 240, 0.6);
  position: relative;
}

.building-card-modern:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(30, 41, 59, 0.12);
  border-color: rgba(79, 70, 229, 0.2);
}

.building-image-modern {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: #f1f5f9;
}

.building-image-modern img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.building-card-modern:hover .building-image-modern img {
  transform: scale(1.05);
}

.building-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(0,0,0,0.1) 0%, transparent 50%);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 12px;
}

.building-badge {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.building-info-modern {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.building-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  letter-spacing: -0.2px;
  line-height: 1.3;
}

.building-action {
  display: flex;
  justify-content: center;
}

.view-rooms-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 3px 12px rgba(79, 70, 229, 0.3);
  letter-spacing: 0.2px;
}

.building-card-modern:hover .view-rooms-btn {
  transform: translateX(3px);
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
}

/* Responsive */
@media (max-width: 768px) {
  .page-container {
    padding: 0 12px 40px 12px;
  }

  .page-header {
    padding: 24px 16px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-left {
    gap: 12px;
  }

  .header-icon {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }

  .header-text h1 {
    font-size: 24px;
  }

  .refresh-indicator {
    width: 100%;
    justify-content: center;
  }

  .buildings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
