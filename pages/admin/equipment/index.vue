<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useEquipmentStore } from "@/store/equipmentStore";

definePageMeta({ middleware: ["load-user"] });

const equipmentStore = useEquipmentStore();
const { isLoading } = storeToRefs(equipmentStore);

const editableEquipments = ref([]);
const showModal = ref(false);

// ฟอร์มเพิ่มอุปกรณ์ใหม่
const newEquipment = ref({
  name: "",
  quantity: "",
  image: null,
  imagePreview: null,
});

// โหลดข้อมูลอุปกรณ์
const loadEquipments = async () => {
  await equipmentStore.fetchEquipments();
  editableEquipments.value = equipmentStore.equipments.map((e) => ({
    id: e.id,
    name: e.name || "",
    image_url: e.image_url || "",
    quantity: e.quantity || 0,
    status: e.status || "Available",
    available: typeof e.available === "number" ? e.available : e.quantity,
    imageFile: null,
    newImagePreview: null,
    isEditing: false,
  }));
};

onMounted(loadEquipments);

// เริ่มแก้ไข
const startEdit = (index) => {
  const e = editableEquipments.value[index];
  e.isEditing = true;
  e.imageFile = null;
  e.newImagePreview = null;
};

// อัปโหลดรูปใหม่ (edit)
const handleImageUpload = (event, index) => {
  const file = event.target.files[0];
  if (file) {
    editableEquipments.value[index].imageFile = file;
    editableEquipments.value[index].newImagePreview = URL.createObjectURL(file);
  } else {
    editableEquipments.value[index].imageFile = null;
    editableEquipments.value[index].newImagePreview = null;
  }
};

// อัปโหลดรูปใหม่ (create)
const handleNewImageUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    newEquipment.value.image = file;
    newEquipment.value.imagePreview = URL.createObjectURL(file);
  } else {
    newEquipment.value.image = null;
    newEquipment.value.imagePreview = null;
  }
};

