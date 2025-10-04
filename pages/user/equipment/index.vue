<script setup>
import { ref, onMounted } from "vue";
import { useEquipmentStore } from "@/store/equipmentStore";
import LoadingPage from "@/components/Loading.vue";

const equipmentStore = useEquipmentStore();
const { isLoading } = storeToRefs(equipmentStore);

const equipments = ref([]);

const loadEquipments = async () => {
  await equipmentStore.fetchEquipments();
  equipments.value = equipmentStore.equipments.map((eq) => ({
    ...eq,
    available: typeof eq.available === "number" ? eq.available : eq.quantity,
  }));
};

onMounted(loadEquipments);
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div>
    <h1>รายการอุปกรณ์เสริม</h1>
  </div>

  <div class="equipment-container">
    <div v-if="equipments.length" class="equipment-grid">
      <div
        v-for="eq in equipments"
        :key="eq.id"
        class="equipment-card"
        :class="{ broken: eq.status === 'Broken' }"
      >
        <div class="image-wrapper">
          <img v-if="eq.image_url" :src="eq.image_url" alt="equipment" />
          <div v-else class="no-image">ไม่มีรูป</div>

          <!-- overlay ถ้า Broken -->
          <div v-if="eq.status === 'Broken'" class="broken-overlay">
            <span>❌ ชำรุด</span>
          </div>
        </div>

        <div class="info">
          <h3>{{ eq.name }}</h3>
          <p>จำนวนทั้งหมด: {{ eq.quantity }}</p>
          <p>
            <span class="available">จำนวนที่สามารถจองได้:</span>
            <span
              :class="['available', eq.available === 0 ? 'zero' : '']"
            >
              {{ eq.available }}
            </span>
          </p>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <p>ยังไม่มีอุปกรณ์</p>
    </div>
  </div>
</template>

<style scoped>
.equipment-container {
  padding: 2rem;
  max-width: 1200px;
  margin: auto;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 2rem;
}

.equipment-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: default;
  display: flex;
  flex-direction: column;
  height: 400px; /* ✅ เพิ่มความสูง card */
}

.equipment-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
}

.image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3; /* สูง/กว้าง = 3/4 */
  overflow: hidden;
  border-radius: 16px;
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 250px; /* ✅ กำหนดความสูงรูปให้ใหญ่ขึ้น */
  overflow: hidden;
  border-radius: 16px;
}

.image-wrapper img {
  width: 100%;
  height: 100%; /* ✅ ทำให้เต็มพื้นที่ */
  object-fit: cover; /* ✅ รูปไม่โดนยืดแต่ครอบเต็ม */
  border-radius: 16px;
}

.no-image {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #aaa;
  font-size: 16px;
  background-color: #f0f0f0;
}

.broken-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 0, 0, 0.5);
  color: white;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  text-align: center;
}

.info {
  padding: 1rem 1rem 1.5rem 1rem;
  flex: 1;
}

.info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 20px;
  color: #333;
}

.info p {
  margin: 0.3rem 0;
  font-size: 15px;
  color: #555;
}

.empty {
  text-align: center;
  padding: 3rem;
  color: #888;
  font-size: 16px;
}

.available {
  color: rgb(3, 166, 11);
}
</style>
