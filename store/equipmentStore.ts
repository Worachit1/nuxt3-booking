import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig();

export const useEquipmentStore = defineStore("equipment", {
  state: () => ({
    equipments: [],
    isLoading: false,
  }),
  actions: {
    async fetchEquipments() {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/equipments/list`
        );
        if (response.status === 200) {
          this.equipments = response.data.data;
        } else {
          console.error("Error fetching equipments:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching equipments:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async getById(id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/equipments/${id}`
        );
        if (response.status === 200) {
          return response.data.data;
        } else {
          console.error("Error fetching equipment:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },

     async getAvailableById(id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/equipments/available/${id}`
        );
        if (response.status === 200) {
          return response.data.data;
        } else {
          console.error("Error fetching equipment:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },

    // ✅ ใช้ FormData สำหรับสร้างอาคารใหม่
    async addEquipment(formData: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // อย่า set Content-Type ให้ axios ทำเอง
        const response = await axios.post(
          `${config.public.apiBase}/api/v1/equipments/create`,
          formData,
          { headers }
        );

        if (response.status === 200) {
          await this.fetchEquipments();
        } else {
          console.error("Error adding equipment:", response.statusText);
        }
      } catch (error) {
        console.error("Error adding equipment:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    }
    ,

    // ✅ ใช้ FormData สำหรับอัปเดตอาคาร
    async updateEquipment(id: string, updatedEquipment: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        // ไม่ต้องกำหนด Content-Type เอง
        await axios.patch(
          `${config.public.apiBase}/api/v1/equipments/${id}`,
          updatedEquipment,
          { headers }
        );
        await this.fetchEquipments();
      } catch (error) {
        console.error("Error updating equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async deleteEquipment(id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/equipments/${id}`,
          { headers }
        );
        if (response.status === 200) {
          await this.fetchEquipments();
        } else {
          console.error("Error deleting equipment:", response.statusText);
        }
      } catch (error) {
        console.error("Error deleting equipment:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
