import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig();

export const useRoom_Types = defineStore("roomTypes", {
  state: () => ({
    roomTypes: [],
    isLoading: false,
  }),
  actions: {
    async fetchRoomTypes() {
      this.isLoading = true;
      try {
        let token =
          localStorage.getItem("token") ||
          localStorage.getItem("access_token") ||
          "";
        if (token && (token.startsWith('"') || token.startsWith("'"))) {
          try {
            token = JSON.parse(token);
          } catch {
            token = token.slice(1, -1);
          }
        }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/roomTypes/list`,
          {
            headers,
          }
        );
        if (response.status === 200) {
          this.roomTypes = response.data.data;
          // console.log("Room types fetched successfully:", this.roomTypes);
        } else {
          console.error("Error fetching room types:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching room types:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
