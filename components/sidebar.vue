<script setup>
import { onMounted, ref, computed, defineProps, defineEmits } from "vue";
import { useBuildingStore } from "@/store/buildingStore";
import { useUserStore } from "@/store/userStore";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const userId = route.params.id || localStorage.getItem("user_id");
const userRole =
  route.params.role_name ??
  localStorage.getItem("user_role_name") ??
  "default_role";

const props = defineProps({
  isSidebarOpen: Boolean,
});
const emit = defineEmits(["toggleSidebar"]);

const buildingStore = useBuildingStore();
const userStore = useUserStore();

const buildings = computed(() => buildingStore.buildings);
const currentUser = computed(() => userStore.currentUser);
const isAdmin = computed(() => currentUser.value?.role_name === "Admin");

const isRoomDropdownOpen = ref(false);
const openBuildingId = ref(null);
const openRoomName = ref(null); // เปลี่ยนจาก id เป็นชื่อห้อง

const toggleSidebar = () => {
  emit("toggleSidebar");
};

// คืน array ของชื่อห้องจากแต่ละ building
const filteredRooms = (building) => {
  return building.rooms_name || [];
};
const toggleRoom = (roomName) => {
  openRoomName.value = openRoomName.value === roomName ? null : roomName;
};

const getRoomName = (room) => room?.name ?? String(room ?? "");
const getRoomId = (room) => room?.id ?? room?.room_id ?? room?.value ?? null;
const goToRoom = (room) => {
  const id = getRoomId(room);
  if (id != null) {
    router.push(`/user/bookings/bookingroom/${id}`);
  }
};
onMounted(async () => {
  await buildingStore.fetchBuildings();

  if (userId) {
    await userStore.getUserById(userId);
  }
});

// Tooltip เพื่อแสดงข้อความเมื่อ hover
const tooltipText = ref("");
const tooltipVisible = ref(false);
const tooltipX = ref(0);
const tooltipY = ref(0);
let tooltipTimeout = null;

function showTooltip(text, event) {
  clearTimeout(tooltipTimeout);
  tooltipTimeout = setTimeout(() => {
    tooltipText.value = text;
    tooltipVisible.value = true;
    tooltipX.value = event.clientX + 10;
    tooltipY.value = event.clientY + 10;
  }, 300); // ดีเลย์ 300ms
}
function hideTooltip() {
  clearTimeout(tooltipTimeout);
  tooltipVisible.value = false;
}
</script>

