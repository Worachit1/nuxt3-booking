<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";


import { useBuildingStore } from "@/store/buildingStore";
import { useBuilding_RoomStore } from "~/store/building_roomStore";

definePageMeta({
  middleware: ["load-user"],
});

// Store
const buildingStore = useBuildingStore();
const { isLoading } = storeToRefs(buildingStore);
const buildingRoomStore = useBuilding_RoomStore();

// Local state for editing, modal and new building name
const editableBuildings = ref([]);
const showModal = ref(false);
const newBuildingName = ref("");

// โหลดข้อมูลอาคารมาแปลงใส่ editableBuildings เพื่อให้แก้ไขชื่อได้
const loadBuildings = async () => {
  await buildingStore.fetchBuildings();
  editableBuildings.value = buildingStore.buildings.map((b) => ({
    ...b,
    isEditing: false,
  }));
};

onMounted(loadBuildings);

const createBuilding = async () => {
  const name = newBuildingName.value.trim();
  if (!name) {
    Swal.fire("แจ้งเตือน", "กรุณากรอกชื่ออาคาร", "warning");
    return;
  }
  buildingStore.isLoading = true;
  await buildingStore.addBuilding({ name });
  newBuildingName.value = "";
  Swal.fire({
    title: "เพิ่มอาคารใหม่เรียบร้อย",
    icon: "success",
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-ok",
    },
  });
  showModal.value = false;
  await loadBuildings();
  buildingStore.isLoading = false;
};

const startEdit = (index) => {
  editableBuildings.value[index].isEditing = true;
};

const saveEdit = async (id, index) => {
  const updated = { name: editableBuildings.value[index].name };
  buildingStore.isLoading = true;
  await buildingStore.updateBuilding(id, updated);
  editableBuildings.value[index].isEditing = false;
  await loadBuildings();
  buildingStore.isLoading = false;
};

const deleteBuilding = async (building) => {
  await buildingRoomStore.fetchBuilding_Rooms();
  const buildingRooms = buildingRoomStore.building_rooms.filter(
    (br) => br.building_id === building.id
  );
  if (buildingRooms.length > 0) {
    Swal.fire({
      title: "ไม่สามารถลบได้",
      text: "เนื่องจากมีห้องอยู่ในอาคารนี้ กรุณาลบห้องก่อน",
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
    title: `คุณต้องการลบอาคาร <br>"${building.name}" ใช่ไหม?`,
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
  buildingStore.isLoading = true;
  await buildingStore.deleteBuilding(building.id);
  await loadBuildings();
  buildingStore.isLoading = false;
  await Swal.fire({
    title: "ลบแล้ว! อาคารถูกลบเรียบร้อย",
    icon: "success",
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-ok",
    },
  });
return;

};

const closeModals = () => {
  showModal.value = false;
  newBuildingName.value = "";
};
</script>

<template>
  <teleport to="body"> 
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div v-if="buildingStore.isLoading" class="loading-overlay">
    <div class="loader"></div>
  </div>
  <div class="container">
    <div class="header">
      <h1>รายการอาคาร</h1>
      <button class="createbuilding" @click="showModal = true">
        <i class="fa-solid fa-circle-plus"></i> เพิ่มอาคาร
      </button>
    </div>

    <div v-if="editableBuildings.length > 0">
      <table class="building-table">
        <thead>
          <tr>
            <th>ชื่ออาคาร</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, index) in editableBuildings" :key="b.id">
            <td>
              <input type="text" v-model="b.name" :disabled="!b.isEditing" />
            </td>
            <td>
              <div class="action-buttons">
                <button
                  class="edit"
                  v-if="!b.isEditing"
                  @click="startEdit(index)"
                >
                  <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                </button>
                <button class="confirm" v-else @click="saveEdit(b.id, index)">
                  <i class="fa-solid fa-check"></i> บันทึก
                </button>

                <button @click="deleteBuilding(b)" class="delete">
                  <i class="fa-solid fa-trash-can"></i> ลบ
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else>
      <p>ยังไม่ได้เพิ่มอาคาร</p>
    </div>
  </div>

  <teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <template v-if="showModal">
          <h3>เพิ่มอาคารใหม่</h3>
          <input
            v-model="newBuildingName"
            type="text"
            placeholder="ชื่ออาคาร"
          />
          <div class="modal-actions">
            <button @click="createBuilding" class="modal-confirm">
              บันทึก
            </button>
            <button @click="closeModals" class="modal-cancel">ยกเลิก</button>
          </div>
        </template>
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