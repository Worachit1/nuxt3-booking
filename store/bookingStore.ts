import axios from "axios";
import { defineStore } from "pinia";

import type { Booking } from "@/models/booking.model";

const config = useRuntimeConfig();

export const useBookingStore = defineStore("booking", {
  state: () => ({
    bookings: [] as Booking[],
    isLoading: false,
    total: 0,
  }),
  actions: {
    async fetchBookings({ page = 1, size = 10 } = {}) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/list`,
          {
            params: { page, size },
          }
        );

        if (response.status === 200) {
          this.bookings = response.data.data;
          this.total = response.data.pagination?.total || 0;
        } else {
          console.error(
            "Error fetching paginated bookings:",
            response.statusText
          );
        }
      } catch (error) {
        console.error("Error fetching paginated bookings:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async fetchAllBookings() {
      this.isLoading = true;
      let page = 1;
      const size = 1000;
      let allBookings = [];

      while (true) {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/list`,
          {
            params: { page, size },
          }
        );

        const data = response.data.data;
        allBookings.push(...data);

        const pagination = response.data.pagination;
        if (page * size >= pagination.total) break;
        page++;
      }

      this.bookings = allBookings;
      this.isLoading = false;
      return allBookings;
    },
    async fetchBookingsApprove() {
      this.isLoading = true;
      let page = 1;
      const size = 100;
      let allBookings = [];

      while (true) {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/list`,
          {
            params: { page, size },
          }
        );

        const data = response.data.data;

        // ✅ กรองเฉพาะ status Approved และ Pending
        const filteredData = data.filter(
          (booking: Booking) =>
            booking.status === "Approved" || booking.status === "Pending"
        );

        allBookings.push(...filteredData);

        const pagination = response.data.pagination;
        if (page * size >= pagination.total) break;
        page++;
      }

      this.bookings = allBookings;
      this.isLoading = false;
      return allBookings;
    },
    async fetchBookingByRoomId(room_id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/room/${room_id}`
        );
        if (response.status === 200 && response.data?.data) {
          this.bookings = response.data.data;
        } else {
          console.error(
            "Error fetching bookings:",
            response.statusText || "No data found"
          );
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async addBooking(newBooking: {
      room_id: string;
      user_id: string;
      title: string;
      description: string;
      start_time: number;
      end_time: number;
      phone: string;
      approved_by: string;
      status: string;
    }) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const response = await axios.post(
          `${config.public.apiBase}/api/v1/bookings/create`,
          newBooking,
          {
            headers,
          }
        );

        if (response.status === 200) {
          return response.data;
        } else {
          console.error("Error adding booking:", response.statusText);
        }
      } catch (error) {
        console.error(
          "Error adding booking:",
          (error as any).response?.data || (error as any).message
        );
      } finally {
        this.isLoading = false;
      }
    },
    async getBookingByuserId(user_id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/user/${user_id}`,
          {
            headers,
          }
        );

        if (response.status === 200) {
          // console.log("Booking fetched successfully:", response.data.data);
          this.bookings = response.data.data; // Update the bookings state with the fetched data
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async updateStatusBooking(
      id: string,
      updatedBooking: { status: string; approved_by: string }
    ) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.patch(
          `${config.public.apiBase}/api/v1/bookings/${id}`,
          updatedBooking,
          { headers }
        );

        if (response.status === 200) {
          // console.log("Booking Status updated successfully:", response.data.data);
        } else {
          console.error("Error updating booking:", response.statusText);
        }
      } catch (error) {
        console.error("Error updating status:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async deleteBooking(id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/bookings/${id}`,
          {
            headers,
          }
        );

        if (response.status === 200) {
          return response.data;
        } else {
          console.error("Error deleting booking:", response.statusText);
        }
      } catch (error) {
        console.error("Error deleting booking:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
