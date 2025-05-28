<script setup>
import { onMounted, computed } from "vue";
import { useUserStore } from "@/store/userStore";
import { useRouter, useRoute } from "vue-router";

import LoadingPage from "~/components/Loading.vue";

const route = useRoute();
const router = useRouter();
const userId = route.params.id || localStorage.getItem("user_id");

const userStore = useUserStore();
const { isLoading } = storeToRefs(userStore);

const user = computed(() => userStore.currentUser || null);

const handleImageError = (e) => {
  e.target.src = "/images/default-profile.jpg";
};

const handleBackButton = () => {
  router.push("/");
};

onMounted(async () => {
  if (!localStorage.getItem("reloaded")) {
    localStorage.setItem("reloaded", "true");
    window.location.reload();
  } else {
    localStorage.removeItem("reloaded");
    if (userId) {
      await userStore.getUserById(userId);
    }
  }
});
</script>

<template>
  <LoadingPage v-if="isLoading" />
  <div v-if="user" class="profile-container">
    <!-- กล่องซ้าย -->
    <div class="profile-left">
      <img
        :src="user.image_url || '/images/default-profile.jpg'"
        alt="Profile"
        class="profile-img"
        @error="handleImageError"
      />
      <p class="profile-name">{{ user.first_name }} {{ user.last_name }}</p>
      <p>อีเมล : {{ user.email }}</p>
      <p>ตำแหน่งงาน : {{ user.position_name || "—" }}</p>
      <!-- <button class="edit-btn">✏️ แก้ไขรูป</button> -->
    </div>

    <!-- กล่องขวา -->
    <div class="profile-right">
      <h2>ข้อมูลบุคคล</h2>
      <div class="form-grid">
        <div>
          <label>ชื่อ</label>
          <input
            disabled
            class="input-box"
            type="text"
            placeholder="กรอกชื่อ"
            :value="user.first_name"
          />
        </div>
        <div>
          <label>นามสกุล</label>
          <input
            disabled
            class="input-box"
            type="text"
            placeholder="กรอกนามสกุล"
            :value="user.last_name"
          />
        </div>
      </div>
      <div class="form-grid">
        <div>
          <label>เบอร์โทรศัพท์</label>
          <input
            disabled
            class="input-box"
            type="text"
            placeholder="กรอกเบอร์โทรศัพท์"
            :value="user.phone || '—'"
          />
        </div>
      </div>

      <div class="button-row">
        <!-- <button class="btn-black">บันทึกข้อมูล</button> -->
        <button @click="handleBackButton" class="btn-orange">กลับ</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  display: flex;
  gap: 40px;
  padding: 30px;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 50px auto;
  max-width: 850px;
}

.profile-left {
  width: 250px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 12px;
  text-align: start;
  height: 40%;
}

.profile-img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 50%;
  margin-bottom: 10px;
}

.profile-name {
  font-weight: bold;
  margin-bottom: 10px;
}

.edit-btn {
  margin-top: 10px;
  background-color: #00aaff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.profile-right {
  flex: 1;
}

h2 {
  margin-bottom: 20px;
}

.form-grid {
  display: grid;
  gap: 20px 0px;
}

.form-grid label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
}

.input-box {
  width: 40%;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 12px;
  background-color: #fff;
  font-size: 14px;
  outline: none;
}

.input-box:focus {
  border-color: #00aaff;
}

.button-row {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 30px;
}

.btn-black {
  background-color: black;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

.btn-orange {
  background-color: #13131f;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  margin-right: 20px;
  margin-top: 50px;
}

.btn-orange:hover {
  background-color: #4a4a4a;
  transition: background-color 0.3s ease;
}
</style>
