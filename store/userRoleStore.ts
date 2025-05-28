import { defineStore } from 'pinia';
import axios from 'axios';

export const useUserRoleStore = defineStore('userRole', {
  state: () => ({
    currentUserRole: [] as any[],
  }),

  actions: {
    async getUserRoleById(user_id: string) {
      // ✅ ป้องกันการเรียกซ้ำ ถ้ามีข้อมูลอยู่แล้ว
      if (this.currentUserRole.length > 0) {
        // console.log("📦 ใช้ role จาก cache ใน store");
        return this.currentUserRole;
      }

      const config = useRuntimeConfig();
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const response = await axios.get(`${config.public.apiBase}/api/v1/userRoles/${user_id}`, {
          headers,
        });

        if (response.status === 200 && Array.isArray(response.data.data)) {
          this.currentUserRole = response.data.data;
          return response.data.data;
        } else {
          this.currentUserRole = [];
          return [];
        }
      } catch (error) {
        console.error("⚠️ ดึง user role ผิดพลาด:", error);
        this.currentUserRole = [];
        return [];
      }
    },
  },
});
