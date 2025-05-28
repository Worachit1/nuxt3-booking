<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";

import { useRoomStore } from "@/store/roomStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useBuilding_RoomStore } from "~/store/building_roomStore";
definePageMeta({
  middleware: ["load-user"],
});

// Removed unused import for useRoute

const roomStore = useRoomStore();
const buildingStore = useBuildingStore();
const building_roomStore = useBuilding_RoomStore();
const { isLoading } = storeToRefs(roomStore, buildingStore, building_roomStore);

const Room = ref({
  name: "",
  description: "",
  capacity: 1,
  image_url: "", // ใช้สำหรับ preview รูป
  imageFile: null, // ไฟล์จริง ใช้ส่งไป backend
  building_id: null,
});

const buildings = ref([]);

onMounted(async () => {
  await buildingStore.fetchBuildings();
  buildings.value = buildingStore.buildings;
});

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    Room.value.imageFile = file;
    Room.value.image_url = URL.createObjectURL(file); // Preview รูป
  }
};

const handleCreate = async () => {
  if (!Room.value.name.trim()) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณากรอกชื่อห้อง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  if (!Room.value.building_id) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกอาคาร",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  if (!Room.value.imageFile) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกไฟล์รูปภาพ",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  const createdRoom = await roomStore.addRoom({
    name: Room.value.name,
    description: Room.value.description,
    capacity: Room.value.capacity,
    image_url: Room.value.imageFile,
  });

  if (createdRoom && createdRoom.data && createdRoom.data.ID) {
    await building_roomStore.addBuilding_Room({
      roomId: createdRoom.data.ID,
      buildingId: Room.value.building_id,
    });

    await Swal.fire({
      icon: "success",
      title: "สร้างห้องสำเร็จ!",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });

    // window.location.href = "/admin/rooms";
    router.push("/admin/rooms");
  } else {
    await Swal.fire({
      icon: "error",
      title: "สร้างห้องไม่สำเร็จ",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
  }

  // Reset
  Room.value = {
    name: "",
    description: "",
    capacity: 1,
    image_url: "",
    imageFile: null,
    building_id: null,
  };
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="container">
    <button @click="$router.back()" class="back-button">
      <i class="fas fa-arrow-left"></i> กลับ
    </button>

    <div class="form-wrapper">
      <div class="image-section">
        <img
          :src="Room.image_url || '/images/default-picture.png'"
          alt="Room Image"
          class="image-preview"
        />
        <div class="input-image">
          <input
            id="fileInput"
            type="file"
            @change="handleImageUpload"
            accept="image/*"
            class="file-hidden"
          />
          <label for="fileInput" class="upload-button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="svg-icon"
              width="20"
              height="20"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            เพิ่มรูป
          </label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-group">
          <label>ชื่อห้อง:</label>
          <input type="text" v-model="Room.name" placeholder="ชื่อห้อง" />
        </div>
        <div class="form-group">
          <label>อาคาร:</label>
          <select v-model="Room.building_id">
            <option disabled value="">-- เลือกอาคาร --</option>
            <option v-for="building in buildings" :key="building.id" :value="building.id">
              {{ building.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>จำนวนคนที่เข้าประชุมได้:</label>
          <input type="number" v-model="Room.capacity" min="1" />
        </div>
        <div class="form-group">
          <label>รายละเอียดห้องประชุม:</label>
          <input type="text" v-model="Room.description" placeholder="คำอธิบาย" />
        </div>
        <button @click="handleCreate" class="create-room">สร้างห้อง</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  display: flex;
  justify-content: center;
  align-items: flex-start; /* ให้ปุ่ม back อยู่ด้านบน */
  background-color: #f4f4f4;
  font-family: sans-serif;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  padding: 30px 20px;
  box-sizing: border-box;
}

.back-button {
   align-self: flex-start;
  margin-bottom: 20px;
  background-color: transparent;
  border: none;
  color: #1f2937;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.back-button:hover {
  text-decoration: underline;
}

.form-wrapper {
   display: flex;
  flex-wrap: wrap;
  gap: 30px;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  background-color: #fff;
  width: 80%;
  justify-content: center;
  align-items: center;
}

.image-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-preview {
  width: 100%;
  max-width: 350px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  object-fit: cover;
}

.input-image {
  margin-top: 15px;
}

.file-hidden {
  display: none;
}

.upload-button {
  background-color: #3b82f6;
  color: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.upload-button:hover {
  background-color: #2563eb;
}

.form-section {
  flex: 1;
  min-width: 300px;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
  color: #374151;
}

input,
select {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  width: 80%;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}
input:focus,
select:focus {
  border-color: #3b82f6;
  outline: none;
}

.create-room {
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.3s ease;
  padding: 12px 24px;
  font-size: 15px;
}
.create-room:hover {
  background-color: #059669;
}

.my-popup {
  font-size: 17px;
  border-radius: 14px !important;
  padding: 1.3em 1.8em !important;
  animation-duration: 0.5s !important;
}

.btn-ok {
  background-color: #1f2937 !important;
  color: white !important;
  font-weight: bold;
  border-radius: 6px !important;
  padding: 10px 24px !important;
  border: none !important;
  transition: background-color 0.3s ease;
}

.btn-ok:hover {
  background-color: #4b5563 !important;
}

/* Responsive */
@media (max-width: 768px) {
  .form-wrapper {
    flex-direction: column;
    width: 90%;
    padding: 20px;
  }

  .form-section {
    width: 100%;
  }

  .image-section {
    width: 100%;
  }
}
</style>

