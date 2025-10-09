<script setup>
import { onMounted, ref, computed } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import LoadingPage from "@/components/Loading.vue";

import { useBookingStore } from "@/store/bookingStore";
import { useEquipmentBookingStore } from "@/store/equipmentBookingStore";
import { useEquipmentStore } from "@/store/equipmentStore";
import { storeToRefs } from "pinia";
import dayjs from "dayjs";
import "dayjs/locale/th";

definePageMeta({
  middleware: ["load-user"],
});
import { useUserId } from "~/composables/useUser";
const userId = useUserId();

const bookingStore = useBookingStore();
const equipmentBookingStore = useEquipmentBookingStore();
const equipmentStore = useEquipmentStore();
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

// Equipment modal
const showEquipmentModal = ref(false);
const selectedBookingEquipments = ref([]);
const currentBookingForEquipment = ref(null);

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

const openEquipmentModal = async (booking) => {
  currentBookingForEquipment.value = booking;
  selectedBookingEquipments.value = [];

  try {
    // Fetch booking equipments
    await equipmentBookingStore.fetchBookingEquipments();

    // Filter equipments for this specific booking
    const bookingEquipments = equipmentBookingStore.booking_equipment.filter(
      (be) => String(be.booking_id) === String(booking.id)
    );

    // Get equipment details for each booking equipment
    const equipmentDetails = [];
    for (const be of bookingEquipments) {
      try {
        const equipment = await equipmentStore.getById(be.equipment_id);
        if (equipment) {
          equipmentDetails.push({
            ...equipment,
            quantity: be.quantity || 1,
            booking_equipment_id: be.id,
          });
        }
      } catch (error) {
        console.error("Error fetching equipment details:", error);
      }
    }

    selectedBookingEquipments.value = equipmentDetails;
    showEquipmentModal.value = true;
  } catch (error) {
    console.error("Error fetching booking equipments:", error);
    selectedBookingEquipments.value = [];
    showEquipmentModal.value = true;
  }
};

const closeEquipmentModal = () => {
  showEquipmentModal.value = false;
  selectedBookingEquipments.value = [];
  currentBookingForEquipment.value = null;
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <h1 style="margin-left: 25px; font-size: 24px">
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
                <th>เริ่มจองเวลา</th>
                <th>ถึงเวลา</th>
                <th>อุปกรณ์</th>
                <th>สถานะ</th>
                <th>ผู้ที่จัดการ</th>
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
                    v-if="!['Finished', 'Canceled'].includes(booking.status)"
                    class="btn-equipment"
                    @click="openEquipmentModal(booking)"
                    title="ดูรายการอุปกรณ์ที่จอง"
                  >
                    <i class="fa-solid fa-list"></i> ดูอุปกรณ์
                  </button>
                  <span v-else class="no-equipment-text"> </span>
                </td>
                <td>
                  <button
                    :class="statusClass(booking.status)"
                    :disabled="
                      ['Approved', 'Canceled', 'Finished'].includes(
                        booking.status
                      )
                    "
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

  <!-- Equipment Modal -->
  <teleport to="body">
    <div v-if="showEquipmentModal" class="modal">
      <div class="modal-content equipment-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-list"></i>
            รายการอุปกรณ์ที่จอง
          </h3>
          <button @click="closeEquipmentModal" class="close-btn">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="booking-info">
            <p>
              <strong>ผู้จอง:</strong>
              {{ currentBookingForEquipment?.user_name }}
              {{ currentBookingForEquipment?.user_lastname }}
            </p>
            <p>
              <strong>ห้อง:</strong> {{ currentBookingForEquipment?.room_name }}
            </p>
          </div>

          <div
            v-if="selectedBookingEquipments.length > 0"
            class="equipment-list"
          >
            <div
              v-for="equipment in selectedBookingEquipments"
              :key="equipment.id"
              class="equipment-item"
            >
              <div class="equipment-image">
                <img
                  :src="equipment.image_url || '/images/default-picture.png'"
                  :alt="equipment.name"
                  @error="$event.target.src = '/images/default-picture.png'"
                />
              </div>
              <div class="equipment-details">
                <span class="equipment-name">{{ equipment.name }}</span>
              </div>
              <span class="equipment-quantity"
                >จำนวนที่จอง: {{ equipment.quantity }}</span
              >
            </div>
          </div>

          <div v-else class="no-equipment">
            <i class="fa-solid fa-box-open"></i>
            ไม่มีการจองอุปกรณ์
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeEquipmentModal" class="btn-close">ปิด</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.container {
  margin: 30px auto;
  max-width: 1400px;
  padding: 40px 30px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

h1 {
  margin-left: 30px !important;
  margin-bottom: 20px !important;
  font-size: 32px !important;
  color: #2d2d2d !important;
  font-weight: 700 !important;
}

.status-filter {
  padding: 20px;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  display: inline-block;
  margin-bottom: 24px;
}

.filter-title {
  font-weight: 600;
  margin-bottom: 12px;
  display: block;
  color: #2d2d2d;
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
  background-color: #2d2d2d;
  border-color: #2d2d2d;
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
  border-color: #2d2d2d;
}

.custom-label {
  cursor: pointer;
  font-size: 14px;
  color: #2d2d2d;
  user-select: none;
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  background-color: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}

th,
td {
  padding: 14px 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #f5f5f5;
  font-weight: 600;
}

tr:hover {
  background-color: #f8f9fa;
  transition: background-color 0.3s ease;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  transition: all 0.2s;
}

.btn-pending {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.btn-pending:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
}

.btn-approved {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-approved:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-cancel {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  text-decoration: line-through;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.btn-finished {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  text-decoration: line-through;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-finished:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

.btn-equipment {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: white;
  cursor: pointer;
  font-size: 13px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-equipment:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #3a3a3a 0%, #4a4a4a 100%);
}

.no-equipment-text {
  color: #6c757d;
  font-style: italic;
  text-align: center;
  display: block;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: #ffffff;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  min-width: 400px;
  max-width: 600px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid #e0e0e0;
}

.modal-actions button {
  margin: 10px;
}

.btn-close {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-close:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

.booking-table-wrapper {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #e0e0e0;
  padding: 0;
  background-color: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  font-style: italic;
  color: #6c757d;
  font-size: 16px;
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

/* Equipment Modal Styles */
.equipment-modal {
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}

.modal-header h3 {
  margin: 0;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 22px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6c757d;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
  color: #2d2d2d;
  transform: scale(1.1);
}

.modal-body {
  margin-bottom: 20px;
}

.booking-info {
  background-color: #f8f9fa;
  padding: 18px;
  border-radius: 10px;
  margin-bottom: 24px;
  border-left: 4px solid #2d2d2d;
}

.booking-info p {
  margin: 8px 0;
  color: #495057;
  font-size: 15px;
}

.equipment-list {
  max-height: 400px;
  overflow-y: auto;
}

.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  margin: 10px 0;
  background-color: #f8f9fa;
  border-radius: 10px;
  border-left: 4px solid #2d2d2d;
  gap: 14px;
  transition: all 0.2s;
}

.equipment-item:hover {
  background-color: #e9ecef;
  transform: translateX(4px);
}

.equipment-image {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.equipment-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.equipment-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equipment-name {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.equipment-description {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.equipment-quantity {
  font-size: 14px;
  color: #6b7280;
  background-color: #e5e7eb;
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}

.no-equipment {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-style: italic;
}

.no-equipment i {
  font-size: 48px;
  margin-bottom: 10px;
  display: block;
  color: #cbd5e0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #ddd;
  padding-top: 15px;
}
</style>
