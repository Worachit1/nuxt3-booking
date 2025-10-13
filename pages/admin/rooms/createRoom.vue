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

  <div class="page-container">
    <!-- Hero Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <button @click="$router.back()" class="btn-back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="header-icon">
            <i class="fa-solid fa-door-open"></i>
          </div>
          <div class="header-text">
            <h1>เพิ่มห้องใหม่</h1>
            <p class="subtitle">กรอกข้อมูลห้องประชุมใหม่</p>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="form-card">
        <div class="form-layout">
          <!-- Image Section -->
          <div class="image-section">
            <div class="image-upload-area">
              <div class="image-preview-wrapper">
                <img
                  :src="Room.image_url || '/images/default-picture.png'"
                  alt="Room Image"
                  class="image-preview"
                />
              </div>
              <input
                id="fileInput"
                type="file"
                @change="handleImageUpload"
                accept="image/*"
                class="file-input"
              />
              <label for="fileInput" class="upload-btn">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>อัพโหลดรูปภาพ</span>
              </label>
              <p class="upload-hint">รองรับไฟล์: JPG, PNG (สูงสุด 5MB)</p>
            </div>
          </div>

          <!-- Form Section -->
          <div class="form-section">
            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-door-open"></i>
                  ชื่อห้อง
                </label>
                <input
                  type="text"
                  v-model="Room.name"
                  placeholder="กรอกชื่อห้อง"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-tag"></i>
                  ประเภทห้อง
                </label>
                <select v-model="Room.room_type_id" class="form-select">
                  <option disabled value="">-- เลือกประเภทห้อง --</option>
                  <option v-for="rt in roomTypes" :key="rt.id" :value="rt.id">
                    {{ rt.name || rt.type || rt.id }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-building"></i>
                  อาคาร
                </label>
                <select v-model="Room.building_id" class="form-select">
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
                <label>
                  <i class="fa-solid fa-users"></i>
                  จำนวนที่นั่ง
                </label>
                <input
                  type="number"
                  v-model="Room.capacity"
                  min="1"
                  class="form-input"
                  placeholder="จำนวนคน"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-clock"></i>
                  เวลาเปิดห้อง
                </label>
                <input
                  type="time"
                  v-model="Room.start_time_str"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-clock"></i>
                  เวลาปิดห้อง
                </label>
                <input
                  type="time"
                  v-model="Room.end_time_str"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-group full-width">
              <label>
                <i class="fa-solid fa-align-left"></i>
                รายละเอียด
              </label>
              <textarea
                v-model="Room.description"
                placeholder="กรอกรายละเอียดห้องประชุม"
                class="form-textarea"
                rows="4"
              ></textarea>
            </div>

            <div class="form-actions">
              <button @click="$router.back()" class="btn-cancel">
                <i class="fa-solid fa-xmark"></i>
                <span>ยกเลิก</span>
              </button>
              <button @click="handleCreate" class="btn-submit">
                <i class="fa-solid fa-check"></i>
                <span>สร้างห้อง</span>
              </button>
            </div>
          </div>
        </div>
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

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1200px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.btn-back {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
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
}

.subtitle {
  color: #cbd5e0;
  font-size: 14px;
  margin: 8px 0 0 0;
}

/* Container */
.container {
  margin: 0 auto;
  max-width: 1200px;
}

/* Form Card */
.form-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

.form-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 40px;
}

/* Image Section */
.image-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.image-preview-wrapper {
  width: 100%;
  height: 400px;
  border-radius: 16px;
  overflow: hidden;
  border: 3px dashed #e0e0e0;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-input {
  display: none;
}

.upload-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 14px 32px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

.upload-hint {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  margin: 0;
}

/* Form Section */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #2d2d2d;
}

.form-group label i {
  color: #fbbf24;
  font-size: 16px;
}

.form-input,
.form-select,
.form-textarea {
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s ease;
  background: #f8f9fa;
  font-family: inherit;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #fbbf24;
  background: white;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 24px;
  border-top: 2px solid #f3f4f6;
}

.btn-cancel,
.btn-submit {
  flex: 1;
  padding: 14px 28px;
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
}

.btn-submit {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

/* SweetAlert Customization */
.my-popup {
  font-size: 17px;
  border-radius: 16px !important;
  padding: 1.5em 2em !important;
}

.btn-ok {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
  color: white !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  padding: 12px 28px !important;
  border: none !important;
}

/* Responsive */
@media (max-width: 1024px) {
  .form-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .image-preview-wrapper {
    height: 300px;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 100px 12px 40px 12px;
  }

  .page-header {
    padding: 24px 20px;
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

  .form-card {
    padding: 24px 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .image-preview-wrapper {
    height: 250px;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-cancel,
  .btn-submit {
    width: 100%;
  }
}
</style>
