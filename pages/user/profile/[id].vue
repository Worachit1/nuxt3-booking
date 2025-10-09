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
        <button v-else @click="handleBackButton" class="btn-back">
          <i class="fa-solid fa-arrow-left"></i> กลับ
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  display: flex;
  gap: 30px;
  padding: 40px 30px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin: 0 auto;
  max-width: 1200px;
}

.profile-left {
  width: 300px;
  padding: 30px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  text-align: center;
  background: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.profile-img {
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 50%;
  margin-bottom: 10px;
  border: 4px solid #2d2d2d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.profile-left p {
  margin: 6px 0;
  font-size: 15px;
  color: #333;
  line-height: 1.6;
  text-align: center;
}

.profile-name {
  font-weight: 700;
  font-size: 20px;
  margin: 12px 0;
  color: #2d2d2d;
}

.profile-left input[type="file"] {
  margin-top: 10px;
  padding: 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  background: #ffffff;
  width: 100%;
}

.edit-btn {
  margin-top: 10px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.edit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}

.btn-black {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
}

.btn-black:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}

.btn-back {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  margin-right: 0;
  margin-top: 0;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.profile-right {
  flex: 1;
  background: #ffffff;
  padding: 30px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

h2 {
  margin: 0 0 24px 0;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
  font-size: 24px;
  font-weight: 700;
  color: #2d2d2d;
}

.form-grid {
  display: grid;
  gap: 24px 0px;
  margin-bottom: 24px;
}

.form-grid label {
  display: block;
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 16px;
  color: #2d2d2d;
}

.input-box {
  width: 60%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background-color: #fff;
  font-size: 15px;
  outline: none;
  transition: all 0.3s;
}

.input-box:focus {
  border-color: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

.input-box[readonly] {
  background: #f3f3f3 !important;
  cursor: not-allowed !important;
  color: #666;
}

.button-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
  padding-top: 24px;
  border-top: 2px solid #e0e0e0;
}
</style>
