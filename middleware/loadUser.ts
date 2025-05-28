// middleware/loadUser.ts
import { useUserStore } from "@/store/userStore";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useAuthStore } from "@/store/authStore";


export default defineNuxtRouteMiddleware(async (to, from) => {
  if (!process.client) return;

  const userStore = useUserStore();
  const userId = localStorage.getItem("user_id");

if (!userId) {
  if (to.path !== "/") {
    await Swal.fire({
      icon: "warning",
      title: "ไม่พบข้อมูลผู้ใช้",
      text: "กรุณาเข้าสู่ระบบก่อนเข้าถึงหน้านี้",
      confirmButtonText: "ตกลง",
    });
    const authStore = useAuthStore();
    authStore.openLoginModal();
    return navigateTo("/");
  }
  return;
}
  if (!userStore.currentUser || userStore.currentUser.id !== userId) {
    try {
      await userStore.getUserById(userId);
    } catch (err) {
      console.error("โหลด user ไม่สำเร็จ:", err);
    }
  }
});
