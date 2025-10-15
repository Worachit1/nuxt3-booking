<script setup>
import { onMounted, computed, ref, reactive } from "vue";
import { storeToRefs } from "pinia";
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

const handleLogout = async () => {
  const result = await Swal.fire({
    title: "ออกจากระบบ?",
    text: "คุณต้องการออกจากระบบใช่หรือไม่?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
  });

  if (result.isConfirmed) {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_role_name");
    Swal.fire({
      title: "ออกจากระบบสำเร็จ",
      text: "กำลังนำคุณไปยังหน้าเข้าสู่ระบบ",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });
    setTimeout(() => {
      router.push("/login");
    }, 1500);
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
  <div v-if="user" class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <i class="fa-solid fa-user"></i>
        </div>
        <div class="header-text">
          <h1>โปรไฟล์ส่วนตัว</h1>
          <p class="subtitle">จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชีของคุณ</p>
        </div>
      </div>
      <div class="header-actions">
        <button v-if="!isEditing" class="btn-edit" @click="startEdit">
          <i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูล
        </button>
        <button @click="handleBackButton" class="btn-back-header">
          <i class="fa-solid fa-arrow-left"></i> กลับ
        </button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Profile Card -->
      <div class="profile-card">
        <!-- Profile Image Section -->
        <div class="profile-image-section">
          <div class="image-container">
            <img
              :src="previewImage || user.image_url || '/images/default-profile.jpg'"
              alt="Profile"
              class="profile-img"
              @error="handleImageError"
            />
            <div v-if="isEditing" class="image-overlay">
              <label for="file-input" class="image-upload-btn">
                <i class="fa-solid fa-camera"></i>
                <span>เปลี่ยนรูปภาพ</span>
              </label>
              <input
                id="file-input"
                type="file"
                @change="onImageChange"
                accept="image/*"
                style="display: none"
              />
            </div>
          </div>

          <!-- Profile Info Summary -->
          <div class="profile-summary">
            <h2 class="profile-name">{{ user.first_name }} {{ user.last_name }}</h2>
            <div class="profile-meta">
              <div class="meta-item">
                <i class="fa-solid fa-envelope"></i>
                <span>{{ user.email }}</span>
              </div>
              <div class="meta-item">
                <i class="fa-solid fa-briefcase"></i>
                <span>{{ user.position_name || "ไม่ระบุตำแหน่ง" }}</span>
              </div>
              <div class="meta-item">
                <i class="fa-solid fa-shield-halved"></i>
                <span class="role-badge">{{ user.role_name || "User" }}</span>
              </div>
            </div>

            <!-- Logout Button -->
            <button class="btn-logout" @click="handleLogout">
              <i class="fa-solid fa-right-from-bracket"></i>
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>

        <!-- Profile Details Section -->
        <div class="profile-details-section">
          <div class="section-header">
            <h3>
              <i class="fa-solid fa-address-card"></i>
              ข้อมูลส่วนตัว
            </h3>
            <span v-if="!isEditing" class="edit-hint">
              <i class="fa-solid fa-info-circle"></i>
              คลิก "แก้ไขข้อมูล" เพื่อเปลี่ยนแปลงข้อมูล
            </span>
          </div>

          <div class="form-section">
            <!-- Personal Information -->
            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-user"></i>
                  ชื่อ
                </label>
                <input
                  class="input-box"
                  type="text"
                  placeholder="กรอกชื่อ"
                  :value="isEditing ? editUser.first_name : user.first_name"
                  :readonly="!isEditing"
                  @input="(e) => (editUser.first_name = e.target.value)"
                />
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-user"></i>
                  นามสกุล
                </label>
                <input
                  class="input-box"
                  type="text"
                  placeholder="กรอกนามสกุล"
                  :value="isEditing ? editUser.last_name : user.last_name"
                  :readonly="!isEditing"
                  @input="(e) => (editUser.last_name = e.target.value)"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-envelope"></i>
                  อีเมล
                </label>
                <input
                  class="input-box"
                  type="email"
                  :value="user.email"
                  readonly
                  disabled
                />
                <span class="field-note">อีเมลไม่สามารถเปลี่ยนแปลงได้</span>
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-phone"></i>
                  เบอร์โทรศัพท์
                </label>
                <input
                  class="input-box"
                  type="text"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  :value="isEditing ? editUser.phone : user.phone"
                  :readonly="!isEditing"
                  @input="(e) => (editUser.phone = e.target.value)"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>
                  <i class="fa-solid fa-briefcase"></i>
                  ตำแหน่งงาน
                </label>
                <input
                  class="input-box"
                  type="text"
                  :value="user.position_name || 'ไม่ระบุ'"
                  readonly
                  disabled
                />
                <span class="field-note">ติดต่อผู้ดูแลระบบเพื่อเปลี่ยนแปลง</span>
              </div>

              <div class="form-group">
                <label>
                  <i class="fa-solid fa-shield-halved"></i>
                  ระดับสิทธิ์
                </label>
                <input
                  class="input-box"
                  type="text"
                  :value="user.role_name || 'User'"
                  readonly
                  disabled
                />
              </div>
            </div>

            <!-- Password Section (Only when editing) -->
            <div v-if="isEditing" class="password-section">
              <div class="section-divider">
                <span>
                  <i class="fa-solid fa-lock"></i>
                  เปลี่ยนรหัสผ่าน (ถ้าต้องการ)
                </span>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>
                    <i class="fa-solid fa-key"></i>
                    รหัสผ่านใหม่
                  </label>
                  <input
                    class="input-box"
                    type="password"
                    placeholder="ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน"
                    v-model="editUser.password"
                  />
                  <span class="field-note">ปล่อยว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-if="isEditing" class="action-buttons">
            <button class="btn-save" @click="saveEdit">
              <i class="fa-solid fa-check"></i>
              บันทึกการเปลี่ยนแปลง
            </button>
            <button class="btn-cancel" @click="cancelEdit">
              <i class="fa-solid fa-times"></i>
              ยกเลิก
            </button>
          </div>
        </div>
        <button
          class="btn-edit"
          style="margin: 32px auto 0 auto; display: block;"
          @click="router.push(`/user/profile/${userId}/line`)"
        >
          <i class="fa-brands fa-line"></i>
          เชื่อม LINE เพื่อรับการแจ้งเตือน
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page Container */
.page-container {
  background: #f5f5f5;
  min-height: 100vh;
  padding: 100px 20px 40px 20px;
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border-radius: 16px;
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

.header-text h1 {
  margin: 0 !important;
  padding: 0 !important;
  font-size: 28px !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  line-height: 1.2;
}

.subtitle {
  color: #cbd5e0;
  font-size: 14px;
  margin: 8px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-edit {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-edit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

.btn-back-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.2);
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back-header:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

/* Content Wrapper */
.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

/* Profile Card */
.profile-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.profile-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Profile Image Section */
.profile-image-section {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 48px 40px;
  display: flex;
  align-items: center;
  gap: 40px;
  position: relative;
  overflow: hidden;
}

.profile-image-section::before {
  content: "";
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.image-container {
  position: relative;
  flex-shrink: 0;
}

.profile-img {
  width: 160px;
  height: 160px;
  object-fit: cover;
  border-radius: 50%;
  border: 5px solid #fbbf24;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.profile-img:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(251, 191, 36, 0.4);
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
}

.image-upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
  transition: all 0.3s ease;
  gap: 4px;
}

.image-upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.5);
}

.image-upload-btn i {
  font-size: 14px;
}

/* Profile Summary */
.profile-summary {
  flex: 1;
  color: white;
}

.profile-name {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 20px 0;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.meta-item:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(4px);
}

.meta-item i {
  font-size: 18px;
  color: #fbbf24;
  width: 24px;
  text-align: center;
}

.meta-item span {
  font-size: 15px;
  color: #cbd5e0;
  font-weight: 500;
}

/* Logout Button */
.btn-logout {
  margin-top: 24px;
  width: 100%;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: #ffffff;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-logout:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.5);
  background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
}

.btn-logout:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-logout i {
  font-size: 20px;
}

.role-badge {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff !important;
  padding: 4px 12px;
  border-radius: 6px;
  font-weight: 700 !important;
  font-size: 13px !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Profile Details Section */
.profile-details-section {
  padding: 40px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
  flex-wrap: wrap;
  gap: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-header h3 i {
  color: #fbbf24;
  font-size: 24px;
}

.edit-hint {
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.edit-hint i {
  color: #fbbf24;
}

/* Form Section */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
  color: #2d2d2d;
}

.form-group label i {
  color: #fbbf24;
  font-size: 16px;
  width: 20px;
}

.input-box {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background-color: #fff;
  font-size: 15px;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.input-box:focus {
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

.input-box:hover:not([readonly]):not([disabled]) {
  border-color: #fbbf24;
}

.input-box[readonly],
.input-box[disabled] {
  background: #f8f9fa !important;
  cursor: not-allowed !important;
  color: #6b7280;
  border-color: #e0e0e0;
}

.field-note {
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
  margin-top: -4px;
}

/* Password Section */
.password-section {
  margin-top: 16px;
  padding-top: 24px;
}

.section-divider {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
}

.section-divider span {
  font-size: 16px;
  font-weight: 700;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-divider i {
  color: #fbbf24;
  font-size: 18px;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #e0e0e0;
  flex-wrap: wrap;
}

.btn-save {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  border: none;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
}

.btn-cancel {
  background: #ffffff;
  color: #2d2d2d;
  border: 2px solid #e0e0e0;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-cancel:hover {
  background: #f8f9fa;
  border-color: #dc3545;
  color: #dc3545;
  transform: translateY(-2px);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .profile-image-section {
    flex-direction: column;
    text-align: center;
    padding: 40px 32px;
  }

  .profile-summary {
    width: 100%;
  }

  .profile-name {
    justify-content: center;
    font-size: 28px;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 80px 16px 32px 16px;
  }

  .page-header {
    padding: 24px;
    margin-bottom: 24px;
    flex-direction: column;
    align-items: flex-start;
  }

  .header-content {
    width: 100%;
  }

  .header-icon {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }

  .header-text h1 {
    font-size: 22px !important;
  }

  .subtitle {
    font-size: 13px;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .btn-edit,
  .btn-back-header {
    width: 100%;
    justify-content: center;
  }

  .profile-image-section {
    padding: 32px 24px;
  }

  .profile-img {
    width: 140px;
    height: 140px;
  }

  .profile-name {
    font-size: 24px;
  }

  .meta-item {
    padding: 10px 14px;
    font-size: 14px;
  }

  .meta-item i {
    font-size: 16px;
  }

  .profile-details-section {
    padding: 24px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-header h3 {
    font-size: 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .action-buttons {
    flex-direction: column-reverse;
  }

  .btn-save,
  .btn-cancel {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 20px 16px;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    font-size: 24px;
  }

  .header-text h1 {
    font-size: 18px !important;
  }

  .subtitle {
    font-size: 12px;
  }

  .profile-image-section {
    padding: 24px 16px;
  }

  .profile-img {
    width: 120px;
    height: 120px;
  }

  .profile-name {
    font-size: 20px;
  }

  .meta-item {
    font-size: 13px;
  }

  .profile-details-section {
    padding: 20px 16px;
  }

  .section-header h3 {
    font-size: 18px;
  }

  .input-box {
    padding: 12px 14px;
    font-size: 14px;
  }
}
</style>
