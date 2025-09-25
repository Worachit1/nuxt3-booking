<script setup>
import { ref, onMounted, watch } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useBookingStore } from "@/store/bookingStore";
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import "dayjs/locale/th";

definePageMeta({
  middleware: ["load-user"],
});

const route = useRoute();
const userId = route.params.id || localStorage.getItem("user_id");

const bookingStore = useBookingStore();
const userStore = useUserStore();
const roomStore = useRoomStore();

const user = ref(null);
const { isLoading } = storeToRefs(bookingStore, userStore);

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

const selectedRoom = ref(null);

// รับวันที่ล็อคจาก query string
const lockedDate = ref("");
const bookedRanges = ref([]);

// ตรวจสอบว่าวันที่เป็นวันจันทร์-ศุกร์หรือไม่
const isWeekday = (date) => {
  const day = dayjs(date).day(); // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
  return day >= 1 && day <= 5; // จันทร์=1, ศุกร์=5
};

// ตรวจสอบเวลาที่อนุญาต (07:00-18:00)
const isAllowedTime = (timeString) => {
  const time = timeString.split(':');
  const hours = parseInt(time[0]);
  const minutes = parseInt(time[1]);
  const totalMinutes = hours * 60 + minutes;
  
  const minTime = 7 * 60; // 07:00 = 420 นาที
  const maxTime = 18 * 60; // 18:00 = 1080 นาที
  
  return totalMinutes >= minTime && totalMinutes <= maxTime;
};

onMounted(async () => {
  // ตรวจสอบวันที่ทันทีที่เข้าหน้า
  if (route.query.date) {
    lockedDate.value = route.query.date;
    
    // ตรวจสอบว่าเป็นวันจันทร์-ศุกร์หรือไม่ (ทำทันที)
    if (!isWeekday(lockedDate.value)) {
      await Swal.fire({
        icon: "error",
        title: "ไม่สามารถจองได้",
        html: `
          <p>สามารถจองได้เฉพาะวัน <strong>จันทร์ - ศุกร์</strong> เท่านั้น</p>
          <p>เวลา <strong>07:00 - 18:00 น.</strong></p>
          <hr style="margin: 15px 0;">
          <p style="color: #e74c3c; font-weight: bold;">หากต้องการจองนอกเวลา กรุณาติดต่อเจ้าหน้าที่</p>
          <p><i class="fa-solid fa-phone" style="color: #3498db;"></i> โทร: <strong>02-123-4567</strong></p>
        `,
        confirmButtonText: "ตกลง",
        customClass: {
          popup: "my-popup",
          confirmButton: "btn-ok",
        },
        allowOutsideClick: false, // ป้องกันการปิด modal โดยคลิกนอก
        allowEscapeKey: false,    // ป้องกันการปิด modal ด้วย ESC
      });
      await navigateTo("/");
      return; // หยุดการทำงานต่อ
    }
  }

  // โหลดข้อมูลผู้ใช้
  if (userId) {
    await userStore.getUserById(userId);
  }
  user.value = userStore.currentUser || null;
  if (user.value) {
    Booking.value.user_id = user.value.id;
    Booking.value.phone = user.value.phone;
  }

  // set room_id จาก params
  if (route.params.id) {
    Booking.value.room_id = route.params.id;
    selectedRoom.value = await roomStore.getById(route.params.id);
  }

  // เซ็ต default เวลาหลังจากผ่านการตรวจสอบวันแล้ว
  if (route.query.date && isWeekday(lockedDate.value)) {
    Booking.value.start_time = "07:00";
    Booking.value.end_time = "08:00";
  }

  // โหลดข้อมูลการจองที่มีอยู่แล้ว
  if (Booking.value.room_id) {
    const bookings = await bookingStore.fetchBookingByRoomId(Booking.value.room_id);
    // แปลงเป็น array ของช่วงเวลา (เฉพาะวันที่ที่เลือก)
    bookedRanges.value = bookings
      .filter(b => dayjs.unix(b.start_time).format("YYYY-MM-DD") === lockedDate.value)
      .map(b => ({
        start: dayjs.unix(b.start_time).format("HH:mm"),
        end: dayjs.unix(b.end_time).format("HH:mm"),
      }));
  }
});

function isTimeOverlapped(start, end) {
  return bookedRanges.value.some(range => {
    // ถ้าเวลาเริ่ม < เวลาสิ้นสุดที่จองไว้ และ เวลาสิ้นสุด > เวลาเริ่มที่จองไว้
    return start < range.end && end > range.start;
  });
}

