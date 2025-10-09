<script setup>
import { ref, onMounted, computed, watch } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useBookingStore } from "~/store/bookingStore";
import { useRouter } from "vue-router";

const router = useRouter();
definePageMeta({
  middleware: ["load-user"],
});

const roomStore = useRoomStore();
const buildingStore = useBuildingStore();
const { isLoading } = storeToRefs(roomStore, buildingStore);
const bookingStore = useBookingStore();

const buildings = ref([]);
const selectedBuilding = ref(null);
const rooms = ref([]);
const selectedRoom = ref(null);

const page = ref(1);
const size = ref(10);
const total = ref(0);
const jumpToPage = ref(1);

const fetchBuildings = async () => {
  await buildingStore.fetchBuildings();
  buildings.value = buildingStore.buildings;
};

const handleBuildingClick = async (building) => {
  selectedBuilding.value = building;
  // Enrich building rooms with full details (start_room, end_room, is_available, maintenance_*)
  await roomStore.fetchAllRooms(1, 1000);
  const allRooms = Array.isArray(roomStore.rooms) ? roomStore.rooms : [];
  const baseRooms = Array.isArray(building.rooms) ? building.rooms : [];
  const enriched = baseRooms.map((r) => {
    const full = allRooms.find((ar) => ar.id === r.id) || {};
    return { ...r, ...full };
  });
  rooms.value = enriched;
  total.value = rooms.value.length;
  page.value = 1;
};

const goBackToBuildings = () => {
  selectedBuilding.value = null;
  rooms.value = [];
  page.value = 1;
  total.value = 0;
};

