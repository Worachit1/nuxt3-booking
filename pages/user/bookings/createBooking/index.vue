<script setup>
import { ref, onMounted } from "vue";

import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";

import { useBookingStore } from "@/store/bookingStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useUserStore } from "@/store/userStore";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import "dayjs/locale/th";

import { ElSelect, ElOption } from "element-plus";
import "element-plus/dist/index.css";

definePageMeta({
  middleware: ["load-user", "user-only"], // Corrected middleware name
});

const route = useRoute();
const userId = route.params.id || localStorage.getItem("user_id");

const bookingStore = useBookingStore();

const userStore = useUserStore();
const user = ref(null);

const { isLoading } = storeToRefs(bookingStore, userStore);
const buildingStore = useBuildingStore();
const Booking = ref({
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  phone: "",
  room_id: null,
  user_id: null,
  status: "Pending",
});

const filteredRooms = computed(() => {
  if (!Booking.value.building_id) return [];
  const building = buildingStore.buildings.find(
    (b) => b.id === Booking.value.building_id
  );
  return building?.rooms_name || [];
});

watch(
  () => Booking.value.building_id,
  (newVal) => {
    const building = buildingStore.buildings.find((b) => b.id === newVal);
    if (building && building.rooms_name && building.rooms_name.length > 0) {
      Booking.value.room_id = building.rooms_name[0].id;
    } else {
      Booking.value.room_id = null;
    }
  }
);
const showMoadal = ref(false);

onMounted(async () => {
  await buildingStore.fetchBuildings();

  if (userId) {
    await userStore.getUserById(userId);
  }

  user.value = userStore.currentUser || null;

  if (user.value) {
    Booking.value.user_id = user.value.id;
    Booking.value.phone = user.value.phone;
  }
});

