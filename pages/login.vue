<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { useUserRoleStore } from '@/store/userRoleStore';

const email = ref('');
const password = ref('');
const router = useRouter();
const authStore = useAuthStore();
const error = ref('');

const login = async () => {
  try {
    const user = await authStore.login({ email: email.value, password: password.value });

    if (!user || !user.id) {
      console.error("User ID is not available");
      return;
    }

    // เก็บข้อมูลลง localStorage
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('user_first_name', user.first_name);
    localStorage.setItem('user_last_name', user.last_name);
    localStorage.setItem('user_image_url', String(user.image_url));
    localStorage.setItem('user_position', user.position_name);
    localStorage.setItem('user_token', user.token || '');

    const userStore = useUserStore();
    const userRoleStore = useUserRoleStore();

    if (!userStore.currentUser || userRoleStore.currentUserRole.length === 0) {
      console.log("ข้อมูลไม่ครบถ้วน, รอการโหลดข้อมูล");
      await userStore.getUserById(user.id);
      console.log('User loaded:', userStore.currentUser);

      const roleData = await userRoleStore.getUserRoleById(user.id);
      console.log('✅ Role loaded:', roleData);
    }

    if (userStore.currentUser && userRoleStore.currentUserRole.length > 0) {
      console.log("ข้อมูลครบถ้วน, redirect ไปหน้าโปรไฟล์");
      router.push(`/user/profile/${user.id}`);
    } else {
      console.log("ข้อมูลยังไม่ครบ, ทำการ redirect ไปหน้า login");
      router.push('/login');
    }

  } catch (error) {
    console.error("Login error:", error);
    alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
  }
};
</script>

<template>
  <div class="login-page">
    <h2>เข้าสู่ระบบ</h2>
    <div class="form-group">
      <label for="email">อีเมล</label>
      <input type="email" id="email" v-model="email" required />
    </div>
    <div class="form-group">
      <label for="password">รหัสผ่าน</label>
      <input type="password" id="password" v-model="password" required />
    </div>
    <button @click="login">เข้าสู่ระบบ</button>
    <p>ยังไม่มีบัญชี? <router-link to="/register">ลงทะเบียน</router-link></p>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>



<style scoped>
.login-page {
  max-width: 400px;
  margin: 100px auto;
  padding: 2rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.form-group {
  margin-bottom: 1rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #04bd35;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #5ef684;
  transition: background-color 0.3s ease;
}

.error {
  margin-top: 1rem;
  color: red;
}
</style>

<!-- <script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';          // ✅ เพิ่มบรรทัดนี้
import { useUserRoleStore } from '@/store/userRoleStore';


const email = ref('');
const password = ref('');
const router = useRouter();
const authStore = useAuthStore();
const error = ref('');

const login = async () => {
  try {
    const user = await authStore.login({ email: email.value, password: password.value });

    if (!user || !user.id) {
      console.error("User ID is not available");
      return;
    }

    // เก็บข้อมูลลง localStorage
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('user_first_name', user.first_name);
    localStorage.setItem('user_last_name', user.last_name);
    localStorage.setItem('user_image_url', String(user.image_url));
    localStorage.setItem('user_position', user.position_name);
    localStorage.setItem('user_token', user.token || '');

    // ตรวจสอบให้แน่ใจว่าข้อมูลถูกโหลด
    const userStore = useUserStore();
    const userRoleStore = useUserRoleStore();

    // ตรวจสอบว่า store มีข้อมูลครบถ้วนหรือยัง
    // ตรวจสอบว่า store มีข้อมูลครบถ้วนหรือยัง
    if (!userStore.currentUser || userRoleStore.currentUserRole.length === 0) {
      console.log("ข้อมูลไม่ครบถ้วน, รอการโหลดข้อมูล");
      await userStore.getUserById(user.id);
      console.log('User loaded:', userStore.currentUser);

      const roleData = await userRoleStore.getUserRoleById(user.id);
      console.log('✅ Role loaded:', roleData);
    }

    // ตรวจสอบข้อมูลอีกครั้งหลังจากโหลด
    if (userStore.currentUser && userRoleStore.currentUserRole.length > 0) {
      console.log("ข้อมูลครบถ้วน, redirect ไปหน้าโปรไฟล์");
      router.push(`/user/profile/${user.id}`);
    } else {
      console.log("ข้อมูลยังไม่ครบ, ทำการ redirect ไปหน้า login");
      router.push('/login');
    }

  } catch (error) {
    console.error("Login error:", error);
    alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
  }
};

</script>

<template>
  <div class="login-page">
    <h2>เข้าสู่ระบบ</h2>
    <div class="form-group">
      <label for="email">อีเมล</label>
      <input type="email" id="email" v-model="email" required />
    </div>
    <div class="form-group">
      <label for="password">รหัสผ่าน</label>
      <input type="password" id="password" v-model="password" required />
    </div>
    <button @click="login">เข้าสู่ระบบ</button>
    <p>ยังไม่มีบัญชี? <router-link to="/register">ลงทะเบียน</router-link></p>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<style scoped>
.login-page {
  max-width: 400px;
  margin: 100px auto;
  padding: 2rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.form-group {
  margin-bottom: 1rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #04bd35;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #5ef684;
}

.error {
  margin-top: 1rem;
  color: red;
}
</style> -->