// เพิ่ม watch สำหรับตรวจสอบเวลาที่อนุญาต
watch([() => Booking.value.start_time, () => Booking.value.end_time], ([start, end]) => {
  if (start && end) {
    // ตรวจสอบเวลาที่อนุญาต
    if (!isAllowedTime(start) || !isAllowedTime(end)) {
      Swal.fire({
        icon: "error",
        title: "ไม่สามารถจองได้",
        html: `
          <p>สามารถจองได้เฉพาะเวลา <strong>07:00 - 18:00 น.</strong></p>
          <hr style="margin: 15px 0;">
          <p style="color: #e74c3c; font-weight: bold;">หากต้องการจองนอกเวลา กรุณาติดต่อเจ้าหน้าที่</p>
          <p><i class="fa-solid fa-phone" style="color: #3498db;"></i> โทร: <strong>02-123-4567</strong></p>
        `,
        confirmButtonText: "ตกลง",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      Booking.value.start_time = "07:00";
      Booking.value.end_time = "08:00";
      return;
    }
    
    // ตรวจสอบเวลาทับซ้อน
    if (isTimeOverlapped(start, end)) {
      Swal.fire({
        icon: "warning",
        title: "ช่วงเวลานี้ถูกจองแล้ว",
        text: "กรุณาเลือกเวลาอื่นที่ว่าง",
        confirmButtonText: "ตกลง",
      });
      Booking.value.start_time = "";
      Booking.value.end_time = "";
    }
  }
});

const showMoadal = ref(false);

const handleConfirm = async () => {
  // ตรวจสอบว่าเป็นวันจันทร์-ศุกร์
  if (!isWeekday(lockedDate.value)) {
    await Swal.fire({
      icon: "error",
      title: "ไม่สามารถจองได้",
      html: `
        <p>สามารถจองได้เฉพาะวัน <strong>จันทร์ - ศุกร์</strong> เท่านั้น</p>
        <p>เวลา <strong>07:00 - 18:00 น.</strong></p>
        <hr style="margin: 15px 0;">
        <p style="color: #e74c3c; font-weight: bold;">หากต้องการจองนอกเวลา กรุณาติดต่อเจ้าหน้าที่</p>
        <p><i class="fa-solid fa-phone" style="color: #3498db;"></i> โทร: <strong>02-123-4567</strong></p>
      `,
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  // ตรวจสอบเวลาที่อนุญาต
  if (!isAllowedTime(Booking.value.start_time) || !isAllowedTime(Booking.value.end_time)) {
    await Swal.fire({
      icon: "error",
      title: "ไม่สามารถจองได้",
      html: `
        <p>สามารถจองได้เฉพาะเวลา <strong>07:00 - 18:00 น.</strong></p>
        <p>ในวัน <strong>จันทร์ - ศุกร์</strong> เท่านั้น</p>
        <hr style="margin: 15px 0;">
        <p style="color: #e74c3c; font-weight: bold;">หากต้องการจองนอกเวลา กรุณาติดต่อเจ้าหน้าที่</p>
        <p><i class="fa-solid fa-phone" style="color: #3498db;"></i> โทร: <strong>02-123-4567</strong></p>
      `,
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  // รวมวันที่กับเวลา
  const startDateTime = `${lockedDate.value}T${Booking.value.start_time}`;
  const endDateTime = `${lockedDate.value}T${Booking.value.end_time}`;

  if (new Date(startDateTime) >= new Date(endDateTime)) {
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
  const startTime = new Date(startDateTime);
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
  await bookingStore.fetchAllBookings();
  const isOverlapping = bookingStore.bookings.some((booking) => {
    if (
      booking.status === "Approved" ||
      (booking.status === "Pending" &&
        booking.room_id === Booking.value.room_id)
    ) {
      const existingStart = new Date(booking.start_time * 1000);
      const existingEnd = new Date(booking.end_time * 1000);
      return (
        (startTime < existingEnd && startTime >= existingStart) ||
        (new Date(endDateTime) > existingStart &&
          new Date(endDateTime) <= existingEnd)
      );
    }
    return false;
  });

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

    // รวมวันที่กับเวลา
    const startDateTime = `${lockedDate.value}T${Booking.value.start_time}`;
    const endDateTime = `${lockedDate.value}T${Booking.value.end_time}`;

    const payload = {
      title: Booking.value.title.trim(),
      description: Booking.value.description.trim(),
      start_time: Math.floor(new Date(startDateTime).getTime() / 1000),
      end_time: Math.floor(new Date(endDateTime).getTime() / 1000),
      room_id: Booking.value.room_id,
      user_id: Booking.value.user_id,
      phone: Booking.value.phone,
      status: Booking.value.status,
    };

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
      Booking.value = {
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        phone: "",
        room_id: null,
        user_id: null,
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
  showMoadal.value = false;
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="container">
    <h2 class="h2">
      <i class="fa-solid fa-location-pin"></i> จองห้องประชุม
      {{ selectedRoom?.name }}
    </h2>
    
    <!-- แสดงข้อมูลเวลาที่อนุญาต -->
    <div class="booking-info">
      <div class="info-card">
        <h3><i class="fa-solid fa-info-circle"></i> ข้อมูลการจอง</h3>
        <p><strong>วันที่อนุญาต:</strong> จันทร์ - ศุกร์</p>
        <p><strong>เวลาที่อนุญาต:</strong> 07:00 - 18:00 น.</p>
        <div class="contact-info">
          <p><strong style="color: #e74c3c;">หากต้องการจองนอกเวลา กรุณาติดต่อเจ้าหน้าที่</strong></p>
          <p><i class="fa-solid fa-phone" style="color: #3498db;"></i> โทร: <strong>02-123-4567</strong></p>
        </div>
      </div>
    </div>

    <form @submit.prevent="handleConfirm" class="booking-form">
      <div class="form-row">
        <div class="form-group">
          <label for="title">หัวข้อการประชุม:</label>
          <input id="title" v-model="Booking.title" type="text" required />
        </div>
        <!-- วันที่จอง (แสดงอย่างเดียว) -->
        <div class="form-group">
          <label>วันที่จอง:</label>
          <input
            type="date"
            :value="lockedDate"
            disabled
            style="background: #f3f3f3; color: #888"
          />
        </div>

        <!-- เวลาเริ่มจอง -->
        <div class="form-group">
          <label for="start_time">เวลาเริ่มจอง: <span class="time-note">(07:00-18:00)</span></label>
          <input
            id="start_time"
            v-model="Booking.start_time"
            type="time"
            min="07:00"
            max="18:00"
            required
          />
        </div>

        <!-- เวลาสิ้นสุดการจอง -->
        <div class="form-group">
          <label for="end_time">เวลาสิ้นสุดการจอง: <span class="time-note">(07:00-18:00)</span></label>
          <input
            id="end_time"
            v-model="Booking.end_time"
            type="time"
            min="07:00"
            max="18:00"
            required
          />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="room_id">ห้องที่จอง:</label>
          <input
            type="text"
            :value="selectedRoom?.name"
            disabled
            style="color: #c2c4c3"
          />
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
            {{ dayjs(lockedDate + 'T' + Booking.start_time).format("DD/MM/YYYY HH:mm") }} ถึง
            {{ dayjs(lockedDate + 'T' + Booking.end_time).format("DD/MM/YYYY HH:mm") }} น.
          </p>
        </div>

        <div v-if="user" class="form-group">
          <label for="user"
            ><i class="fa-solid fa-user"></i> ผู้ที่จองห้องประชุม:</label
          >
          <p class="detail">
            {{ user.first_name + " " + user.last_name }}
          </p>
        </div>

        <div v-if="user" class="modal-section">
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
            {{ selectedRoom?.name || "-" }}
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

/* Info Card Styles */
.booking-info {
  margin-bottom: 25px;
}

.info-card {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border: 1px solid #bbdefb;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-card h3 {
  color: #13131f;
  margin-bottom: 15px;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card p {
  margin: 8px 0;
  color: #333;
  font-size: 14px;
}

.contact-info {
  background: rgba(255, 255, 255, 0.8);
  padding: 12px;
  border-radius: 8px;
  margin-top: 15px;
  border-left: 4px solid #e74c3c;
}

.contact-info p:first-child {
  color: #e74c3c;
  font-weight: bold;
  margin-bottom: 8px;
}

.time-note {
  color: #666;
  font-size: 12px;
  font-weight: normal;
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
  gap: 20px;
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
  z-index: 1000;
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

/* SweetAlert2 Custom Classes */
:global(.my-popup) {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
}

:global(.btn-ok) {
  background: #13131f !important;
  color: white !important;
  border: none !important;
  padding: 10px 20px !important;
  border-radius: 6px !important;
  font-weight: bold !important;
}

:global(.btn-ok:hover) {
  background: #4a4a4a !important;
}
</style>