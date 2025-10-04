<script setup>
import { ref, onMounted, computed } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";

import { useRoomStore } from "@/store/roomStore";
import { useReport } from "@/store/reportStore";
import { useUserStore } from "@/store/userStore";

definePageMeta({ middleware: ["load-user"] });

const roomStore = useRoomStore();
const reportStore = useReport();
const userStore = useUserStore();

const selectedRoomId = ref("");
const description = ref("");

const { isLoading: roomsLoading } = storeToRefs(roomStore);
const { isLoading: reportsLoading } = storeToRefs(reportStore);
const isLoading = computed(() => roomsLoading.value || reportsLoading.value);

const userId = ref(null);

onMounted(async () => {
  // load user id (for report payload)
  const uid = localStorage.getItem("user_id");
  userId.value = uid;
  if (uid) {
    try {
      await userStore.getUserById(uid);
    } catch {}
  }
  // fetch rooms for selection
  await roomStore.fetchAllRooms();
});

// ไม่ต้องมีการค้นหา: แสดงทุกห้องจาก roomStore.rooms

const pickRoom = (id) => {
  selectedRoomId.value = String(id);
};

const canSubmit = computed(() => {
  return Boolean(
    selectedRoomId.value && description.value.trim().length >= 5 && userId.value
  );
});

const submitReport = async () => {
  if (!canSubmit.value) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกห้องและกรอกรายละเอียด",
      text: "รายละเอียดควรมีอย่างน้อย 5 ตัวอักษร",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
    return;
  }
  try {
    const payload = {
      user_id: userId.value,
      room_id: selectedRoomId.value,
      description: description.value.trim(),
    };
    await reportStore.addReport(payload);
    await Swal.fire({
      icon: "success",
      title: "ส่งรายงานเรียบร้อย",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
    description.value = "";
  } catch (e) {
    await Swal.fire({
      icon: "error",
      title: "ไม่สามารถส่งรายงานได้",
      text: e?.message || "โปรดลองอีกครั้ง",
      confirmButtonText: "ตกลง",
      customClass: { popup: "my-popup", confirmButton: "btn-ok" },
    });
  }
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="reports-container">
    <h2 class="title">แจ้งปัญหาห้องประชุม</h2>

    <!-- Form -->
    <div class="report-form">
      <div class="form-row">
        <div class="form-group">
          <label>เลือกห้อง</label>
          <select v-model="selectedRoomId">
            <option value="" disabled>-- เลือกห้อง --</option>
            <option
              v-for="r in roomStore.rooms"
              :key="r.id"
              :value="String(r.id)"
            >
              {{ r.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>รายละเอียดปัญหา</label>
        <textarea
          v-model="description"
          rows="4"
          placeholder="อธิบายปัญหาที่พบ"
        ></textarea>
        <small class="hint">โปรดระบุรายละเอียดอย่างน้อย 5 ตัวอักษร</small>
      </div>

      <button class="submit" :disabled="!canSubmit" @click="submitReport">
        ส่งรายงานปัญหา
      </button>
    </div>

    <!-- Rooms Grid -->
    <div class="rooms-grid">
      <div
        v-for="room in roomStore.rooms"
        :key="room.id"
        class="room-card"
        :class="{ active: String(room.id) === String(selectedRoomId) }"
      >
        <img
          :src="room.image_url || '/images/default-picture.png'"
          :alt="room.name"
        />
        <div class="room-info">
          <div class="room-name">{{ room.name }}</div>
          <div class="room-desc">{{ room.description }}</div>
        </div>
        <button class="pick" @click="pickRoom(room.id)">เลือกห้องนี้</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-container {
  max-width: 1000px;
  margin: 24px auto;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.title {
  margin: 0 0 16px;
  font-size: 22px;
  color: #13131f;
}
.report-form {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
  margin-bottom: 24px;
}
.form-row {
  display: flex;
  gap: 16px;
}
.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
}
select,
input,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}
.hint {
  color: #6b7280;
}
.submit {
  margin-top: 12px;
  background: #13131f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
}
.submit:disabled {
  background: #9aa0a6;
  cursor: not-allowed;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}
.room-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.room-card.active {
  outline: 2px solid #2d6cdf;
}
.room-card img {
  width: 100%;
  height: 140px;
  object-fit: cover;
}
.room-info {
  padding: 10px;
}
.room-name {
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}
.room-desc {
  color: #6b7280;
  font-size: 13px;
  min-height: 36px;
}
.pick {
  margin: 10px;
  background: #2d6cdf;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
</style>
