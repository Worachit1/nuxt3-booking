<script setup>
import { ref, onMounted, watch, computed } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useBookingStore } from "@/store/bookingStore";
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { useEquipmentStore } from "@/store/equipmentStore";
import { useEquipmentBookingStore } from "@/store/equipmentBookingStore";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import "dayjs/locale/th";

import { navigateTo } from "#app";

definePageMeta({
  middleware: ["load-user", "user-only"],
});

const route = useRoute();
const userId = localStorage.getItem("user_id");

const bookingStore = useBookingStore();
const userStore = useUserStore();
const roomStore = useRoomStore();
const equipmentStore = useEquipmentStore();
const equipmentBookingStore = useEquipmentBookingStore();

const user = ref(null);
const { isLoading } = storeToRefs(bookingStore, userStore);

// Room availability/time window (derived from /rooms/:id)
const allowedStartTime = ref("07:00");
const allowedEndTime = ref("18:00");
const isRoomAvailable = ref(true);
const maintenanceNote = ref("");
const maintenanceEta = ref("");

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

// เดิมมีการจำกัดวัน (จันทร์-ศุกร์) และข้อความแจ้งเตือน ซึ่งถูกยกเลิกตามคำขอ

// Helpers for time parsing and allowed window
const hhmmToMinutes = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
  const [h, m] = t.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};
const secondsToHHMM = (secs) => {
  if (secs === null || secs === undefined) return "";
  const n = Number(secs);
  if (!Number.isFinite(n) || n < 0) return "";
  const h = Math.floor(n / 3600) % 24;
  const m = Math.floor((n % 3600) / 60);
  const pad = (v) => (v < 10 ? `0${v}` : String(v));
  return `${pad(h)}:${pad(m)}`;
};
const isAllowedTime = (timeString) => {
  const totalMinutes = hhmmToMinutes(timeString);
  const minTime = hhmmToMinutes(allowedStartTime.value);
  const maxTime = hhmmToMinutes(allowedEndTime.value);
  if (
    !Number.isFinite(totalMinutes) ||
    !Number.isFinite(minTime) ||
    !Number.isFinite(maxTime)
  )
    return false;
  return totalMinutes >= minTime && totalMinutes <= maxTime;
};

// Validation states
const isStartAllowed = computed(() =>
  Booking.value.start_time ? isAllowedTime(Booking.value.start_time) : true
);
const isEndAllowed = computed(() =>
  Booking.value.end_time ? isAllowedTime(Booking.value.end_time) : true
);
const isDurationValid = computed(() => {
  if (!Booking.value.start_time || !Booking.value.end_time || !lockedDate.value)
    return true;
  const s = new Date(`${lockedDate.value}T${Booking.value.start_time}`);
  const e = new Date(`${lockedDate.value}T${Booking.value.end_time}`);
  return s < e;
});
const canSubmit = computed(
  () =>
    Boolean(
      Booking.value.title &&
        Booking.value.description &&
        Booking.value.start_time &&
        Booking.value.end_time &&
        lockedDate.value &&
        Booking.value.room_id &&
        Booking.value.user_id
    ) &&
    isStartAllowed.value &&
    isEndAllowed.value &&
    isDurationValid.value &&
    isRoomAvailable.value
);

