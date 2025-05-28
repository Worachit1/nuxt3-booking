<script setup>
import { onMounted, ref, computed } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";

import { useBookingStore } from "@/store/bookingStore";
import { storeToRefs } from "pinia";
import dayjs from "dayjs";
import "dayjs/locale/th";

definePageMeta({
  middleware: ["load-user"],
});
import { useUserId } from "~/composables/useUser";
const userId = useUserId();

const bookingStore = useBookingStore();
const bookings = computed(() => bookingStore.bookings);
const { isLoading } = storeToRefs(bookingStore, useUserId);

const currentPage = ref(1);
const pageSize = 10;
const totalBookings = ref(0);

const fetchBookings = async () => {
  await bookingStore.fetchBookings({
    page: currentPage.value,
    size: pageSize,
  });
  totalBookings.value = bookingStore.total;
};

const jumpToPage = ref(currentPage.value);
const totalPages = computed(() => Math.ceil(totalBookings.value / pageSize));
const paginationRange = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const delta = 1;
  const range = [];
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== "...") {
      range.push("...");
    }
  }
  return range;
});
const gotoPage = async (page) => {
  if (
    page === "..." ||
    page === currentPage.value ||
    page < 1 ||
    page > totalPages.value
  ) {
    return;
  }

  currentPage.value = page;
  await fetchBookings();
};

onMounted(fetchBookings);

const formatDateTime = (date) =>
  dayjs(date < 1e10 ? date * 1000 : date)
    .locale("th")
    .format("D MMMM YYYY เวลา HH:mm:ss น.");

const statusClass = (status) => ({
  "btn-pending": status === "Pending",
  "btn-approved": status === "Approved",
  "btn-cancel": status === "Canceled",
  "btn-finished": status === "Finished",
});

const statusMap = {
  Pending: "กำลังรอ...",
  Approved: "อนุมัติการจองแล้ว",
  Canceled: "ปฏิเสธการจอง",
  Finished: "การจองสิ้นสุดแล้ว",
};

const allStatuses = Object.keys(statusMap);
const selectedStatuses = ref([...allStatuses]);
const filteredBookings = computed(() =>
  bookings.value.filter(
    (b) =>
      (!b.deleted_at || b.deleted_at === 0) &&
      selectedStatuses.value.includes(b.status)
  )
);

const showModal = ref(false);
const selectedBooking = ref(null);

