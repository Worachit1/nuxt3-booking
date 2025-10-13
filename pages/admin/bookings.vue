<script setup>
import { onMounted, ref, computed, nextTick } from "vue";
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

const closeModal = async () => {
  console.log("🔴 กำลังปิด modal...");
  showModal.value = false;
  selectedBooking.value = null;
  await nextTick(); // บังคับให้ Vue update DOM ทันที
  // รอให้ animation เสร็จ
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log("✅ ปิด modal แล้ว, showModal =", showModal.value);
};

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
        await closeModal();
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

    // ปิด modal ก่อนที่จะแสดง SweetAlert confirmation
    await closeModal();

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

    if (!confirmResult.isConfirmed) {
      return;
    }

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
    
    // ปิด modal ในกรณี error ด้วย
    await closeModal();
    
    await Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการอัปเดต",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
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

  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <div class="header-text">
          <h1>จัดการการจองห้องประชุม</h1>
          <p class="subtitle">ตรวจสอบและอนุมัติการจองห้องประชุมทั้งหมด</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-card">
          <div class="stat-icon pending">
            <i class="fa-solid fa-clock"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">รอการอนุมัติ</span>
            <span class="stat-value">{{
              filteredBookings.filter((b) => b.status === "Pending").length
            }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon approved">
            <i class="fa-solid fa-check-circle"></i>
          </div>
          <div class="stat-info">
            <span class="stat-label">อนุมัติแล้ว</span>
            <span class="stat-value">{{
              filteredBookings.filter((b) => b.status === "Approved").length
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- Filter Section -->
      <div class="filter-section">
        <div class="filter-header">
          <i class="fa-solid fa-filter"></i>
          <span>กรองตามสถานะ</span>
        </div>
        <div class="filter-options">
          <label
            class="filter-checkbox"
            v-for="status in allStatuses"
            :key="status"
          >
            <input type="checkbox" :value="status" v-model="selectedStatuses" />
            <span class="checkmark"></span>
            <span
              class="filter-label"
              :class="'status-' + status.toLowerCase()"
            >
              <i
                :class="{
                  'fa-solid fa-clock': status === 'Pending',
                  'fa-solid fa-check-circle': status === 'Approved',
                  'fa-solid fa-times-circle': status === 'Canceled',
                  'fa-solid fa-flag-checkered': status === 'Finished',
                }"
              ></i>
              {{ statusMap[status] }}
            </span>
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

        <div v-else class="empty-state">
          <i class="fa-solid fa-inbox"></i>
          <p>ไม่มีการจองในขณะนี้</p>
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
          <button @click="closeModal()" class="btn-close">ปิด</button>
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
  padding: 30px 40px;
  margin-bottom: 30px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
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

.header-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 160px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.pending {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
}

.stat-icon.approved {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #cbd5e0;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
}

/* Container */
.container {
  margin: 0 auto;
  max-width: 1400px;
  padding: 0;
}

/* Filter Section */
.filter-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 2px solid #e0e0e0;
}

.filter-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  color: #2d2d2d;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
}

.filter-header i {
  color: #fbbf24;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 12px 20px;
  background: #f8f9fa;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
  position: relative;
}

.filter-checkbox:hover {
  background: #e9ecef;
  border-color: #2d2d2d;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.filter-checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkmark {
  height: 22px;
  width: 22px;
  background-color: #ffffff;
  border: 2px solid #ccc;
  border-radius: 6px;
  display: inline-block;
  position: relative;
  margin-right: 10px;
  transition: all 0.2s ease;
}

.filter-checkbox input:checked ~ .checkmark {
  background-color: #2d2d2d;
  border-color: #2d2d2d;
}

.filter-checkbox input:checked ~ .checkmark:after {
  content: "";
  position: absolute;
  display: block;
  left: 7px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 3px 3px 0;
  transform: rotate(45deg);
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: #2d2d2d;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label i {
  font-size: 16px;
}

.filter-label.status-pending i {
  color: #fbbf24;
}

.filter-label.status-approved i {
  color: #10b981;
}

.filter-label.status-canceled i {
  color: #dc3545;
}

.filter-label.status-finished i {
  color: #6c757d;
}

/* Table Section */
.booking-table-wrapper {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 2px solid #e0e0e0;
  min-height: 400px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background-color: #ffffff;
}

thead {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 18px 16px;
  text-align: left;
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 3px solid #fbbf24;
}

th i {
  margin-right: 6px;
  color: #fbbf24;
}

