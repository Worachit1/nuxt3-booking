<script setup>
import { ref, computed, watch, onMounted } from "vue";
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

const { isLoading } = storeToRefs(buildingStore, bookingStore);

const roomName = ref("");
const events = ref([]);
const calendarRef = ref(null);
const popupVisible = ref(false);
const selectedEvent = ref(null);
const searchDate = ref(null);
const loading = ref(false);

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
    await loadBookings();
  }
});

const loadBookings = async () => {
  if (!roomId.value) return;
  loading.value = true;

  try {
    await bookingStore.fetchBookingByRoomId(roomId.value);

    // แสดงการจองทั้งหมด รวมถึง Finished แต่ไม่รวม Canceled
    const filteredBookings = bookingStore.bookings.filter(
      (booking) => booking.status !== "Canceled"
    );

    if (filteredBookings.length > 0) {
      roomName.value = filteredBookings[0].room_name;
    } else {
      const roomData = await roomStore.getById(roomId.value);
      roomName.value = roomData ? roomData.name : "ไม่พบชื่อห้อง";
    }

    events.value = filteredBookings.map((booking) => {
      let backgroundColor = "#04bd35"; // Approved - เขียว
      if (booking.status === "Pending") backgroundColor = "#dbdb02"; // Pending - เหลือง
      if (booking.status === "Finished") backgroundColor = "#6c757d"; // Finished - เทา

      return {
        id: booking.id,
        title: booking.title || "ไม่ระบุหัวข้อ",
        room_name: booking.room_name || "ไม่ระบุห้อง",
        description: booking.description || "ไม่ระบุรายละเอียด",
        start: booking.start_time * 1000,
        end: booking.end_time * 1000,
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
    loading.value = false;
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
  popupVisible.value = true;
}

function closePopup() {
  popupVisible.value = false;
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
      dayjs(event.start).isAfter(today) &&
      dayjs(event.start).isBefore(tomorrow)
  );
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

  selectedDate.value = info.dateStr;
  showCreateModal.value = true;
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
    start: dayjs().format('YYYY-MM-DD'),
  },
  // เพิ่ม view options
  views: {
    timeGridWeek: {
      titleFormat: { year: 'numeric', month: 'long', day: 'numeric' }
    }
  }
}));
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
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
          <div class="room-search">
            <label style="margin-right: 7px; font-weight: bold">เลือกอาคาร:</label>
            <el-select v-model="selectedBuildingId" placeholder="--- กรุณาเลือกอาคาร ---"
              style="width: 200px; margin-right: 10px" filterable popper-class="custom-el-dropdown">
              <el-option v-for="building in buildings" :key="building.id" :label="building.name" :value="building.id" />
            </el-select>

            <label style="margin-right: 7px; font-weight: bold">เลือกห้อง:</label>
            <el-select v-model="selectedRoomId" placeholder="--- กรุณาเลือกห้อง ---"
              style="width: 200px; margin-right: 10px" :disabled="!selectedBuildingId" filterable
              popper-class="custom-el-dropdown">
              <el-option v-for="room in filteredRooms" :key="room.id" :label="room.name" :value="room.id" />
            </el-select>
            <button class="search-button" @click="goToRoomBooking" :disabled="!selectedRoomId">
              <i class="fa-solid fa-magnifying-glass"></i> ไปยังห้องที่เลือก
            </button>
          </div>
        </div>
        <div class="header-calendar">
          <div class="calendar-header-row">
            <div class="header">
              <i class="fa-solid fa-table-list" style="font-size: 27px"></i>
              <span>ห้อง: {{ roomName }}</span>
            </div>
            <div class="calendar-search">
              <label for="search-date" style="margin-right: 7px; font-weight: bold">ค้นหาวันที่:</label>
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
            <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; margin-bottom: 20px">
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
                <tr v-for="(event, index) in todayBookings" :key="index" :class="[
                  index % 2 === 0 ? 'row-even' : 'row-odd',
                  event.status === 'Finished' ? 'row-finished' : ''
                ]">
                  <td>{{ event.title }}</td>
                  <td>{{ event.description }}</td>
                  <td>{{ formatDateTime(event.start) }}</td>
                  <td>{{ formatDateTime(event.end) }}</td>
                  <td>{{ event.first_name }} {{ event.last_name }}</td>
                  <td>{{ event.room_name }}</td>
                  <td>
                    <span :class="[
                      'status-badge',
                      event.status === 'Approved' ? 'status-approved' : '',
                      event.status === 'Pending' ? 'status-pending' : '',
                      event.status === 'Finished' ? 'status-finished' : ''
                    ]">
                      {{
                        event.status === 'Approved' ? 'อนุมัติ' :
                          event.status === 'Pending' ? 'รอการอนุมัติ' :
                            event.status === 'Finished' ? 'เสร็จสิ้น' :
                              event.status
                      }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else>ไม่มีการจองในวันนี้</div>
        </div>

        <!-- 📋 รวมทั้งหมด -->
        <div class="all-bookings">
          <h2>📋 ตารางรวมการจองทั้งหมด</h2>

          <!-- ตรวจสอบว่ามีข้อมูล approved อย่างน้อย 1 รายการในทุกวันรวมกัน -->
          <div v-if="hasApprovedBookings">
            <div v-for="(events, date) in dailyBookings" :key="date">
              <!-- กรองเฉพาะที่ Approved -->
              <template v-if="events.filter(e => e.status === 'Approved').length > 0">
                <h3>
                  {{ dayjs(date, "YYYY-MM-DD").locale("th").format("D MMMM YYYY") }}
                </h3>
                <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; margin-bottom: 20px">
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
                    <tr v-for="(event, index) in events.filter(e => e.status === 'Approved')" :key="index"
                      :class="[index % 2 === 0 ? 'row-even' : 'row-odd']">
                      <td>{{ event.title }}</td>
                      <td>{{ event.description }}</td>
                      <td>{{ formatDateTime(event.start) }}</td>
                      <td>{{ formatDateTime(event.end) }}</td>
                      <td>{{ event.first_name }} {{ event.last_name }}</td>
                      <td>{{ event.room_name }}</td>
                      <td>
                        <span class="status-badge status-approved">อนุมัติ</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
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
              <span :class="[
                'status-badge',
                selectedEvent?.extendedProps?.status === 'Approved' ? 'status-approved' : '',
                selectedEvent?.extendedProps?.status === 'Pending' ? 'status-pending' : '',
                selectedEvent?.extendedProps?.status === 'Finished' ? 'status-finished' : ''
              ]">
                {{
                  selectedEvent?.extendedProps?.status === 'Approved' ? 'อนุมัติ' :
                    selectedEvent?.extendedProps?.status === 'Pending' ? 'รอการอนุมัติ' :
                      selectedEvent?.extendedProps?.status === 'Finished' ? 'เสร็จสิ้น' :
                        selectedEvent?.extendedProps?.status
                }}
              </span>
            </p>
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
            <p>วันที่ที่เลือก: <b>{{ selectedDate }}</b></p>
            <button class="booking-button"
              @click="router.push(`/user/bookings/createBooking/${roomId}?date=${selectedDate}`)">
              จองวันที่
              <b>{{ dayjs(selectedDate).locale("th").format("D MMMM YYYY") }}</b>
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
}

