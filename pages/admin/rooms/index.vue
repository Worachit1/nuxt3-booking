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

  <div class="page-container">
    <!-- แสดงรายการอาคาร -->
    <div v-if="!selectedBuilding">
      <!-- Hero Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <i class="fa-solid fa-building"></i>
            </div>
            <div class="header-text">
              <h1>จัดการห้อง</h1>
              <p class="subtitle">เลือกอาคารเพื่อดูห้องภายใน</p>
            </div>
          </div>
          <button
            class="btn-add"
            @click="router.push('/admin/rooms/createRoom')"
          >
            <i class="fa-solid fa-circle-plus"></i>
            <span>เพิ่มห้องใหม่</span>
          </button>
        </div>
      </div>

      <div class="container">
        <div v-if="buildings.length" class="buildings-grid">
          <div
            v-for="building in buildings"
            :key="building.id"
            class="building-card"
            @click="handleBuildingClick(building)"
          >
            <div class="building-image">
              <img
                :src="building.image_url || '/images/default-picture.png'"
                :alt="building.name"
              />
              <div class="image-overlay">
                <i class="fa-solid fa-arrow-right"></i>
              </div>
            </div>
            <div class="building-content">
              <h3>{{ building.name }}</h3>
              <div class="room-count">
                <i class="fa-solid fa-door-open"></i>
                <span>{{ building.rooms?.length || 0 }} ห้อง</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <i class="fa-solid fa-building-slash"></i>
          <h3>ยังไม่มีอาคารในระบบ</h3>
          <p>กรุณาเพิ่มอาคารก่อนเพื่อจัดการห้อง</p>
        </div>
      </div>
    </div>

    <!-- แสดงห้องในอาคาร -->
    <div v-else>
      <!-- Header with Back Button -->
      <div class="page-header rooms-header">
        <div class="header-content">
          <div class="header-left">
            <button @click="goBackToBuildings" class="btn-back">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div class="header-icon">
              <i class="fa-solid fa-door-open"></i>
            </div>
            <div class="header-text">
              <h1>ห้องใน {{ selectedBuilding.name }}</h1>
              <p class="subtitle">จำนวนห้องทั้งหมด: {{ total }} ห้อง</p>
            </div>
          </div>
          <button
            class="btn-add"
            @click="router.push('/admin/rooms/createRoom')"
          >
            <i class="fa-solid fa-circle-plus"></i>
            <span>เพิ่มห้องใหม่</span>
          </button>
        </div>
      </div>

      <div class="container">
        <div v-if="paginatedRooms.length" class="rooms-table-wrapper">
          <table class="rooms-table">
            <thead>
              <tr>
                <th><i class="fa-solid fa-image"></i> รูปภาพ</th>
                <th><i class="fa-solid fa-door-open"></i> ชื่อห้อง</th>
                <th><i class="fa-solid fa-users"></i> จำนวนที่นั่ง</th>
                <th><i class="fa-solid fa-align-left"></i> คำอธิบาย</th>
                <th><i class="fa-solid fa-clock"></i> เวลาเปิด</th>
                <th><i class="fa-solid fa-clock"></i> เวลาปิด</th>
                <th><i class="fa-solid fa-circle-check"></i> สถานะ</th>
                <th><i class="fa-solid fa-wrench"></i> บันทึกซ่อมบำรุง</th>
                <th><i class="fa-solid fa-hourglass-half"></i> เวลาซ่อม</th>
                <th><i class="fa-solid fa-cog"></i> จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="room in paginatedRooms" :key="room.id">
                <td class="img-cell">
                  <img
                    :src="room.image_url || '/images/default-picture.png'"
                    alt="room"
                  />
                </td>
                <td class="room-name">{{ room.name }}</td>
                <td class="capacity">{{ room.capacity }} คน</td>
                <td class="description">{{ room.description || "-" }}</td>
                <td>{{ secondsToHHMM(room.start_room) }}</td>
                <td>{{ secondsToHHMM(room.end_room) }}</td>
                <td>
                  <span
                    class="status-badge"
                    :class="
                      isAvailable(room.is_available)
                        ? 'available'
                        : 'unavailable'
                    "
                  >
                    <i
                      :class="
                        isAvailable(room.is_available)
                          ? 'fa-solid fa-circle-check'
                          : 'fa-solid fa-circle-xmark'
                      "
                    ></i>
                    {{
                      isAvailable(room.is_available)
                        ? "พร้อมใช้งาน"
                        : "ไม่พร้อมใช้งาน"
                    }}
                  </span>
                </td>
                <td class="maintenance">
                  {{ orBlank(room.maintenance_note) || "-" }}
                </td>
                <td class="eta">{{ orBlank(room.maintenance_eta) || "-" }}</td>
                <td class="actions">
                  <button class="btn-detail" @click="goTodetail(room.id)">
                    <i class="fa-solid fa-eye"></i>
                    <span>ดูข้อมูล</span>
                  </button>
                  <button class="btn-delete" @click="handleDeleteRoom(room)">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>ลบ</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <i class="fa-solid fa-door-closed"></i>
          <h3>ยังไม่มีห้องในอาคารนี้</h3>
          <p>เพิ่มห้องแรกของคุณเลย</p>
          <button
            class="btn-add-empty"
            @click="router.push('/admin/rooms/createRoom')"
          >
            <i class="fa-solid fa-circle-plus"></i>
            <span>เพิ่มห้องใหม่</span>
          </button>
        </div>
      </div>
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
/* Page Container */
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 100px 20px 80px 20px;
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1400px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.btn-back {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
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
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}

