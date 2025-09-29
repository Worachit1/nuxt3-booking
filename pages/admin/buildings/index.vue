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
            <img v-if="b.newImagePreview"
              :src="b.newImagePreview"
              style="width:80px;height:60px;object-fit:cover;border-radius:6px;" />
            <!-- ถ้ายังไม่เลือกไฟล์ใหม่ ให้ใช้รูปเดิม -->
            <img v-else-if="b.image_url"
              :src="b.image_url"
              style="width:80px;height:60px;object-fit:cover;border-radius:6px;" />
            <span v-else style="color:#aaa;">ไม่มีรูป</span>
            <div v-if="b.isEditing" style="margin-top:5px">
              <input type="file" accept="image/*" @change="e => handleImageUpload(e, index)" />
            </div>
          </td>

          <td>
            <input type="text" v-model="b.name" :disabled="!b.isEditing" />
          </td>

          <td>
            <div class="action-buttons">
              <button v-if="!b.isEditing" class="edit" @click="startEdit(index)">
                แก้ไข
              </button>
              <button v-else class="confirm" @click="saveEdit(index)">
                บันทึก
              </button>
              <button class="delete" @click="deleteBuilding(b)">
                ลบ
              </button>
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
        <input type="file" accept="image/*" @change="handleNewImageUpload" style="margin-top:10px" />
        <div v-if="newImagePreview" style="margin-bottom:10px;">
          <img :src="newImagePreview" style="width:80px;height:60px;object-fit:cover;border-radius:6px;" />
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
  padding: 5vw 4vw;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 5vw auto;
  max-width: 1000px;
  width: 100%;
  box-sizing: border-box;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
  margin-bottom: 20px;
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
  color: #333;
  text-decoration: underline;
}

@media (min-width: 640px) {
  h1 {
    font-size: 28px;
  }
}

.createbuilding {
  background-color: #13131f;
  color: white;
  border: 1px solid #13131f;
  padding: 10px 20px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.createbuilding:hover {
  background-color: #4a4a4a;
}

.building-table {
  width: 100%;
  border-collapse: collapse;
  word-break: break-word;
}

.building-table th,
.building-table td {
  padding: 12px 8px;
  text-align: left;
  vertical-align: middle;
}

.building-table input[type="text"] {
  width: 80%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
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
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 6px;
}

.edit {
  background-color: #00b7ff;
  color: white;
}

.edit:hover {
  background-color: #0088cc;
}

.confirm {
  background-color: #ffb700;
  color: white;
}

.confirm:hover {
  background-color: #cc9a00;
}

.delete {
  background-color: #f13c3c;
  color: white;
}

.delete:hover {
  background-color: #cc0000;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  backdrop-filter: blur(3px);
}

.modal {
  background: #ffffff;
  padding: 30px 40px;
  border-radius: 12px;
  width: 90vw;
  max-width: 400px;
  box-shadow: 0 12px 25px rgba(0, 0, 0, 0.2);
  animation: scaleFadeIn 0.3s ease forwards;
  transform-origin: center;
  box-sizing: border-box;
}

.modal h3 {
  margin-bottom: 20px;
  font-size: 22px;
  font-weight: bold;
  text-align: center;
  color: #333;
}

.modal input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 16px;
  margin-bottom: 20px;
  outline: none;
  transition: border-color 0.2s;
}

.modal input:focus {
  border-color: #00b7ff;
  box-shadow: 0 0 3px rgba(0, 183, 255, 0.4);
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.modal-confirm,
.modal-cancel {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: none;
}

.modal-confirm {
  background-color: #00c853;
  color: white;
}

.modal-confirm:hover {
  background-color: #009c3b;
}

.modal-cancel {
  background-color: #4e555b;
  color: white;
}

.modal-cancel:hover {
  background-color: #7d878f;
}

@keyframes scaleFadeIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
