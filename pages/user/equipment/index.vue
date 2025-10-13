<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useEquipmentStore } from "@/store/equipmentStore";
import LoadingPage from "@/components/Loading.vue";

const equipmentStore = useEquipmentStore();
const { isLoading } = storeToRefs(equipmentStore);

const equipments = ref([]);
let refreshInterval = null; // เก็บ interval สำหรับ auto-refresh
const isRefreshing = ref(false); // สถานะการรีเฟรชแบบเงียบ

const loadEquipments = async (silent = false) => {
  if (silent) {
    isRefreshing.value = true;
  }

  await equipmentStore.fetchEquipments();

  // เก็บข้อมูลเก่าไว้ก่อนเพื่อเปรียบเทียบ
  const newEquipments = equipmentStore.equipments.map((eq) => ({
    ...eq,
    available: typeof eq.available === "number" ? eq.available : eq.quantity,
  }));

  // อัปเดตข้อมูลแบบนุ่มนวล (ไม่ทำให้กระพริบ)
  equipments.value = newEquipments;

  if (silent) {
    isRefreshing.value = false;
  }
};

onMounted(async () => {
  await loadEquipments(); // โหลดครั้งแรก (แสดง loading)

  // 🔥 เริ่ม Auto-refresh ทุก 2 วินาที (แบบเงียบ ไม่แสดง loading)
  refreshInterval = setInterval(async () => {
    await loadEquipments(true); // silent mode
  }, 2000);
});

// 🧹 ทำความสะอาด interval เมื่อออกจากหน้า
onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading && !isRefreshing" />
  </teleport>

  <div class="page-container">
    <!-- Hero Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <i class="fa-solid fa-box"></i>
          </div>
          <div class="header-text">
            <h1>รายการอุปกรณ์เสริม</h1>
            <p class="subtitle">อุปกรณ์เสริมสำหรับการจองห้อง</p>
          </div>
        </div>
        <div class="refresh-indicator" :class="{ active: isRefreshing }">
          <i class="fa-solid fa-sync-alt"></i>
          <span>{{ isRefreshing ? "กำลังอัปเดต..." : "อัปเดตอัตโนมัติ" }}</span>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- Equipment Grid -->
      <div v-if="equipments.length" class="equipment-grid">
        <div
          v-for="eq in equipments"
          :key="eq.id"
          class="equipment-card"
          :class="{
            broken: eq.status === 'Broken',
            'out-of-stock': eq.available === 0,
          }"
        >
          <div class="card-image">
            <img v-if="eq.image_url" :src="eq.image_url" alt="equipment" />
            <div v-else class="no-image">
              <i class="fa-solid fa-image"></i>
              <span>ไม่มีรูป</span>
            </div>

            <!-- Status Overlays -->
            <div v-if="eq.status === 'Broken'" class="status-overlay broken">
              <i class="fa-solid fa-tools"></i>
              <span>ชำรุด</span>
            </div>
            <div
              v-else-if="eq.available === 0"
              class="status-overlay unavailable"
            >
              <i class="fa-solid fa-ban"></i>
              <span>ไม่พร้อมใช้งาน</span>
            </div>
          </div>

          <div class="card-body">
            <h3 class="equipment-name">{{ eq.name }}</h3>

            <div class="stats-row">
              <div class="stat-item total">
                <i class="fa-solid fa-boxes"></i>
                <div>
                  <span class="stat-label">ทั้งหมด</span>
                  <span class="stat-value">{{ eq.quantity }}</span>
                </div>
              </div>

              <div
                class="stat-item available"
                :class="{ zero: eq.available === 0 }"
              >
                <i class="fa-solid fa-check-circle"></i>
                <div>
                  <span class="stat-label">พร้อมใช้</span>
                  <span class="stat-value">{{ eq.available }}</span>
                </div>
              </div>
            </div>

            <div v-if="eq.status === 'Broken'" class="alert-box broken">
              <i class="fa-solid fa-exclamation-triangle"></i>
              <span>อุปกรณ์ชำรุด</span>
            </div>
            <div v-else-if="eq.available === 0" class="alert-box unavailable">
              <i class="fa-solid fa-info-circle"></i>
              <span>อุปกรณ์ไม่เหลือ</span>
            </div>
            <div v-else class="alert-box available">
              <i class="fa-solid fa-check-circle"></i>
              <span>พร้อมให้บริการ</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h2>ยังไม่มีอุปกรณ์</h2>
        <p>ขณะนี้ยังไม่มีอุปกรณ์เสริมในระบบ</p>
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

/* Hero Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 20px;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.header-content {
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

.refresh-indicator.active {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.refresh-indicator.active i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Container */
.container {
  max-width: 1400px;
  margin: 0 auto;
}

/* Equipment Grid */
.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.equipment-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease;
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

.equipment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

.equipment-card.broken {
  opacity: 0.8;
  border-color: #dc3545;
}

.equipment-card.out-of-stock {
  border-color: #f59e0b;
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

.equipment-card:hover .card-image img {
  transform: scale(1.05);
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  color: #9ca3af;
  gap: 8px;
}

.no-image i {
  font-size: 48px;
}

.no-image span {
  font-size: 14px;
  font-weight: 600;
}

.status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: white;
  font-weight: 700;
  font-size: 20px;
  backdrop-filter: blur(4px);
}

.status-overlay i {
  font-size: 48px;
}

.status-overlay.broken {
  background: linear-gradient(
    135deg,
    rgba(220, 53, 69, 0.9) 0%,
    rgba(200, 35, 51, 0.9) 100%
  );
}

.status-overlay.unavailable {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.9) 0%,
    rgba(217, 119, 6, 0.9) 100%
  );
}

/* Card Body */
.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.equipment-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
  line-height: 1.3;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.stat-item.total {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 1px solid #93c5fd;
}

.stat-item.available {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border: 1px solid #6ee7b7;
}

.stat-item.available.zero {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 1px solid #fca5a5;
}

.stat-item i {
  font-size: 24px;
}

.stat-item.total i {
  color: #2563eb;
}

.stat-item.available i {
  color: #059669;
}

.stat-item.available.zero i {
  color: #dc2626;
}

.stat-item > div {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
}

/* Alert Box */
.alert-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.alert-box i {
  font-size: 18px;
}

.alert-box.available {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border-left: 4px solid #10b981;
}

.alert-box.unavailable {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border-left: 4px solid #f59e0b;
}

.alert-box.broken {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border-left: 4px solid #dc3545;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 16px;
  border: 2px dashed #e0e0e0;
}

.empty-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: white;
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.3);
}

.empty-state h2 {
  margin: 0 0 12px 0;
  font-size: 28px;
  color: #2d2d2d;
  font-weight: 700;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
  .page-container {
    padding: 100px 12px 40px 12px;
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

  .equipment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
