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
      <div style="margin-top: 8px">
        <button class="edit-btn" @click="reportStore.fetchReports()">
          โหลดข้อมูลอีกครั้ง
        </button>
      </div>
    </div>

    <div v-else class="table-wrapper">
      <table class="reports-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ห้อง</th>
            <th>รายละเอียด</th>
            <th>แจ้งโดย</th>
            <th>วันที่แจ้ง</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rep, idx) in reportStore.reports" :key="rep.id">
            <td>{{ idx + 1 }}</td>
            <td>{{ roomName(rep.room_id) }}</td>
            <td class="desc">{{ rep.description }}</td>
            <td>
              {{ rep.name_user || rep.user_name || rep.user || rep.user_id }}
            </td>
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
  max-width: 1400px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  padding: 40px 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.title {
  padding: 10px;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
  color: #2d2d2d;
}

.no-data {
  padding: 40px;
  color: #999;
  text-align: center;
  font-size: 16px;
}
.table-wrapper {
  overflow-x: auto;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
}

.reports-table th,
.reports-table td {
  border: 1px solid #e0e0e0;
  padding: 14px 16px;
  text-align: left;
}

.reports-table thead th {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}

.reports-table tbody tr {
  background: #ffffff;
  transition: all 0.2s;
}

.reports-table tbody tr:hover {
  background: #f8f9fa;
}

.desc {
  max-width: 480px;
  white-space: pre-wrap;
  line-height: 1.6;
  color: #333;
}

.edit-btn {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
}

.edit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}
</style>
