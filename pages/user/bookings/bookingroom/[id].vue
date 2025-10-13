<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import LoadingPage from "@/components/Loading.vue";
import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";
import { useRoute, useRouter } from "vue-router";
import { useBookingStore } from "@/store/bookingStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useRoomStore } from "@/store/roomStore";
import { useEquipmentBookingStore } from "@/store/equipmentBookingStore";
import { useEquipmentStore } from "@/store/equipmentStore";
import { ElSelect, ElOption } from "element-plus";
import "element-plus/dist/index.css";
import dayjs from "dayjs";
import "dayjs/locale/th";

import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

definePageMeta({
  middleware: ["load-user"],
});

const date = ref(dayjs().format("YYYY-MM-DD"));
const formatDateTime = (date) => {
  const timestamp = date < 10000000000 ? date * 1000 : date;
  return dayjs(timestamp).locale("th").format("D MMMM YYYY HH:mm:ss น.");
};

const route = useRoute();
const router = useRouter();
const roomId = ref(route.params.id);
const roomStore = useRoomStore();
const bookingStore = useBookingStore();
const buildingStore = useBuildingStore();
const equipmentBookingStore = useEquipmentBookingStore();
const equipmentStore = useEquipmentStore();

const { isLoading } = storeToRefs(buildingStore, bookingStore);

const roomName = ref("");
const events = ref([]);
const calendarRef = ref(null);
const popupVisible = ref(false);
const selectedEvent = ref(null);
const selectedEventEquipments = ref([]);
const searchDate = ref(null);
const loading = ref(false);
const isRefreshing = ref(false); // สถานะการรีเฟรชแบบเงียบ
let refreshInterval = null; // เก็บ interval สำหรับ auto-refresh

onMounted(async () => {
  await buildingStore.fetchBuildings();
  buildings.value = buildingStore.buildings;

  if (roomId.value) {
    const found = buildings.value.find((b) =>
      (b.rooms || []).some((r) => r.id == roomId.value)
    );
    if (found) {
      selectedBuildingId.value = found.id;
      selectedRoomId.value = roomId.value;
    }
    await loadBookings(); // โหลดครั้งแรก (แสดง loading)

    // 🔥 เริ่ม Auto-refresh ทุก 2 วินาที (แบบเงียบ ไม่แสดง loading)
    refreshInterval = setInterval(async () => {
      await loadBookings(true); // silent mode
    }, 2000);
  }
});

// 🧹 ทำความสะอาด interval เมื่อออกจากหน้า
onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});

const loadBookings = async (silent = false) => {
  if (!roomId.value) return;

  if (silent) {
    isRefreshing.value = true;
  } else {
    loading.value = true;
  }

  try {
    await bookingStore.fetchBookingByRoomId(roomId.value);

    // แสดงการจองทั้งหมด (ยกเว้น Canceled) — รองรับตัวพิมพ์เล็ก/ใหญ่ของสถานะ
    const filteredBookings = bookingStore.bookings.filter(
      (booking) => String(booking.status || "").toLowerCase() !== "canceled"
    );

    if (filteredBookings.length > 0) {
      roomName.value = filteredBookings[0].room_name;
    } else {
      const roomData = await roomStore.getById(roomId.value);
      roomName.value = roomData ? roomData.name : "ไม่พบชื่อห้อง";
    }

    const toMs = (v) => {
      if (v == null) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      // ถ้าน้อยกว่า 10^12 ถือว่าเป็นวินาที -> แปลงเป็น ms
      return n < 1000000000000 ? n * 1000 : n;
    };

    events.value = filteredBookings.map((booking) => {
      let backgroundColor = "#04bd35"; // Approved - เขียว
      if (booking.status === "Pending") backgroundColor = "#dbdb02"; // Pending - เหลือง
      if (booking.status === "Finished") backgroundColor = "#6c757d"; // Finished - เทา

      return {
        id: booking.id,
        title: booking.title || "ไม่ระบุหัวข้อ",
        room_name: booking.room_name || "ไม่ระบุห้อง",
        description: booking.description || "ไม่ระบุรายละเอียด",
        start: toMs(booking.start_time),
        end: toMs(booking.end_time),
        first_name: booking.user_name || "ไม่ระบุชื่อ",
        last_name: booking.user_lastname || "ไม่ระบุนามสกุล",
        backgroundColor,
        borderColor: backgroundColor,
        status: booking.status || "Unknown",
      };
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลดข้อมูลการจอง:", error);
  } finally {
    if (silent) {
      isRefreshing.value = false;
    } else {
      loading.value = false;
    }
  }
};

watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      roomId.value = newId;
      await loadBookings();
    }
  }
);