const handleConfirm = async () => {
  if (new Date(Booking.value.start_time) >= new Date(Booking.value.end_time)) {
    await Swal.fire({
      icon: "warning",
      title: "❗ วันเวลาสิ้นสุดต้องมากกว่าวันเวลาเริ่ม",
      text: "กรุณาเลือกวันและเวลาใหม่",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  // ดักเพื่อไม่ให้ผู้ใช้จองเวลาในอดีต
  const now = new Date();
  const startTime = new Date(Booking.value.start_time);
  if (startTime < now) {
    await Swal.fire({
      icon: "warning",
      title: "❗ ไม่สามารถจองเวลาในอดีตได้",
      text: "กรุณาเลือกวันและเวลาใหม่",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  // ตรวจสอบเวลาทับซ้อนกับการจองที่มีสถานะเป็น "Approved"
  await bookingStore.fetchAllBookings(); // ดึงข้อมูลการจองทั้งหมด
  const isOverlapping = bookingStore.bookings.some((booking) => {
    if (
      booking.status === "Approved" ||
      (booking.status === "Pending" &&
        booking.room_id === Booking.value.room_id)
    ) {
      const existingStart = new Date(booking.start_time * 1000); // แปลงเวลาเป็น milliseconds
      const existingEnd = new Date(booking.end_time * 1000); // แปลงเวลาเป็น milliseconds
      // ตรวจสอบว่ามีการทับซ้อนกับการจองที่มีอยู่
      return (
        (startTime < existingEnd && startTime >= existingStart) ||
        (new Date(Booking.value.end_time) > existingStart &&
          new Date(Booking.value.end_time) <= existingEnd)
      );
    }
    return false;
  });

  // ดักการจองที่ทับซ้อน
  if (isOverlapping) {
    await Swal.fire({
      icon: "warning",
      title: "❗ มีการจองห้องประชุมในช่วงเวลานี้แล้ว",
      text: "กรุณาเลือกเวลาอื่น",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  showMoadal.value = true;
};

const handleCreateBooking = async () => {
  try {
    // ตรวจสอบข้อมูลก่อนส่ง
    if (!Booking.value.user_id || !Booking.value.phone) {
      await Swal.fire({
        icon: "warning",
        title: "ไม่พบข้อมูลผู้จองหรือเบอร์โทร",
        text: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
        confirmButtonText: "ตกลง",
        customClass: {
          popup: "my-popup",
          confirmButton: "btn-ok",
        },
      });
      return;
    }

    const payload = {
      title: Booking.value.title.trim(),
      description: Booking.value.description.trim(),
      start_time: Math.floor(
        new Date(Booking.value.start_time).getTime() / 1000
      ),
      end_time: Math.floor(new Date(Booking.value.end_time).getTime() / 1000),
      room_id: Booking.value.room_id,
      user_id: Booking.value.user_id,
      phone: Booking.value.phone,
      status: Booking.value.status,
    };

    // console.log("📦 Payload:", payload);

    const success = await bookingStore.addBooking(payload);

    if (success) {
      await Swal.fire({
        icon: "success",
        title: "✅ สร้างการจองสำเร็จ",
        confirmButtonText: "ตกลง",
        customClass: {
          popup: "my-popup",
          confirmButton: "btn-ok",
        },
      });
      // เคลียร์ข้อมูลในฟอร์ม
      Booking.value = {
        title: "",
        description: "",
        start_time: 0,
        end_time: 0,
        phone: "",
        room_id: null,
        user_id: null,
        approved_by: null,
        status: "Pending",
      };
      showMoadal.value = false;
      navigateTo("/");
    } else {
      await Swal.fire({
        icon: "error",
        title: "❌ ไม่สามารถสร้างการจองได้",
        confirmButtonText: "ตกลง",
        customClass: {
          popup: "my-popup",
          confirmButton: "btn-ok",
        },
      });
      console.error("❌ Error creating booking: เพราะ มีเวลาซ้ำกกัน", error);
    }
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    if (error.response) {
      console.error("📄 Backend Response Error:", error.response.data);
    }
    await Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการสร้างการจอง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
  }
};

const handleCancel = () => {
  showMoadal.value = false; // ปิด modal
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
            <i class="fa-solid fa-calendar-plus"></i>
          </div>
          <div class="header-text">
            <h1>จองห้องประชุม</h1>
            <p class="subtitle">สร้างการจองห้องประชุมใหม่</p>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <form @submit.prevent="handleConfirm" class="booking-form">
        <div class="form-row">
          <div class="form-group">
            <label for="title">หัวข้อการประชุม:</label>
            <input id="title" v-model="Booking.title" type="text" required />
          </div>
          <div class="form-group">
            <label for="start_time">วันเวลาเริ่มจอง:</label>
            <input
              id="start_time"
              v-model="Booking.start_time"
              type="datetime-local"
              required
            />
          </div>
          <div class="form-group">
            <label for="end_time">วันเวลาสิ้นสุดการจอง:</label>
            <input
              id="end_time"
              v-model="Booking.end_time"
              type="datetime-local"
              required
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="building_id">อาคาร:</label>
            <el-select
              v-model="Booking.building_id"
              placeholder="--- กรุณาเลือกอาคาร ---"
              style="width: 100%"
              filterable
              required
            >
              <el-option
                v-for="building in buildingStore.buildings"
                :key="building.id"
                :label="building.name"
                :value="building.id"
              />
            </el-select>
          </div>
          <div class="form-group">
            <label for="room_id">ห้องที่จอง:</label>
            <el-select
              v-model="Booking.room_id"
              placeholder="--- กรุณาเลือกห้อง ---"
              style="width: 100%"
              filterable
              :disabled="!Booking.building_id"
              required
            >
              <el-option
                v-for="room in filteredRooms"
                :key="room.id"
                :label="room.name"
                :value="room.id"
              />
            </el-select>
          </div>
          <div v-if="user" class="form-group">
            <label for="user_id">ผู้ที่จองห้องประชุม:</label>
            <input
              disabled
              id="user"
              :value="user.first_name + ' ' + user.last_name"
              type="text"
              required
              style="color: #c2c4c3"
            />
          </div>
          <div v-if="user" class="form-group">
            <label for="phone">เบอร์ติดต่อ:</label>
            <input
              disabled
              id="phone"
              :value="user.phone"
              type="text"
              required
              style="color: #c2c4c3"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="description">รายละเอียดการประชุม:</label>
            <textarea
              id="description"
              v-model="Booking.description"
              required
            ></textarea>
          </div>
        </div>

        <button type="submit" class="btn-submit">
          <i class="fa-solid fa-circle-plus"></i>
          สร้างการจอง
        </button>
      </form>
    </div>
  </div>

  <teleport to="body">
    <!-- Modal -->
    <div v-if="showMoadal" class="modal-overlay">
      <div class="modal-content">
        <h3 class="modal-title">
          <i class="fa-solid fa-circle-info"></i> รายละเอียดการจองประชุม
        </h3>

        <div class="modal-section">
          <p>
            <strong
              ><i class="fa-solid fa-handshake"></i> หัวข้อการประชุม:</strong
            >
          </p>
          <p class="detail">{{ Booking.title }}</p>
        </div>

        <div class="modal-section">
          <p>
            <strong
              ><i class="fa-solid fa-circle-info"></i>
              รายละเอียดการประชุม:</strong
            >
          </p>
          <p class="detail">{{ Booking.description }}</p>
        </div>

        <div class="modal-section">
          <p>
            <strong
              ><i class="fa-solid fa-clock"></i> วันที่เริ่ม - สิ้นสุด
              กิจกรรม:</strong
            >
          </p>
          <p class="detail">
            ตั้งแต่
            {{ dayjs(Booking.start_time).format("DD/MM/YYYY HH:mm") }} ถึง
            {{ dayjs(Booking.end_time).format("DD/MM/YYYY HH:mm") }} น.
          </p>
        </div>

        <div class="form-group">
          <label for="user"
            ><i class="fa-solid fa-user"></i> ผู้ที่จองห้องประชุม:</label
          >
          <p class="detail">
            {{ user.first_name + " " + user.last_name }}
          </p>
        </div>

        <div class="modal-section">
          <p>
            <strong><i class="fa-solid fa-phone"></i> เบอร์ติดต่อ:</strong>
          </p>
          <p class="detail">{{ user.phone }}</p>
        </div>

        <div class="modal-section">
          <p>
            <strong><i class="fa-solid fa-house"></i> ห้องประชุม:</strong>
          </p>
          <p class="detail">
            {{
              filteredRooms.find((room) => room.id === Booking.room_id)?.name ||
              "-"
            }}
          </p>
        </div>

        <div class="modal-buttons">
          <button @click="handleCreateBooking" class="confirm">
            ยืนยันการจอง
          </button>
          <button @click="handleCancel" class="cancel">
            <i class="fa-solid fa-xmark"></i>
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
  max-width: 1000px;
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

/* Container */
.container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

/* Booking Form */
.booking-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 600;
  color: #2d2d2d;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-group input,
.form-group textarea {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s ease;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.form-group input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-group textarea {
  min-height: 120px;
  resize: vertical;
}

/* Element Plus Select Styling */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: none;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: #fbbf24;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

/* Submit Button */
.btn-submit {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  align-self: center;
  min-width: 200px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  margin-top: 10px;
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

/* Modal Overlay */
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

.modal-content {
  position: relative;
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

.modal-title {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  padding: 24px 32px;
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 3px solid #fbbf24;
}

.modal-title i {
  color: #fbbf24;
  font-size: 24px;
}

.modal-content > div:not(.modal-title):not(.modal-buttons) {
  padding: 0 32px;
}

.modal-section {
  margin: 24px 32px;
}

.modal-section:first-of-type {
  margin-top: 32px;
}

.modal-section strong {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #2d2d2d;
  font-size: 15px;
}

.modal-section strong i {
  color: #fbbf24;
  font-size: 16px;
}

.detail {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-left: 4px solid #fbbf24;
  border-radius: 8px;
  padding: 14px 18px;
  color: #374151;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}

.form-group {
  margin: 24px 32px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #2d2d2d;
  font-weight: 600;
  font-size: 15px;
}

.form-group label i {
  color: #fbbf24;
  font-size: 16px;
}

/* Modal Buttons */
.modal-buttons {
  padding: 20px 32px 32px 32px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #e5e7eb;
  margin-top: 24px;
}

.confirm {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 12px 28px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.cancel {
  position: absolute;
  top: 24px;
  right: 32px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s ease;
}

.cancel:hover {
  background: rgba(220, 53, 69, 0.9);
  transform: scale(1.1);
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

  .container {
    padding: 24px 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .btn-submit {
    width: 100%;
  }

  .modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .modal-title {
    padding: 20px 24px;
    font-size: 18px;
  }

  .modal-section,
  .form-group {
    margin: 20px 24px;
  }

  .modal-buttons {
    padding: 16px 24px 24px 24px;
  }

  .cancel {
    top: 20px;
    right: 24px;
  }
}
</style>
