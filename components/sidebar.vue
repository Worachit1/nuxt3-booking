<script setup>
import { onMounted, ref, computed, defineProps, defineEmits } from "vue";
import { useBuildingStore } from "@/store/buildingStore";
import { useUserStore } from "@/store/userStore";
import { useRoute } from "vue-router";

const route = useRoute();
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
            src="/public/images/logo_sidebar.png"
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
      <div
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
      </div>

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
              v-for="room in b.rooms_name"
              :key="room.id"
              class="dropdown-sub-item"
            >
              <div
                @click="
                  openRoomName = openRoomName === room.name ? null : room.name
                "
                class="room-link"
                style="cursor: pointer"
                @mouseenter="showTooltip(room.name, $event)"
                @mouseleave="hideTooltip"
                @mousemove="showTooltip(room.name, $event)"
              >
                <i class="fa-solid fa-archway"></i> {{ room.name }}
                <i
                  :class="
                    openRoomName === room.name
                      ? 'fas fa-chevron-up ml-1'
                      : 'fas fa-chevron-down ml-1'
                  "
                ></i>
              </div>

              <!-- ชั้นสอง: รายการภายใต้ห้องนั้น -->
              <ul v-if="openRoomName === room.name" class="dropdown-sub-sub">
                <li>
                  <router-link
                    :to="`/user/bookings/bookingroom/${room.id}`"
                    class="dropdown-sub-item"
                    exact-active-class="active-link"
                    style="font-size: 12px"
                  >
                    รายการจอง
                  </router-link>
                </li>
                <li>
                  <router-link
                    :to="`/user/bookings/detailroom/${room.id}`"
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

      <router-link
        to="/user/bookings/createBooking"
        class="home-link"
        exact-active-class="active-link"
      >
        <i class="fas fa-edit"></i> จองห้องประชุม
      </router-link>

      <!-- เฉพาะ Admin เท่านั้น -->
      <div v-if="isAdmin">
        <router-link
          to="/admin/buildings"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-pen-nib"></i> จัดการอาคาร
        </router-link>
        <router-link
          to="/admin/rooms"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fa-solid fa-pen-nib"></i> จัดการห้อง
        </router-link>
        <router-link
          to="/admin/bookings"
          class="home-link"
          exact-active-class="active-link"
        >
          <i class="fas fa-receipt"></i> รายการจองห้อง
        </router-link>
      </div>

      <!-- ประวัติการจอง (ทุกคนเห็นได้) -->
      <router-link
        :to="`/user/bookings/history/${userId}`"
        class="home-link"
        exact-active-class="active-link"
      >
        <i class="fas fa-history"></i> ประวัติการจอง
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
  background-color: #13131f;
  height: 150vh;
  position: fixed;
  left: 0;
  top: 10px;
  transform: translateX(-100%);
  transition: transform 0.85s ease;
  z-index: 1000;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.sidebar.open {
  transform: translateX(0);
}
.sidebar-content {
  padding: 20px;
  max-height: calc(100vh - 40px); /* ปรับตาม header/sidebar */
  overflow-y: auto;
}

.toggle-btn {
  position: absolute;
  top: 20px;
  left: 210px;
  background-color: #13131f;
  border: none;
  padding: 10px;
  cursor: pointer;
  border-radius: 50px;
  z-index: 1100;
  margin-top: 20%;
}

.toggle-btn:hover {
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

.sidebar-content {
  padding: 20px;
}

.home-link-header {
  display: block;
  margin-top: 25px;
  text-decoration: none;
  color: #ffffff;
  font-weight: bold;
}

.home-link-header:hover {
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

.home-link {
  display: block;
  margin-top: 20px;
  text-decoration: none;
  color: #ffffff;
  font-weight: bold;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.3s ease;
}

.home-link:hover {
  background-color: #444466;
}

.active-link {
  background-color: whitesmoke !important;
  color: #13131f !important;
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
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: 0.2s;
  text-decoration: none;
  animation: scaleIn 0.25s ease;
}

.dropdown-sub-item:hover,
.room-link:hover,
.home-link:hover,
.building-name:hover {
  text-decoration: none;
  background: #e4e1e151;
  border-radius: 5px;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.dropdown-sub-item:active,
.room-link:active,
.home-link:active,
.building-name:active {
  color: #ffffff;
  background-color: #4a4a72;
  transition: background-color 0.2s ease, color 0.2s ease;
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
  animation: fadeIn 0.2s ease-in-out;
}

.dropdown-sub-item {
  font-size: 16px;
  color: #ddd;
  margin-top: 4px;
  cursor: pointer;
  transition: 0.2s;
  text-decoration: none;
  animation: scaleIn 0.25s ease;
}

.room-link {
  text-decoration: none;
  color: inherit;
  font-size: 14px;
  margin-right: 20px;
}

/* Custom Tooltip Modal */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  background: #fff;
  color: #222;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 14px;
  pointer-events: none;
  white-space: nowrap;      /* บรรทัดเดียว */
  max-width: 400px;         /* ปรับความยาวสูงสุดตามต้องการ */
  overflow-x: auto;         /* เลื่อนแนวนอนได้ถ้ายาวเกิน */
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  opacity: 0.97;
}
</style>