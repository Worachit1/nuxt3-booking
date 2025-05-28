<script setup>
import { ref, onMounted, computed, watch } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";
import { useBookingStore } from "~/store/bookingStore";
import { useRouter } from "vue-router";

const router = useRouter();
definePageMeta({
  middleware: ["load-user"],
});

const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);
const bookingStore = useBookingStore();

const rooms = ref([]);
const selectedRoom = ref(null);

const page = ref(1);
const size = ref(10);
const total = ref(0);
const jumpToPage = ref(1);

const fetchRooms = async () => {
  await roomStore.fetchRooms(page.value, size.value);
  rooms.value = roomStore.rooms;
  total.value = roomStore.total || 0;
};

const handleDeleteRoom = async (room) => {
  await bookingStore.fetchAllBookings?.();

  const roomBookings = bookingStore.bookings.filter(
    (booking) =>
      booking.room_id === room.id &&
      booking.status !== "Canceled" &&
      booking.status !== "Finished"
  );

  if (roomBookings.length > 0) {
    await Swal.fire({
      title: "ไม่สามารถลบได้",
      text: "เนื่องจากมีการจองอยู่ในห้องนี้ กรุณายกเลิกการจองก่อน",
      icon: "error",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  const result = await Swal.fire({
    title: `คุณต้องการลบห้อง <br>"${room.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    reverseButtons: true,
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-confirm",
      cancelButton: "btn-cancel",
    },
  });

  if (!result.isConfirmed) return;

  roomStore.isLoading = true;
  await roomStore.deleteRoom(room.id);
  await fetchRooms();
  roomStore.isLoading = false;

  await Swal.fire({
    title: "ลบแล้ว! ห้องถูกลบเรียบร้อย",
    icon: "success",
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-ok",
    },
  });

  selectedRoom.value = null;
};

const goTodetail = (id) => {
  router.push(`/admin/rooms/detail/${id}`);
};

const totalPages = computed(() => Math.ceil(total.value / size.value));

const paginationRange = computed(() => {
  const totalP = totalPages.value;
  const current = page.value;
  const delta = 1;
  const range = [];
  for (let i = 1; i <= totalP; i++) {
    if (
      i === 1 ||
      i === totalP ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== "...") {
      range.push("...");
    }
  }
  return range;
});

const gotoPage = async (p) => {
  if (
    p === "..." ||
    p === page.value ||
    p < 1 ||
    p > totalPages.value
  ) {
    return;
  }
  page.value = p;
  jumpToPage.value = p;
  await fetchRooms();
};

watch([page, size], fetchRooms);
onMounted(async () => {
  await bookingStore.fetchBookings();
  await fetchRooms();
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="container">
    <div class="header-row">
      <h1><i class="fa-solid fa-house-chimney"></i> รายการห้องประชุม</h1>
      <button class="btn-create" @click="router.push('/admin/rooms/createRoom')">
        <i class="fa-solid fa-circle-plus"></i> เพิ่มห้อง
      </button>
    </div>

    <table class="table table-bordered table-striped" v-if="rooms.length">
      <thead>
        <tr>
          <th>รูปภาพ</th>
          <th>ชื่อห้อง</th>
          <th>จำนวนที่เข้าประชุมได้</th>
          <th>คำอธิบาย</th>
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(room, idx) in rooms" :key="room.id" class="room-cell"
          :class="{ 'alt-row': rooms.length > 2 && idx % 2 === 1 }">
          <td>
            <img :src="room.image_url" alt="room" width="100" height="100" />
          </td>
          <td>{{ room.name }}</td>
          <td>{{ room.capacity }}</td>
          <td>{{ room.description }}</td>
          <td>
            <button class="btn-detail" @click="goTodetail(room.id)">
              <i class="fa-solid fa-info"></i> ดูข้อมูล
            </button>
            <button class="btn-cancel" @click="handleDeleteRoom(room)">
              <i class="fa-solid fa-trash-can"></i> ลบ
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else>ไม่มีห้องประชุมในระบบ</div>
  </div>
    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination-bar">
      <div class="pagination">
        <button
          :disabled="page === 1"
          @click="gotoPage(page - 1)"
        >
          ก่อนหน้า
        </button>

        <button
          v-for="p in paginationRange"
          :key="p + '-btn'"
          :class="{ active: p === page }"
          @click="gotoPage(p)"
          :disabled="p === '...'"
        >
          {{ p }}
        </button>

        <button
          :disabled="page >= totalPages"
          @click="gotoPage(page + 1)"
        >
          ถัดไป
        </button>

        <div class="page-jump">
          <label>ไปหน้า:</label>
          <input
            type="number"
            min="1"
            :max="totalPages"
            v-model.number="jumpToPage"
            @keyup.enter="gotoPage(jumpToPage)"
            :disabled="totalPages === 0"
          />
        </div>
      </div>
    </div>
</template>

<style scoped>
.container {
  padding: 15px;
  margin: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  padding-bottom: 80px;
  height: calc(100vh - 110px); 
  max-height: calc(100vh - 110px);
  min-height: 400px; 
  overflow-y: auto;
  background: #fff; 
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-row h1 {
  margin: 0;
  font-size: 24px;
}

.room-cell {
  text-align: center;
  vertical-align: middle;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fafafa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

th,
td {
  padding: 16px;
  vertical-align: middle;
  border-bottom: 1px solid #eaeaea;
  font-weight: bold;
}

th {
  background-color: #3d3c3c31;
  color: #13131f;
}

tr:hover {
  background-color: #f2f2f2;
}
.alt-row {
  background-color: #d0d3d880 !important;
}

img {
  border-radius: 8px;
  object-fit: cover;
}

td:last-child {
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

img {
  border-radius: 6px;
  object-fit: cover;
}

button {
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  color: white;
  font-weight: bold;
}

h1 {
  text-decoration: underline;
}

.btn-create {
  background-color: #13131f;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: 5px;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  gap: 5px;
  transition: background-color 0.3s;
  border: 1px solid #13131f;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.btn-create:hover {
  background-color: #4a4a4a;
  transition: background-color 0.3s ease;
}

.btn-detail {
  background-color: #5bc0de;
  color: white;
  border: none;
  padding: 7px 15px;
  margin-top: 30px;
}

.btn-detail:hover {
  background-color: #31b0d5;
  transition: background-color 0.3s ease;
}

.btn-cancel {
  background-color: #f06666;
  color: white;
  border: none;
  padding: 7px 15px;
  margin-left: 10px;
  margin-top: 30px;
}

.btn-cancel:hover {
  background-color: #d9534f;
  transition: background-color 0.3s ease;
}

.btn-close {
  background-color: #f3c735;
}

.btn-close:hover {
  background-color: #d8ba6f;
  transition: background-color 0.3s ease;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(61, 60, 60, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: whitesmoke;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  width: 400px;
}

.modal-actions button {
  margin: 10px;
}

.pagination-bar {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  background: #fafafa;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
  justify-content: center;
  text-align: center;
  z-index: 100;
  display: flex;
  padding: 12px 0;
}

.pagination {
  display: flex;
  justify-content: center; 
  align-items: center;
  flex-wrap: wrap; 
  gap: 5px;
}
.pagination button {
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  background-color: #13131f;
  color: white;
  border: none;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}
.pagination button:hover:not(:disabled) {
  background-color: #444760;
}
.pagination button:disabled {
  background-color: #e0e0e0;
  color: #777;
  cursor: not-allowed;
  opacity: 1;
}
.pagination button.active {
  background-color: #f5f5f5;
  color: #13131f;
  font-weight: bold;
  border: 1px solid #ccc;
}
.page-jump {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 10px;
}
.page-jump input {
  width: 50px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
  text-align: center;
}
</style>