.main-content {
  display: flex;
  flex: 1;
  min-height: 100vh;
  transition: margin-left 0.5s ease;
}

h2 {
  text-decoration: underline;
}

.left-content {
  width: 66.666%;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  margin-top: 20px;
}

.right-content {
  width: 33.333%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px;
}

/* ปรับขนาด header */
.header {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  margin-left: 15px;
  text-decoration: underline;
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.room-search {
  display: flex;
  align-items: center;
}

.calendar-container {
  background-color: whitesmoke;
  border-radius: 8px;
  overflow: hidden;
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
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.search-button {
  background-color: #13131f;
  color: white;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
  transition: background-color 0.3s ease;
}

.search-button:hover {
  background-color: #4a4a4a;
  transition: background-color 0.3s ease;
}

.scroll-select {
  max-height: 180px;
  overflow-y: auto;
}

.popup-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 500;
  animation: fadeIn 0.2s ease-in-out;
}

.popup-content {
  background: white;
  padding: 24px;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  animation: scaleIn 0.25s ease;
  max-height: 90vh;
  overflow-y: auto;
  font-weight: 600;
}

.popup-header {
  font-size: 22px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.popup-body {
  font-size: 16px;
  color: #374151;
  margin-bottom: 24px;
  line-height: 1.6;
}

.popup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.popup-footer button {
  background-color: #dbdb02;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.popup-footer button:hover {
  background-color: #f0e68c;
  transition: background-color 0.3s ease;
}

.header-row {
  background-color: #191925;
  font-weight: bold;
  color: #ffffff;
}

.today-bookings {
  border-radius: 5px;
  background-color: #f9f9f9;
  padding: 10px;
  margin-bottom: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  font-size: 10px;
  width: 100%;
}

.all-bookings {
  border-radius: 5px;
  background-color: #f9f9f9;
  padding: 10px;
  margin-bottom: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  font-size: 10px;
  width: 100%;
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
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status-approved {
  background-color: #d4edda;
  color: #155724;
}

.status-pending {
  background-color: #fff3cd;
  color: #856404;
}

.status-finished {
  background-color: #e2e3e5;
  color: #6c757d;
}

.booking-button {
  background-color: #13131f;
  border: #000 solid 1px;
  color: white;
  padding: 10px 20px;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  margin-top: 5px;
  cursor: pointer;
}

.booking-button:hover {
  background-color: #4a4a4a;
  transition: background-color 0.3s ease;
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