import axios from "axios";
import { defineStore } from "pinia";
import type { User } from "@/models/user.model";


const config = useRuntimeConfig();

export const useAuthStore = defineStore("auth", {
    state: () => ({
        user: null as User | null,
        isLoading: false,
        token: null as string | null,
        showLoginModal: false, // เพิ่ม state นี้
    }),
    actions: {
        openLoginModal() {
            this.showLoginModal = true;
        },
        closeLoginModal() {
            this.showLoginModal = false;
        },
        async login(payload: { email: string; password: string }) {
            this.isLoading = true;
            try {
                const response = await axios.post(
                    `${config.public.apiBase}/api/v1/login`,
                    payload,
                    { withCredentials: true }
                );
                const user = response.data.user;
                const token = response.data.token;
                if (!user || !token) {
                    throw new Error("ข้อมูลผู้ใช้ไม่สมบูรณ์");
                }
                localStorage.setItem("token", token);
                localStorage.setItem("user_id", user.id);
                this.user = user;
                this.token = token;
                this.closeLoginModal(); // ปิด modal หลัง login สำเร็จ
                return user;
            } catch (error: any) {
                console.error("Login error:", error);
                throw new Error(error.response?.data?.message || "เข้าสู่ระบบไม่สำเร็จ");
            } finally {
                this.isLoading = false;
            }
        },
        async logout() {
            try {
                await axios.post(
                    `${config.public.apiBase}/api/v1/logout`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${this.token}`,
                        },
                    }
                );
                this.user = null;
                this.token = null;
                localStorage.removeItem("token");
                localStorage.removeItem("user_id");
                localStorage.removeItem("user_email");
                localStorage.removeItem("user_first_name");
                localStorage.removeItem("user_last_name");
                localStorage.removeItem("user_image_url");
                localStorage.removeItem("user_position");
            } catch (error) {
                console.error("Logout error:", error);
            }
        },
        async register(newUser: User) {
            try {
                const formData = new FormData();
                formData.append("first_name", newUser.first_name);
                formData.append("last_name", newUser.last_name);
                formData.append("email", newUser.email);
                formData.append("password", newUser.password);
                formData.append("position_name", newUser.position_name);
                formData.append("phone", newUser.phone);
                if (newUser.image_url instanceof File) {
                    formData.append("image_url", newUser.image_url);
                } else {
                    formData.append("image_url", newUser.image_url);
                }
                const response = await axios.post(
                    `${config.public.apiBase}/api/v1/users/register`,
                    formData,
                    {
                        headers: {
                            "Content-Type": "multipart/form-data",
                            Authorization: `Bearer ${this.token}`,
                        },
                    }
                );
                if (response.status === 200 && response.data.data) {
                    return response.data.data;
                } else {
                    console.error("Registration failed:", response.statusText);
                    return null;
                }
            } catch (error) {
                console.error("Register error:", error);
                throw error;
            }
        },
    },
});