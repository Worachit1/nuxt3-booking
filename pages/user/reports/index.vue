<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";

import { useRoomStore } from "@/store/roomStore";
import { useReport } from "@/store/reportStore";
import { useUserStore } from "@/store/userStore";
import { useBuildingStore } from "@/store/buildingStore";
import { useBuilding_RoomStore } from "@/store/building_roomStore";

definePageMeta({ middleware: ["load-user"] });

const roomStore = useRoomStore();
const reportStore = useReport();
const userStore = useUserStore();
const buildingStore = useBuildingStore();
const buildingRoomStore = useBuilding_RoomStore();

const selectedBuildingId = ref("");
const selectedRoomId = ref("");
const description = ref("");

const { isLoading: roomsLoading } = storeToRefs(roomStore);
const { isLoading: reportsLoading } = storeToRefs(reportStore);
const { isLoading: buildingsLoading } = storeToRefs(buildingStore);
const { isLoading: buildingRoomsLoading } = storeToRefs(buildingRoomStore);
const isLoading = computed(
  () =>
    roomsLoading.value ||
    reportsLoading.value ||
    buildingsLoading.value ||
    buildingRoomsLoading.value
);

const userId = ref(null);
const buildings = ref([]);
const roomsInBuilding = ref([]);

onMounted(async () => {
  // load user id (for report payload)
  const uid = localStorage.getItem("user_id");
  userId.value = uid;
  if (uid) {
    try {
      await userStore.getUserById(uid);
    } catch {}
  }
  // fetch buildings for first-step selection
  await buildingStore.fetchBuildings();
  buildings.value = Array.isArray(buildingStore.buildings)
    ? buildingStore.buildings
    : [];
});

// โหลดห้องตามอาคารที่เลือก
const loadRoomsForBuilding = async () => {
  roomsInBuilding.value = [];
  selectedRoomId.value = "";
  const bId = selectedBuildingId.value;
  if (!bId) return;
  try {
    const res = await buildingRoomStore.getRoomsByBuildingId(String(bId));
    let list = [];
    // รองรับหลายรูปแบบข้อมูลจาก backend
    if (Array.isArray(res)) {
      list = res;
    } else if (res && Array.isArray(res.rooms)) {
      list = res.rooms;
    }
    // เปิดไส้ room จากรูปแบบ {room:{...}} หรือ normalize id/name
    const norm = [];
    for (const item of list) {
      const r = item?.room || item?.Room || item;
      let id = r?.id ?? r?.ID ?? r?.room_id ?? r?.roomId;
      let name = r?.name ?? r?.Name;
      let image_url = r?.image_url ?? r?.imageUrl ?? r?.image;
      let description = r?.description ?? r?.desc;
      if (!id && (item?.room_id || item?.roomId)) {
        id = item.room_id || item.roomId;
      }
      if (!name || !image_url) {
        // ดึงรายละเอียดห้องถ้าข้อมูลไม่ครบ
        if (id) {
          const full = await roomStore.getById(String(id));
          if (full) {
            name = name || full.name;
            image_url = image_url || full.image_url;
            description = description || full.description;
          }
        }
      }
      if (id) norm.push({ id, name, image_url, description });
    }
    // กันซ้ำตาม id
    const seen = new Set();
    roomsInBuilding.value = norm.filter((r) => {
      const key = String(r.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    // ถ้า endpoint ใช้ไม่ได้ ให้ fallback จาก buildings store (ถ้ามีโครงสร้าง)
    const b = buildings.value.find(
      (x) => String(x.id) === String(selectedBuildingId.value)
    );
    roomsInBuilding.value = Array.isArray(b?.rooms) ? b.rooms : [];
  }
};

watch(selectedBuildingId, () => {
  loadRoomsForBuilding();
});

const pickRoom = (id) => {
  selectedRoomId.value = String(id);
};

const canSubmit = computed(() => {
  return Boolean(
    selectedBuildingId.value &&
      selectedRoomId.value &&
      description.value.trim().length >= 5 &&
      userId.value
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
          <label>เลือกอาคาร</label>
          <select v-model="selectedBuildingId">
            <option value="" disabled>-- เลือกอาคาร --</option>
            <option v-for="b in buildings" :key="b.id" :value="String(b.id)">
              {{ b.name || b.building_name || b.id }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>เลือกห้อง</label>
          <select v-model="selectedRoomId" :disabled="!selectedBuildingId">
            <option value="" disabled>-- เลือกห้อง --</option>
            <option
              v-for="r in roomsInBuilding"
              :key="r.id"
              :value="String(r.id)"
            >
              {{ r.name || r.id }}
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
    <div v-if="!selectedBuildingId" class="hint-select">
      กรุณาเลือกอาคารก่อน
    </div>
    <div v-else class="rooms-grid">
      <div
        v-for="room in roomsInBuilding"
        :key="room.id"
        class="room-card"
        :class="{ active: String(room.id) === String(selectedRoomId) }"
      >
        <img
          :src="room.image_url || '/images/default-picture.png'"
          :alt="room.name"
        />
        <div class="room-info">
          <div class="room-name">{{ room.name || room.id }}</div>
          <div class="room-desc">{{ room.description }}</div>
        </div>
        <button class="pick" @click="pickRoom(room.id)">เลือกห้องนี้</button>
      </div>
      <div v-if="roomsInBuilding.length === 0" class="hint-select">
        ไม่มีห้องในอาคารนี้
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
.hint-select {
  margin-top: 8px;
  color: #6b7280;
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