function handleEventClick(info) {
  selectedEvent.value = info.event;
  selectedEventEquipments.value = [];

  // Fetch equipment bookings for Approved and Pending bookings only
  const status = info.event.extendedProps?.status;
  if (status === "Approved" || status === "Pending") {
    fetchEquipmentsForBooking(info.event.id);
  }

  popupVisible.value = true;
}

function closePopup() {
  popupVisible.value = false;
  selectedEventEquipments.value = [];
}

async function fetchEquipmentsForBooking(bookingId) {
  try {
    // Fetch booking equipments
    await equipmentBookingStore.fetchBookingEquipments();

    // Filter equipments for this specific booking
    const bookingEquipments = equipmentBookingStore.booking_equipment.filter(
      (be) => String(be.booking_id) === String(bookingId)
    );

    // Get equipment details for each booking equipment
    const equipmentDetails = [];
    for (const be of bookingEquipments) {
      try {
        const equipment = await equipmentStore.getById(be.equipment_id);
        if (equipment) {
          equipmentDetails.push({
            ...equipment,
            quantity: be.quantity || 1,
            booking_equipment_id: be.id,
          });
        }
      } catch (error) {
        console.error("Error fetching equipment details:", error);
      }
    }

    selectedEventEquipments.value = equipmentDetails;
  } catch (error) {
    console.error("Error fetching booking equipments:", error);
    selectedEventEquipments.value = [];
  }
}

function goToDate() {
  if (searchDate.value && calendarRef.value) {
    const calendarApi = calendarRef.value.getApi();
    calendarApi.gotoDate(searchDate.value);
  }
}

const todayBookings = computed(() => {
  const today = dayjs().startOf("day");
  const tomorrow = today.add(1, "day");
  return events.value.filter(
    (event) =>
      dayjs(event.start).isAfter(today) && dayjs(event.start).isBefore(tomorrow)
  );
});

// Pagination for today's bookings
const todayPage = ref(1);
const todayPageSize = 10;
const todayTotalPages = computed(() =>
  Math.max(1, Math.ceil(todayBookings.value.length / todayPageSize))
);
const todayPageItems = computed(() => {
  const start = (todayPage.value - 1) * todayPageSize;
  return todayBookings.value.slice(start, start + todayPageSize);
});
watch(todayBookings, () => {
  if (todayPage.value > todayTotalPages.value) todayPage.value = 1;
});

const dailyBookings = computed(() => {
  const grouped = {};
  events.value.forEach((event) => {
    const date = dayjs(event.start).startOf("day").format("YYYY-MM-DD");
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(event);
  });
  return grouped;
});

// Show "รวมทั้งหมด" section only if there is at least one Approved booking (case-insensitive)
const hasApprovedBookings = computed(() =>
  events.value.some((e) => String(e.status || "").toLowerCase() === "approved")
);

// Flatten approved bookings for pagination
const allApprovedBookings = computed(() =>
  events.value
    .filter((e) => String(e.status || "").toLowerCase() === "approved")
    .sort((a, b) => (a.start || 0) - (b.start || 0))
);
const allPage = ref(1);
const allPageSize = 10;
const allTotalPages = computed(() =>
  Math.max(1, Math.ceil(allApprovedBookings.value.length / allPageSize))
);
const allPageItems = computed(() => {
  const start = (allPage.value - 1) * allPageSize;
  return allApprovedBookings.value.slice(start, start + allPageSize);
});
watch(allApprovedBookings, () => {
  if (allPage.value > allTotalPages.value) allPage.value = 1;
});