// เพิ่มอุปกรณ์ใหม่
const createEquipment = async () => {
  if (!newEquipment.value.name?.trim() || !newEquipment.value.quantity) {
    Swal.fire("กรุณากรอกข้อมูลให้ครบ", "", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("name", newEquipment.value.name.trim());
  formData.append("quantity", newEquipment.value.quantity);

  if (newEquipment.value.image) {
    formData.append("image_url", newEquipment.value.image);
  }

  try {
    await equipmentStore.addEquipment(formData);
    newEquipment.value = {
      name: "",
      quantity: "",
      image: null,
      imagePreview: null,
    };
    showModal.value = false;
    await loadEquipments();
    Swal.fire("เพิ่มอุปกรณ์เรียบร้อย", "", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเพิ่มอุปกรณ์ได้", "error");
  }
};

// บันทึกการแก้ไข
const saveEdit = async (index) => {
  const e = editableEquipments.value[index];
  if (!e.name?.trim()) {
    Swal.fire("กรุณากรอกชื่ออุปกรณ์", "", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("name", e.name.trim());
  formData.append("quantity", e.quantity);

  formData.append("existing_image_url", e.image_url);
  if (e.imageFile) {
    formData.append("image_url", e.imageFile);
  }

  try {
    await equipmentStore.updateEquipment(e.id, formData);
    e.isEditing = false;
    e.imageFile = null;
    e.newImagePreview = null;
    await loadEquipments();
    Swal.fire("แก้ไขเรียบร้อย", "", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถแก้ไขอุปกรณ์ได้", "error");
  }
};

// ลบอุปกรณ์
const deleteEquipment = async (e) => {
  const result = await Swal.fire({
    title: `คุณต้องการลบ "${e.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
  });
  if (!result.isConfirmed) return;

  equipmentStore.isLoading = true;
  await equipmentStore.deleteEquipment(e.id);
  await loadEquipments();
  equipmentStore.isLoading = false;
  Swal.fire("ลบเรียบร้อย", "", "success");
};

// ลบรูปใหม่ในโหมดเพิ่ม
const removeNewImage = () => {
  newEquipment.value.image = null;
  newEquipment.value.imagePreview = null;
};

// ปิด modal
const closeModals = () => {
  showModal.value = false;
  newEquipment.value = {
    name: "",
    quantity: "",
    image: null,
    imagePreview: null,
  };
};
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
          <div class="header-icon">
            <i class="fa-solid fa-box"></i>
          </div>
          <div class="header-text">
            <h1>รายการอุปกรณ์</h1>
            <p class="subtitle">จัดการอุปกรณ์ทั้งหมดในระบบ</p>
          </div>
        </div>
        <button class="btn-add" @click="showModal = true">
          <i class="fa-solid fa-circle-plus"></i>
          <span>เพิ่มอุปกรณ์</span>
        </button>
      </div>
    </div>

    <div class="container">
      <!-- Equipment Table -->
      <div v-if="editableEquipments.length" class="table-wrapper">
        <table class="equipment-table">
          <thead>
            <tr>
              <th>
                <i class="fa-solid fa-image"></i>
                รูปภาพ
              </th>
              <th>
                <i class="fa-solid fa-tag"></i>
                ชื่ออุปกรณ์
              </th>
              <th>
                <i class="fa-solid fa-boxes"></i>
                จำนวนทั้งหมด
              </th>
              <th>
                <i class="fa-solid fa-check-circle"></i>
                พร้อมใช้งาน
              </th>
              <th>
                <i class="fa-solid fa-cog"></i>
                การดำเนินการ
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(eq, index) in editableEquipments" :key="eq.id">
              <!-- Image -->
              <td class="image-cell">
                <div
                  v-if="eq.isEditing && eq.newImagePreview"
                  class="image-preview"
                >
                  <img :src="eq.newImagePreview" alt="New preview" />
                  <span class="new-badge">ใหม่</span>
                </div>
                <img
                  v-else-if="eq.image_url"
                  :src="eq.image_url"
                  class="equipment-image"
                  alt="Equipment"
                />
                <div v-else class="no-image">
                  <i class="fa-solid fa-image"></i>
                  <span>ไม่มีรูป</span>
                </div>
                <input
                  v-if="eq.isEditing"
                  type="file"
                  accept="image/*"
                  @change="handleImageUpload($event, index)"
                  class="file-input"
                />
              </td>

              <!-- Name -->
              <td class="name-cell">
                <span v-if="!eq.isEditing" class="name-text">{{
                  eq.name
                }}</span>
                <input
                  v-else
                  v-model="eq.name"
                  type="text"
                  placeholder="ชื่ออุปกรณ์"
                  class="edit-input"
                />
              </td>

              <!-- Total Quantity -->
              <td class="quantity-cell">
                <span v-if="!eq.isEditing" class="quantity-badge">
                  {{ eq.quantity }}
                </span>
                <input
                  v-else
                  v-model="eq.quantity"
                  type="number"
                  min="0"
                  placeholder="จำนวน"
                  class="edit-input"
                />
              </td>

              <!-- Available -->
              <td class="available-cell">
                <div class="available-badge">
                  <i class="fa-solid fa-check-circle"></i>
                  <span>{{ eq.available }}</span>
                </div>
              </td>

              <!-- Actions -->
              <td class="action-cell">
                <div class="action-buttons">
                  <button
                    v-if="!eq.isEditing"
                    class="btn-edit"
                    @click="startEdit(index)"
                  >
                    <i class="fa-solid fa-pen"></i>
                    แก้ไข
                  </button>
                  <button
                    v-if="eq.isEditing"
                    class="btn-save"
                    @click="saveEdit(index)"
                  >
                    <i class="fa-solid fa-check"></i>
                    บันทึก
                  </button>
                  <button class="btn-delete" @click="deleteEquipment(eq)">
                    <i class="fa-solid fa-trash"></i>
                    ลบ
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h2>ยังไม่มีอุปกรณ์</h2>
        <p>เริ่มต้นเพิ่มอุปกรณ์แรกของคุณ</p>
        <button class="btn-add-empty" @click="showModal = true">
          <i class="fa-solid fa-circle-plus"></i>
          เพิ่มอุปกรณ์
        </button>
      </div>
    </div>
  </div>

  <!-- Modal เพิ่มอุปกรณ์ -->
  <teleport to="body">
    <div v-if="showModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-icon">
            <i class="fa-solid fa-box"></i>
          </div>
          <div>
            <h3>เพิ่มอุปกรณ์ใหม่</h3>
            <p class="modal-subtitle">กรอกข้อมูลอุปกรณ์</p>
          </div>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>
              <i class="fa-solid fa-tag"></i>
              ชื่ออุปกรณ์
            </label>
            <input
              v-model="newEquipment.name"
              type="text"
              placeholder="กรอกชื่ออุปกรณ์"
            />
          </div>

          <div class="form-group">
            <label>
              <i class="fa-solid fa-boxes"></i>
              จำนวนทั้งหมด
            </label>
            <input
              v-model="newEquipment.quantity"
              type="number"
              min="1"
              placeholder="กรอกจำนวน"
            />
          </div>

          <div class="form-group">
            <label>
              <i class="fa-solid fa-image"></i>
              รูปภาพ
            </label>
            <div class="image-upload-area">
              <input
                type="file"
                accept="image/*"
                @change="handleNewImageUpload"
                class="file-input-modal"
                id="newImageInput"
              />
              <label for="newImageInput" class="upload-label">
                <i class="fa-solid fa-cloud-upload-alt"></i>
                <span>คลิกเพื่ออัปโหลดรูปภาพ</span>
              </label>
              <div v-if="newEquipment.imagePreview" class="preview-container">
                <img :src="newEquipment.imagePreview" alt="Preview" />
                <button @click="removeNewImage" class="btn-remove-image">
                  <i class="fa-solid fa-times"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="createEquipment" class="btn-confirm">
            <i class="fa-solid fa-check"></i>
            บันทึก
          </button>
          <button @click="closeModals" class="btn-cancel">
            <i class="fa-solid fa-times"></i>
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
  max-width: 1200px;
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

.btn-add {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Table Wrapper */
.table-wrapper {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

.equipment-table {
  width: 100%;
  border-collapse: collapse;
}

.equipment-table thead {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
}

.equipment-table th {
  padding: 18px 16px;
  text-align: left;
  color: white;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.equipment-table th i {
  margin-right: 8px;
  color: #fbbf24;
}

.equipment-table tbody tr {
  border-bottom: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

.equipment-table tbody tr:hover {
  background: #f8f9fa;
}

.equipment-table tbody tr:last-child {
  border-bottom: none;
}

.equipment-table td {
  padding: 16px;
  vertical-align: middle;
}

/* Image Cell */
.image-cell {
  width: 120px;
}

.equipment-image {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
}

.image-preview {
  position: relative;
  width: 80px;
  height: 60px;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #fbbf24;
}

.new-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 60px;
  background: #f3f4f6;
  border-radius: 8px;
  border: 2px dashed #d1d5db;
  color: #9ca3af;
  font-size: 12px;
}

.no-image i {
  font-size: 20px;
  margin-bottom: 4px;
}

.file-input {
  margin-top: 8px;
  font-size: 12px;
}

/* Name Cell */
.name-cell {
  min-width: 200px;
}

.name-text {
  font-weight: 600;
  color: #2d2d2d;
  font-size: 16px;
}

.edit-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s ease;
}

.edit-input:focus {
  outline: none;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

/* Quantity Cell */
.quantity-cell {
  width: 150px;
}

.quantity-badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 20px;
  font-weight: 600;
  font-size: 15px;
}

/* Available Cell */
.available-cell {
  width: 150px;
}

.available-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border-radius: 20px;
  font-weight: 600;
  font-size: 15px;
  border: 1px solid #6ee7b7;
}

/* Action Cell */
.action-cell {
  width: 200px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-edit,
.btn-save,
.btn-delete {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s ease;
}

.btn-edit {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.btn-edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
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
  margin: 0 0 32px 0;
  font-size: 16px;
  color: #6b7280;
}

.btn-add-empty {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
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
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90vw;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
  overflow: hidden;
}

.modal-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 3px solid #fbbf24;
}

.modal-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 24px;
  color: white;
  font-weight: 700;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.modal-body {
  padding: 32px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2d2d2d;
  font-size: 14px;
}

.form-group label i {
  color: #fbbf24;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.image-upload-area {
  position: relative;
}

.file-input-modal {
  display: none;
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-label:hover {
  border-color: #fbbf24;
  background: #fffbeb;
}

.upload-label i {
  font-size: 32px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.upload-label span {
  color: #6b7280;
  font-size: 14px;
}

.preview-container {
  position: relative;
  margin-top: 16px;
  display: inline-block;
}

.preview-container img {
  width: 150px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #fbbf24;
}

.btn-remove-image {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.4);
  transition: all 0.3s ease;
}

.btn-remove-image:hover {
  transform: scale(1.1);
}

.modal-footer {
  padding: 20px 32px;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #e0e0e0;
}

.btn-confirm,
.btn-cancel {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
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

.btn-cancel {
  background: #6c757d;
  color: white;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-cancel:hover {
  background: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
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

  .btn-add {
    width: 100%;
    justify-content: center;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .equipment-table {
    min-width: 800px;
  }

  .modal-header {
    padding: 20px 24px;
  }

  .modal-body {
    padding: 24px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn-confirm,
  .btn-cancel {
    width: 100%;
    justify-content: center;
  }
}
</style>
