<script setup>
import { ref, onMounted, computed } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";

import { useRoomStore } from "@/store/roomStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useBuilding_RoomStore } from "~/store/building_roomStore";
import { useRoom_Types } from "@/store/room_typeStore";
definePageMeta({
  middleware: ["load-user"],
});

// Removed unused import for useRoute

const roomStore = useRoomStore();
const buildingStore = useBuildingStore();
const building_roomStore = useBuilding_RoomStore();
const roomTypeStore = useRoom_Types();

// Combine loading flags if stores expose them (JS-friendly, no TS casts)
const isLoading = computed(
  () =>
    !!(roomStore && roomStore.isLoading) ||
    !!(buildingStore && buildingStore.isLoading) ||
    !!(building_roomStore && building_roomStore.isLoading) ||
    !!(roomTypeStore && roomTypeStore.isLoading)
);

const Room = ref({
  name: "",
  description: "",
  capacity: 1,
  image_url: "", // ใช้สำหรับ preview รูป
  imageFile: null, // ไฟล์จริง ใช้ส่งไป backend
  building_id: null,
  room_type_id: null,
  start_time_str: "", // รับรูปแบบเวลา เช่น "08:00"
  end_time_str: "", // รับรูปแบบเวลา เช่น "18:00"
});

const buildings = ref([]);
const roomTypes = ref([]);

onMounted(async () => {
  await buildingStore.fetchBuildings();
  buildings.value = buildingStore.buildings;
  await roomTypeStore.fetchRoomTypes();
  roomTypes.value = roomTypeStore.roomTypes;
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

  if (!Room.value.room_type_id) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกประเภทห้อง",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
    return;
  }

  if (!Room.value.start_time_str || !Room.value.end_time_str) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกเวลาเปิด-ปิดห้อง",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
    return;
  }

  const toSecondsOfDay = (hhmm) => {
    if (typeof hhmm !== "string" || !hhmm.includes(":")) return null;
    const [hStr, mStr] = hhmm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (
      Number.isNaN(h) ||
      Number.isNaN(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    )
      return null;
    return h * 3600 + m * 60; // วินาทีตั้งแต่ 00:00
  };

  const startSec = toSecondsOfDay(Room.value.start_time_str);
  const endSec = toSecondsOfDay(Room.value.end_time_str);

  if (startSec == null || endSec == null) {
    await Swal.fire({
      icon: "warning",
      title: "รูปแบบเวลาไม่ถูกต้อง",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
    return;
  }

  if (endSec < startSec) {
    await Swal.fire({
      icon: "warning",
      title: "เวลาเปิดต้องน้อยกว่าหรือเท่ากับเวลาปิด",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
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
    room_type_id: Room.value.room_type_id,
    // เก็บเป็นวินาทีตั้งแต่ 00:00 ของวัน (ไม่เก็บวันเดือนปี)
    start_room: startSec,
    end_room: endSec,
  });

  const createdId =
    createdRoom?.data?.id ||
    createdRoom?.data?.ID ||
    createdRoom?.id ||
    createdRoom?.ID;
  if (createdId) {
    const linkRes = await building_roomStore.addBuilding_Room({
      room_id: createdId,
      building_id: Room.value.building_id,
    });
    if (!linkRes) {
      await Swal.fire({
        icon: "warning",
        title: "ผูกห้องกับอาคารไม่สำเร็จ",
        text: "สร้างห้องสำเร็จแล้ว แต่การเชื่อม building_room ล้มเหลว",
        confirmButtonText: "ตกลง",
        customClass: { popup: "my-popup", confirmButton: "btn-ok" },
      });
      // ไม่ return เพื่อยังคงไปหน้ารายการห้องได้
    }

    await Swal.fire({
      icon: "success",
      title: "สร้างห้องสำเร็จ!",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });

    window.location.href = "/admin/rooms";
    // router.push("/admin/rooms");
  } else {
    await Swal.fire({
      icon: "error",
      title: "สร้างห้องไม่สำเร็จ",
      text:
        createdRoom && createdRoom.status?.message
          ? String(createdRoom.status.message)
          : "ไม่พบรหัสห้องจากผลลัพธ์ API",
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
    room_type_id: null,
    start_time_str: "",
    end_time_str: "",
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
          <label>ประเภทห้อง:</label>
          <select v-model="Room.room_type_id">
            <option disabled value="">-- เลือกประเภทห้อง --</option>
            <option v-for="rt in roomTypes" :key="rt.id" :value="rt.id">
              {{ rt.name || rt.type || rt.id }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>อาคาร:</label>
          <select v-model="Room.building_id">
            <option disabled value="">-- เลือกอาคาร --</option>
            <option
              v-for="building in buildings"
              :key="building.id"
              :value="building.id"
            >
              {{ building.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>เวลาเปิดห้อง (เช่น 08:00):</label>
          <input type="time" v-model="Room.start_time_str" />
        </div>
        <div class="form-group">
          <label>เวลาปิดห้อง (เช่น 18:00):</label>
          <input type="time" v-model="Room.end_time_str" />
        </div>
        <div class="form-group">
          <label>จำนวนคนที่เข้าประชุมได้:</label>
          <input type="number" v-model="Room.capacity" min="1" />
        </div>
        <div class="form-group">
          <label>รายละเอียดห้องประชุม:</label>
          <input
            type="text"
            v-model="Room.description"
            placeholder="คำอธิบาย"
          />
        </div>
        <button @click="handleCreate" class="create-room">สร้างห้อง</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  margin: 30px auto;
  padding: 40px 30px;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.back-button {
  align-self: flex-start;
  margin-bottom: 30px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border: none;
  color: #f5f5f5;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.form-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 40px;
  padding: 0;
  width: 100%;
  justify-content: flex-start;
  align-items: flex-start;
}

.image-section {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f8f9fa;
  padding: 30px;
  border-radius: 12px;
  border: 2px dashed #e0e0e0;
}

.image-preview {
  width: 100%;
  max-width: 350px;
  height: 350px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  object-fit: cover;
  border: 1px solid #e0e0e0;
}

.input-image {
  margin-top: 20px;
}

.file-hidden {
  display: none;
}

.upload-button {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.upload-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.form-section {
  flex: 1;
  min-width: 400px;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 8px;
  color: #2d2d2d;
  font-size: 15px;
}

input,
select {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  background: #ffffff;
}

input:focus,
select:focus {
  border-color: #2d2d2d;
  outline: none;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.create-room {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  padding: 14px 32px;
  font-size: 16px;
  margin-top: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  width: 100%;
}

.create-room:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
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
@media (max-width: 1024px) {
  .form-wrapper {
    flex-direction: column;
    gap: 30px;
  }

  .image-section {
    flex: 1;
    width: 100%;
  }

  .form-section {
    width: 100%;
    min-width: 100%;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 30px 20px;
    margin: 20px;
  }

  .image-section {
    padding: 20px;
  }

  .image-preview {
    max-width: 100%;
    height: 250px;
  }

  input,
  select {
    font-size: 14px;
  }
}
</style>
