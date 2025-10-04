import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig();

export const useReviewStore = defineStore("reviews", {
  state: () => ({
    reviews: [] as any[],
    isLoading: false,
  }),
  actions: {
    getBearerToken() {
      // Try common keys and normalize quotes
      let token =
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        "";
      if (token && (token.startsWith('"') || token.startsWith("'"))) {
        try {
          token = JSON.parse(token);
        } catch {
          token = token.replace(/^['\"]|['\"]$/g, "");
        }
      }
      return token || "";
    },
    getAuthHeaders() {
      const token = this.getBearerToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    getBookingId(r: any) {
      return (
        r?.booking_id ??
        r?.bookingId ??
        r?.booking?.id ??
        r?.book_id ??
        r?.bookingID
      );
    },

    upsertReview(review: any) {
      if (!review) return;
      if (!Array.isArray(this.reviews)) {
        // initialize if somehow undefined or not an array
        this.reviews = [] as any[];
      }
      const byIdIdx = this.reviews.findIndex(
        (r: any) => r?.id && r.id === review.id
      );
      if (byIdIdx >= 0) {
        this.reviews.splice(byIdIdx, 1, review);
        return;
      }
      const bId = this.getBookingId(review);
      const uId = review?.user_id;
      const byBookingIdx = this.reviews.findIndex(
        (r: any) =>
          String(this.getBookingId(r)) === String(bId) &&
          (!uId || String(r?.user_id) === String(uId))
      );
      if (byBookingIdx >= 0) {
        this.reviews.splice(byBookingIdx, 1, review);
      } else {
        this.reviews.push(review);
      }
    },

    async fetchReviews() {
      this.isLoading = true;
      try {
        const headers = this.getAuthHeaders();
        console.log(
          "[ReviewStore] fetchReviews: start, hasToken=",
          Boolean(this.getBearerToken())
        );
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/reviews/list`,
          { headers }
        );
        if (response.status === 200) {
          this.reviews = response.data.data;
          console.log(
            "[ReviewStore] fetchReviews: loaded",
            Array.isArray(this.reviews) ? this.reviews.length : 0
          );
        } else {
          console.error("Error fetching reviews:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async addReview(payload: any) {
      this.isLoading = true;
      try {
        const token = this.getBearerToken();
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        console.log("[ReviewStore] addReview: start", {
          hasToken: Boolean(token),
          booking_id: payload?.booking_id,
          rating: payload?.rating,
        });
        const response = await axios.post(
          `${config.public.apiBase}/api/v1/reviews/create`,
          payload,
          { headers }
        );
        if (response.status >= 200 && response.status < 300) {
          const created = (response as any)?.data?.data ?? payload;
          if (!Array.isArray(this.reviews)) {
            this.reviews = [] as any[];
          }
          if (created) {
            this.upsertReview(created);
          }
          console.log(
            "[ReviewStore] addReview: success, upserted id=",
            created?.id,
            "booking_id=",
            created?.booking_id
          );
          await this.fetchReviews();
        } else {
          console.error("Error adding review:", response.statusText);
        }
        return response;
      } catch (error) {
        const err: any = error as any;
        if (err?.response?.status === 401) {
          console.error(
            "[ReviewStore] addReview: 401 Unauthorized - token may be invalid"
          );
        }
        const serverMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unknown error";
        console.error("Error adding review:", serverMsg, err);
        throw new Error(serverMsg);
      } finally {
        this.isLoading = false;
      }
    },

    async getById(id: string) {
      this.isLoading = true;
      try {
        const headers = this.getAuthHeaders();
        console.log(
          "[ReviewStore] getById: start",
          id,
          "hasToken=",
          Boolean(this.getBearerToken())
        );
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/reviews/${id}`,
          { headers }
        );
        if (response.status === 200) {
          console.log("[ReviewStore] getById: success");
          return response.data.data;
        } else {
          console.error("Error fetching review:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching review:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async getByBookingId(bookingId: string) {
      this.isLoading = true;
      try {
        const headers = this.getAuthHeaders();
        console.log(
          "[ReviewStore] getByBookingId: start",
          bookingId,
          "hasToken=",
          Boolean(this.getBearerToken())
        );
        const res = await axios.get(
          `${
            config.public.apiBase
          }/api/v1/reviews/bookings/${encodeURIComponent(bookingId)}`,
          { headers }
        );
        if (res.status === 200 && res.data) {
          const data = res.data.data ?? res.data;
          console.log(
            "[ReviewStore] getByBookingId: success, type=",
            Array.isArray(data) ? "array" : typeof data
          );
          return Array.isArray(data) ? data[0] : data;
        }
      } catch (error) {
        const err: any = error as any;
        if (err?.response?.status === 401) {
          console.error(
            "[ReviewStore] getByBookingId: 401 Unauthorized - token may be invalid"
          );
        }
        console.error("Error fetching reviews by booking ID:", err);
      } finally {
        this.isLoading = false;
      }
      return undefined;
    },

    // A silent variant that does not toggle the global isLoading flag
    async getByBookingIdSilent(bookingId: string) {
      try {
        const headers = this.getAuthHeaders();
        const res = await axios.get(
          `${
            config.public.apiBase
          }/api/v1/reviews/bookings/${encodeURIComponent(bookingId)}`,
          { headers }
        );
        if (res.status === 200 && res.data) {
          const data = res.data.data ?? res.data;
          return Array.isArray(data) ? data[0] : data;
        }
      } catch (error) {
        const err: any = error as any;
        if (err?.response?.status === 401) {
          console.error(
            "[ReviewStore] getByBookingIdSilent: 401 Unauthorized - token may be invalid"
          );
        }
        console.error("Error fetching reviews by booking ID (silent):", err);
      }
      return undefined;
    },

    async updateReview(id: string, updatedReview: FormData) {
      this.isLoading = true;
      try {
        const headers: any = this.getAuthHeaders();
        await axios.patch(
          `${config.public.apiBase}/api/v1/reviews/${id}`,
          updatedReview,
          { headers }
        );
        await this.fetchReviews();
      } catch (error) {
        console.error("Error updating review:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async deleteReview(id: string) {
      this.isLoading = true;
      try {
        const headers = this.getAuthHeaders();
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/reviews/${id}`,
          { headers }
        );
        if (response.status === 200) {
          await this.fetchReviews();
        } else {
          console.error("Error deleting review:", response.statusText);
        }
      } catch (error) {
        console.error("Error deleting review:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
