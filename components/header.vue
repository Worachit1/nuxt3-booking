<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useUserStore } from "@/store/userStore";
import { useAuthStore } from "@/store/authStore";
import { useUserRoleStore } from "@/store/userRoleStore";
import { useBookingStore } from "~/store/bookingStore";
import loginmodal from "@/components/loginModal.vue";
import registerModal from "@/components/registerModal.vue";

import { useRouter } from "vue-router";

import dayjs from 'dayjs'
import 'dayjs/locale/th'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('th')

const currentTime = ref(dayjs().tz('Asia/Bangkok').format('วันที่ D MMMM YYYY HH:mm:ss น.'))

let timer = null

onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = dayjs().tz('Asia/Bangkok').format('D MMMM YYYY HH:mm:ss น.')
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const bookingStore = useBookingStore();
const userRoleStore = useUserRoleStore();
const userId = localStorage.getItem("user_id");

const user = computed(() => userStore.currentUser);
const isLoading = computed(() => userStore.isLoading);
const isLoggedIn = computed(() => !!user.value?.id);

const userProfileImage = computed(
  () => user.value?.image_url || "/images/default-profile.png"
);
const userFirstName = computed(() =>
  isLoading.value ? "กำลังโหลด..." : user.value?.first_name || "Guest"
);
const userLastName = computed(() =>
  isLoading.value ? "" : user.value?.last_name || "User"
);

const showMenu = ref(false);
const profileWrapperRef = ref(null);
const isModalOpenLogin = ref(false);
const isModalOpenRegister = ref(false);
const bookingsDropdownRef = ref(null);
const currentUserRole = computed(() => userRoleStore.currentUserRole);
const showBookings = ref(false);

function handleProfileClick() {
  showMenu.value = !showMenu.value;
}

function closeMenu() {
  showMenu.value = false;
}

function handleClickProfileOutside(event) {
  if (
    profileWrapperRef.value &&
    !profileWrapperRef.value.contains(event.target)
  ) {
    closeMenu();
  }
}

function openLoginModal() {
  isModalOpenLogin.value = true;
}
function openRegisterModal() {
  isModalOpenRegister.value = true;
}

function viewProfile() {
  closeMenu();
  router.push({ name: "user-profile-id", params: { id: userId } });
}

async function logout() {
  try {
    await authStore.logout();
    closeMenu();
    window.location.reload();
    window.location.href = "/";
  } catch (error) {
    console.error("Logout failed:", error);
  }
  showMenu.value = false;
}

onMounted(async () => {
  document.addEventListener("click", handleClickProfileOutside);

  if (userId) {
    // โหลดข้อมูล user เข้า store
    await userStore.getUserById(userId);
    await userRoleStore.getUserRoleById(userId);
    await bookingStore.fetchBookings();
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickProfileOutside);
});
</script>

<template>
  <div v-if="!isLoading" class="header">
    <!-- เพิ่มเวลาไว้ซ้ายบน -->
    <div class="current-time">{{ currentTime }}</div>

    <div class="profile-wrapper" ref="profileWrapperRef">
      <div class="profile" @click="handleProfileClick">
        <img
          :src="userProfileImage"
          alt="Profile"
          class="profile-image"
        />
        <div class="profile-name">
          {{ userFirstName }} {{ userLastName }}
        </div>
      </div>

      <div v-if="showMenu" class="dropdown-menu">
        <ul>
          <template v-if="isLoggedIn">
            <li @click="viewProfile">
              <i class="fa-solid fa-address-card"></i> ดูโปรไฟล์
            </li>
            <li @click="logout">
              <i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
            </li>
          </template>
          <template v-else>
            <li @click="openLoginModal">
              <i class="fa-solid fa-user"></i> เข้าสู่ระบบ
            </li>
            <li @click="openRegisterModal">
              <i class="fa-solid fa-user-plus"></i> สมัครสมาชิก
            </li>
          </template>
        </ul>
      </div>
    </div>
  </div>

  <loginmodal
    v-if="isModalOpenLogin"
    @close="isModalOpenLogin = false"
    @open-register="() => { isModalOpenLogin = false; isModalOpenRegister = true }"
  />
  <registerModal
    v-if="isModalOpenRegister"
    @close="isModalOpenRegister = false"
    @open-login="() => { isModalOpenRegister = false; isModalOpenLogin = true }"
  />
</template>

<style scoped>
.header {
  width: 100%;
  height: 50px;
  background-color: #13131f;
  color: white;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  /* ไม่แก้ไขส่วนอื่น */
}

.current-time {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-weight: 600;
  font-size: 14px;
  user-select: none;
}

.profile-wrapper {
  position: relative;
}

.profile {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-right: 35px;
}

.profile-image {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 15px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.profile-image:hover {
  border: 2px solid #fff;
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

.profile-name {
  font-size: 16px;
  font-weight: bold;
  margin-right: 10px;
}

.profile-name:hover {
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 10px;
  background-color: #2a2a3c;
  border-radius: 8px;
  padding: 10px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  min-width: 150px;
  z-index: 10000;
  color: #e0e0e0;
  margin-right: 25px;
  animation: fadeIn 0.2s ease-in-out;
}

.dropdown-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
  animation: scaleIn 0.25s ease;
}

.dropdown-menu li {
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.dropdown-menu li:hover {
  background-color: #f0f0f07a;
}
</style>
