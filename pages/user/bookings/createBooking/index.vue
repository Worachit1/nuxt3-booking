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
  middleware: ["load-user"], // Corrected middleware name
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
    const building = buildingStore.buildings.find(b => b.id === newVal);
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
      title: "❗ ไม่สามารถจองในอดีตได้",
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
  await bookingStore.fetchBookings(); // ดึงข้อมูลการจองทั้งหมด
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
  <div class="container">
    <h2 class="h2"><i class="fa-solid fa-location-pin"></i> จองห้องประชุม</h2>
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

      <button type="submit" class="create">
        <i class="fa-solid fa-circle-plus"></i> สร้างการจอง
      </button>
    </form>
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
@media (min-width: 1024px) {
  .modal-content {
    max-width: 700px;
    padding: 40px 48px;
  }

  .container {
    max-width: 1000px;
  }

  .create {
    width: 15%;
  }
}

.container {
  padding: 25px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 20px auto;
  width: 90%;
  max-width: 800px;
}

.h2 {
  color: #13131f;
  font-size: 21px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: bold;
  text-align: left;
}

.booking-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.form-row {
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 5px;
  font-weight: bold;
}

input,
select,
textarea {
  padding: 8px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

textarea {
  height: 100px;
}

.create {
  padding: 10px 20px;
  background-color: #13131f;
  color: white;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  margin-top: 20px;
  width: 20%;
  align-self: center;
}

.create:hover {
  background-color: #4a4a4a;
  transition: background-color 0.3s;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  /* ดันไปด้านขวาสุด */
  gap: 20px;
  /* ระยะห่างระหว่างปุ่ม */
  margin-top: 20px;
}

.confirm {
  background-color: #04bd35;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.confirm:hover {
  background-color: #039d2b;
  transition: background-color 0.3s;
}

.cancel {
  position: absolute;
  top: 16px;
  right: 20px;
  color: #13131f;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
}

.cancel:hover {
  background-color: #e63939;
  color: white;
  transition: background-color 0.5s;
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* กล่อง modal */
.modal-content {
  position: relative;
  background-color: #ffffff;
  border-radius: 16px;
  width: 70%;
  max-width: 560px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
  padding: 32px;
  animation: fadeInUp 0.3s ease-out;
  transition: all 0.3s ease;
  color: #1f2937;
  margin-top: 45px;
}

/* ปิด modal */
.cancel {
  position: absolute;
  top: 16px;
  right: 20px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: #333;
  cursor: pointer;
}

.cancel:hover {
  color: red;
  transition: color 0.3s ease;
}

/* หัวข้อ modal */
.modal-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #111827;
  text-align: center;
}

/* เนื้อหา section */
.modal-section {
  margin-bottom: 16px;
}

.modal-section strong {
  display: block;
  margin-bottom: 6px;
  color: #374151;
}

/* รายละเอียด */
.detail {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 16px;
  color: #374151;
  font-size: 15px;
  line-height: 1.6;
}

/* ปุ่มต่าง ๆ */
.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.confirm {
  background-color: #04bd35;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.confirm:hover {
  background-color: #039d2b;
  transition: background-color 0.3s;
}

/* Animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive เพิ่มเติม */
@media (min-width: 1024px) {
  .modal-content {
    padding: 40px;
    max-width: 700px;
  }
}
</style>
