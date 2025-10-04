import axios from "axios";
import { defineStore } from "pinia";

const config = useRuntimeConfig();

export const useReport = defineStore("reports", {
  state: () => ({
    reports: [],
    isLoading: false,
  }),
  actions: {
    async fetchReports() {
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
          `${config.public.apiBase}/api/v1/reports/list`,
          {
            headers,
          }
        );
        if (response.status === 200) {
          this.reports = response.data.data;
        } else {
          console.error("Error fetching reports:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        this.isLoading = false;
      }
    },

    
async getById(id: string) {
      this.isLoading = true;
      try {
        const response = await axios.get(
          `${config.public.apiBase}/api/v1/reports/${id}`
        );
        if (response.status === 200) {
          return response.data.data;
        } else {
          console.error("Error fetching report:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async addReport(payload: any) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // อย่า set Content-Type ให้ axios ทำเอง
        const response = await axios.post(
          `${config.public.apiBase}/api/v1/reports/create`,
          payload,
          { headers }
        );

        if (response.status === 200) {
          await this.fetchReports();
        } else {
          console.error("Error adding report:", response.statusText);
        }
      } catch (error) {
        console.error("Error adding report:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async updateReport(id: string, updatedReport: FormData) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        // ไม่ต้องกำหนด Content-Type เอง
        await axios.patch(
          `${config.public.apiBase}/api/v1/reports/${id}`,
          updatedReport,
          { headers }
        );
        await this.fetchReports();
      } catch (error) {
        console.error("Error updating report:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async deleteReport(id: string) {
      this.isLoading = true;
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.delete(
          `${config.public.apiBase}/api/v1/reports/${id}`,
          { headers }
        );
        if (response.status === 200) {
          await this.fetchReports();
        } else {
          console.error("Error deleting report:", response.statusText);
        }
      } catch (error) {
        console.error("Error deleting report:", error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});