const handleUpdateStatus = async (bookingId, status) => {
  try {
    const booking = bookings.value.find((b) => b.id === bookingId);

    if (status === "Approved") {
      const isOverlap = bookings.value.some(
        (b) =>
          b.id !== bookingId &&
          b.room_id === booking.room_id &&
          b.status === "Approved" &&
          booking.start_time < b.end_time &&
          booking.end_time > b.start_time
      );
      if (isOverlap) {
        await Swal.fire({
          icon: "error",
          title: "ไม่สามารถอนุมัติได้",
          text: "มีการจองที่ได้รับอนุมัติแล้วในช่วงเวลาดังกล่าว",
          confirmButtonText: "ตกลง",
          customClass: {
            popup: "my-popup",
            confirmButton: "btn-ok",
          },
        });
        return;
      }
    }

    const actionText = status === "Approved" ? "อนุมัติ" : "ปฏิเสธ";
    const confirmResult = await Swal.fire({
      title: `คุณต้องการ${actionText}การจองนี้ใช่หรือไม่?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: `ใช่, ${actionText}`,
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      customClass: {
        popup: "my-popup",
        confirmButton: status === "Approved" ? "btn-approved" : "btn-cancel",
        cancelButton: "btn-close",
      },
    });

    if (!confirmResult.isConfirmed) return;

    const updatedBooking = {
      status,
      approved_by: userId,
    };

    await bookingStore.updateStatusBooking(bookingId, updatedBooking);
    await Swal.fire({
      icon: "success",
      title: "อัปเดตสถานะเรียบร้อยแล้ว",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    window.location.reload();
  } catch (error) {
    console.error("❌ Error updating booking status:", error);
    await Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการอัปเดต",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
  } finally {
    showModal.value = false;
    selectedBooking.value = null;
  }
};

const openModal = (booking) => {
  selectedBooking.value = booking;
  showModal.value = true;
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <h1 style="margin-left: 25px; font-size: 24px;">
    <i class="fa-solid fa-book-open"></i> รายการจองห้องประชุม
  </h1>
  <div class="container">
    <div class="row">
      <div class="col-md-12">
        <!-- ตัวกรองสถานะ -->
        <div class="status-filter mb-3">
          <label class="filter-title">กรองตามสถานะ:</label>
          <div
            class="status-option"
            v-for="status in allStatuses"
            :key="status"
          >
            <input
              class="custom-checkbox"
              type="checkbox"
              :id="status"
              :value="status"
              v-model="selectedStatuses"
            />
            <label class="custom-label" :for="status">
              {{ statusMap[status] }}
            </label>
          </div>
        </div>

        <!-- ตาราง -->
        <div class="booking-table-wrapper">
          <table
            class="table table-bordered table-striped"
            v-if="filteredBookings.length"
          >
            <thead>
              <tr>
                <th>วัน / เวลา ที่จอง</th>
                <th>ผู้จอง</th>
                <th>ห้องที่จอง</th>
                <th>เวลาเริ่มจอง</th>
                <th>เวลาสิ้นสุดจอง</th>
                <th>สถานะ</th>
                <th>อนุมัติการจองโดย</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in filteredBookings" :key="booking.id">
                <td>{{ formatDateTime(booking.created_at) }}</td>
                <td>{{ booking.user_name }} {{ booking.user_lastname }}</td>
                <td>{{ booking.room_name }}</td>
                <td>{{ formatDateTime(booking.start_time) }}</td>
                <td>{{ formatDateTime(booking.end_time) }}</td>
                <td>
                  <button
                    :class="statusClass(booking.status)"
                    :disabled="['Approved', 'Canceled', 'Finished'].includes(booking.status)"
                    @click="openModal(booking)"
                  >
                    {{ booking.status }}
                  </button>
                </td>
                <td>
                  <span>
                    {{
                      booking.nameapproved_by
                        ? booking.nameapproved_by
                        : "ยังไม่ได้อนุมัติ"
                    }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="no-data">ไม่มีการจองในขณะนี้</div>          
        </div>
      </div>
        <div class="pagination-bar">
            <div class="pagination">
            <button
              :disabled="currentPage === 1"
              @click="gotoPage(currentPage - 1)"
            >
              ก่อนหน้า
            </button>

            <button
              v-for="page in paginationRange"
              :key="page + '-btn'"
              :class="{ active: page === currentPage }"
              @click="gotoPage(page)"
              :disabled="page === '...'"
            >
              {{ page }}
            </button>

            <button
              :disabled="currentPage === totalPages"
              @click="gotoPage(currentPage + 1)"
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
    </div>
    
  </div>
  

  <teleport to="body">
    <div v-if="showModal" class="modal">
      <div class="modal-content">
        <h3>คุณต้องการอนุมัติ หรือ ปฏิเสธการจองนี้ใช่หรือไม่?</h3>
        <p>
          ผู้จอง: {{ selectedBooking?.user_name }}
          {{ selectedBooking?.user_lastname }}
        </p>
        <p>ห้องที่จอง: {{ selectedBooking?.room_name }}</p>
        <div class="modal-actions">
          <button
            @click="handleUpdateStatus(selectedBooking.id, 'Approved')"
            class="btn-approved"
          >
            อนุมัติ
          </button>
          <button
            @click="handleUpdateStatus(selectedBooking.id, 'Canceled')"
            class="btn-cancel"
          >
            ปฏิเสธ
          </button>
          <button @click="showModal = false" class="btn-close">ปิด</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.container {
  margin: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

h1 {
  text-decoration: underline;
}

.status-filter {
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  display: inline-block;
}

.filter-title {
  font-weight: bold;
  margin-bottom: 8px;
  display: block;
  color: #333;
  font-size: 16px;
}

.status-option {
  display: inline-flex;
  align-items: center;
  margin-right: 16px;
  margin-bottom: 8px;
}

.custom-checkbox {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #ccc;
  border-radius: 4px;
  margin-right: 8px;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.custom-checkbox:checked {
  background-color: #13131f;
  border-color: #13131f;
}

.custom-checkbox:checked::after {
  content: "✔";
  color: white;
  font-size: 12px;
  position: absolute;
  top: -2%;
  left: 3px;
}

.custom-checkbox:hover {
  border-color: #999;
}

.custom-label {
  cursor: pointer;
  font-size: 14px;
  color: #13131f;
  user-select: none;
  font-weight: bold;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  background-color: #ffffff;
}

th,
td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background-color: #3d3c3c31;
  color: #13131f;
  font-weight: bold;
}

tr:hover {
  background-color: #f1f1f1;
  transition: background-color 0.3s ease;
}

button {
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  font-size: 14px;
  color: rgb(255, 239, 239);
}

.btn-pending {
  background-color: #f9c749;
  cursor: pointer;
}

.btn-pending:hover {
  background-color: #d8ba6f;
  transition: background-color 0.3s ease;
}

.btn-approved {
  background-color: #73ea8d;
}

.btn-approved:hover {
  background-color: #5bcf6b;
  transition: background-color 0.3s ease;
}

.btn-cancel {
  background-color: #f06666;
  text-decoration: line-through;
}

.btn-cancel:hover {
  background-color: #d9534f;
  transition: background-color 0.3s ease;
}

.btn-finished {
  background-color: #6c757d;
  text-decoration: line-through;
}

.btn-finished:hover {
  background-color: #5a6268;
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

.btn-close {
  background-color: #f3c735;
}

.btn-close:hover {
  background-color: #d8ba6f;
  transition: background-color 0.3s ease;
}

.booking-table-wrapper {
  min-height: 400px; /* ✅ ปรับความสูงขั้นต่ำตามต้องการ */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #ddd;
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
}

.no-data {
  text-align: center;
  padding: 20px;
  font-style: italic;
  color: #888;
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
.pagination-bar {
  position: fixed;
  justify-content: center;
  width: 100%;
  margin-top: 5px;
  text-align: center;
  z-index: 50;
  display: flex;
}
</style>