onMounted(async () => {
  console.log(
    "onMounted",
    "userId:",
    userId,
    "room_id:",
    route.params.id,
    "date:",
    route.query.date
  );
  // รับค่าวันที่จาก query (ไม่จำกัดเฉพาะ จันทร์-ศุกร์ อีกต่อไป)
  if (route.query.date) {
    lockedDate.value = route.query.date;
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
    // Derive allowed window and availability from room
    if (selectedRoom.value) {
      allowedStartTime.value =
        secondsToHHMM(selectedRoom.value.start_room) || allowedStartTime.value;
      allowedEndTime.value =
        secondsToHHMM(selectedRoom.value.end_room) || allowedEndTime.value;
      const v = selectedRoom.value.is_available;
      isRoomAvailable.value =
        v === true ||
        v === 1 ||
        (typeof v === "string" && v.toLowerCase() === "true");
      maintenanceNote.value = selectedRoom.value.maintenance_note || "";
      maintenanceEta.value = selectedRoom.value.maintenance_eta || "";
      if (!isRoomAvailable.value) {
        // แจ้งเตือนและบล็อกการจอง หากเข้าหน้านี้โดยตรง
        await Swal.fire({
          icon: "error",
          title: "กำลังปรับปรุง",
          html: `<div style="text-align:left">
            <p><strong>หมายเหตุ:</strong> ${maintenanceNote.value || "ว่าง"}</p>
            <p><strong>คาดว่าจะเสร็จ:</strong> ${
              maintenanceEta.value || "ว่าง"
            }</p>
          </div>`,
          confirmButtonText: "ตกลง",
          customClass: { popup: "my-popup", confirmButton: "btn-ok" },
        });
      }
    }
  }

  // เซ็ต default เวลาเมื่อมีวันที่ล็อค
  if (route.query.date) {
    // ตั้งค่า default ภายในช่วงอนุญาต
    Booking.value.start_time = allowedStartTime.value;
    const startMin = hhmmToMinutes(allowedStartTime.value);
    const endMin = hhmmToMinutes(allowedEndTime.value);
    const oneHour = startMin + 60;
    Booking.value.end_time =
      Number.isFinite(endMin) && oneHour <= endMin
        ? `${String(Math.floor(oneHour / 60)).padStart(2, "0")}:${String(
            oneHour % 60
          ).padStart(2, "0")}`
        : allowedEndTime.value;
  }

  // โหลดข้อมูลการจองที่มีอยู่แล้ว
  if (Booking.value.room_id) {
    const bookings = await bookingStore.fetchBookingByRoomId(
      Booking.value.room_id
    );
    // แปลงเป็น array ของช่วงเวลา (เฉพาะวันที่ที่เลือก และสถานะ Approved หรือ Pending)
    bookedRanges.value = bookings
      .filter((b) => {
        const bookingDate = dayjs.unix(b.start_time).format("YYYY-MM-DD");
        const status = String(b.status || "").toLowerCase();
        const isValidStatus = status === "approved" || status === "pending";
        const isSameDate = bookingDate === lockedDate.value;
        
        return isSameDate && isValidStatus;
      })
      .map((b) => ({
        start: dayjs.unix(b.start_time).format("HH:mm"),
        end: dayjs.unix(b.end_time).format("HH:mm"),
        status: b.status,
      }));
    
    console.log("โหลดการจองสำหรับวันที่:", lockedDate.value);
    console.log("การจองที่พบ:", bookedRanges.value);
  }
});

function isTimeOverlapped(start, end) {
  // ต้องมีการจองอย่างน้อย 1 รายการถึงจะตรวจสอบ
  if (bookedRanges.value.length === 0) return false;
  
  return bookedRanges.value.some((range) => {
    // ตรวจสอบว่าช่วงเวลาทับซ้อนกันหรือไม่
    // ทับซ้อนเมื่อ: เวลาเริ่มใหม่ < เวลาสิ้นสุดเดิม AND เวลาสิ้นสุดใหม่ > เวลาเริ่มเดิม
    const isOverlap = start < range.end && end > range.start;
    
    if (isOverlap) {
      console.log("พบการทับซ้อน:", {
        ช่วงใหม่: { start, end },
        ช่วงเดิม: range
      });
    }
    
    return isOverlap;
  });
}

// เพิ่ม watch สำหรับตรวจสอบเวลาที่อนุญาต (แต่ไม่ alert ทันที)
// จะตรวจสอบตอน submit แทน
watch(
  [() => Booking.value.start_time, () => Booking.value.end_time],
  ([start, end]) => {
    // เอา alert ออก ให้ตรวจสอบตอน submit แทน
    // เพื่อไม่ให้รบกวนตอนกำลังเลือกเวลา
    if (start && end) {
      console.log("เลือกเวลา:", { start, end });
      console.log("การจองที่มีอยู่:", bookedRanges.value);
    }
  }
);

const showModal = ref(false);
const showEquipmentModal = ref(false);
const equipmentSelections = ref([]);

