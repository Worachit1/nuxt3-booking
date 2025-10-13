<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useRoute, useRouter } from "vue-router";
import LoadingPage from "~/components/Loading.vue";

import { useRoomStore } from "~/store/roomStore";

definePageMeta({
  middleware: ["load-user"],
});

const route = useRoute();
const router = useRouter();
const roomId = route.params.id;
const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);

const room = ref(null);
const editableRoom = ref({
  name: "",
  description: "",
  capacity: 0,
  imageFile: null,
  // new fields for operations
  start_time_str: "", // HH:MM
  end_time_str: "", // HH:MM
  is_available: true,
  maintenance_note: "",
  maintenance_eta: "",
});

const previewImage = ref(null);
const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    editableRoom.value.imageFile = file;
    previewImage.value = URL.createObjectURL(file);
  }
};

const handleUpdate = async () => {
  if (!editableRoom.value.name?.trim()) {
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

  if (!editableRoom.value.capacity) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณากรอกจำนวนที่นั่ง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }
  const confirmResult = await Swal.fire({
    title: `คุณต้องการอัปเดตข้อมูลห้อง <br>"${editableRoom.value.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "อัปเดต",
    cancelButtonText: "ยกเลิก",
    reverseButtons: true,
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-confirm-update",
      cancelButton: "btn-cancel",
    },
  });
  if (!confirmResult.isConfirmed) return;

  const formData = new FormData();
  formData.append("name", editableRoom.value.name || "");
  formData.append("description", editableRoom.value.description || "");
  formData.append("capacity", (editableRoom.value.capacity ?? 0).toString());

  // convert HH:MM to seconds-of-day
  const toSecondsOfDay = (hhmm) => {
    if (!hhmm || typeof hhmm !== "string") return undefined;
    const [h, m] = hhmm.split(":").map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
    return h * 3600 + m * 60;
  };

  const startSecs = toSecondsOfDay(editableRoom.value.start_time_str);
  const endSecs = toSecondsOfDay(editableRoom.value.end_time_str);
  if (typeof startSecs === "number")
    formData.append("start_room", String(startSecs));
  if (typeof endSecs === "number") formData.append("end_room", String(endSecs));

  // availability and maintenance
  formData.append("is_available", String(!!editableRoom.value.is_available));
  formData.append(
    "maintenance_note",
    editableRoom.value.maintenance_note || "-"
  );
  formData.append("maintenance_eta", editableRoom.value.maintenance_eta || "-");

  if (editableRoom.value.imageFile) {
    formData.append("image_url", editableRoom.value.imageFile);
  }

  const updateResult = await roomStore.updateRoom(roomId, formData);

  if (updateResult) {
    await Swal.fire({
      icon: "success",
      title: "อัปเดตข้อมูลห้องเสร็จสิ้นแล้ว",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    router.back();
  } else {
    await Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลห้อง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
  }
};

onMounted(async () => {
  room.value = await roomStore.getById(roomId);
  editableRoom.value = {
    name: room.value?.name || "",
    description: room.value?.description || "",
    capacity: room.value?.capacity || 0,
    imageFile: null,
    // prefill new fields
    start_time_str: (() => {
      const s = room.value?.start_room;
      if (s === null || s === undefined) return "";
      const n = Number(s);
      if (!Number.isFinite(n)) return "";
      const h = Math.floor(n / 3600) % 24;
      const m = Math.floor((n % 3600) / 60);
      const pad = (v) => (v < 10 ? `0${v}` : String(v));
      return `${pad(h)}:${pad(m)}`;
    })(),
    end_time_str: (() => {
      const e = room.value?.end_room;
      if (e === null || e === undefined) return "";
      const n = Number(e);
      if (!Number.isFinite(n)) return "";
      const h = Math.floor(n / 3600) % 24;
      const m = Math.floor((n % 3600) / 60);
      const pad = (v) => (v < 10 ? `0${v}` : String(v));
      return `${pad(h)}:${pad(m)}`;
    })(),
    is_available: (() => {
      const v = room.value?.is_available;
      if (v === true) return true;
      if (v === false) return false;
      if (v === 1 || v === "1") return true;
      if (v === 0 || v === "0") return false;
      if (typeof v === "string") return v.toLowerCase() === "true";
      return !!v;
    })(),
    maintenance_note: room.value?.maintenance_note || "",
    maintenance_eta: room.value?.maintenance_eta || "",
  };
  previewImage.value = room.value?.image_url || null;
});
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
          <button @click="router.back()" class="btn-back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="header-icon">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <div class="header-text">
            <h1>แก้ไขข้อมูลห้อง</h1>
            <p class="subtitle">{{ editableRoom.name || "กำลังโหลด..." }}</p>
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
                  :src="previewImage || '/images/default-picture.png'"
                  alt="Room Image"
                  class="image-preview"
                />
              </div>
              <input
                id="imageUpload"
                type="file"
                @change="handleImageUpload"
                accept="image/*"
                class="file-input"
              />
              <label for="imageUpload" class="upload-btn">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>เปลี่ยนรูปภาพ</span>
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
                  v-model="editableRoom.name"
                  placeholder="กรอกชื่อห้อง"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-users"></i>
                  จำนวนที่นั่ง
                </label>
                <input
                  type="number"
                  v-model="editableRoom.capacity"
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
                  v-model="editableRoom.start_time_str"
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
                  v-model="editableRoom.end_time_str"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-circle-check"></i>
                  สถานะห้อง
                </label>
                <select v-model="editableRoom.is_available" class="form-select">
                  <option :value="true">พร้อมใช้งาน</option>
                  <option :value="false">ไม่พร้อมใช้งาน</option>
                </select>
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-hourglass-half"></i>
                  เวลาซ่อมบำรุง
                </label>
                <input
                  type="text"
                  placeholder="เช่น 2 ชม. 30 นาที"
                  v-model="editableRoom.maintenance_eta"
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
                v-model="editableRoom.description"
                placeholder="กรอกรายละเอียดห้องประชุม"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group full-width">
              <label>
                <i class="fa-solid fa-wrench"></i>
                บันทึกการซ่อมบำรุง
              </label>
              <textarea
                v-model="editableRoom.maintenance_note"
                placeholder="หมายเหตุการซ่อมบำรุง"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-actions">
              <button @click="router.back()" class="btn-cancel">
                <i class="fa-solid fa-xmark"></i>
                <span>ยกเลิก</span>
              </button>
              <button @click="handleUpdate" class="btn-submit">
                <i class="fa-solid fa-check"></i>
                <span>บันทึกการเปลี่ยนแปลง</span>
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
  min-height: 80px;
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
