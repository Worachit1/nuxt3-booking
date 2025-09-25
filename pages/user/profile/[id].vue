<script setup>
import { onMounted, computed, ref, reactive } from "vue";
import { useUserStore } from "@/store/userStore";
import { useRouter, useRoute } from "vue-router";
import LoadingPage from "~/components/Loading.vue";
import Swal from "sweetalert2";

const route = useRoute();
const router = useRouter();
const userId = route.params.id || localStorage.getItem("user_id");

const userStore = useUserStore();
const { isLoading } = storeToRefs(userStore);

const user = computed(() => userStore.currentUser || null);

const isEditing = ref(false);
const editUser = reactive({
  first_name: "",
  last_name: "",
  phone: "",
  image_url: "",
  password: "",
  position_name: "",
  imageFile: null,
});
const previewImage = ref("");

const handleImageError = (e) => {
  e.target.src = "/images/default-profile.jpg";
};

const handleBackButton = () => {
  router.push("/");
};

const startEdit = () => {
  isEditing.value = true;
  editUser.first_name = user.value.first_name;
  editUser.last_name = user.value.last_name;
  editUser.phone = user.value.phone;
  editUser.position_name = user.value.position_name;
  editUser.password = ""; // ไม่เปลี่ยนรหัสผ่าน
  editUser.image_url = user.value.image_url;
  previewImage.value = user.value.image_url;
};

const cancelEdit = () => {
  isEditing.value = false;
  previewImage.value = "";
};

const onImageChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    editUser.imageFile = file;
    previewImage.value = URL.createObjectURL(file);
    editUser.image_url = file;
  }
};

const saveEdit = async () => {
  try {
    await userStore.updateUser(user.value.id, editUser);
    await userStore.getUserById(user.value.id);
    Swal.fire("สำเร็จ", "บันทึกข้อมูลเรียบร้อย", "success");
    isEditing.value = false;
    previewImage.value = "";
  } catch (e) {
    Swal.fire("ผิดพลาด", "ไม่สามารถบันทึกข้อมูลได้", "error");
  }
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
        :src="previewImage || user.image_url || '/images/default-profile.jpg'"
        alt="Profile"
        class="profile-img"
        @error="handleImageError"
      />
      <p class="profile-name">{{ user.first_name }} {{ user.last_name }}</p>
      <p>อีเมล : {{ user.email }}</p>
      <p>ตำแหน่งงาน : {{ user.position_name || "—" }}</p>
      <button v-if="!isEditing" class="edit-btn" @click="startEdit">
        <i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูล
      </button>
      <div v-if="isEditing" style="margin-top: 10px">
        <input type="file" @change="onImageChange" accept="image/*" />
      </div>
    </div>

    <!-- กล่องขวา -->
    <div class="profile-right">
      <h2>ข้อมูลบุคคล</h2>
      <div class="form-grid">
        <div>
          <label>ชื่อ</label>
          <input
            class="input-box"
            type="text"
            placeholder="กรอกชื่อ"
            :value="isEditing ? editUser.first_name : user.first_name"
            :readonly="!isEditing"
            @input="(e) => (editUser.first_name = e.target.value)"
            :style="!isEditing ? 'background:#f3f3f3;cursor:not-allowed;' : ''"
          />
        </div>
        <div>
          <label>นามสกุล</label>
          <input
            class="input-box"
            type="text"
            placeholder="กรอกนามสกุล"
            :value="isEditing ? editUser.last_name : user.last_name"
            :readonly="!isEditing"
            @input="(e) => (editUser.last_name = e.target.value)"
            :style="!isEditing ? 'background:#f3f3f3;cursor:not-allowed;' : ''"
          />
        </div>
      </div>
      <div class="form-grid">
        <div>
          <label>เบอร์โทรศัพท์</label>
          <input
            class="input-box"
            type="text"
            placeholder="กรอกเบอร์โทรศัพท์"
            :value="isEditing ? editUser.phone : user.phone"
            :readonly="!isEditing"
            @input="(e) => (editUser.phone = e.target.value)"
            :style="!isEditing ? 'background:#f3f3f3;cursor:not-allowed;' : ''"
          />
        </div>
      </div>

      <div class="button-row">
        <button v-if="isEditing" class="btn-black" @click="saveEdit">
          บันทึกข้อมูล
        </button>
        <button v-if="isEditing" class="btn-back" @click="cancelEdit">
          ยกเลิก
        </button>
        <button v-else @click="handleBackButton" class="btn-back"><i class="fa-solid fa-arrow-left"></i> กลับ</button>
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
  background-color: #2196f3;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: background 0.2s;
}
.edit-btn:hover {
  background-color: #1769aa;
}

.btn-black {
  background-color: #222f3e;
  color: #fff;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: background 0.2s;
}
.btn-black:hover {
  background-color: #3a3a4a;
}

.btn-back {
  background-color: #f44336;
  color: #fff;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  margin-right: 0;
  margin-top: 0;
  transition: background 0.2s;
}
.btn-back:hover {
  background-color: #c62828;
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
</style>
