<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useUserStore } from "@/store/userStore";
import { useAuthStore } from "@/store/authStore";
import { useUserRoleStore } from "@/store/userRoleStore";
import { useBookingStore } from "~/store/bookingStore";
import loginmodal from "@/components/loginModal.vue";
import registerModal from "@/components/registerModal.vue";

import { useRouter } from "vue-router";


import dayjs from "dayjs";
import "dayjs/locale/th";

const formatDateTime = (date) => {
  const timestamp = date < 10000000000 ? date * 1000 : date; // ถ้าน้อยกว่า 10 หลัก → เป็น seconds
  return dayjs(timestamp).locale("th").format("D MMMM YYYY HH:mm:ss น.");
};

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

// กรองเฉพาะการจองที่มีสถานะ Pending ของ Admin
const pendingBookings = computed(() => {
  if (currentUserRole.value?.[0]?.role_name === "Admin") {
    const filteredBookings = bookingStore.bookings.filter(
      (booking) => booking.status === "Pending"
    );
    // console.log("Pending Bookings:", filteredBookings); // ตรวจสอบรายการที่กรองแล้ว
    return filteredBookings;
  }
  return [];
});

// กรองเฉพาะการจองที่มีสถานะ Approved และ Cancel ของ User
const statusUserBookings = computed(() => {
  if (currentUserRole.value?.[0]?.role_name !== "Admin") {
    return bookingStore.bookings.filter(
      (booking) =>
        booking.user_id === userId &&
        (booking.status === "Approved" || booking.status === "Canceled") &&
        !acknowledgedBookings.value.includes(booking.id) // กรองการจองที่ยังไม่ได้รับทราบ
    );
  }
  return [];
});

// สำหรับจุดแดงกระดิ่ง Admin
const hasPendingBookings = computed(() =>
  currentUserRole.value?.[0]?.role_name === "Admin"
    ? pendingBookings.value.length > 0
    : false
);
// สำหรับจุดแดงกระดิ่ง User
const hasUserBookings = computed(() =>
  currentUserRole.value?.[0]?.role_name !== "Admin"
    ? statusUserBookings.value.length > 0
    : false
);

// สำหรับกดรับการจองของ User
const acknowledgedBookings = ref([]); // เก็บ ID ของการจองที่ User รับทราบแล้ว
function acknowledgeBooking(bookingId) {
  if (!acknowledgedBookings.value.includes(bookingId)) {
    acknowledgedBookings.value.push(bookingId);  // เพิ่มการจองที่รับทราบแล้ว
    localStorage.setItem("acknowledgedBookings", JSON.stringify(acknowledgedBookings.value));  // เก็บข้อมูลใน localStorage
  }
}

function toggleBookings() {
  showBookings.value = !showBookings.value;
}
function closeBookings() {
  showBookings.value = false;
}

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

function handleClickBookingOutside(event) {
  if (
    bookingsDropdownRef.value &&
    !bookingsDropdownRef.value.contains(event.target) &&
    !event.target.closest(".bell")
  ) {
    closeBookings();
  }
}

function openLoginModal() {
  isModalOpenLogin.value = true; // เปิด modal login
}
function openRegisterModal() {
  isModalOpenRegister.value = true; // เปิด modal register
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
    window.location.href = "/"; // Redirect to home page after logout
  } catch (error) {
    console.error("Logout failed:", error);
  }
  showMenu.value = false;
}

onMounted(async () => {
  document.addEventListener("click", handleClickBookingOutside);
  document.addEventListener("click", handleClickProfileOutside);

  const userId = localStorage.getItem("user_id");

  if (userId) {
    await userRoleStore.getUserRoleById(userId);
    await bookingStore.fetchBookings(); // โหลด booking ทุกกรณี
  }
  const storedAcknowledgedBookings = localStorage.getItem("acknowledgedBookings");
  if (storedAcknowledgedBookings) {
    acknowledgedBookings.value = JSON.parse(storedAcknowledgedBookings);  // โหลดข้อมูลจาก localStorage
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickBookingOutside);
  document.removeEventListener("click", handleClickProfileOutside);
});
</script>

<template>
  <div v-if="!isLoading" class="header">
    <div class="profile-wrapper" ref="profileWrapperRef">
      <div class="profile">
        <img
          :src="userProfileImage"
          alt="Profile"
          class="profile-image"
          @click="handleProfileClick"
        />
        <div class="profile-name" @click="handleProfileClick">
          {{ userFirstName }} {{ userLastName }}
        </div>
      </div>

      <div v-if="showMenu" class="dropdown-menu">
        <ul>
          <template v-if="isLoggedIn">
            <li @click="viewProfile">
              <i class="fa-solid fa-address-card "></i> ดูโปรไฟล์
            </li>
            <li @click="logout">
              <i class="fa-solid fa-right-from-bracket "></i> ออกจากระบบ
            </li>
          </template>
          <template v-else>
            <li @click="openLoginModal">
              <i class="fa-solid fa-user   "></i> เข้าสู่ระบบ
            </li>
            <li @click="openRegisterModal">
              <i class="fa-solid fa-user-plus   "></i> สมัครสมาชิก
            </li>
          </template>
        </ul>
      </div>
    </div>
  </div>

  <loginmodal
    v-if="isModalOpenLogin"
    @close="isModalOpenLogin = false"
    @open-register="
      () => {
        isModalOpenLogin = false;
        isModalOpenRegister = true;
      }
    "
  />
  <registerModal
    v-if="isModalOpenRegister"
    @close="isModalOpenRegister = false"
    @open-login="
      () => {
        isModalOpenRegister = false;
        isModalOpenLogin = true;
      }
    "
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