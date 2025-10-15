// middleware/userOnly.ts
// ป้องกัน Admin เข้าถึงหน้าของ User
import { useUserStore } from "@/store/userStore";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

export default defineNuxtRouteMiddleware(async (to, from) => {
  // ทำงานเฉพาะฝั่ง client
  if (typeof window === 'undefined') return;

  const userStore = useUserStore();
  const userId = localStorage.getItem("user_id");

  // ถ้าไม่มี userId ให้ผ่านไป (loadUser middleware จะจัดการ)
  if (!userId) return;

  // โหลดข้อมูล user ถ้ายังไม่มี
  if (!userStore.currentUser || userStore.currentUser.id !== userId) {
    try {
      await userStore.getUserById(userId);
    } catch (err) {
      console.error("โหลด user ไม่สำเร็จ:", err);
      return;
    }
  }

  // ตรวจสอบว่าเป็น Admin หรือไม่
  const isAdmin = userStore.currentUser?.role_name === "Admin";

  if (isAdmin) {
    await Swal.fire({
      icon: "warning",
      title: "ไม่สามารถเข้าถึงได้",
      text: "ผู้ดูแลระบบไม่สามารถเข้าถึงหน้านี้ได้ กรุณาใช้เมนูผู้ดูแลระบบ",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return navigateTo("/admin/dashboard");
  }
});
