<script setup>
import { onMounted, ref, computed } from "vue";
import { useReport } from "@/store/reportStore";
import { useRoomStore } from "@/store/roomStore";
import LoadingPage from "@/components/Loading.vue";
import dayjs from "dayjs";
import { navigateTo } from "#app";

definePageMeta({ middleware: ["load-user"] });

const reportStore = useReport();
const roomStore = useRoomStore();

const { isLoading: reportsLoading } = storeToRefs(reportStore);
const { isLoading: roomsLoading } = storeToRefs(roomStore);
const isLoading = computed(() => reportsLoading.value || roomsLoading.value);

onMounted(async () => {
  await Promise.all([reportStore.fetchReports(), roomStore.fetchAllRooms()]);
});

const roomName = (room_id) => {
  const r = roomStore.rooms.find((r) => String(r.id) === String(room_id));
  return r?.name || `Room #${room_id}`;
};

const goEditRoom = (room_id) => {
  if (!room_id) return;
  navigateTo(`/admin/rooms/edit/${room_id}`);
};

// Helper: normalize various timestamp formats/keys to formatted date string
const toUnixSeconds = (val) => {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (Number.isFinite(num)) {
    // Detect ms vs s
    if (num > 1e12 || num > 1e10) return Math.floor(num / 1000);
    if (num >= 0) return Math.floor(num);
    return null;
  }
  if (typeof val === "string") {
    const ts = Date.parse(val);
    if (!Number.isNaN(ts)) return Math.floor(ts / 1000);
  }
  return null;
};

const formatCreatedAt = (rep) => {
  const raw =
    rep?.create_at ??
    rep?.created_at ??
    rep?.createdAt ??
    rep?.createAt ??
    rep?.created ??
    rep?.createdDate ??
    rep?.created_time ??
    rep?.createdTime;
  const unix = toUnixSeconds(raw);
  return unix !== null ? dayjs.unix(unix).format("DD/MM/YYYY เวลา HH:mm") : "-";
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="admin-reports">
    <h2 class="title">รายงานปัญหาห้องประชุม</h2>

    <div v-if="reportStore.reports.length === 0" class="no-data">
      ยังไม่มีการรายงานปัญหา
    </div>

    <div v-else class="table-wrapper">
      <table class="reports-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ห้อง</th>
            <th>รายละเอียด</th>
            <th>แจ้งโดย (user_id)</th>
            <th>วันที่แจ้ง</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rep, idx) in reportStore.reports" :key="rep.id">
            <td>{{ idx + 1 }}</td>
            <td>{{ roomName(rep.room_id) }}</td>
            <td class="desc">{{ rep.description }}</td>
            <td>{{ rep.user_id }}</td>
            <td>{{ formatCreatedAt(rep) }}</td>
            <td>
              <button class="edit-btn" @click="goEditRoom(rep.room_id)">
                ไปแก้ไขห้อง
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.admin-reports {
  max-width: 1100px;
  margin: 24px auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05);
}
.title {
  font-size: 22px;
  margin: 0 0 16px;
  color: #13131f;
}
.no-data {
  padding: 16px;
  color: #6b7280;
  text-align: center;
}
.table-wrapper {
  overflow-x: auto;
}
.reports-table {
  width: 100%;
  border-collapse: collapse;
}
.reports-table th,
.reports-table td {
  border: 1px solid #e5e7eb;
  padding: 10px;
  text-align: left;
}
.reports-table thead th {
  background: #f3f4f6;
}
.desc {
  max-width: 480px;
  white-space: pre-wrap;
}
.edit-btn {
  background: #2d6cdf;
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.edit-btn:hover {
  background: #1f54b8;
}
</style>
