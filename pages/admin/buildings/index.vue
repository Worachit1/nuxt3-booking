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

  <div class="container">
    <div class="header">
      <h1>รายการอาคาร</h1>
      <button class="createbuilding" @click="showModal = true">
        <i class="fa-solid fa-circle-plus"></i> เพิ่มอาคาร
      </button>
    </div>

    <table v-if="editableBuildings.length" class="building-table">
      <thead>
        <tr>
          <th>รูปภาพ</th>
          <th>ชื่ออาคาร</th>
          <th>การดำเนินการ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(b, index) in editableBuildings" :key="b.id">
          <td>
            <!-- Preview รูปใหม่ถ้าเลือกไฟล์ใหม่ -->
            <img
              v-if="b.newImagePreview"
              :src="b.newImagePreview"
              style="
                width: 80px;
                height: 60px;
                object-fit: cover;
                border-radius: 6px;
              "
            />
            <!-- ถ้ายังไม่เลือกไฟล์ใหม่ ให้ใช้รูปเดิม -->
            <img
              v-else-if="b.image_url"
              :src="b.image_url"
              style="
                width: 80px;
                height: 60px;
                object-fit: cover;
                border-radius: 6px;
              "
            />
            <span v-else style="color: #aaa">ไม่มีรูป</span>
            <div v-if="b.isEditing" style="margin-top: 5px">
              <input
                type="file"
                accept="image/*"
                @change="(e) => handleImageUpload(e, index)"
              />
            </div>
          </td>

          <td>
            <input type="text" v-model="b.name" :disabled="!b.isEditing" />
          </td>

          <td>
            <div class="action-buttons">
              <button
                v-if="!b.isEditing"
                class="edit"
                @click="startEdit(index)"
              >
                แก้ไข
              </button>
              <button v-else class="confirm" @click="saveEdit(index)">
                บันทึก
              </button>
              <button class="delete" @click="deleteBuilding(b)">ลบ</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else>
      <p>ยังไม่มีอาคาร</p>
    </div>
  </div>

  <teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <h3>เพิ่มอาคารใหม่</h3>
        <input v-model="newBuildingName" type="text" placeholder="ชื่ออาคาร" />
        <input
          type="file"
          accept="image/*"
          @change="handleNewImageUpload"
          style="margin-top: 10px"
        />
        <div v-if="newImagePreview" style="margin-bottom: 10px">
          <img
            :src="newImagePreview"
            style="
              width: 80px;
              height: 60px;
              object-fit: cover;
              border-radius: 6px;
            "
          />
        </div>
        <div class="modal-actions">
          <button @click="createBuilding" class="modal-confirm">บันทึก</button>
          <button @click="closeModals" class="modal-cancel">ยกเลิก</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.container {
  padding: 40px 30px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin: 30px auto;
  max-width: 1200px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e0e0e0;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

@media (min-width: 640px) {
  .header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

h1 {
  margin: 0;
  font-size: 6vw;
  color: #2d2d2d;
  font-weight: 700;
}

@media (min-width: 640px) {
  h1 {
    font-size: 32px;
  }
}

.createbuilding {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f0f0f0;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.createbuilding:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.building-table {
  width: 100%;
  border-collapse: collapse;
  word-break: break-word;
}

.building-table th {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  padding: 14px 12px;
  text-align: left;
  vertical-align: middle;
  font-weight: 600;
}

.building-table td {
  padding: 14px 12px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid #e0e0e0;
}

.building-table tr:hover {
  background: #f8f9fa;
}

.building-table input[type="text"] {
  width: 80%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s;
}

.building-table input[type="text"]:focus {
  outline: none;
  border-color: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

.building-table input[type="text"]:disabled {
  background-color: #f5f5f5;
  border-color: #e0e0e0;
  color: #666;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.edit,
.confirm,
.delete {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.edit {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.confirm {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.delete {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
  background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal {
  background: #ffffff;
  padding: 30px 40px;
  border-radius: 12px;
  width: 90vw;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid #e0e0e0;
  box-sizing: border-box;
}

.modal h3 {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  color: #2d2d2d;
}

.modal input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 20px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.modal input:focus {
  border-color: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.modal-confirm,
.modal-cancel {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.modal-confirm {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.modal-confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.modal-cancel {
  background-color: #6c757d;
  color: white;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.modal-cancel:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}
</style>