<template>
  <div :class="['sidebar', { open: props.isSidebarOpen }]">
    <button @click="toggleSidebar" class="toggle-btn">
      <i
        v-if="!props.isSidebarOpen"
        class="fa-solid fa-bars"
        style="font-size: 24px; color: whitesmoke"
      ></i>
      <i
        v-else
        class="fa-solid fa-backward"
        style="font-size: 24px; color: whitesmoke"
      ></i>
    </button>

    <div v-if="props.isSidebarOpen" class="sidebar-content">
      <!-- โลโก้ -->
      <div>
        <router-link to="/" class="home-link-header">
          <img
            src="/images/logo_sidebar.png"
            alt="menu"
            style="
              width: 100px;
              height: 100px;
              object-fit: contain;
              margin-top: -15%;
            "
          />
          <span style="font-size: 16px">BOOKING ROOM</span>
        </router-link>
      </div>
      <br />

      <!-- หน้าหลัก -->
      <router-link to="/" class="home-link" exact-active-class="active-link">
        <i class="fas fa-home"></i> หน้าหลัก
      </router-link>

      <!-- เลือกห้อง Dropdown -->
      <!-- <div
        class="home-link"
        @click="isRoomDropdownOpen = !isRoomDropdownOpen"
        style="cursor: pointer"
      >
        <i class="fas fa-map-pin"></i> เลือกห้อง
        <i
          :class="
            isRoomDropdownOpen
              ? 'fas fa-chevron-up ml-2'
              : 'fas fa-chevron-down ml-2'
          "
        ></i>
      </div> -->

      <!-- รายการอาคาร -->
      <ul v-if="isRoomDropdownOpen" class="dropdown-list">
        <li v-for="b in buildings" :key="b.id" class="dropdown-item">
          <div
            class="building-name"
            @click="openBuildingId = openBuildingId === b.id ? null : b.id"
            @mouseenter="showTooltip(b.name, $event)"
            @mouseleave="hideTooltip"
            @mousemove="showTooltip(b.name, $event)"
          >
            <i class="fa-solid fa-building"></i> {{ b.name }}
            <i
              :class="
                openBuildingId === b.id
                  ? 'fas fa-chevron-up'
                  : 'fas fa-chevron-down'
              "
            ></i>
          </div>
          <!-- รายการห้องในอาคาร -->
          <ul v-if="openBuildingId === b.id" class="dropdown-sub">
            <li
              v-for="room in b.rooms_name || b.rooms || []"
              :key="getRoomId(room) ?? getRoomName(room)"
              class="dropdown-sub-item"
            >
              <div class="room-row">
                <router-link
                  :to="`/user/bookings/bookingroom/${getRoomId(room)}`"
                  class="room-link"
                  style="cursor: pointer"
                  @mouseenter="showTooltip(getRoomName(room), $event)"
                  @mouseleave="hideTooltip"
                  @mousemove="showTooltip(getRoomName(room), $event)"
                  v-if="getRoomId(room) != null"
                >
                  <i class="fa-solid fa-archway"></i> {{ getRoomName(room) }}
                </router-link>
                <span
                  v-else
                  class="room-link"
                  style="cursor: not-allowed; opacity: 0.6"
                  @mouseenter="showTooltip(getRoomName(room), $event)"
                  @mouseleave="hideTooltip"
                  @mousemove="showTooltip(getRoomName(room), $event)"
                >
                  <i class="fa-solid fa-archway"></i> {{ getRoomName(room) }}
                </span>
                <button
                  class="chevron-btn"
                  @click.stop="toggleRoom(getRoomName(room))"
                  :aria-expanded="openRoomName === getRoomName(room)"
                  :title="openRoomName === getRoomName(room) ? 'ยุบ' : 'ขยาย'"
                >
                  <i
                    :class="
                      openRoomName === getRoomName(room)
                        ? 'fas fa-chevron-up ml-1'
                        : 'fas fa-chevron-down ml-1'
                    "
                  ></i>
                </button>
              </div>

              <!-- ชั้นสอง: รายการภายใต้ห้องนั้น -->
              <ul
                v-if="openRoomName === getRoomName(room)"
                class="dropdown-sub-sub"
              >
                <li>
                  <router-link
                    :to="`/user/bookings/bookingroom/${getRoomId(room)}`"
                    class="dropdown-sub-item"
                    exact-active-class="active-link"
                    style="font-size: 12px"
                  >
                    รายการจอง
                  </router-link>
                </li>
                <li>
                  <router-link
                    :to="`/user/bookings/detailroom/${getRoomId(room)}`"
                    class="dropdown-sub-item"
                    exact-active-class="active-link"
                    style="font-size: 12px"
                  >
                    รายละเอียดห้อง
                  </router-link>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>

      <!-- เฉพาะ Admin เท่านั้น -->
      <div v-if="isAdmin">
        <div class="menu-section-title">
          <i class="fa-solid fa-user-shield"></i> เมนูผู้ดูแลระบบ
        </div>

        <router-link
          to="/admin/dashboard"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-chart-line"></i> Dashboard
        </router-link>

        <router-link
          to="/admin/bookings"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fas fa-receipt"></i> รายการจองห้อง
        </router-link>

        <router-link
          to="/admin/roomStatistics"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-chart-simple"></i> สถิติห้องประชุม
        </router-link>

        <router-link
          to="/admin/buildings"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-building"></i> จัดการอาคาร
        </router-link>

        <router-link
          to="/admin/rooms"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-door-open"></i> จัดการห้อง
        </router-link>

        <router-link
          to="/admin/equipment"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-wrench"></i> จัดการอุปกรณ์เสริม
        </router-link>

        <router-link
          to="/admin/reviews"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-star"></i> รายการรีวิวห้อง
        </router-link>

        <router-link
          to="/admin/reports"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-flag"></i> จัดการแจ้งรายงานปัญหา
        </router-link>
      </div>

      <!-- เมนูผู้ใช้ทั่วไป -->
      <div class="menu-section-title">
        <i class="fa-solid fa-user"></i> เมนูผู้ใช้
      </div>

      <router-link
        :to="`/user/equipment`"
        class="home-link"
        exact-active-class="active-link"
      >
        <i class="fa-solid fa-toolbox"></i> อุปกรณ์เสริม
      </router-link>

      <router-link
        :to="`/user/bookings/history/${userId}`"
        class="home-link"
        exact-active-class="active-link"
      >
        <i class="fas fa-history"></i> ประวัติการจอง
      </router-link>

      <router-link
        :to="`/user/reports`"
        class="home-link"
        exact-active-class="active-link"
      >
        <i class="fa-solid fa-circle-info"></i> แจ้งการรายงานห้อง
      </router-link>
    </div>
    <!-- Custom Tooltip Modal -->
    <div
      v-if="tooltipVisible"
      class="custom-tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 200px;
  background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 1000;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.7);
  border-right: 1px solid #404040;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-content {
  padding: 20px;
  padding-top: 55px;
  max-height: 100vh;
  overflow-y: auto;
}