const buildings = ref([]);
const selectedBuildingId = ref("");
const selectedRoomId = ref("");
const filteredRooms = computed(() => {
  const building = buildings.value.find(
    (b) => b.id === selectedBuildingId.value
  );
  return building?.rooms || [];
});

watch(selectedBuildingId, (newVal) => {
  const building = buildings.value.find((b) => b.id === newVal);
  if (building && building.rooms && building.rooms.length > 0) {
    selectedRoomId.value = building.rooms[0].id;
  } else {
    selectedRoomId.value = "";
  }
});

function goToRoomBooking() {
  if (selectedRoomId.value) {
    router.push(`/user/bookings/bookingroom/${selectedRoomId.value}`);
  } else {
    alert("กรุณาเลือกห้อง");
  }
}

// Modal สำหรับสร้างการจองใหม่เมื่อคลิกวันที่ว่าง
const showCreateModal = ref(false);
const selectedDate = ref(null);

function handleDateClick(info) {
  // แปลง dateStr ให้เป็นวันที่เสมอ (รองรับทั้ง day view และ week view)
  const selected = dayjs(info.dateStr).startOf("day");
  const today = dayjs().startOf("day");

  // ป้องกันการจองวันที่ผ่านไปแล้ว (รวมถึงเมื่อวาน)
  if (selected.isBefore(today)) {
    Swal.fire({
      icon: "error",
      title: "ไม่สามารถจองได้",
      text: "ไม่สามารถจองวันที่ผ่านมาแล้ว กรุณาเลือกวันที่ในอนาคต",
      confirmButtonText: "ตกลง",
    });
    return;
  }

  const minDate = today.add(2, "day"); // ต้องจองล่วงหน้า 2 วัน
  if (selected.isBefore(minDate)) {
    Swal.fire({
      icon: "warning",
      title: "โปรดจองล่วงหน้า 2 วัน",
      text: "ไม่สามารถจองห้องในวันที่ท่านเลือกได้ กรุณาเลือกวันที่อื่น",
      confirmButtonText: "ตกลง",
    });
    return;
  }

  // บันทึกเป็นรูปแบบ YYYY-MM-DD เท่านั้น
  selectedDate.value = selected.format("YYYY-MM-DD");
  showCreateModal.value = true;
  console.log("roomId:", roomId.value, "selectedDate:", selectedDate.value);
}

function closeCreateModal() {
  showCreateModal.value = false;
  selectedDate.value = null;
}

