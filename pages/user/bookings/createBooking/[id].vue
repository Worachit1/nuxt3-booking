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
  middleware: ["load-user"],
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
    // แปลงเป็น array ของช่วงเวลา (เฉพาะวันที่ที่เลือก)
    bookedRanges.value = bookings
      .filter(
        (b) =>
          dayjs.unix(b.start_time).format("YYYY-MM-DD") === lockedDate.value
      )
      .map((b) => ({
        start: dayjs.unix(b.start_time).format("HH:mm"),
        end: dayjs.unix(b.end_time).format("HH:mm"),
      }));
  }
});

function isTimeOverlapped(start, end) {
  return bookedRanges.value.some((range) => {
    // ถ้าเวลาเริ่ม < เวลาสิ้นสุดที่จองไว้ และ เวลาสิ้นสุด > เวลาเริ่มที่จองไว้
    return start < range.end && end > range.start;
  });
}

// เพิ่ม watch สำหรับตรวจสอบเวลาที่อนุญาต
watch(
  [() => Booking.value.start_time, () => Booking.value.end_time],
  ([start, end]) => {
    if (start && end) {
      // ตรวจสอบเวลาทับซ้อน เฉพาะเมื่อเวลาอยู่ในช่วงที่อนุญาต
      if (isAllowedTime(start) && isAllowedTime(end)) {
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
          ></textarea>
        </div>
      </div>

      <button type="submit" class="create" :disabled="!canSubmit">
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
  background: #f7fafd;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.08);
  padding: 18px 22px;
  min-width: 220px;
  max-width: 260px;
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 2px solid #e3e6f0;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.equipment-card-header {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}
.equipment-card-body {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.equipment-available {
  color: #219653;
  font-weight: bold;
  font-size: 15px;
}
.equipment-unavailable {
  color: #e74c3c;
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
  background: #2196f3;
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
  transition: background 0.2s;
}
.quantity-btn:disabled {
  background: #b0bec5;
  cursor: not-allowed;
}
.quantity-display {
  font-size: 18px;
  font-weight: bold;
  min-width: 32px;
  text-align: center;
}
.equipment-card.equipment-unavailable {
  opacity: 0.7;
  border-color: #e74c3c;
}
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

.error-text {
  color: #e74c3c;
  font-size: 12px;
  margin-top: 6px;
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

.create:disabled {
  background-color: #9aa0a6;
  cursor: not-allowed;
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

/* Equipment Modal Styles */
.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.equipment-info {
  flex: 1;
}

.equipment-name {
  font-weight: bold;
  color: #13131f;
}

.equipment-available {
  font-size: 14px;
}

.equipment-unavailable {
  font-size: 14px;
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