.subtitle {
  color: #cbd5e0;
  font-size: 14px;
  margin: 8px 0 0 0;
}

.btn-add {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

/* Container */
.container {
  margin: 0 auto;
  max-width: 1400px;
  padding: 0;
}

/* Buildings Grid */
.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.building-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.building-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

.building-image {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.building-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.building-card:hover .building-image img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.building-card:hover .image-overlay {
  opacity: 1;
}

.image-overlay i {
  font-size: 48px;
  color: white;
  animation: slideRight 0.6s ease infinite alternate;
}

@keyframes slideRight {
  from {
    transform: translateX(-8px);
  }
  to {
    transform: translateX(8px);
  }
}

.building-content {
  padding: 20px;
}

.building-content h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
}

.room-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
}

.room-count i {
  color: #fbbf24;
  font-size: 18px;
}

/* Rooms Table */
.rooms-table-wrapper {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

.rooms-table {
  width: 100%;
  border-collapse: collapse;
}

.rooms-table thead {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
}

.rooms-table th {
  padding: 16px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.rooms-table th i {
  margin-right: 6px;
  color: #fbbf24;
}

.rooms-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s ease;
}

.rooms-table tbody tr:hover {
  background: #f8f9fa;
}

.rooms-table td {
  padding: 16px 12px;
  vertical-align: middle !important;
  color: #374151;
  font-size: 14px;
  height: 100%;
}

.img-cell {
  width: 120px;
}

.img-cell img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
}

.room-name {
  font-weight: 600;
  color: #2d2d2d;
  font-size: 15px;
}

.capacity {
  font-weight: 600;
  color: #6b7280;
}

.description {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
}

.maintenance,
.eta {
  color: #9ca3af;
  font-size: 13px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.status-badge.available {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.status-badge.unavailable {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.actions {
  display: table-cell;
  vertical-align: middle;
}

.actions > button {
  margin-right: 8px;
  margin-bottom: 8px;
}

/* Action Buttons */
.btn-detail,
.btn-delete {
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.btn-detail {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-detail:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.btn-delete {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: #ffffff;
  border-radius: 16px;
  border: 2px dashed #e0e0e0;
}

.empty-state i {
  font-size: 80px;
  color: #e5e7eb;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #374151;
}

.empty-state p {
  margin: 0 0 24px 0;
  font-size: 16px;
  color: #6b7280;
}

.btn-add-empty {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  transition: all 0.3s ease;
}

.btn-add-empty:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

/* Pagination */
.pagination-bar {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  background: white;
  border-top: 2px solid #e0e0e0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  padding: 16px 20px;
  z-index: 100;
  display: flex;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pagination button {
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  background: white;
  color: #374151;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #fbbf24;
  transform: translateY(-1px);
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination button.active {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border-color: #fbbf24;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 2px solid #e0e0e0;
}

.page-jump label {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}

.page-jump input {
  width: 60px;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}

.page-jump input:focus {
  outline: none;
  border-color: #fbbf24;
}

/* Responsive */
@media (max-width: 1024px) {
  .buildings-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .rooms-table-wrapper {
    overflow-x: auto;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 100px 12px 80px 12px;
  }

  .page-header {
    padding: 24px 20px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-left {
    flex-direction: column;
    align-items: flex-start;
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

  .buildings-grid {
    grid-template-columns: 1fr;
  }

  .btn-add {
    width: 100%;
    justify-content: center;
  }

  .rooms-table th,
  .rooms-table td {
    padding: 12px 8px;
    font-size: 12px;
  }

  .img-cell img {
    width: 80px;
    height: 80px;
  }

  .actions {
    flex-direction: column;
  }

  .btn-detail,
  .btn-delete {
    width: 100%;
    justify-content: center;
  }

  .pagination {
    gap: 4px;
  }

  .pagination button {
    padding: 8px 12px;
    font-size: 12px;
  }

  .page-jump {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    margin-top: 8px;
    width: 100%;
  }
}
</style>