// เพิ่ม dateClick ใน calendarOptions
const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: "dayGridMonth",
  locale: thLocale,
  events: events.value,
  eventClick: handleEventClick,
  headerToolbar: {
    start: "prev,next today",
    center: "title",
    end: "dayGridMonth,timeGridWeek", // เพิ่ม timeGridWeek
  },
  height: "auto",
  contentHeight: "auto",
  eventDidMount(info) {
    info.el.style.cursor = "pointer";
    info.el.classList.add(
      `status-${info.event.extendedProps.status.toLowerCase()}`
    );
  },
  eventContent(info) {
    const room = info.event.extendedProps.room_name || "";
    const status = info.event.extendedProps.status || "Unknown";
    let color = "#78f657"; // Approved - เขียว
    if (status === "Pending") color = "#f3f85c"; // Pending - เหลือง
    if (status === "Finished") color = "#a6a6a6"; // Finished - เทา
    if (status === "Canceled") color = "#f06666"; // Canceled - แดง

    const start = dayjs(info.event.start).format("HH.mm");
    const end = dayjs(info.event.end).format("HH.mm");
    const timeText = `${start}-${end}`;
    const displayText = `${timeText} ${room}`;

    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "5px";

    const dot = document.createElement("div");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "50%";
    dot.style.background = color;

    const text = document.createElement("div");
    text.className = "event-time-title";
    text.innerText = displayText;
    text.title = displayText;

    el.appendChild(dot);
    el.appendChild(text);

    return { domNodes: [el] };
  },
  dayMaxEvents: 2,
  dateClick: handleDateClick,
  // ป้องกันการคลิกในวันที่ผ่านไปแล้ว
  selectConstraint: {
    start: dayjs().format("YYYY-MM-DD"),
  },
  // เพิ่ม view options
  views: {
    timeGridWeek: {
      titleFormat: { year: "numeric", month: "long", day: "numeric" },
    },
  },
}));
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading && !isRefreshing" />
  </teleport>
  <div class="app-container">
    <div class="main-content">
      <!-- 🎯 ปฏิทิน -->
      <div class="left-content">
        <div class="header-calendar">
          <div class="header">
            <i class="fa-solid fa-calendar-days" style="font-size: 27px"></i>
            <span>ปฏิทินการจอง</span>
          </div>
          <!-- <div class="room-search">
            <label style="margin-right: 7px; font-weight: bold"
              >เลือกอาคาร:</label
            >
            <el-select
              v-model="selectedBuildingId"
              placeholder="--- กรุณาเลือกอาคาร ---"
              style="width: 200px; margin-right: 10px"
              filterable
              popper-class="custom-el-dropdown"
            >
              <el-option
                v-for="building in buildings"
                :key="building.id"
                :label="building.name"
                :value="building.id"
              />
            </el-select>

            <label style="margin-right: 7px; font-weight: bold"
              >เลือกห้อง:</label
            >
            <el-select
              v-model="selectedRoomId"
              placeholder="--- กรุณาเลือกห้อง ---"
              style="width: 200px; margin-right: 10px"
              :disabled="!selectedBuildingId"
              filterable
              popper-class="custom-el-dropdown"
            >
              <el-option
                v-for="room in filteredRooms"
                :key="room.id"
                :label="room.name"
                :value="room.id"
              />
            </el-select>
            <button
              class="search-button"
              @click="goToRoomBooking"
              :disabled="!selectedRoomId"
            >
              <i class="fa-solid fa-magnifying-glass"></i> ไปยังห้องที่เลือก
            </button>
          </div> -->
        </div>
        <div class="header-calendar">
          <div class="calendar-header-row">
            <div class="header">
              <i class="fa-solid fa-table-list" style="font-size: 27px"></i>
              <span>ห้อง: {{ roomName }}</span>
            </div>
            <div class="calendar-search">
              <label
                for="search-date"
                style="margin-right: 7px; font-weight: bold"
                >ค้นหาวันที่:</label
              >
              <input type="date" v-model="searchDate" class="date-input" />
              <button @click="goToDate" class="search-button">
                <i class="fa-solid fa-magnifying-glass"></i> ไปยังวันที่เลือก
              </button>
            </div>
          </div>
        </div>

        <!-- 📅 ปฏิทิน -->
        <div class="calendar-container">
          <FullCalendar :options="calendarOptions" ref="calendarRef" />
        </div>
      </div>

      <!-- 🧾 ตาราง -->
      <div class="right-content">
        <!-- 📌 วันนี้ -->
        <div class="today-bookings">
          <h2>
            <i class="fa-brands fa-pinterest" style="color: crimson"></i>
            ตารางการจองวันนี้ ({{
              dayjs(date.value).locale("th").format("D MMMM YYYY")
            }})
          </h2>

          <div v-if="todayBookings.length > 0">
            <table
              border="1"
              cellpadding="8"
              cellspacing="0"
              style="width: 100%; margin-bottom: 20px"
            >
              <thead>
                <tr class="header-row">
                  <th>หัวข้อ</th>
                  <th>รายละเอียด</th>
                  <th>เริ่ม</th>
                  <th>สิ้นสุด</th>
                  <th>ผู้จอง</th>
                  <th>ห้องที่จอง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(event, index) in todayPageItems"
                  :key="index"
                  :class="[
                    index % 2 === 0 ? 'row-even' : 'row-odd',
                    event.status === 'Finished' ? 'row-finished' : '',
                  ]"
                >
                  <td>{{ event.title }}</td>
                  <td>{{ event.description }}</td>
                  <td>{{ formatDateTime(event.start) }}</td>
                  <td>{{ formatDateTime(event.end) }}</td>
                  <td>{{ event.first_name }} {{ event.last_name }}</td>
                  <td>{{ event.room_name }}</td>
                  <td>
                    <span
                      :class="[
                        'status-badge',
                        event.status === 'Approved' ? 'status-approved' : '',
                        event.status === 'Pending' ? 'status-pending' : '',
                        event.status === 'Finished' ? 'status-finished' : '',
                      ]"
                    >
                      {{
                        event.status === "Approved"
                          ? "อนุมัติ"
                          : event.status === "Pending"
                          ? "รอการอนุมัติ"
                          : event.status === "Finished"
                          ? "เสร็จสิ้น"
                          : event.status
                      }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="pagination" v-if="todayTotalPages > 1">
              <button
                class="page-btn"
                :disabled="todayPage === 1"
                @click="todayPage = Math.max(1, todayPage - 1)"
              >
                ← กลับ
              </button>
              <span class="page-info"
                >หน้า {{ todayPage }} / {{ todayTotalPages }}</span
              >
              <button
                class="page-btn"
                :disabled="todayPage === todayTotalPages"
                @click="todayPage = Math.min(todayTotalPages, todayPage + 1)"
              >
                ถัดไป →
              </button>
            </div>
          </div>
          <div v-else>ไม่มีการจองในวันนี้</div>
        </div>

        <!-- 📋 รวมทั้งหมด (เฉพาะ Approved) พร้อมแบ่งหน้า -->
        <div class="all-bookings">
          <h2>📋 ตารางรวมการจองทั้งหมด</h2>
          <div v-if="allApprovedBookings.length > 0">
            <table
              border="1"
              cellpadding="8"
              cellspacing="0"
              style="width: 100%; margin-bottom: 20px"
            >
              <thead>
                <tr class="header-row">
                  <th>วันที่</th>
                  <th>หัวข้อ</th>
                  <th>รายละเอียด</th>
                  <th>เริ่ม</th>
                  <th>สิ้นสุด</th>
                  <th>ผู้จอง</th>
                  <th>ห้องที่จอง</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(event, index) in allPageItems"
                  :key="index"
                  :class="[index % 2 === 0 ? 'row-even' : 'row-odd']"
                >
                  <td>
                    {{ dayjs(event.start).locale("th").format("D MMMM YYYY") }}
                  </td>
                  <td>{{ event.title }}</td>
                  <td>{{ event.description }}</td>
                  <td>{{ formatDateTime(event.start) }}</td>
                  <td>{{ formatDateTime(event.end) }}</td>
                  <td>{{ event.first_name }} {{ event.last_name }}</td>
                  <td>{{ event.room_name }}</td>
                </tr>
              </tbody>
            </table>
            <div class="pagination" v-if="allTotalPages > 1">
              <button
                class="page-btn"
                :disabled="allPage === 1"
                @click="allPage = Math.max(1, allPage - 1)"
              >
                ← กลับ
              </button>
              <span class="page-info"
                >หน้า {{ allPage }} / {{ allTotalPages }}</span
              >
              <button
                class="page-btn"
                :disabled="allPage === allTotalPages"
                @click="allPage = Math.min(allTotalPages, allPage + 1)"
              >
                ถัดไป →
              </button>
            </div>
          </div>
          <div v-else>ไม่มีข้อมูลการจอง</div>
        </div>
      </div>
    </div>

    <!-- 🔥 Popup Event -->
    <teleport to="body">
      <div v-if="popupVisible" class="popup-wrapper">
        <div class="popup-content">
          <div class="popup-header">
            <i class="fa-brands fa-pinterest" style="color: crimson"></i>
            {{ selectedEvent?.title }}
          </div>
          <div class="popup-body">
            <p>
              <strong>รายละเอียด:</strong>
              {{ selectedEvent?.extendedProps?.description }}
            </p>
            <p>
              <strong>เริ่ม:</strong> {{ formatDateTime(selectedEvent?.start) }}
            </p>
            <p>
              <strong>สิ้นสุด:</strong> {{ formatDateTime(selectedEvent?.end) }}
            </p>
            <p>
              <strong>ผู้จอง:</strong>
              {{ selectedEvent?.extendedProps?.first_name }}
              {{ selectedEvent?.extendedProps?.last_name }}
            </p>
            <p>
              <strong>ห้องที่จอง:</strong>
              {{ selectedEvent?.extendedProps?.room_name }}
            </p>
            <p>
              <strong>สถานะ:</strong>
              <span
                :class="[
                  'status-badge',
                  selectedEvent?.extendedProps?.status === 'Approved'
                    ? 'status-approved'
                    : '',
                  selectedEvent?.extendedProps?.status === 'Pending'
                    ? 'status-pending'
                    : '',
                  selectedEvent?.extendedProps?.status === 'Finished'
                    ? 'status-finished'
                    : '',
                ]"
              >
                {{
                  selectedEvent?.extendedProps?.status === "Approved"
                    ? "อนุมัติ"
                    : selectedEvent?.extendedProps?.status === "Pending"
                    ? "รอการอนุมัติ"
                    : selectedEvent?.extendedProps?.status === "Finished"
                    ? "เสร็จสิ้น"
                    : selectedEvent?.extendedProps?.status
                }}
              </span>
            </p>

            <!-- แสดงอุปกรณ์ที่จอง (เฉพาะ Approved และ Pending) -->
            <div
              v-if="
                selectedEvent?.extendedProps?.status === 'Approved' ||
                selectedEvent?.extendedProps?.status === 'Pending'
              "
              class="equipment-section"
            >
              <p><strong>อุปกรณ์ที่จอง:</strong></p>
              <div
                v-if="selectedEventEquipments.length > 0"
                class="equipment-list"
              >
                <div
                  v-for="equipment in selectedEventEquipments"
                  :key="equipment.id"
                  class="equipment-item"
                >
                  <div class="equipment-image">
                    <img
                      :src="
                        equipment.image_url || '/images/default-picture.png'
                      "
                      :alt="equipment.name"
                      @error="$event.target.src = '/images/default-picture.png'"
                    />
                  </div>
                  <div class="equipment-details">
                    <span class="equipment-name">{{ equipment.name }}</span>
                  </div>
                  <span class="equipment-quantity"
                    >จำนวน: {{ equipment.quantity }}</span
                  >
                </div>
              </div>
              <div v-else class="no-equipment">ไม่มีการจองอุปกรณ์</div>
            </div>
          </div>
          <div class="popup-footer">
            <button @click="closePopup">ปิด</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 🔥 Modal สร้างการจองใหม่เมื่อคลิกวันที่ว่าง -->
    <teleport to="body">
      <div v-if="showCreateModal" class="popup-wrapper">
        <div class="popup-content">
          <div class="popup-header">
            <i class="fa-solid fa-calendar-plus" style="color: #2196f3"></i>
            สร้างการจองใหม่
          </div>
          <div class="popup-body">
            <p>
              วันที่ที่เลือก: <b>{{ selectedDate }}</b>
            </p>
            <button
              class="booking-button"
              @click="
                () => {
                  console.log(
                    'router.push',
                    `/user/bookings/createBooking/${roomId}?date=${selectedDate}`
                  );
                  router.push(
                    `/user/bookings/createBooking/${roomId}?date=${selectedDate}`
                  );
                }
              "
            >
              จองวันที่
              <b>{{
                dayjs(selectedDate).locale("th").format("D MMMM YYYY")
              }}</b>
            </button>
          </div>
          <div class="popup-footer">
            <button @click="closeCreateModal">ปิด</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-wrap: wrap;
  background: #f5f5f5;
  min-height: 100vh;
}

