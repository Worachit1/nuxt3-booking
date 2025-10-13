<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useBuildingStore } from "@/store/buildingStore";

definePageMeta({ middleware: ["load-user"] });

const buildingStore = useBuildingStore();
const { isLoading } = storeToRefs(buildingStore);

const editableBuildings = ref([]);
const showModal = ref(false);
const newBuildingName = ref("");
const newBuildingImage = ref(null);
const newImagePreview = ref(null);

// โหลดข้อมูลอาคาร
const loadBuildings = async () => {
  await buildingStore.fetchBuildings();
  editableBuildings.value = buildingStore.buildings.map((b) => ({
    id: b.id,
    name: b.name || "",
    image_url: b.image_url || "",
    imageFile: null,
    newImagePreview: null,
    rooms_name: b.rooms_name || [],
    isEditing: false,
  }));
};

onMounted(loadBuildings);

// เริ่มแก้ไข
const startEdit = (index) => {
  const b = editableBuildings.value[index];
  b.isEditing = true;
  b.imageFile = null;
  b.newImagePreview = null;
};

// upload รูปใหม่
const handleImageUpload = (event, index) => {
  const file = event.target.files[0];
  if (file) {
    editableBuildings.value[index].imageFile = file;
    editableBuildings.value[index].newImagePreview = URL.createObjectURL(file);
  } else {
    editableBuildings.value[index].imageFile = null;
    editableBuildings.value[index].newImagePreview = null;
  }
};

// upload รูปใหม่ใน modal
const handleNewImageUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    newBuildingImage.value = file;
    newImagePreview.value = URL.createObjectURL(file);
  } else {
    newBuildingImage.value = null;
    newImagePreview.value = null;
  }
};

