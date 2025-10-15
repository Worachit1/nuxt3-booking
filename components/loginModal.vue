<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { useRouter } from 'vue-router';
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const emit = defineEmits(['close', 'open-register']);

const isModalOpen = ref(true);
const showRegisterModal = ref(false);

const email = ref('');
const password = ref('');
const error = ref('');
const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

function closeModal() {
    emit('close');
}

const login = async () => {
    try {
        const user = await authStore.login({ email: email.value, password: password.value });
        if (!user || !user.id) {
            console.error("User ID is not available");
            return;
        }
        
        // 🔥 โหลดข้อมูล user ใหม่เข้า store เพื่ออัปเดต header แบบ real-time
        await userStore.getUserById(user.id);
        
        // ปิด modal ก่อน
        closeModal();
        
        // ตรวจสอบ role และ redirect ตามสิทธิ์
        const isAdmin = user.role_name === 'Admin';
        const redirectPath = isAdmin ? '/admin/dashboard' : '/';
        
        // แสดง SweetAlert สำเร็จ
        await Swal.fire({
            title: 'เข้าสู่ระบบสำเร็จ',
            text: `ยินดีต้อนรับ ${user.first_name} ${user.last_name}`,
            icon: 'success',
            confirmButtonText: 'ตกลง',
            timer: 1500,
            timerProgressBar: true
        });
        
        // 🔥 หลังจากปิด Alert แล้ว ให้ reload หน้าเพื่อให้ middleware/component redirect
        if (isAdmin) {
            // Admin: Reload หน้าแล้วไปที่ dashboard
            window.location.replace(redirectPath);
        } else {
            // User: Reload หน้าแล้วอยู่ที่หน้าหลัก
            window.location.reload();
        }
    } catch (err) {
        console.error("Login error:", err);
        error.value = 'เข้าสู่ระบบไม่สำเร็จ: ' + err.message;
    }
};
const openRegisterModal = () => {
    isModalOpen.value = false;
    showRegisterModal.value = true;
};
</script>

<template>
    <div>
        <div v-if="isModalOpen" class="modal-overlay" @click="closeModal">
            <div class="modal-content" @click.stop>
                <h2>เข้าสู่ระบบ</h2>
                <div class="form-group">
                    <label for="email">อีเมล:</label>
                    <input type="email" id="email" v-model="email" required />
                </div>
                <div class="form-group">
                    <label for="password">รหัสผ่าน:</label>
                    <input type="password" id="password" v-model="password" required />
                </div>
                <button @click="login" class="login-btn">เข้าสู่ระบบ</button>
                <p>ยังไม่มีบัญชี?
                    <a href="#" @click.prevent="$emit('open-register')">ลงทะเบียน</a>
                </p>
                <div v-if="error" class="error">{{ error }}</div>
                <button class="close-btn" @click="$emit('close')">ปิด</button>
            </div>
        </div>

        <!-- ✅ แสดง Register Modal -->
        <register-modal v-if="showRegisterModal" @close="showRegisterModal = false" />
    </div>
</template>

<script>
import RegisterModal from '@/components/registerModal.vue';
export default {
    components: {
        RegisterModal,
    },
};
</script>


<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
}

.modal-content {
    background-color: #fff;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
    max-width: 420px;
    width: 100%;
    animation: fadeIn 0.3s ease-in-out;
}

.modal-content h2 {
    margin-bottom: 1.5rem;
    font-size: 1.8rem;
    text-align: center;
    color: #333;
}

.form-group {
    margin-bottom: 1.2rem;
}

label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #444;
}

input[type="email"],
input[type="password"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;
}

input:focus {
    outline: none;
    border-color: #04bd35;
    box-shadow: 0 0 0 3px rgba(4, 189, 53, 0.2);
}

button {
    width: 100%;
    padding: 0.75rem;
    background-color: #04bd35;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s ease;
}

a {
    color: #13131f;
    font-weight: bold;
    transition: color 0.3s ease;
}

a:hover {
    color: #47476a;
}


.error {
    margin-top: 1rem;
    color: #f44336;
    text-align: center;
}

.login-btn {
    margin-top: 1rem;
    background-color: transparent;
    color: #4caf50;
    border: 2px solid #4caf50;
    border-radius: 8px;
    padding: 0.5rem;
    transition: all 0.3s ease;
}

.login-btn:hover {
    background-color: #4caf50;
    color: white;
}

.close-btn {
    margin-top: 1rem;
    background-color: transparent;
    color: #f44336;
    border: 2px solid #f44336;
    border-radius: 8px;
    padding: 0.5rem;
    transition: all 0.3s ease;
}

.close-btn:hover {
    background-color: #f44336;
    color: white;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