.toggle-btn {
  position: absolute;
  top: 20px;
  left: 210px;
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border: none;
  padding: 10px;
  cursor: pointer;
  border-radius: 10px;
  z-index: 1100;
  margin-top: 20%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
}

.toggle-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.9);
}

.home-link-header {
  display: block;
  margin-top: 25px;
  text-decoration: none;
  color: #b0b0b0;
  font-weight: 600;
}

.home-link-header:hover {
  color: #ffffff;
}

.home-link {
  display: block;
  margin-top: 20px;
  text-decoration: none;
  color: #b0b0b0;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.home-link:hover {
  background-color: rgba(80, 80, 80, 0.5);
  transform: translateX(5px);
  color: #ffffff;
}

.active-link {
  background-color: rgba(80, 80, 80, 0.7) !important;
  color: #ffffff !important;
  font-weight: 600;
}

.dropdown-list {
  list-style: none;
  padding-left: 20px;
  margin-top: 5px;
  text-decoration: none;
  animation: fadeIn 0.2s ease-in-out;
}

.dropdown-item {
  margin: 5px 0;
  color: #b0b0b0;
  font-size: 16px;
  cursor: pointer;
  transition: 0.2s;
  text-decoration: none;
}

.dropdown-sub-item:hover,
.room-link:hover,
.building-name:hover {
  text-decoration: none;
  background: rgba(80, 80, 80, 0.5);
  border-radius: 5px;
  transition: all 0.2s ease;
  color: #ffffff;
}

.dropdown-sub-item:active,
.room-link:active,
.home-link:active,
.building-name:active {
  color: #ffffff;
  background-color: rgba(80, 80, 80, 0.7);
  transition: background-color 0.2s ease;
}
.building-name,
.room-link {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px; /* ปรับตามความกว้าง sidebar */
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
}

.dropdown-sub {
  list-style: none;
  padding-left: 15px;
  margin-top: 5px;
}

.dropdown-sub-item {
  font-size: 16px;
  color: #909090;
  margin-top: 4px;
  cursor: pointer;
  transition: 0.2s;
  text-decoration: none;
}

.room-link {
  text-decoration: none;
  color: #909090;
  font-size: 14px;
  margin-right: 20px;
}

/* Menu Section Title */
.menu-section-title {
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  margin-top: 25px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: rgba(80, 80, 80, 0.4);
  border-radius: 8px;
  border-left: 4px solid #667eea;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-section-title i {
  font-size: 16px;
}

/* Custom Tooltip Modal */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: #e0e0e0;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  pointer-events: none;
  white-space: nowrap;
  max-width: 400px;
  overflow-x: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  border: 1px solid #404040;
}
</style>