const handleDeleteRoom = async (room) => {
  await bookingStore.fetchAllBookings?.();

  const roomBookings = bookingStore.bookings.filter(
    (booking) =>
      booking.room_id === room.id &&
      booking.status !== "Canceled" &&
      booking.status !== "Finished"
  );

  if (roomBookings.length > 0) {
    await Swal.fire({
      title: "ไม่สามารถลบได้",
      text: "เนื่องจากมีการจองอยู่ในห้องนี้ กรุณายกเลิกการจองก่อน",
      icon: "error",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  const result = await Swal.fire({
    title: `คุณต้องการลบห้อง <br>"${room.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    reverseButtons: true,
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-confirm",
      cancelButton: "btn-cancel",
    },
  });

  if (!result.isConfirmed) return;

  roomStore.isLoading = true;
  await roomStore.deleteRoom(room.id);

  // อัปเดตข้อมูลอาคารใหม่หลังลบห้อง
  await fetchBuildings();
  if (selectedBuilding.value) {
    const updatedBuilding = buildings.value.find(
      (b) => b.id === selectedBuilding.value.id
    );
    if (updatedBuilding) {
      selectedBuilding.value = updatedBuilding;
      rooms.value = updatedBuilding.rooms || [];
      total.value = rooms.value.length;
    }
  }

  roomStore.isLoading = false;

  await Swal.fire({
    title: "ลบแล้ว! ห้องถูกลบเรียบร้อย",
    icon: "success",
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-ok",
    },
  });

  selectedRoom.value = null;
};

const goTodetail = (id) => {
  router.push(`/admin/rooms/detail/${id}`);
};

// Pagination สำหรับห้อง
const paginatedRooms = computed(() => {
  const start = (page.value - 1) * size.value;
  const end = start + size.value;
  return rooms.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(total.value / size.value));

const paginationRange = computed(() => {
  const totalP = totalPages.value;
  const current = page.value;
  const delta = 1;
  const range = [];
  for (let i = 1; i <= totalP; i++) {
    if (
      i === 1 ||
      i === totalP ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== "...") {
      range.push("...");
    }
  }
  return range;
});

const gotoPage = (p) => {
  if (p === "..." || p === page.value || p < 1 || p > totalPages.value) {
    return;
  }
  page.value = p;
  jumpToPage.value = p;
};

// Helper: format seconds-of-day to HH:mm for display
const secondsToHHMM = (secs) => {
  if (secs === null || secs === undefined) return "-";
  const n = Number(secs);
  if (!Number.isFinite(n) || n < 0) return "-";
  const h = Math.floor(n / 3600) % 24;
  const m = Math.floor((n % 3600) / 60);
  const pad = (v) => (v < 10 ? `0${v}` : String(v));
  return `${pad(h)}:${pad(m)}`;
};

// Helper: fallback text
const orBlank = (v) => {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
};

// Normalize availability from boolean/number/string
const isAvailable = (v) => {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return !!v;
};

onMounted(async () => {
  await bookingStore.fetchBookings();
  await fetchBuildings();
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="container">
    <!-- แสดงรายการอาคาร -->
    <div v-if="!selectedBuilding">
      <div class="header-row">
        <h1><i class="fa-solid fa-building"></i> รายการห้องภายในอาคาร</h1>
        <button
          class="btn-create"
          @click="router.push('/admin/rooms/createRoom')"
        >
          <i class="fa-solid fa-circle-plus"></i> เพิ่มห้อง
        </button>
      </div>

      <div v-if="buildings.length" class="buildings-grid">
        <div
          v-for="building in buildings"
          :key="building.id"
          class="building-card"
          @click="handleBuildingClick(building)"
        >
          <div class="building-image">
            <img
              :src="building.image_url || '/default-building.jpg'"
              :alt="building.name"
            />
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
      <div v-else>ไม่มีอาคารในระบบ</div>
    </div>

    <!-- แสดงห้องในอาคาร -->
    <div v-else>
      <div class="header-row">
        <div class="breadcrumb">
          <button @click="goBackToBuildings" class="back-button">
            <i class="fa-solid fa-arrow-left"></i> กลับไปยังรายการอาคาร
          </button>
          <h1>
            <i class="fa-solid fa-door-open"></i>
            ห้องใน {{ selectedBuilding.name }}
          </h1>
        </div>
        <button
          class="btn-create"
          @click="router.push('/admin/rooms/createRoom')"
        >
          <i class="fa-solid fa-circle-plus"></i> เพิ่มห้อง
        </button>
      </div>

      <table
        class="table table-bordered table-striped"
        v-if="paginatedRooms.length"
      >
        <thead>
          <tr>
            <th>รูปภาพ</th>
            <th>ชื่อห้อง</th>
            <th>จำนวนที่เข้าประชุมได้</th>
            <th>คำอธิบาย</th>
            <th>เวลาเปิด</th>
            <th>เวลาปิด</th>
            <th>สถานะห้อง</th>
            <th>ปรับปรุงห้อง</th>
            <th>คาดว่าจะเสร็จ(ชม. นาที)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(room, idx) in paginatedRooms"
            :key="room.id"
            class="room-cell"
            :class="{ 'alt-row': paginatedRooms.length > 2 && idx % 2 === 1 }"
          >
            <td>
              <img :src="room.image_url" alt="room" width="100" height="100" />
            </td>
            <td>{{ room.name }}</td>
            <td>{{ room.capacity }}</td>
            <td>{{ room.description }}</td>
            <td>{{ secondsToHHMM(room.start_room) }}</td>
            <td>{{ secondsToHHMM(room.end_room) }}</td>
            <td>
              <span
                class="status-pill"
                :class="
                  isAvailable(room.is_available) ? 'available' : 'unavailable'
                "
              >
                <span
                  class="status-dot"
                  :class="isAvailable(room.is_available) ? 'green' : 'red'"
                ></span>
                {{
                  isAvailable(room.is_available)
                    ? "พร้อมใช้งาน"
                    : "ไม่พร้อมใช้งาน"
                }}
              </span>
            </td>
            <td>{{ orBlank(room.maintenance_note) }}</td>
            <td>{{ orBlank(room.maintenance_eta) }}</td>
            <td>
              <button class="btn-detail" @click="goTodetail(room.id)">
                <i class="fa-solid fa-info"></i> ดูข้อมูล
              </button>
              <button class="btn-cancel" @click="handleDeleteRoom(room)">
                <i class="fa-solid fa-trash-can"></i> ลบ
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else>ไม่มีห้องในอาคารนี้</div>
    </div>
  </div>

  <!-- Pagination -->
  <div v-if="selectedBuilding && totalPages > 1" class="pagination-bar">
    <div class="pagination">
      <button :disabled="page === 1" @click="gotoPage(page - 1)">
        ก่อนหน้า
      </button>

      <button
        v-for="p in paginationRange"
        :key="p + '-btn'"
        :class="{ active: p === page }"
        @click="gotoPage(p)"
        :disabled="p === '...'"
      >
        {{ p }}
      </button>

      <button :disabled="page >= totalPages" @click="gotoPage(page + 1)">
        ถัดไป
      </button>

      <div class="page-jump">
        <label>ไปหน้า:</label>
        <input
          type="number"
          min="1"
          :max="totalPages"
          v-model.number="jumpToPage"
          @keyup.enter="gotoPage(jumpToPage)"
          :disabled="totalPages === 0"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 40px 30px;
  margin: 30px auto;
  max-width: 1400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding-bottom: 80px;
  min-height: 400px;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 15px;
}

.back-button {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.header-row h1 {
  margin: 0;
  font-size: 28px;
  color: #2d2d2d;
  font-weight: 700;
}

/* Building Grid Styles */
.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 25px;
  margin-bottom: 30px;
}

.building-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
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
  justify-content: flex-start;
  align-items: center;
}

.room-count {
  color: #2d2d2d;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
}

/* Room Table Styles */
.room-cell {
  text-align: center;
  vertical-align: middle;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

th,
td {
  padding: 14px 12px;
  vertical-align: middle;
  border-bottom: 1px solid #e0e0e0;
  font-weight: 500;
}

th {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  font-weight: 600;
}

tr:hover {
  background-color: #f8f9fa;
}

.alt-row {
  background-color: #f8f9fa !important;
}

img {
  border-radius: 8px;
  object-fit: cover;
}

td:last-child {
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

/* Availability status styles */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
  color: #fff;
}
.status-pill.available {
  background: #28a745;
}
.status-pill.unavailable {
  background: #dc3545;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.status-dot.green {
  color: #d4edda;
  background: #d4edda;
}
.status-dot.red {
  color: #f8d7da;
  background: #f8d7da;
}

button {
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  color: white;
  font-weight: bold;
}

h1 {
  text-decoration: none;
}

.btn-create {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  border: none;
  padding: 12px 24px;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  gap: 8px;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.btn-detail {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  border: none;
  padding: 8px 16px;
  margin-top: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-detail:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.btn-cancel {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  margin-left: 10px;
  margin-top: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
  background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
}

.pagination-bar {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  background: #fafafa;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  justify-content: center;
  text-align: center;
  z-index: 100;
  display: flex;
  padding: 12px 0;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.pagination button {
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
}

.pagination button:hover:not(:disabled) {
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
  transform: translateY(-1px);
}

.pagination button:disabled {
  background-color: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  opacity: 0.6;
}

.pagination button.active {
  background: #f5f5f5;
  color: #2d2d2d;
  font-weight: 600;
  border: 2px solid #2d2d2d;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 10px;
}

.page-jump input {
  width: 50px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .buildings-grid {
    grid-template-columns: 1fr;
  }

  .header-row {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .breadcrumb {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
