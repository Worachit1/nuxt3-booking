<script setup>
import LoadingPage from "~/components/Loading.vue";

import { useBookingStore } from "@/store/bookingStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useRoomStore } from "@/store/roomStore";

import { ElSelect, ElOption } from "element-plus";
import "element-plus/dist/index.css";

definePageMeta({
  middleware: ["load-user"],
});

const router = useRouter();
const bookingStore = useBookingStore();
const buildingStore = useBuildingStore();
const roomStore = useRoomStore();

const buildings = ref([]);
const selectedBuilding = ref(null);
const buildingRooms = ref([]);
const selectedRoom = ref(null);

// Search states
const searchRoomName = ref('');
const searchCapacity = ref('');
const showRoomDropdown = ref(false);

// Modal states
const roomModalVisible = ref(false);

const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    await buildingStore.fetchBuildings();
    buildings.value = buildingStore.buildings;
    console.log('Buildings data:', buildings.value); // Debug
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
    buildingRooms.value = building.rooms || [];
    console.log('Building rooms:', buildingRooms.value); // Debug
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
    console.log('Selected room:', selectedRoom.value); // Debug
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
  searchRoomName.value = '';
  searchCapacity.value = '';
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
  
  return buildingRooms.value.filter(room => 
    room.name.toLowerCase().includes(searchRoomName.value.toLowerCase())
  );
});

// Filtered rooms based on search criteria
const filteredBuildingRooms = computed(() => {
  if (!buildingRooms.value.length) return [];
  
  return buildingRooms.value.filter(room => {
    // Filter by room name
    const nameMatch = !searchRoomName.value || 
      room.name.toLowerCase().includes(searchRoomName.value.toLowerCase());
    
    // Filter by capacity (greater than or equal to search value)
    const capacityMatch = !searchCapacity.value || 
      (room.capacity && room.capacity >= parseInt(searchCapacity.value));
    
    return nameMatch && capacityMatch;
  });
});

