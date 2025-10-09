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

  <div class="equipment-container">
    <div class="page-header">
      <h1>รายการอุปกรณ์เสริม</h1>
    </div>
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
          <p v-if="eq.available === 0" class="out-of-stock">
            ❌ อุปกรณ์ไม่เหลือ
          </p>
          <p v-else>
            <span>จำนวนที่สามารถจองได้:</span>
            <span class="available">{{ eq.available }}</span>
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
  padding: 40px 30px;
  max-width: 1400px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.page-header {
  padding-bottom: 24px;
  margin-bottom: 30px;
  border-bottom: 2px solid #e0e0e0;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #2d2d2d;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.equipment-card {
  background: #ffffff;
  border-radius: 16px;
  border: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s;
  cursor: default;
  display: flex;
  flex-direction: column;
  height: 420px;
}

.equipment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  border-color: #2d2d2d;
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 260px;
  overflow: hidden;
  background: #f8f9fa;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.equipment-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.no-image {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #999;
  font-size: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  font-weight: 600;
}

.broken-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(220, 53, 69, 0.85) 0%,
    rgba(200, 35, 51, 0.85) 100%
  );
  color: white;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  text-align: center;
  backdrop-filter: blur(2px);
}

.info {
  padding: 18px 20px 20px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
  line-height: 1.3;
}

.info p {
  margin: 0;
  font-size: 15px;
  color: #555;
  line-height: 1.5;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 16px;
}

.available {
  color: #10b981;
  font-weight: 700;
  font-size: 16px;
}

.out-of-stock {
  color: #dc3545;
  font-weight: 700;
  font-size: 16px;
  background: linear-gradient(135deg, #fee, #fdd);
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 4px solid #dc3545;
  display: flex;
  align-items: center;
  gap: 6px;
}

.equipment-card.broken {
  opacity: 0.85;
}

.equipment-card.broken .info h3 {
  color: #6c757d;
}
</style>
