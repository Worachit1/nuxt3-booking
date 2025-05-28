import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig()

export const useUserPositionStore = defineStore("userPosition", {
    state: () => ({
        userPositions: [],
        isLoading: false,
    }),
    actions: {
        async fetchUserPositions() {
            this.isLoading = true;
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await axios.get(`${config.public.apiBase}/api/v1/positions/list`, {
                    headers,
                });
                if (response.status === 200) {
                    this.userPositions = response.data.data;
                    // console.log("User positions fetched successfully:", this.userPositions);
                } else {
                    console.error("Error fetching user positions:", response.statusText);
                }
            } catch (error) {
                console.error("Error fetching user positions:", error);
            }finally {
                this.isLoading = false;
            }
        },
    },
});