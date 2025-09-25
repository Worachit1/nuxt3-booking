import axios from "axios";
import { defineStore } from "pinia";
import type { Booking } from "@/models/booking.model";

const config = useRuntimeConfig();

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
      let allBookings: Booking[] = [];

      try {
        while (true) {
          const response = await axios.get(
            `${config.public.apiBase}/api/v1/bookings/list`,
            {
              params: { page, size },
            }
          );

          const data = response.data.data;
          const pagination = response.data.pagination;

          if (
            !data ||
            data.length === 0 ||
            !pagination?.total ||
            pagination.total === 0
          ) {
            break;
          }

          allBookings.push(...data);

          if (page * size >= pagination.total) break;
          page++;
        }

        this.bookings = allBookings;
        return allBookings;
      } catch (error) {
        console.error("Error fetching bookings:", error);
        this.bookings = [];
        return [];
      } finally {
        this.isLoading = false;
      }
    },

    async fetchBookingsApprove() {
      this.isLoading = true;
      let page = 1;
      const size = 100;
      let allBookings: Booking[] = [];

      try {
        while (true) {
          const response = await axios.get(
            `${config.public.apiBase}/api/v1/bookings/list`,
            {
              params: { page, size },
            }
          );

          const data = response.data.data;
          const pagination = response.data.pagination;

          // ถ้าไม่มีข้อมูลเลย หยุดลูปทันที
          if (
            !data ||
            data.length === 0 ||
            !pagination.total ||
            pagination.total === 0
          ) {
            break;
          }

          const filteredData = data.filter(
            (booking: Booking) =>
              booking.status === "Approved" || booking.status === "Pending"
          );

          allBookings.push(...filteredData);

          if (page * size >= pagination.total) {
            break;
          }

          page++;
        }

        this.bookings = allBookings;
        return allBookings;
      } catch (error) {
        console.error("Error fetching approve bookings", error);
        return [];
      } finally {
        this.isLoading = false;
      }
    },

    async fetchBookingByRoomId(room_id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/room/${room_id}`
        );

        const data = response.data?.data;
        if (!data || data.length === 0) {
          this.bookings = [];
          return [];
        }
        this.bookings = data;
        return data;
      } catch (error) {
        console.error("Error fetching bookings:", error);
        this.bookings = [];
        return [];
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
        const headers = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const response = await axios.post(
          `${config.public.apiBase}/api/v1/bookings/create`,
          newBooking,
          { headers }
        );

        if (response.status === 200) {
          return response.data;
        } else {
          console.error("Error adding booking:", response.statusText);
          return null;
        }
      } catch (error: any) {
        console.error(
          "Error adding booking:",
          error.response?.data || error.message
        );
        return null;
      } finally {
        this.isLoading = false;
      }
    },

    async getBookingByuserId(user_id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/bookings/user/${user_id}`,
          { headers: getAuthHeaders() }
        );
        const data = response.data?.data;
        if (!data || data.length === 0) {
          this.bookings = [];
          return [];
        }
        this.bookings = data;
        return data;
      } catch (error) {
        console.error("Error fetching booking:", error);
        this.bookings = [];
        return [];
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
        const response = await axios.patch(
          `${config.public.apiBase}/api/v1/bookings/${id}`,
          updatedBooking,
          { headers: getAuthHeaders() }
        );

        if (response.status === 200) {
          return true;
        } else {
          console.error("Error updating booking:", response.statusText);
          return false;
        }
      } catch (error) {
        console.error("Error updating status:", error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteBooking(id: string) {
      this.isLoading = true;
      try {
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/bookings/${id}`,
          { headers: getAuthHeaders() }
        );

        if (response.status === 200) {
          return true;
        } else {
          console.error("Error deleting booking:", response.statusText);
          return false;
        }
      } catch (error) {
        console.error("Error deleting booking:", error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