.main-content {
  display: flex;
  flex: 1;
  min-height: 100vh;
  transition: margin-left 0.5s ease;
  gap: 20px;
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

h2 {
  font-size: 20px;
  font-weight: 700;
  color: #2d2d2d;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.left-content {
  width: 66.666%;
  padding: 30px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  border: 2px solid #e0e0e0;
}

.right-content {
  width: 33.333%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ปรับขนาด header */
.header {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 20px;
  margin-left: 0;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sub-header {
  font-size: 1.125rem;
  font-weight: bold;
  margin-bottom: 16px;
}

.header-calendar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.room-search {
  display: flex;
  align-items: center;
  gap: 12px;
}

.calendar-container {
  background-color: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.calendar-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.date-input {
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.date-input:focus {
  outline: none;
  border-color: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

.search-button {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.search-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}

.search-button:disabled {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.scroll-select {
  max-height: 180px;
  overflow-y: auto;
}

.popup-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 500;
  animation: fadeIn 0.2s ease-in-out;
  overflow-y: auto;
  padding: 40px 20px;
  box-sizing: border-box;
}

.popup-content {
  background: white;
  padding: 32px;
  border-radius: 16px;
  width: 100%;
  max-width: 550px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: scaleIn 0.25s ease;
  position: relative;
  margin: auto;
  border: 2px solid #e0e0e0;
}

.popup-header {
  font-size: 24px;
  font-weight: 700;
  color: #2d2d2d;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.popup-body {
  font-size: 15px;
  color: #333;
  margin-bottom: 24px;
  line-height: 1.8;
}

.popup-body p {
  margin: 12px 0;
}

.popup-body strong {
  color: #2d2d2d;
  font-weight: 700;
}

.popup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.popup-footer button {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.2);
}

.popup-footer button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
}

.header-row {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  font-weight: 600;
  color: #ffffff;
}

.today-bookings table,
.all-bookings table {
  border-collapse: collapse;
  width: 100%;
}

.today-bookings th,
.today-bookings td,
.all-bookings th,
.all-bookings td {
  padding: 12px;
  text-align: left;
  border: 1px solid #e0e0e0;
}

.today-bookings tbody tr,
.all-bookings tbody tr {
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease-in-out;
}

.today-bookings tbody tr:hover,
.all-bookings tbody tr:hover {
  background-color: #f8f9fa !important;
}

.today-bookings {
  border-radius: 12px;
  background-color: #ffffff;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  width: 100%;
}

.all-bookings {
  border-radius: 12px;
  background-color: #ffffff;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  width: 100%;
}

@keyframes fadeIn {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

.row-even {
  background-color: #f4f7fb;
}

.row-odd {
  background-color: #e3e6f0;
}

.row-finished {
  background-color: #f8f9fa !important;
  color: #6c757d;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
  transition: all 0.3s ease;
}

.status-approved {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  color: #155724;
  border: 1px solid #b1dfbb;
}

.status-pending {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  color: #856404;
  border: 1px solid #ffd93d;
}

.status-finished {
  background: linear-gradient(135deg, #e2e3e5 0%, #d6d8db 100%);
  color: #6c757d;
  border: 1px solid #ced4da;
}

.booking-button {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border: none;
  color: white;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  margin-right: 10px;
  margin-top: 5px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
  display: inline-block;
}

.booking-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 16px 0 8px;
}

.page-btn {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 2px 6px rgba(45, 45, 45, 0.2);
}

.page-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(45, 45, 45, 0.3);
}

.page-btn:disabled {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  box-shadow: none;
}

.page-info {
  font-weight: 700;
  color: #2d2d2d;
  font-size: 14px;
}

.fc {
  background-color: #fffbfb;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  padding: 5px;
  border: 1px solid #ccc;
}

.calendar-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.calendar-search {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.date-input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

/* hover ของstatus ที่ขึ้นในหน้าปฏิทิน */
::v-deep(.status-pending:hover) {
  background-color: #f0e68c !important;
  transition: background-color 0.3s ease;
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

::v-deep(.status-approved:hover) {
  background-color: #90ee90 !important;
  transition: background-color 0.3s ease;
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

::v-deep(.status-finished:hover) {
  background-color: #d3d3d3 !important;
  transition: background-color 0.3s ease;
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

::v-deep(.fc-button-group) {
  gap: 0.5em;
}

::v-deep(.fc-prev-button),
::v-deep(.fc-next-button) {
  border-radius: 50% !important;
}

::v-deep(.fc-prev-button):hover,
::v-deep(.fc-next-button):hover {
  background-color: #5a5959 !important;
  transition: background-color 0.3s ease;
}

::v-deep(.fc-button) {
  background-color: #13131f !important;
}

/* ป้องกันการคลิกในวันที่ผ่านไปแล้ว */
::v-deep(.fc-day-past) {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  cursor: not-allowed !important;
}

::v-deep(.fc-day-past:hover) {
  background-color: #f8f9fa !important;
  cursor: not-allowed !important;
}

/* Hover เฉพาะวันที่ว่าง (ไม่มี event) และไม่ใช่วันที่ผ่านไปแล้ว */
::v-deep(.fc-daygrid-day:not(.fc-day-today):not(.fc-day-past):hover) {
  background: #9adce424 !important;
  cursor: pointer;
  transition: background 0.2s;
}

/* ถ้าอยากให้วันที่วันนี้ (today) ไม่เปลี่ยนสี */
::v-deep(.fc-day-today:hover) {
  background: #fffde7 !important;
}

/* Responsive: ปรับการแสดงผลเมื่อหน้าจอเล็กลง */
@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }

  .main-content {
    flex-direction: column;
    margin-left: 0;
  }

  .left-content {
    width: 100%;
    padding: 15px;
  }

  .right-content {
    width: 100%;
    padding: 15px;
    max-height: none;
  }

  .header {
    font-size: 24px;
  }

  .sub-header {
    font-size: 1rem;
  }

  .search-button {
    width: 100%;
    margin-top: 10px;
  }

  .booking-button {
    width: 100%;
    margin-top: 10px;
  }

  .popup-wrapper {
    padding: 20px 10px;
    align-items: flex-start;
    padding-top: 40px;
  }

  .popup-content {
    max-width: 100%;
    max-height: calc(100vh - 60px);
    margin: 0;
    padding: 20px;
  }

  .equipment-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .equipment-image {
    align-self: center;
  }

  .equipment-details {
    text-align: center;
    width: 100%;
  }

  .equipment-quantity {
    align-self: center;
  }
}

/* Equipment section styles */
.equipment-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.equipment-list {
  margin-top: 8px;
}

.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin: 8px 0;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #13131f;
  gap: 12px;
}

.equipment-image {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.equipment-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.equipment-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equipment-name {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.equipment-description {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.equipment-quantity {
  font-size: 14px;
  color: #6b7280;
  background-color: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
}

.no-equipment {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #f3f4f6;
  border-radius: 6px;
  color: #6b7280;
  font-style: italic;
  text-align: center;
}

/* สำคัญ! บังคับ parent ทุกชั้นไม่ให้ขยาย */
::v-deep(.fc-daygrid-day-frame),
::v-deep(.fc-daygrid-event-harness),
::v-deep(.fc-daygrid-event),
::v-deep(.fc-daygrid-event-content) {
  min-width: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  transition: all 0.3s ease !important;
}

::v-deep(.event-time-title) {
  display: block;
  width: 100%;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
</style>
