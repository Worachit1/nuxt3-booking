import axios from "axios";
import { defineStore } from "pinia";

export const useUserStore = defineStore("user", {
    state: () => ({
        users: [] as any[],
        currentUser: null as any,
        userId: null as string | null,
        isLoading: false,
    }),
    actions: {
        setUserId(id: string) {
            this.userId = id;
        },

        async fetchUsers() {
            this.isLoading = true;
            const config = useRuntimeConfig();
            const token = localStorage.getItem("token") || null;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            try {
                const response = await axios.get(`${config.public.apiBase}/api/v1/users/list`, {
                    headers,
                });
                if (response.status === 200) {
                    this.users = response.data.data;
                    // console.log("Users fetched successfully:", this.users);
                } else {
                    console.error("Error fetching users:", response.statusText);
                }
            } catch (error) {
                console.error("Error fetching users:", error);
            }finally {
                this.isLoading = false;
            }
        },
        async getUserById(user_id: string) {
            const config = useRuntimeConfig();
            const token = localStorage.getItem("token") || null;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            this.isLoading = true;
            try {
                const response = await axios.get(`${config.public.apiBase}/api/v1/users/${user_id}`, {
                    headers,
                });
                if (response.status === 200) {
                    this.currentUser = response.data.data;
                    return this.currentUser;
                } else {
                    console.error("Error fetching user:", response.statusText);
                    return null;
                }
            } catch (error) {
                console.error("Error fetching user:", error);
                return null;
            }finally {
                this.isLoading = false;
            }
        },
        async addUser(newUser: any) {
            this.isLoading = true;
            const config = useRuntimeConfig();
            const formData = new FormData();
            formData.append("first_name", newUser.first_name);
            formData.append("last_name", newUser.last_name);
            formData.append("email", newUser.email);
            formData.append("password", newUser.password);
            formData.append("position_name", newUser.position_name);
            formData.append("phone", newUser.phone);
            formData.append("image_url", newUser.image_url);

            try {
                const response = await axios.post(`${config.public.apiBase}/api/v1/users`, formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });
                if (response.status === 200) {
                    // console.log("User added successfully:", response.data.data);
                    return response.data;
                } else {
                    console.error("Error adding user:", response.statusText);
                }
            } catch (error) {
                console.error("Error adding user:", error);
            }finally{
                this.isLoading = false;
            }
        },

        async updateUser(user_id: string, updatedUser: any) {
            this.isLoading = true;
            const config = useRuntimeConfig();
            const token = localStorage.getItem("token") || null;
            const formData = new FormData();
            formData.append("first_name", updatedUser.first_name);
            formData.append("last_name", updatedUser.last_name);
            formData.append("password", updatedUser.password);
            formData.append("phone", updatedUser.phone);
            formData.append("position_name", updatedUser.position_name);
            formData.append("image_url", updatedUser.image_url);

            try {
                const response = await axios.put(`${config.public.apiBase}/api/v1/users/${user_id}`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                });
                if (response.status === 200) {
                    // console.log("User updated successfully:", response.data.data);
                    return response.data;
                } else {
                    console.error("Error updating user:", response.statusText);
                }
            } catch (error) {
                console.error("Error updating user:", error);
            }finally {
                this.isLoading = false;
            }
        },
        async deleteUser(user_id: string) {
            this.isLoading = true;
            const config = useRuntimeConfig();
            const token = localStorage.getItem("token") || null;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            try {
                const response = await axios.delete(`${config.public.apiBase}/api/v1/users/${user_id}`, {
                    headers,
                });
                if (response.status === 200) {
                    // console.log("User deleted successfully:", response.data.data);
                    return response.data;
                } else {
                    console.error("Error deleting user:", response.statusText);
                }
            } catch (error) {
                console.error("Error deleting user:", error);
            }finally {
                this.isLoading = false;
            }
        },
    },
});
