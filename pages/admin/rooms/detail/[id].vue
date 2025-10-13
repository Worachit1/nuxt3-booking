<script setup>
import { useRoute, useRouter } from "vue-router";
import { ref, onMounted, onActivated } from "vue";
import LoadingPage from "~/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";

definePageMeta({
  middleware: ["load-user"],
});

const route = useRoute();
const router = useRouter();
const roomId = route.params.id;
const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);

const room = ref({});

const goToEditRoom = () => {
  router.push(`/admin/rooms/edit/${roomId}`);
};

const formatTime = (seconds) => {
  if (seconds === null || seconds === undefined) return "-";
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (v) => (v < 10 ? `0${v}` : String(v));
  return `${pad(h)}:${pad(m)}`;
};

const fetchRoomData = async () => {
  try {
    // Force refresh from API instead of cache
    const data = await roomStore.getById(roomId);
    room.value = data || {};
  } catch (error) {
    console.error("Error fetching room details:", error);
  }
};

onMounted(async () => {
  await fetchRoomData();
});

// Refresh data when page becomes visible again (e.g., after navigating back from edit)
onActivated(() => {
  fetchRoomData();
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="page-container">
    <!-- Hero Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <button @click="$router.back()" class="btn-back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="header-icon">
            <i class="fa-solid fa-door-open"></i>
          </div>
          <div class="header-text">
            <h1>รายละเอียดห้อง</h1>
            <p class="subtitle">{{ room.name || "กำลังโหลด..." }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-edit" @click="goToEditRoom">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>แก้ไข</span>
          </button>
          <button class="btn-calendar" @click="$router.push('/')">
            <i class="fa-solid fa-calendar-days"></i>
            <span>ปฏิทิน</span>
          </button>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="detail-layout">
        <!-- Image Section -->
        <div class="image-section">
          <div class="image-wrapper">
            <img
              :src="room.image_url || '/images/default-picture.png'"
              :alt="room.name"
              class="room-image"
            />
          </div>
          <div class="image-info">
            <div class="building-badge">
              <i class="fa-solid fa-building"></i>
              <span>{{ room.building || "ไม่ระบุอาคาร" }}</span>
            </div>
          </div>
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <div class="info-grid">
            <div class="info-card">
              <div class="card-icon capacity">
                <i class="fa-solid fa-users"></i>
              </div>
              <div class="card-content">
                <div class="card-label">จำนวนที่นั่ง</div>
                <div class="card-value">{{ room.capacity || 0 }} คน</div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-icon time">
                <i class="fa-solid fa-clock"></i>
              </div>
              <div class="card-content">
                <div class="card-label">เวลาเปิด-ปิด</div>
                <div class="card-value">
                  {{ formatTime(room.start_room) }} -
                  {{ formatTime(room.end_room) }}
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-icon status">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div class="card-content">
                <div class="card-label">สถานะห้อง</div>
                <div class="card-value">
                  <span
                    class="status-badge"
                    :class="room.is_available ? 'available' : 'unavailable'"
                  >
                    {{ room.is_available ? "พร้อมใช้งาน" : "ไม่พร้อมใช้งาน" }}
                  </span>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-icon maintenance">
                <i class="fa-solid fa-wrench"></i>
              </div>
              <div class="card-content">
                <div class="card-label">การซ่อมบำรุง</div>
                <div class="card-value">{{ room.maintenance_eta || "-" }}</div>
              </div>
            </div>
          </div>

          <div class="description-card">
            <div class="description-header">
              <i class="fa-solid fa-align-left"></i>
              <h3>รายละเอียดห้อง</h3>
            </div>
            <p class="description-text">
              {{ room.description || "ไม่มีรายละเอียด" }}
            </p>
          </div>

          <div
            v-if="room.maintenance_note && room.maintenance_note.trim() !== ''"
            class="maintenance-card"
          >
            <div class="maintenance-header">
              <i class="fa-solid fa-screwdriver-wrench"></i>
              <h3>บันทึกการซ่อมบำรุง</h3>
            </div>
            <p class="maintenance-text">{{ room.maintenance_note }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page Container */
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 100px 20px 40px 20px;
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1200px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.header-content {
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
}

.subtitle {
  color: #cbd5e0;
  font-size: 14px;
  margin: 8px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-edit,
.btn-calendar {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn-edit {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.btn-edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

.btn-calendar {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-calendar:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* Container */
.container {
  margin: 0 auto;
  max-width: 1200px;
}

/* Detail Layout */
.detail-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 32px;
}

/* Image Section */
.image-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-wrapper {
  width: 100%;
  height: 400px;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  background: #f8f9fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.room-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-info {
  display: flex;
  justify-content: center;
}

.building-badge {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

/* Info Section */
.info-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  display: flex;
  gap: 16px;
  align-items: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-card:hover {
  border-color: #fbbf24;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.card-icon.capacity {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.card-icon.time {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.card-icon.status {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.card-icon.maintenance {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 18px;
  color: #2d2d2d;
  font-weight: 700;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
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

/* Description Card */
.description-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.description-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: #2d2d2d;
}

.description-header i {
  color: #fbbf24;
  font-size: 20px;
}

.description-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.description-text {
  color: #374151;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}

/* Maintenance Card */
.maintenance-card {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  padding: 24px;
  border-radius: 12px;
  border: 2px solid #fbbf24;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

.maintenance-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #92400e;
}

.maintenance-header i {
  font-size: 20px;
}

.maintenance-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.maintenance-text {
  color: #78350f;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .detail-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .image-wrapper {
    height: 300px;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 100px 12px 40px 12px;
  }

  .page-header {
    padding: 24px 20px;
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

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .btn-edit,
  .btn-calendar {
    width: 100%;
    justify-content: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .image-wrapper {
    height: 250px;
  }
}
</style>