const handleConfirm = async () => {
  // ตรวจสอบเวลาที่อนุญาต
  if (
    !isAllowedTime(Booking.value.start_time) ||
    !isAllowedTime(Booking.value.end_time)
  ) {
    await Swal.fire({
      icon: "warning",
      title: "เวลาอยู่นอกช่วงของห้อง",
      text: "กรุณาเลือกเวลาใหม่",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  // ตรวจสอบเวลาทับซ้อนกับการจองในวันเดียวกัน (จาก bookedRanges)
  if (isTimeOverlapped(Booking.value.start_time, Booking.value.end_time)) {
    await Swal.fire({
      icon: "warning",
      title: "ช่วงเวลานี้ถูกจองแล้ว",
      text: "กรุณาเลือกเวลาอื่นที่ว่าง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  if (!isRoomAvailable.value) {
    await Swal.fire({
      icon: "error",
      title: "กำลังปรับปรุง",
      html: `<div style="text-align:left">
        <p><strong>หมายเหตุ:</strong> ${maintenanceNote.value || "ว่าง"}</p>
        <p><strong>คาดว่าจะเสร็จ:</strong> ${maintenanceEta.value || "ว่าง"}</p>
      </div>`,
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
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

  await equipmentStore.fetchEquipments();
  equipmentSelections.value = equipmentStore.equipments.map((eq) => ({
    id: eq.id,
    name: eq.name,
    available: typeof eq.available === "number" ? eq.available : eq.quantity,
    selectedQuantity: 0,
  }));
  showEquipmentModal.value = true;
};

const handleEquipmentNext = () => {
  showEquipmentModal.value = false;
  showModal.value = true;
};

// กลับไปแก้ไขรายการอุปกรณ์จาก modal ยืนยัน
function backToEquipment() {
  showModal.value = false;
  showEquipmentModal.value = true;
}

const handleCreateBooking = async () => {
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
  console.log("booking payload", payload);
  const bookingRes = await bookingStore.addBooking(payload);
  console.log("booking response", bookingRes);
  if (bookingRes && bookingRes.data && bookingRes.data.ID) {
    const bookingId = bookingRes.data.ID;
    console.log("booking_id ที่เพิ่งสร้าง:", bookingId);
    // รวมอุปกรณ์ที่เลือกเป็น array ตาม backend ต้องการ
    const equipments = equipmentSelections.value
      .filter((e) => e.selectedQuantity > 0)
      .map((e) => ({ equipment_id: e.id, quantity: e.selectedQuantity }));
    if (equipments.length > 0) {
      try {
        await equipmentBookingStore.addBookingEquipment({
          booking_id: bookingId,
          equipments,
        });
        console.log("สร้าง booking_equipment:", {
          booking_id: bookingId,
          equipments,
        });
      } catch (e) {
        console.error("Error creating booking_equipment", e);
      }
    }
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
    showModal.value = false;
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
};

const handleCancel = () => {
  showModal.value = false;
  showEquipmentModal.value = false;
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

    <form @submit.prevent="handleConfirm" class="booking-form">
      <div class="form-row">
        <div class="form-group">
          <label for="title">หัวข้อการประชุม:</label>
          <input id="title" v-model="Booking.title" type="text" required :disabled="showModal" />
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
      </div>

      <div class="form-row">
        <!-- เวลาเริ่มจอง -->
        <div class="form-group">
          <label for="start_time"
            >เวลาเริ่มจอง: ( จองได้เฉพาะช่วง {{ allowedStartTime }} น.)</label
          >
          <input
            id="start_time"
            v-model="Booking.start_time"
            type="time"
            :min="allowedStartTime"
            :max="allowedEndTime"
            :title="`เลือกได้ระหว่าง ${allowedStartTime} - ${allowedEndTime}`"
            required
            :disabled="showModal"
          />
          <small v-if="!isStartAllowed" class="error-text"
            >อยู่นอกช่วงเวลาอนุญาต ({{ allowedStartTime }} -
            {{ allowedEndTime }} น.)</small
          >
        </div>

        <!-- เวลาสิ้นสุดการจอง -->
        <div class="form-group">
          <label for="end_time"
            >เวลาสิ้นสุดการจอง: ( ถึงช่วง {{ allowedEndTime }} น.)</label
          >
          <input
            id="end_time"
            v-model="Booking.end_time"
            type="time"
            :min="allowedStartTime"
            :max="allowedEndTime"
            :title="`เลือกได้ระหว่าง ${allowedStartTime} - ${allowedEndTime}`"
            required
            :disabled="showModal"
          />
          <small v-if="!isEndAllowed" class="error-text"
            >อยู่นอกช่วงเวลาอนุญาต ({{ allowedStartTime }} -
            {{ allowedEndTime }} น.)</small
          >
          <small v-else-if="!isDurationValid" class="error-text"
            >เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม</small
          >
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
            :disabled="showModal"
          ></textarea>
        </div>
      </div>

      <button type="submit" class="create" :disabled="!canSubmit || showModal">
        <i class="fa-solid fa-circle-plus"></i> สร้างการจอง
      </button>
    </form>
  </div>

  <teleport to="body">
    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay">
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
            {{
              dayjs(lockedDate + "T" + Booking.start_time).format(
                "DD/MM/YYYY HH:mm"
              )
            }}
            ถึง
            {{
              dayjs(lockedDate + "T" + Booking.end_time).format(
                "DD/MM/YYYY HH:mm"
              )
            }}
            น.
          </p>
        </div>

        <div v-if="user" class="form-group">
          <label for="user"
            ><i class="fa-solid fa-user"></i> ผู้ที่จองห้องประชุม:</label
          >
          <p class="detail" >
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

        <!-- แสดงอุปกรณ์ที่เลือกพร้อมจำนวน -->
        <div v-if="equipmentSelections && equipmentSelections.filter(e => e.selectedQuantity > 0).length > 0" class="modal-section">
          <p>
            <strong><i class="fa-solid fa-boxes-stacked"></i> อุปกรณ์ที่เลือก:</strong>
          </p>
          <div class="modal-equipment-list">
            <div v-for="eq in equipmentSelections.filter(e => e.selectedQuantity > 0)" :key="eq.id" class="modal-equipment-item">
              <span class="eq-name">{{ eq.name }}</span>
              <span class="eq-qty">จำนวน: <strong>{{ eq.selectedQuantity }}</strong></span>
            </div>
          </div>
        </div>

        <div class="modal-buttons">
          <button @click="backToEquipment" type="button" class="back">
            <i class="fa-solid fa-arrow-left"></i> แก้ไขอุปกรณ์
          </button>
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

  <teleport to="body">
    <!-- Equipment Modal -->
    <div v-if="showEquipmentModal" class="modal-overlay">
      <div class="modal-content">
        <h3 class="modal-title">
          <i class="fa-solid fa-tools"></i> เลือกอุปกรณ์
        </h3>

        <div class="modal-section">
          <p>
            <strong><i class="fa-solid fa-calendar-check"></i> วันที่:</strong>
          </p>
          <p class="detail">{{ dayjs(lockedDate).format("DD/MM/YYYY") }}</p>
        </div>

        <div class="modal-section">
          <p>
            <strong><i class="fa-solid fa-clock"></i> เวลา:</strong>
          </p>
          <p class="detail">
            {{ Booking.start_time }} - {{ Booking.end_time }} น.
          </p>
        </div>

        <div class="modal-section">
          <p>
            <strong><i class="fa-solid fa-house"></i> ห้องประชุม:</strong>
          </p>
          <p class="detail">
            {{ selectedRoom?.name || "-" }}
          </p>
        </div>

        <div class="modal-section">
          <p>
            <strong
              ><i class="fa-solid fa-user"></i> ผู้ที่จองห้องประชุม:</strong
            >
          </p>
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

        <div class="modal-section equipment-section">
          <p>
            <strong><i class="fa-solid fa-cogs"></i> อุปกรณ์ที่ต้องการ:</strong>
          </p>
          <div class="equipment-list">
            <div
              v-for="(equipment, index) in equipmentSelections"
              :key="equipment.id"
              class="equipment-card"
              :class="{ 'equipment-unavailable': equipment.available === 0 }"
            >
              <div class="equipment-card-header">
                <i
                  class="fa-solid fa-toolbox"
                  style="font-size: 22px; color: #2196f3; margin-right: 8px"
                ></i>
                <span class="equipment-name">{{ equipment.name }}</span>
              </div>
              <div class="equipment-card-body">
                <span
                  v-if="equipment.available > 0"
                  class="equipment-available"
                >
                  <i
                    class="fa-solid fa-check-circle"
                    style="color: #2ecc71; margin-right: 4px"
                  ></i>
                  <b>คงเหลือ {{ equipment.available }} ชิ้น</b>
                </span>
                <span v-else class="equipment-unavailable">
                  <i
                    class="fa-solid fa-times-circle"
                    style="color: #e74c3c; margin-right: 4px"
                  ></i>
                  <b>หมดชั่วคราว</b>
                </span>
                <div class="equipment-actions">
                  <button
                    class="quantity-btn"
                    @click="
                      equipment.selectedQuantity = Math.max(
                        0,
                        equipment.selectedQuantity - 1
                      )
                    "
                    :disabled="
                      equipment.selectedQuantity <= 0 ||
                      equipment.available === 0
                    "
                  >
                    <i class="fa-solid fa-minus"></i>
                  </button>
                  <span class="quantity-display">{{
                    equipment.selectedQuantity
                  }}</span>
                  <button
                    class="quantity-btn"
                    @click="
                      equipment.selectedQuantity = Math.min(
                        equipment.available,
                        equipment.selectedQuantity + 1
                      )
                    "
                    :disabled="
                      equipment.selectedQuantity >= equipment.available ||
                      equipment.available === 0
                    "
                  >
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-buttons">
          <button @click="handleEquipmentNext" class="confirm">ถัดไป</button>
          <button @click="handleCancel" class="cancel">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* Equipment selection UI improvements */
.equipment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 10px;
}
.equipment-card {
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
  padding: 18px 22px;
  min-width: 220px;
  max-width: 260px;
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 2px solid #3a3a3a;
  transition: all 0.3s ease;
}

.equipment-card:hover {
  border-color: #fbbf24;
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.3);
  transform: translateY(-2px);
}

.equipment-card-header {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #ffffff;
}

.equipment-card-header i {
  color: #fbbf24 !important;
}

.equipment-card-body {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.equipment-available {
  color: #4ade80;
  font-weight: bold;
  font-size: 15px;
}
.equipment-unavailable {
  color: #f87171;
  font-weight: bold;
  font-size: 15px;
}
.equipment-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.quantity-btn {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(251, 191, 36, 0.3);
}

.quantity-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.5);
}

.quantity-btn:disabled {
  background: #4a4a4a;
  cursor: not-allowed;
  opacity: 0.5;
}
.quantity-display {
  font-size: 18px;
  font-weight: bold;
  min-width: 32px;
  text-align: center;
  color: #fbbf24;
}
.equipment-card.equipment-unavailable {
  opacity: 0.6;
  border-color: #f87171;
}
@media (min-width: 1024px) {
  .modal-content {
    max-width: 750px;
    padding: 40px 48px;
  }

  .container {
    max-width: 1000px;
  }
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
  }

  .container {
    padding: 20px;
    width: 95%;
  }

  .h2 {
    font-size: 20px;
  }

  .modal-content {
    width: 95%;
    padding: 24px;
  }

  .equipment-list {
    flex-direction: column;
  }

  .equipment-card {
    max-width: 100%;
  }
}

.container {
  padding: 30px;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  margin: 20px auto;
  width: 90%;
  max-width: 900px;
  border: 2px solid #3a3a3a;
}

.h2 {
  color: #ffffff;
  font-size: 24px;
  margin-bottom: 30px;
  font-weight: 700;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 3px solid #fbbf24;
}

.h2 i {
  color: #fbbf24;
  font-size: 28px;
}

/* Info Card Styles */
.booking-info {
  margin-bottom: 25px;
}

.info-card {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border: 2px solid #3a3a3a;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.info-card h3 {
  color: #fbbf24;
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card p {
  margin: 8px 0;
  color: #e0e0e0;
  font-size: 14px;
}

.contact-info {
  background: rgba(251, 191, 36, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-top: 15px;
  border-left: 4px solid #fbbf24;
}

.contact-info p:first-child {
  color: #fbbf24;
  font-weight: bold;
  margin-bottom: 8px;
}

.time-note {
  color: #a0a0a0;
  font-size: 12px;
  font-weight: normal;
}

.booking-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
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
  margin-bottom: 8px;
  font-weight: 600;
  color: #fbbf24;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

input,
select,
textarea {
  padding: 12px 16px;
  font-size: 14px;
  border: 2px solid #3a3a3a;
  border-radius: 8px;
  background: #1a1a1a;
  color: #ffffff;
  transition: all 0.3s ease;
}

/* สีขาวสำหรับ time picker */
input[type="time"] {
  color-scheme: light;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff;
}

input[type="time"]::-webkit-datetime-edit {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

input[type="time"]::-webkit-datetime-edit-fields-wrapper {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

input[type="time"]::-webkit-datetime-edit-text {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  padding: 0 2px;
}

input[type="time"]::-webkit-datetime-edit-hour-field,
input[type="time"]::-webkit-datetime-edit-minute-field,
input[type="time"]::-webkit-datetime-edit-ampm-field {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  background: transparent;
}

input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(200%) contrast(100%);
  cursor: pointer;
  width: 20px;
  height: 20px;
}

input[type="time"]::-webkit-calendar-picker-indicator:hover {
  filter: invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(250%) contrast(100%);
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

input:disabled,
select:disabled,
textarea:disabled {
  background: #2d2d2d;
  color: #888;
  cursor: not-allowed;
}

textarea {
  height: 120px;
  resize: vertical;
}

.error-text {
  color: #f87171;
  font-size: 12px;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.error-text::before {
  content: "⚠️";
  font-size: 14px;
}

.create {
  padding: 14px 32px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 30px;
  font-size: 16px;
  font-weight: 700;
  align-self: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  display: flex;
  align-items: center;
  gap: 10px;
}

.create:disabled {
  background: #4a4a4a;
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.create:hover:not(:disabled) {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.6);
}

.create:active:not(:disabled) {
  transform: translateY(0);
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #3a3a3a;
}

.confirm {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 12px 28px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.confirm:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6);
}

/* ปุ่มกลับไปแก้ไขอุปกรณ์ */
.back {
  background: transparent;
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.18);
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.back:hover {
  background: rgba(251,191,36,0.05);
  transform: translateY(-2px);
}

.cancel {
  position: absolute;
  top: 20px;
  right: 24px;
  color: #e0e0e0;
  background: transparent;
  padding: 8px 12px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 24px;
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel:hover {
  background-color: #ef4444;
  color: white;
  transform: rotate(90deg);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* กล่อง modal */
.modal-content {
  position: relative;
  background: linear-gradient(135deg, #2d2d2d, #1a1a1a);
  border-radius: 20px;
  width: 85%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(251, 191, 36, 0.2);
  padding: 36px;
  animation: fadeInUp 0.3s ease-out;
  transition: all 0.3s ease;
  color: #ffffff;
  margin-top: 45px;
  border: 2px solid #3a3a3a;
}

/* Custom scrollbar for modal */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 10px;
}

/* หัวข้อ modal */
.modal-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  color: #ffffff;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 2px solid #fbbf24;
}

.modal-title i {
  color: #fbbf24;
}

/* เนื้อหา section */
.modal-section {
  margin-bottom: 20px;
}

.modal-section strong {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #fbbf24;
  font-size: 14px;
  font-weight: 600;
}

.modal-section strong i {
  font-size: 16px;
}

/* รายละเอียด */
.detail {
  background: #1a1a1a;
  border: 2px solid #3a3a3a;
  border-radius: 10px;
  padding: 14px 18px;
  color: #e0e0e0;
  font-size: 15px;
  line-height: 1.6;
  transition: all 0.3s ease;
  /* ป้องกันการพิมพ์ / แสดง cursor ห้ามพิมพ์ */
  cursor: not-allowed;
  user-select: none;
  -webkit-user-select: none;
}

.detail:hover {
  border-color: #fbbf24;
}

/* Make disabled inputs show not-allowed cursor while modal is open */
input:disabled,
textarea:disabled,
select:disabled {
  cursor: not-allowed !important;
  background: #2a2a2a !important;
}

.modal-equipment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.modal-equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.04);
  border: 1px solid rgba(251,191,36,0.12);
}
.modal-equipment-item .eq-name { color: #f3f3f3; font-weight: 600 }
.modal-equipment-item .eq-qty { color: #fbbf24; font-weight: 700 }

/* Equipment Modal Styles */
.equipment-section {
  background: rgba(251, 191, 36, 0.05);
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #3a3a3a;
  margin-top: 10px;
}

.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #3a3a3a;
}

.equipment-info {
  flex: 1;
}

.equipment-name {
  font-weight: 700;
  color: #ffffff;
  font-size: 16px;
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
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
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