// เพิ่มอาคารใหม่
const createBuilding = async () => {
  if (!newBuildingName.value?.trim()) {
    Swal.fire("กรุณากรอกชื่ออาคาร", "", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("name", newBuildingName.value.trim());

  // key ต้องเป็น image_url ตาม backend
  if (newBuildingImage.value) {
    formData.append("image_url", newBuildingImage.value);
  }

  try {
    await buildingStore.addBuilding(formData);
    newBuildingName.value = "";
    newBuildingImage.value = null;
    newImagePreview.value = null;
    showModal.value = false;
    await loadBuildings();
    Swal.fire("เพิ่มอาคารเรียบร้อย", "", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเพิ่มอาคารได้", "error");
  }
};

// แก้ไขอาคาร
const saveEdit = async (index) => {
  const b = editableBuildings.value[index];
  if (!b.name?.trim()) {
    Swal.fire("กรุณากรอกชื่ออาคาร", "", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("name", b.name.trim());

  // ส่ง existing_image_url เผื่อไม่ได้เลือกไฟล์ใหม่
  formData.append("existing_image_url", b.image_url);

  // ถ้ามีไฟล์ใหม่ ให้ append
  if (b.imageFile) {
    formData.append("image_url", b.imageFile);
  }

  try {
    await buildingStore.updateBuilding(b.id, formData);
    b.isEditing = false;
    b.imageFile = null;
    b.newImagePreview = null;
    await loadBuildings();
    Swal.fire("แก้ไขเรียบร้อย", "", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถแก้ไขอาคารได้", "error");
  }
};

// ลบอาคาร
const deleteBuilding = async (b) => {
  if (b.rooms_name.length) {
    Swal.fire("ไม่สามารถลบได้", "มีห้องอยู่ในอาคารนี้", "error");
    return;
  }

  const result = await Swal.fire({
    title: `คุณต้องการลบอาคาร "${b.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
  });
  if (!result.isConfirmed) return;

  buildingStore.isLoading = true;
  await buildingStore.deleteBuilding(b.id);
  await loadBuildings();
  buildingStore.isLoading = false;
  Swal.fire("ลบเรียบร้อย", "", "success");
};

// ปิด modal
const closeModals = () => {
  showModal.value = false;
  newBuildingName.value = "";
  newBuildingImage.value = null;
  newImagePreview.value = null;
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <i class="fa-solid fa-building"></i>
        </div>
        <div class="header-text">
          <h1>จัดการอาคาร</h1>
          <p class="subtitle">จัดการข้อมูลอาคารและห้องประชุมทั้งหมด</p>
        </div>
      </div>
      <button class="btn-add" @click="showModal = true">
        <i class="fa-solid fa-plus-circle"></i>
        <span>เพิ่มอาคารใหม่</span>
      </button>
    </div>

    <!-- Buildings Grid -->
    <div class="container">
      <div v-if="editableBuildings.length" class="buildings-grid">
        <div
          v-for="(b, index) in editableBuildings"
          :key="b.id"
          class="building-card"
        >
          <!-- Card Image -->
          <div class="card-image">
            <img
              v-if="b.newImagePreview"
              :src="b.newImagePreview"
              alt="Building Preview"
            />
            <img v-else-if="b.image_url" :src="b.image_url" alt="Building" />
            <div v-else class="no-image">
              <i class="fa-solid fa-image"></i>
              <span>ไม่มีรูปภาพ</span>
            </div>

            <!-- Edit Mode Image Upload -->
            <div v-if="b.isEditing" class="image-upload-overlay">
              <label class="upload-btn">
                <i class="fa-solid fa-camera"></i>
                <span>เปลี่ยนรูป</span>
                <input
                  type="file"
                  accept="image/*"
                  @change="(e) => handleImageUpload(e, index)"
                  hidden
                />
              </label>
            </div>
          </div>

          <!-- Card Content -->
          <div class="card-content">
            <div v-if="!b.isEditing" class="building-name">
              <i class="fa-solid fa-building-circle-check"></i>
              <h3>{{ b.name }}</h3>
            </div>
            <div v-else class="building-edit">
              <input
                type="text"
                v-model="b.name"
                placeholder="ชื่ออาคาร"
                class="edit-input"
              />
            </div>

            <!-- Room List -->
            <div v-if="b.rooms_name.length > 0" class="room-list">
              <div class="room-list-header">
                <i class="fa-solid fa-list"></i>
                <span>ห้องในอาคาร</span>
              </div>
              <div class="room-chips">
                <span
                  v-for="room in b.rooms_name.slice(0, 3)"
                  :key="room"
                  class="room-chip"
                >
                  {{ room }}
                </span>
                <span v-if="b.rooms_name.length > 3" class="room-chip more">
                  +{{ b.rooms_name.length - 3 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="card-actions">
            <button
              v-if="!b.isEditing"
              class="btn-edit"
              @click="startEdit(index)"
            >
              <i class="fa-solid fa-pen-to-square"></i>
              <span>แก้ไข</span>
            </button>
            <button v-else class="btn-save" @click="saveEdit(index)">
              <i class="fa-solid fa-check"></i>
              <span>บันทึก</span>
            </button>
            <button class="btn-delete" @click="deleteBuilding(b)">
              <i class="fa-solid fa-trash"></i>
              <span>ลบ</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <i class="fa-solid fa-building-slash"></i>
        <h3>ยังไม่มีอาคารในระบบ</h3>
        <p>เริ่มต้นโดยการเพิ่มอาคารแรกของคุณ</p>
        <button class="btn-add-empty" @click="showModal = true">
          <i class="fa-solid fa-plus"></i>
          เพิ่มอาคารแรก
        </button>
      </div>
    </div>
  </div>

  <!-- Create Building Modal -->
  <teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-building-circle-plus"></i>
            เพิ่มอาคารใหม่
          </h3>
          <button @click="closeModals" class="close-btn">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>
              <i class="fa-solid fa-signature"></i>
              ชื่ออาคาร
            </label>
            <input
              v-model="newBuildingName"
              type="text"
              placeholder="กรอกชื่ออาคาร"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>
              <i class="fa-solid fa-image"></i>
              รูปภาพอาคาร
            </label>
            <div class="image-upload-area">
              <div v-if="newImagePreview" class="image-preview">
                <img :src="newImagePreview" alt="Preview" />
                <button
                  @click="
                    newImagePreview = null;
                    newBuildingImage = null;
                  "
                  class="remove-image"
                >
                  <i class="fa-solid fa-times"></i>
                </button>
              </div>
              <label v-else class="upload-placeholder">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>คลิกเพื่ออัพโหลดรูปภาพ</span>
                <small>รองรับ JPG, PNG (สูงสุด 5MB)</small>
                <input
                  type="file"
                  accept="image/*"
                  @change="handleNewImageUpload"
                  hidden
                />
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="createBuilding" class="btn-confirm">
            <i class="fa-solid fa-check"></i>
            บันทึก
          </button>
          <button @click="closeModals" class="btn-cancel">
            <i class="fa-solid fa-xmark"></i>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* Page Container */
.page-container {
  background: #f5f5f5;
  min-height: 100vh;
  padding: 100px 20px 40px 20px;
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border-radius: 16px;
  padding: 30px 40px;
  margin-bottom: 30px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-content {
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
  padding: 0;
}

/* Building Card */
.building-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
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
  height: 200px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  overflow: hidden;
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

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  gap: 8px;
}

.no-image i {
  font-size: 48px;
  color: #d1d5db;
}

.image-upload-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.building-card:hover .image-upload-overlay {
  opacity: 1;
}

.upload-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.room-count {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #2d2d2d;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.room-count i {
  color: #fbbf24;
}

/* Card Content */
.card-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.building-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.building-name i {
  color: #fbbf24;
  font-size: 24px;
}

.building-name h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
  line-height: 1.3;
}

.building-edit {
  width: 100%;
}

.edit-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #fbbf24;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
  background: #fffbeb;
}

.edit-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.room-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.room-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-chip {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #90caf9;
}

.room-chip.more {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border-color: #fbbf24;
}

.no-rooms {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
  font-style: italic;
}

/* Card Actions */
.card-actions {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 2px solid #f3f4f6;
  background: #f8f9fa;
}

.btn-edit,
.btn-save,
.btn-delete {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-edit {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.btn-save {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
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
  color: #9ca3af;
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

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal Header */
.modal-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 24px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 3px solid #fbbf24;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.modal-title h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.btn-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

/* Modal Body */
.modal-body {
  padding: 28px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 16px;
  color: #2d2d2d;
}

.form-group label i {
  color: #fbbf24;
  font-size: 18px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 16px;
  transition: all 0.2s ease;
  font-family: inherit;
  background: #f8f9fa;
}

.form-input:focus {
  outline: none;
  border-color: #fbbf24;
  background: white;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

/* Image Upload Area */
.image-upload-area {
  border: 3px dashed #e0e0e0;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-upload-area:hover {
  border-color: #fbbf24;
  background: #fffbeb;
}

.image-preview {
  position: relative;
  display: inline-block;
}

.image-preview img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-remove-image {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  transition: all 0.2s ease;
}

.btn-remove-image:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #6b7280;
}

.upload-placeholder i {
  font-size: 64px;
  color: #d1d5db;
}

.upload-placeholder p {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.upload-placeholder small {
  font-size: 14px;
  color: #9ca3af;
}

/* Modal Footer */
.modal-footer {
  padding: 20px 28px;
  border-top: 2px solid #f3f4f6;
  background: #f8f9fa;
  display: flex;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: #e5e7eb;
  color: #374151;
  border: 2px solid #d1d5db;
}

.btn-cancel:hover {
  background: #d1d5db;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-confirm {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.btn-confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .buildings-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 20px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
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
    gap: 16px;
  }

  .modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-header {
    padding: 20px;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column;
  }

  .btn-cancel,
  .btn-confirm {
    width: 100%;
  }
}
</style>
