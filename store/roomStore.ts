import axios from "axios";
import { defineStore } from "pinia";
import type { Room } from "@/models/room.model";

const config = useRuntimeConfig();

export const useRoomStore = defineStore("room", {
  state: () => ({
    rooms: [] as Room[],
    isLoading: false,
    total: 0,
  }),
  actions: {
    async fetchRooms(page = 1, size = 10) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/rooms/list`,
          { params: { page, size } }
        );
        if (response.status === 200) {
          this.rooms = response.data.data || [];
          // แก้ตรงนี้ให้แน่ใจว่า total ได้ค่าจาก backend
          this.total = response.data.pagination?.total || 0;
        } else {
          this.rooms = [];
          this.total = 0;
        }
      } catch (error) {
        this.rooms = [];
        this.total = 0;
      } finally {
        this.isLoading = false;
      }
    },
    async getById(room_id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/rooms/${room_id}`
        );
        if (response.status === 200) {
          return response.data.data;
        } else {
          console.error("Error fetching room:", response.statusText);
          return null;
        }
      } catch (error) {
        console.error("Error fetching room:", error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    async addRoom(newRoom: Room) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const formData = new FormData();
        formData.append("name", newRoom.name);
        formData.append("description", newRoom.description);
        formData.append("capacity", newRoom.capacity.toString());

        if (newRoom.image_url instanceof File) {
          formData.append("image_url", newRoom.image_url);
        } else {
          formData.append("image_url", newRoom.image_url);
        }

        const response = await axios.post(
          `${config.public.apiBase}/api/v1/rooms/create`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              ...headers,
            },
          }
        );

        if (response.status === 200) {
          // Optionally: await this.fetchRooms();
          return response.data;
        } else {
          console.error("Error adding room:", response.statusText);
          return null;
        }
      } catch (error) {
        console.error("Error adding room:", error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    async updateRoom(id: string, formData: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.patch(
          `${config.public.apiBase}/api/v1/rooms/${id}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              ...headers,
            },
          }
        );

        if (response.status === 200) {
          // Optionally: await this.fetchRooms();
          return response.data;
        } else {
          console.error("Error updating room:", response.statusText);
          return null;
        }
      } catch (error) {
        console.error("Error updating room:", error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    async deleteRoom(id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/rooms/${id}`,
          {
            headers: {
              ...headers,
            },
          }
        );
        if (response.status === 200) {
          // Optionally: await this.fetchRooms();
        } else {
          console.error("Error deleting room:", response.statusText);
        }
      } catch (error) {
        console.error("Error deleting room:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