// Clear search filters
const clearSearch = () => {
  searchRoomName.value = '';
  searchCapacity.value = '';
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
  if (!event.target.closest('.room-name-search')) {
    showRoomDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="loading" />
  </teleport>
  <div class="app-container">
    <div class="main-content">
      <!-- หัวข้อหลัก -->
      <div class="page-header">
        <h1>
          <i class="fa-solid fa-building" style="color: #2d6cdf"></i>
          ระบบจองห้อง
        </h1>
        <p>เลือกอาคารและห้องที่ต้องการจอง</p>
      </div>

      <!-- 🏠 ค้นหาห้อง (Element Plus - ซ่อนไว้ก่อน) -->
      <div class="search-section" style="display: none;">
        <div class="search-container">
          <label style="margin-right: 7px; font-weight: bold">เลือกอาคาร:</label>
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
      <div class="content-section">
        <!-- แสดงรายการอาคาร -->
        <div v-if="!selectedBuilding" class="buildings-list">
          <div class="section-header">
            <h2>
              <i class="fa-solid fa-building" style="color: #2d6cdf"></i>
              รายการอาคารทั้งหมด
            </h2>
            <p>คลิกเพื่อดูห้องในอาคาร</p>
          </div>
          <div class="buildings-grid">
            <div
              v-for="building in buildings"
              :key="building.id"
              class="building-card"
              @click="handleBuildingClick(building)"
            >
              <div class="building-image">
                <img :src="building.image_url || '/default-building.jpg'" :alt="building.name" />
              </div>
              <div class="building-info">
                <h3>{{ building.name }}</h3>
                <div class="building-stats">
                  <span class="room-count">
                    <i class="fa-solid fa-door-open"></i>
                    {{ building.rooms?.length || 0 }} ห้อง
                  </span>
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
                {{ buildingRooms.length !== filteredBuildingRooms.length ? `จากทั้งหมด ${buildingRooms.length} ห้อง` : '' }}
              </p>
            </div>
          </div>

          <!-- No results message -->
          <div v-if="filteredBuildingRooms.length === 0" class="no-results">
            <i class="fa-solid fa-search" style="font-size: 3rem; color: #6c757d; margin-bottom: 1rem;"></i>
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
                <img :src="room.image_url || '/default-room.jpg'" :alt="room.name" />
              </div>
              <div class="room-info">
                <h3>{{ room.name }}</h3>
                <p>{{ room.description || 'ไม่มีรายละเอียด' }}</p>
                <div class="room-stats">
                  <span class="capacity">
                    <i class="fa-solid fa-users"></i>
                    {{ room.capacity || 0 }} คน
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ปุ่มจองห้อง -->
      <div class="action-section">
        <a class="create-booking-button" href="/user/bookings/createBooking">
          <i class="fa-solid fa-calendar-plus"></i> สร้างการจองใหม่
        </a>
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
              <img :src="selectedRoom?.image_url || '/default-room.jpg'" :alt="selectedRoom?.name" />
            </div>
            <div class="room-details">
              <p><strong>ชื่อห้อง:</strong> {{ selectedRoom?.name }}</p>
              <p><strong>รายละเอียด:</strong> {{ selectedRoom?.description || 'ไม่มีรายละเอียด' }}</p>
              <p><strong>ความจุ:</strong> {{ selectedRoom?.capacity || 0 }} ที่นั่ง</p>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="goToRoomBooking(selectedRoom.id)" class="booking-button">
              <i class="fa-solid fa-calendar-plus"></i> ไปยังหน้าจองห้อง
            </button>
            <button @click="closeRoomModal" class="cancel-button">
              <i class="fa-solid fa-xmark"></i> ปิด
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  padding: 20px;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-header {
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, #13131f 0%, #2d2d3a 100%);
  color: white;
}

.page-header h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.page-header p {
  font-size: 1.2rem;
  opacity: 0.9;
  margin: 0;
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
  padding: 40px;
}

.section-header {
  text-align: center;
  margin-bottom: 30px;
}

.section-header h2 {
  font-size: 2rem;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.section-header p {
  color: #6c757d;
  font-size: 1.1rem;
  margin: 0;
}

.action-section {
  text-align: center;
  padding: 30px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

.create-booking-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #13131f 0%, #2d2d3a 100%);
  color: white;
  padding: 15px 30px;
  text-decoration: none;
  border-radius: 50px;
  font-weight: bold;
  font-size: 1.1rem;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 15px rgba(19, 19, 31, 0.4);
}

.create-booking-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(19, 19, 31, 0.6);
}

/* Room Search Section */
.room-search-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-header {
  text-align: center;
  margin-bottom: 20px;
}

.search-header h3 {
  margin: 0;
  color: #13131f;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1.3rem;
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
  font-weight: bold;
  color: #495057;
  font-size: 0.9rem;
}

.search-input {
  padding: 10px 15px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  width: 200px;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #13131f;
  box-shadow: 0 0 0 3px rgba(19, 19, 31, 0.1);
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
  background: white;
  border: 2px solid #e9ecef;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f8f9fa;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
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
  color: #13131f;
}

.room-capacity {
  font-size: 0.85rem;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 4px;
}

.clear-button {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  height: fit-content;
}

.clear-button:hover {
  transform: translateY(-2px);
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
  padding: 60px 20px;
  color: #6c757d;
}

.no-results h3 {
  margin: 0 0 10px 0;
  font-size: 1.5rem;
}

.no-results p {
  margin: 0 0 20px 0;
  font-size: 1.1rem;
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
  background: white;
  border-radius: 12px;
  padding: 1px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  border: 2px solid transparent;
}

.building-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  border-color: #13131f;
}

.building-image img {
  max-width: 100vw;
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 15px;
}

.building-info h3 {
  margin: 0 0 10px 0;
  color: #13131f;
  font-size: 1.3rem;
}

.building-info p {
  margin: 0 0 15px 0;
  color: #6c757d;
  line-height: 1.5;
}

.building-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-count {
  color: #28a745;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Rooms List Styles */
.rooms-list {
  width: 100%;
}

.rooms-header {
  margin-bottom: 30px;
}

.back-button {
  background: linear-gradient(135deg, #13131f 0%, #2d2d3a 100%);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-button:hover {
  transform: translateY(-2px);
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}

.room-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  border: 2px solid transparent;
}

.room-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  border-color: #28a745;
}

.room-image img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 15px;
}

.room-info h3 {
  margin: 0 0 10px 0;
  color: #28a745;
  font-size: 1.2rem;
}

.room-info p {
  margin: 0 0 15px 0;
  color: #6c757d;
  line-height: 1.5;
}

.capacity {
  color: #dc3545;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 5px;
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
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.modal-header h3 {
  margin: 0;
  color: #13131f;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #6c757d;
  padding: 5px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: #f8f9fa;
  color: #dc3545;
}

.modal-body {
  padding: 25px;
}

.room-detail-image img {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 20px;
}

.room-details p {
  margin: 15px 0;
  color: #333;
  font-size: 1.1rem;
  line-height: 1.6;
}

.room-details strong {
  color: #495057;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding: 25px;
  border-top: 1px solid #e9ecef;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.booking-button {
  background: linear-gradient(135deg, #13131f 0%, #2d2d3a 100%);
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s;
}

.booking-button:hover {
  transform: translateY(-2px);
}

.cancel-button {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s;
}

.cancel-button:hover {
  transform: translateY(-2px);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .app-container {
    padding: 10px;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .content-section {
    padding: 20px;
  }

  .buildings-grid,
  .rooms-grid {
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
</style>