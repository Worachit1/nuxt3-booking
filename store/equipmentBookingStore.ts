import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig();

export const useEquipmentBookingStore = defineStore("booking_equipment", {
  state: () => ({
    booking_equipment: [],
    isLoading: false,
  }),
  actions: {
    async fetchBookingEquipments() {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookingEquipments/list`
        );
        if (response.status === 200) {
          this.booking_equipment = response.data.data;
        } else {
          console.error(
            "Error fetching booking equipments:",
            response.statusText
          );
        }
      } catch (error) {
        console.error("Error fetching booking equipments:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async getBookingEquipmentById(id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookingEquipments/${id}`
        );
        if (response.status === 200) {
          return response.data.data;
        } else {
          console.error(
            "Error fetching booking equipment:",
            response.statusText
          );
        }
      } catch (error) {
        console.error("Error fetching booking equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },

    // ✅ ใช้ FormData สำหรับสร้างอาคารใหม่
    async addBookingEquipment(formData: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // formData ต้องเป็น object แบบ backend ต้องการ
        // { booking_id, equipments: [{equipment_id, quantity}, ...] }
        const response = await axios.post(
          `${config.public.apiBase}/api/v1/bookingEquipments/create`,
          formData,
          { headers }
        );
        if (response.status === 200) {
          await this.fetchBookingEquipments();
        } else {
          console.error("Error adding booking equipment:", response.statusText);
        }
      } catch (error) {
        console.error("Error adding booking equipment:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
    // ✅ ใช้ payload object สำหรับอัปเดต booking_equipment
    async updateBookingEquipment(id: string, updateBookingEquipment: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        // ไม่ต้องกำหนด Content-Type เอง
        await axios.patch(
          `${config.public.apiBase}/api/v1/bookingEquipments/${id}`,
          updateBookingEquipment,
          { headers }
        );
        await this.fetchBookingEquipments();
      } catch (error) {
        console.error("Error updating equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async deleteBookingEquipment(id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/bookingEquipments/${id}`,
          { headers }
        );
        if (response.status === 200) {
          await this.fetchBookingEquipments();
        } else {
          console.error(
            "Error deleting booking equipment:",
            response.statusText
          );
        }
      } catch (error) {
        console.error("Error deleting booking equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
