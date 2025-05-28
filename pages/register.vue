<script setup>
import { ref, onMounted } from "vue";
import { useAuthStore } from "@/store/authStore";
import { useUserPositionStore } from "@/store/userPositionStore";

definePageMeta({
    middleware: []
});

const authStore = useAuthStore();
const userPositionStore = useUserPositionStore();
const User = ref({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    position_name: null,
    image_url: "", // ใช้สำหรับ preview รูป
    imageFile: null, // ไฟล์จริง ใช้ส่งไป backend
});

const positions = ref([]);

onMounted(async () => {
    await userPositionStore.fetchUserPositions();
    positions.value = userPositionStore.userPositions;
});


const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        User.value.imageFile = file;
        User.value.image_url = URL.createObjectURL(file); // Preview รูป
    }
};

const handleRegister = async () => {
    if (!User.value.first_name.trim()) {
        alert("กรุณากรอกชื่อ");
        return;
    }
    if (!User.value.last_name.trim()) {
        alert("กรุณากรอกนามสกุล");
        return;
    }
    if (!User.value.email.trim()) {
        alert("กรุณากรอกอีเมล");
        return;
    }
    if (!User.value.password.trim()) {
        alert("กรุณากรอกรหัสผ่าน");
        return;
    }
    if (!User.value.phone.trim()) {
        alert("กรุณากรอกเบอร์โทรศัพท์");
        return;
    }
    // if (!User.value.position_name) {
    //     alert("กรุณาเลือกตำแหน่ง");
    //     return;
    // }
    if (!User.value.imageFile) {
        alert("กรุณาเลือกไฟล์รูปภาพ");
        return;
    }

    const register = await authStore.register({
        first_name: User.value.first_name,
        last_name: User.value.last_name,
        email: User.value.email,
        password: User.value.password,
        phone: User.value.phone,
        position_name: User.value.position_name,
        image_url: User.value.imageFile, // สำคัญ! ส่งไฟล์
    });

    if (register && register.data && register.data.ID) {
        alert("สมัครสมาชิกสำเร็จ!");
        window.location.href = "/login";
    } else {
        alert("สมัครสมาชิกไม่สำเร็จ");
    }
    User.value = {
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone: "",
        position_name: "",
        image_url: "",
        imageFile: null,
    };
};

</script>

<template>
    <div class="register-container">
      <h1 class="title">สมัครสมาชิก</h1>
  
      <div class="form-group">
        <label>ชื่อ:</label>
        <input type="text" v-model="User.first_name" />
      </div>
  
      <div class="form-group">
        <label>นามสกุล:</label>
        <input type="text" v-model="User.last_name" />
      </div>
  
      <div class="form-group">
        <label>อีเมล:</label>
        <input type="email" v-model="User.email" />
      </div>
  
      <div class="form-group">
        <label>รหัสผ่าน:</label>
        <input type="password" v-model="User.password" />
      </div>
  
      <div class="form-group">
        <label>เบอร์โทรศัพท์:</label>
        <input type="text" v-model="User.phone" />
      </div>
  
      <div class="form-group">
        <label>ตำแหน่ง:</label>
        <select v-model="User.position_name">
          <option disabled value="">-- เลือกตำแหน่ง --</option>
          <option v-for="position in positions" :key="position.id" :value="position.name">
            {{ position.name }}
          </option>
        </select>
      </div>
  
      <div class="form-group">
        <label>อัปโหลดรูปภาพ:</label>
        <input type="file" @change="handleImageUpload" accept="image/*" />
        <div v-if="User.image_url" class="image-preview">
          <img :src="User.image_url" alt="preview" />
        </div>
      </div>
  
      <button @click="handleRegister">สมัครสมาชิก</button>
      <div v-if="authStore.error" class="error-message">{{ authStore.error }}</div>
    </div>
  </template>
  



<style scoped>
.register-container {
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  color: #04bd35;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
}

label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

input,
select {
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

input:focus,
select:focus {
  outline: none;
  border-color: #04bd35;
  box-shadow: 0 0 0 3px rgba(4, 189, 53, 0.15);
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #04bd35;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-top: 1rem;
}

button:hover {
  background-color: #5ef684;
  transition: background-color 0.3s ease;
}

.error-message {
  color: red;
  margin-top: 1rem;
  text-align: center;
}

.image-preview {
  margin-top: 10px;
}

.image-preview img {
  max-width: 150px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

</style>