tbody tr {
  border-bottom: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

tbody tr:hover {
  background-color: #f8f9fa;
  transform: scale(1.01);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

tbody tr:last-child {
  border-bottom: none;
}

td {
  padding: 16px;
  text-align: left;
  font-size: 14px;
  color: #333;
  vertical-align: middle;
}

.date-cell,
.time-cell {
  color: #6c757d;
  font-size: 13px;
}

.date-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-wrapper i {
  color: #fbbf24;
}

.user-cell {
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info i {
  color: #2d2d2d;
  font-size: 18px;
}

.room-badge {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  display: inline-block;
  border: 1px solid #90caf9;
}

.manager-name {
  color: #6c757d;
  font-style: italic;
  font-size: 13px;
}

/* Button Styles */
button {
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.status-btn {
  padding: 8px 16px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  min-width: 140px;
  justify-content: center;
}

.btn-pending {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 2px solid #fbbf24;
  cursor: pointer;
}

.btn-pending:hover {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
}

.btn-approved {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 2px solid #10b981;
  cursor: not-allowed;
  opacity: 0.9;
}

.btn-cancel {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 2px solid #dc3545;
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: 0.9;
}

.btn-finished {
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  color: #374151;
  border: 2px solid #6c757d;
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: 0.9;
}

.btn-equipment {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
  padding: 8px 16px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-equipment:hover {
  background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.no-equipment {
  color: #9ca3af;
  font-style: italic;
  text-align: center;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-state i {
  font-size: 64px;
  color: #e5e7eb;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

/* Pagination */
.pagination-bar {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: #ffffff;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 2px solid #e0e0e0;
}

.pagination button {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
  min-width: 40px;
}

.pagination button:not(.active):not(:disabled) {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: white;
}

.pagination button:not(.active):not(:disabled):hover {
  background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.pagination button.active {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.pagination button:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 2px solid #e0e0e0;
}

.page-jump label {
  font-size: 14px;
  font-weight: 600;
  color: #2d2d2d;
}

.page-jump input {
  width: 60px;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  transition: all 0.2s ease;
}

.page-jump input:focus {
  outline: none;
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.1);
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: #ffffff;
  border-radius: 16px;
  min-width: 400px;
  max-width: 600px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid #e0e0e0;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Regular Modal (Approve/Reject) */
.modal-content h3 {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  color: #ffffff;
  padding: 24px 30px;
  margin: 0;
  border-radius: 14px 14px 0 0;
  font-size: 20px;
  font-weight: 700;
}

.modal-content p {
  padding: 0 30px;
  margin: 16px 0;
  font-size: 15px;
  color: #374151;
}

.modal-content p strong {
  color: #2d2d2d;
  font-weight: 700;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 24px 30px 30px;
}

.modal-actions button {
  padding: 12px 28px;
  font-size: 15px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer !important;
  transition: all 0.3s ease;
}

.modal-actions .btn-approved {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  cursor: pointer !important;
  opacity: 1 !important;
  text-decoration: none !important;
}

.modal-actions .btn-approved:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  cursor: pointer !important;
}

.modal-actions .btn-cancel {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  text-decoration: none !important;
  cursor: pointer !important;
  opacity: 1 !important;
}

.modal-actions .btn-cancel:hover {
  background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4);
  cursor: pointer !important;
}

.modal-actions .btn-close {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  color: white;
  padding: 12px 28px;
  font-size: 15px;
  border-radius: 10px;
  cursor: pointer !important;
  border: none;
}

.modal-actions .btn-close:hover {
  background: linear-gradient(135deg, #5a6268 0%, #4e555b 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(108, 117, 125, 0.4);
  cursor: pointer !important;
}

/* Equipment Modal */
.equipment-modal {
  max-width: 700px;
}

.modal-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  padding: 24px 30px;
  border-radius: 14px 14px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  background: none;
  padding: 0;
  margin: 0;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 22px;
}

.modal-header h3 i {
  color: #fbbf24;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffffff;
  font-size: 18px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

.modal-body {
  padding: 30px;
}

.booking-info {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border-left: 4px solid #fbbf24;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.booking-info p {
  margin: 10px 0;
  padding: 0;
  color: #374151;
  font-size: 15px;
  line-height: 1.6;
}

.booking-info strong {
  color: #2d2d2d;
  font-weight: 700;
  margin-right: 6px;
}

.equipment-list {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 10px;
}

.equipment-list::-webkit-scrollbar {
  width: 8px;
}

.equipment-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.equipment-list::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 10px;
}

.equipment-list::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin: 12px 0;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  border-left: 4px solid #fbbf24;
  gap: 16px;
  transition: all 0.3s ease;
}

.equipment-item:hover {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  transform: translateX(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-left-width: 6px;
}

.equipment-image {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  gap: 4px;
}

.equipment-name {
  font-weight: 700;
  color: #2d2d2d;
  font-size: 15px;
}

.equipment-description {
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
}

.equipment-quantity {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  padding: 6px 14px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(251, 191, 36, 0.3);
}

.no-equipment {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.no-equipment i {
  font-size: 64px;
  margin-bottom: 16px;
  color: #e5e7eb;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 20px 30px 30px;
  border-top: 2px solid #e0e0e0;
  margin-top: 10px;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-stats {
    width: 100%;
  }

  .stat-card {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 80px 10px 20px 10px;
  }

  .page-header {
    padding: 20px;
  }

  .header-text h1 {
    font-size: 22px !important;
  }

  .filter-section {
    padding: 16px;
  }

  .filter-options {
    flex-direction: column;
  }

  .filter-checkbox {
    width: 100%;
  }

  table {
    font-size: 12px;
  }

  th,
  td {
    padding: 10px 8px;
  }

  .stat-card {
    min-width: 100%;
  }

  .pagination {
    padding: 12px;
    flex-wrap: wrap;
  }

  .page-jump {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    margin-top: 12px;
    width: 100%;
    justify-content: center;
  }

  .modal-content {
    min-width: 90%;
    max-width: 95%;
    margin: 10px;
  }
}
</style>
