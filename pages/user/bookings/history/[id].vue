<script setup>
import { useRoute } from "vue-router";
import LoadingPage from "@/components/Loading.vue";
import { useBookingStore } from "@/store/bookingStore";
import { useUserStore } from "@/store/userStore";
import { useReviewStore } from "@/store/reviewStore";
import { useEquipmentBookingStore } from "@/store/equipmentBookingStore";
import { useEquipmentStore } from "@/store/equipmentStore";
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { storeToRefs } from "pinia";
import dayjs from "dayjs";
import "dayjs/locale/th";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

definePageMeta({
  middleware: ["load-user", "user-only"],
});

const formatDateTime = (date) => {
  const ts = Number(date);
  const ms = ts < 10000000000 ? ts * 1000 : ts;
  return dayjs(ms).locale("th").format("D MMMM YYYY เวลา HH:mm:ss น.");
};

const route = useRoute();
const userId = route.params.id || localStorage.getItem("user_id");

const bookingStore = useBookingStore();
const userStore = useUserStore();
const reviewStore = useReviewStore();
const equipmentBookingStore = useEquipmentBookingStore();
const equipmentStore = useEquipmentStore();

const bookings = ref([]);
const user = ref(null);

const reviewModal = ref(false);
const reviewDetailModal = ref(false);
const reviewComment = ref("");
const reviewRating = ref(0);
const hoverRating = ref(0); // <- ใช้สำหรับไฮไลต์ตอน hover
const selectedBooking = ref(null);
const reviewLoading = ref(false);
const reviewDetail = ref(null);
// Tracks bookings marked as reviewed immediately after submit (for instant UI flip)
const reviewedMap = ref({});
// Cache of last submitted review per booking to show immediately in detail modal
const lastSubmittedReviews = ref({});
// Cache of bookings already checked via getByBookingId to avoid duplicate calls
const checkedByBooking = ref({});
// Background check indicator
const checkingReviews = ref(false);

// Equipment modal
const showEquipmentModal = ref(false);
const selectedBookingEquipments = ref([]);
const currentBookingForEquipment = ref(null);

const { isLoading: userLoading } = storeToRefs(userStore);
const { isLoading: bookingLoading } = storeToRefs(bookingStore);
const { isLoading: reviewsLoading } = storeToRefs(reviewStore);
const isLoadingPage = computed(
  () => userLoading.value || bookingLoading.value || reviewsLoading.value
);

const statusMap = {
  Pending: "กำลังรอ...",
  Approved: "ได้รับอนุมัติการจองแล้ว",
  Canceled: "ปฏิเสธการจอง",
  Finished: "การจองสิ้นสุดแล้ว",
};

const allStatuses = Object.keys(statusMap);
// Default: check all statuses in the filter
const selectedStatuses = ref([...allStatuses]);

onMounted(async () => {
  try {
    console.log("[History] onMounted: start load for userId=", userId);
    await bookingStore.getBookingByuserId(userId);
    bookings.value = Array.isArray(bookingStore.bookings)
      ? bookingStore.bookings
          .slice()
          .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      : [];
    console.log(
      "[History] onMounted: bookings loaded =",
      bookings.value.length
    );
    await userStore.getUserById(userId);
    user.value = userStore.currentUser;
    await reviewStore.fetchReviews();
    // Prefill reviewedMap after refresh so UI shows "ดูรายละเอียดการรีวิว" ทันที
    populateReviewedMap();
    // Background backfill: call by booking_id for Finished bookings not present in the list yet
    await backfillReviewedStatusByBookingId();
  } catch (error) {
    console.error("Error fetching booking details:", error);
  }
});

// Helpers used by reviewed-map population and watchers must be declared before first use
const getReviewsList = () =>
  Array.isArray(reviewStore?.reviews)
    ? reviewStore.reviews
    : Array.isArray(reviewStore?.reviews?.value)
    ? reviewStore.reviews.value
    : [];

const getBookingIdFromReview = (r) =>
  r?.booking_id ?? r?.bookingId ?? r?.booking?.id ?? r?.book_id ?? r?.bookingID;

const populateReviewedMap = () => {
  const list = getReviewsList();
  const nextMap = {};
  for (const r of list) {
    const bId = getBookingIdFromReview(r);
    if (bId) nextMap[String(bId)] = true;
  }
  reviewedMap.value = nextMap;
};

// Query backend by booking_id for any Finished bookings not detected yet and flip buttons
const backfillReviewedStatusByBookingId = async () => {
  if (checkingReviews.value) return;
  checkingReviews.value = true;
  try {
    const candidates = (
      Array.isArray(bookings.value) ? bookings.value : []
    ).filter(
      (b) =>
        b?.status === "Finished" &&
        !reviewedMap.value[String(b.id)] &&
        !checkedByBooking.value[String(b.id)]
    );
    for (const b of candidates) {
      const key = String(b.id);
      checkedByBooking.value[key] = true;
      try {
        const res = await reviewStore.getByBookingIdSilent(key);
        if (res) {
          // Mark as reviewed and cache minimal detail
          reviewedMap.value = { ...reviewedMap.value, [key]: true };
          // Upsert into store for consistency so findReviewFor can work
          if (typeof reviewStore.upsertReview === "function") {
            reviewStore.upsertReview(res);
          }
        }
      } catch (e) {
        // ignore per-booking errors to continue others
      }
    }
  } finally {
    checkingReviews.value = false;
  }
};

// Keep reviewedMap in sync when reviews list updates
watch(
  () => getReviewsList(),
  () => {
    populateReviewedMap();
  },
  { deep: true }
);

const filteredBookings = computed(() => {
  if (!Array.isArray(bookings.value)) return [];
  return bookings.value.filter(
    (b) =>
      (!b.deleted_at || b.deleted_at === 0) &&
      selectedStatuses.value.includes(b.status)
  );
});

const statusClass = (status) => ({
  "btn-pending": status === "Pending",
  "btn-approved": status === "Approved",
  "btn-cancel": status === "Canceled",
  "btn-finished": status === "Finished",
});

const cancelBooking = async (booking) => {
  const result = await Swal.fire({
    title: "ยืนยันการยกเลิกการจอง?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ใช่, ยกเลิก",
    cancelButtonText: "ไม่",
  });
  if (!result.isConfirmed) return;

  await bookingStore.updateStatusBooking(booking.id, {
    status: "Canceled",
    approved_by: "ผู้ใช้ยกเลิกการจอง",
  });
  await bookingStore.getBookingByuserId(userId);
  Swal.fire(
    "ยกเลิกสำเร็จ",
    "สถานะการจองถูกเปลี่ยนเป็น 'Canceled'",
    "success"
  ).then(() => {
    window.location.reload();
  });
};

// เปิด/ปิดรีวิว
const openReviewModal = async (booking) => {
  selectedBooking.value = booking;
  reviewComment.value = "";
  reviewRating.value = 0;
  hoverRating.value = 0;
  reviewModal.value = true;
  await nextTick();
};

const openReviewDetailModal = async (booking) => {
  reviewLoading.value = true;
  selectedBooking.value = booking;
  await reviewStore.fetchReviews();
  // ค้นหารีวิวที่ตรงกับ booking ก่อน
  const matched = findReviewFor(booking);
  if (matched?.id) {
    try {
      const fresh = await reviewStore.getById(matched.id);
      reviewDetail.value = normalizeReview(fresh || matched);
    } catch (e) {
      reviewDetail.value = normalizeReview(matched);
    }
  } else {
    // ถ้าไม่มี id ลองเรียกจาก backend ด้วย booking_id โดยตรง
    try {
      const byBooking = await reviewStore.getByBookingIdSilent(
        String(booking.id)
      );
      if (byBooking) {
        reviewDetail.value = normalizeReview(byBooking);
        // Ensure list flips to "ดูรายละเอียด" right away
        const key = String(booking.id);
        reviewedMap.value = { ...reviewedMap.value, [key]: true };
        if (typeof reviewStore.upsertReview === "function") {
          reviewStore.upsertReview(byBooking);
        }
      } else {
        // ถ้าไม่เจอในสโตร์ ใช้ค่าในแคช (เพิ่งบันทึก) หรือค่าเริ่มต้น
        const cached = lastSubmittedReviews.value[String(booking.id)];
        reviewDetail.value = normalizeReview(
          matched || cached || { rating: 0, comment: "" }
        );
      }
    } catch (e) {
      const cached = lastSubmittedReviews.value[String(booking.id)];
      reviewDetail.value = normalizeReview(
        matched || cached || { rating: 0, comment: "" }
      );
    }
  }
  reviewDetailModal.value = true;
  reviewLoading.value = false;
};

const closeReviewModal = () => (reviewModal.value = false);
const closeReviewDetailModal = () => (reviewDetailModal.value = false);

const submitReview = async () => {
  reviewLoading.value = true;
  try {
    const payload = {
      user_id: user.value?.id,
      booking_id: selectedBooking.value.id, // ต้องมี booking_id
      room_id: selectedBooking.value.room_id,
      rating: reviewRating.value,
      comment: reviewComment.value,
    };
    await reviewStore.addReview(payload);
    // Optimistic update: ensure the review is present in the store immediately
    const exists = findReviewFor(selectedBooking.value);
    if (!exists) {
      const optimistic = { ...payload };
      if (Array.isArray(reviewStore?.reviews)) {
        reviewStore.reviews.push(optimistic);
      } else if (Array.isArray(reviewStore?.reviews?.value)) {
        reviewStore.reviews.value.push(optimistic);
      }
    }
    // รีเฟรชข้อมูล bookings และ reviews เพื่อให้ปุ่มเปลี่ยนทันที
    await bookingStore.getBookingByuserId(userId);
    bookings.value = Array.isArray(bookingStore.bookings)
      ? bookingStore.bookings
          .slice()
          .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      : [];
    await reviewStore.fetchReviews();
    bookings.value = [...bookings.value];
    // Mark as reviewed locally for instant UI flip (replace object to ensure reactivity)
    if (selectedBooking.value?.id) {
      const key = String(selectedBooking.value.id);
      reviewedMap.value = { ...reviewedMap.value, [key]: true };
      // Cache last submitted review for detail modal fallback
      lastSubmittedReviews.value[key] = {
        rating: reviewRating.value,
        comment: reviewComment.value,
      };
    }
    Swal.fire("บันทึกรีวิวสำเร็จ!", "ขอบคุณสำหรับความคิดเห็นของคุณ", "success");
    reviewModal.value = false;
    selectedBooking.value = null;
  } catch (e) {
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกรีวิวได้", "error");
  }
  reviewLoading.value = false;
};

// review helpers

const isSameUser = (r) =>
  r?.user_id ? String(r.user_id) === String(user.value?.id) : true;

const findReviewFor = (booking) => {
  const list = getReviewsList();
  if (!list || list.length === 0) return undefined;
  return list.find(
    (r) =>
      String(getBookingIdFromReview(r)) === String(booking.id) && isSameUser(r)
  );
};

const normalizeReview = (r) => {
  if (!r) return { rating: 0, comment: "" };
  const rating = r.rating ?? r.score ?? r.stars ?? r.point ?? 0;
  const comment = r.comment ?? r.review ?? r.text ?? r.message ?? "";
  return { rating, comment };
};

const getReviewRating = (booking) => {
  const r = normalizeReview(findReviewFor(booking));
  return Math.max(0, Math.min(5, Math.floor(Number(r?.rating ?? 0))));
};
const hasReview = (booking) =>
  Boolean(reviewedMap.value[String(booking.id)]) ||
  Boolean(lastSubmittedReviews.value[String(booking.id)]) ||
  Boolean(findReviewFor(booking));

// Pagination
const currentPage = ref(1);
const itemsPerPage = 10;
const jumpToPage = ref(currentPage.value);

const totalPages = computed(
  () => Math.ceil(filteredBookings.value.length / itemsPerPage) || 1
);

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

const paginatedBookings = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredBookings.value.slice(start, end);
});

const gotoPage = (page) => {
  if (
    page === "..." ||
    page < 1 ||
    page > totalPages.value ||
    page === currentPage.value
  )
    return;
  currentPage.value = page;
  jumpToPage.value = page;
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
    <LoadingPage v-if="isLoadingPage" />
  </teleport>

  <div class="page-wrapper">
    <div class="container">
      <h2 class="mb-2">
        <i class="fa-solid fa-clock-rotate-left"></i> ประวัติการจองของคุณ
      </h2>

      <!-- ฟิลเตอร์สถานะ -->
      <div class="status-filter mb-3">
        <label class="filter-title">กรองตามสถานะ:</label>
        <div class="status-option" v-for="status in allStatuses" :key="status">
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

      <!-- ตารางรายการ -->
      <div v-if="filteredBookings.length" class="booking-table-wrapper">
        <table class="table table-bordered table-hover">
          <thead class="table-light">
            <tr>
              <th>วัน/เวลาที่จอง</th>
              <th>ห้องที่จอง</th>
              <th>เริ่มจองเวลา</th>
              <th>ถึงเวลา</th>
              <th>อุปกรณ์</th>
              <th>สถานะ</th>
              <th>การดำเนินการ</th>
              <th>ความคิดเห็น</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(booking, index) in paginatedBookings" :key="booking.id">
              <td>{{ formatDateTime(booking.created_at) }}</td>
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
                <span v-else class="no-equipment-text"></span>
              </td>
              <td>
                <button
                  :class="statusClass(booking.status)"
                  :disabled="['Approved', 'Canceled'].includes(booking.status)"
                >
                  {{ statusMap[booking.status] }}
                </button>
              </td>

              <td>
                <button
                  v-if="booking.status === 'Pending'"
                  class="btn-cancelbooking"
                  @click="cancelBooking(booking)"
                >
                  ยกเลิกการจอง
                </button>
              </td>

              <td>
                <template v-if="booking.status === 'Finished'">
                  <!-- ยังไม่มีรีวิว: ปุ่มเขียนรีวิว -->
                  <button
                    v-if="!hasReview(booking)"
                    class="btn-review"
                    @click="openReviewModal(booking)"
                    title="ให้คะแนนและเขียนรีวิว"
                  >
                    รีวิว
                  </button>

                  <!-- มีรีวิวแล้ว: กดดูรายละเอียด (ไม่แสดงดาวในปุ่ม) -->
                  <button
                    v-else
                    class="btn-review-detail"
                    @click="openReviewDetailModal(booking)"
                    title="ดูรายละเอียดการรีวิว"
                  >
                    <i class="fa-solid fa-star"></i>
                    ดูรายละเอียดการรีวิว
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- pagination -->
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

      <div v-else class="no-data">ไม่มีรายการจองในขณะนี้</div>
    </div>

    <!-- Review Modal -->
    <teleport to="body">
      <div
        v-if="reviewModal"
        class="modal-overlay"
        @click.self="closeReviewModal"
      >
        <div class="modal-content">
          <h3>รีวิวห้อง {{ selectedBooking?.room_name }}</h3>

          <!-- ตัวเลือกดาว (เขียนรีวิว) -->
          <div class="star-picker" aria-label="ให้คะแนน 1 ถึง 5 ดาว">
            <button
              v-for="i in 5"
              :key="'w-' + i"
              type="button"
              class="star"
              :class="{ active: i <= (hoverRating || reviewRating) }"
              @mouseenter="hoverRating = i"
              @mouseleave="hoverRating = 0"
              @click="reviewRating = i"
            >
              ★
            </button>
            <span class="star-score">{{ reviewRating }}/5</span>
          </div>

          <textarea
            v-model="reviewComment"
            placeholder="แสดงความคิดเห็น..."
            rows="4"
            class="textarea"
          ></textarea>

          <div class="modal-actions">
            <!-- ปุ่มบันทึกรีวิวจะ disable ถ้า rating หรือ comment ว่างเปล่า -->
            <button
              :disabled="
                reviewLoading || !reviewRating || !reviewComment.trim()
              "
              @click="submitReview"
              class="btn-review"
            >
              บันทึกรีวิว
            </button>
            <button @click="closeReviewModal" class="btn-close">ปิด</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Review Detail Modal -->
    <teleport to="body">
      <div
        v-if="reviewDetailModal"
        class="modal-overlay"
        @click.self="closeReviewDetailModal"
      >
        <div class="modal-content">
          <h3>รีวิวของคุณ</h3>

          <div class="star-readonly">
            <i
              v-for="i in 5"
              :key="'r-' + i"
              class="star"
              :class="{
                active: i <= Math.floor(Number(reviewDetail?.rating ?? 0)),
              }"
              >★</i
            >
            <span class="star-score"
              >{{ Math.floor(Number(reviewDetail?.rating ?? 0)) }}/5</span
            >
          </div>

          <div class="review-detail-text">{{ reviewDetail.comment }}</div>

          <div class="modal-actions">
            <button @click="closeReviewDetailModal" class="btn-close">
              ปิด
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>

  <!-- Equipment Modal -->
  <teleport to="body">
    <div v-if="showEquipmentModal" class="modal-overlay">
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
              {{ currentBookingForEquipment?.user_name || user?.first_name }}
              {{ currentBookingForEquipment?.user_lastname || user?.last_name }}
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
                >จำนวน: {{ equipment.quantity }}</span
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
/* Layout */
.page-wrapper {
  min-height: 110vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.container {
  flex-grow: 1;
  margin: 0 auto;
  max-width: 1400px;
  padding: 40px 30px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.container > h2 {
  font-size: 28px;
  font-weight: 700;
  color: #2d2d2d;
  margin: 0 0 24px 0;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.mb-2 {
  text-decoration: none;
}

/* Filter */
.status-filter {
  padding: 20px;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  display: inline-block;
  margin-bottom: 24px;
}

.filter-title {
  font-weight: 700;
  margin-bottom: 12px;
  display: block;
  color: #2d2d2d;
  font-size: 16px;
}

.status-option {
  display: inline-flex;
  align-items: center;
  margin-right: 20px;
  margin-bottom: 8px;
}

.custom-checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #ccc;
  border-radius: 5px;
  margin-right: 8px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.custom-checkbox:checked {
  background-color: #2d2d2d;
  border-color: #2d2d2d;
}

.custom-checkbox:checked::after {
  content: "✔";
  color: white;
  font-size: 14px;
  font-weight: bold;
  position: absolute;
  top: -2px;
  left: 3px;
}

.custom-checkbox:hover {
  border-color: #2d2d2d;
}

.custom-label {
  cursor: pointer;
  font-size: 15px;
  color: #333;
  user-select: none;
  font-weight: 600;
}

/* Table */
.table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 16px;
  text-align: left;
  border: 1px solid #e0e0e0;
}

th {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}

tbody tr {
  background: #ffffff;
  transition: all 0.2s;
}

tbody tr:hover {
  background: #f8f9fa;
}

/* Buttons */
button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  transition: all 0.3s;
  cursor: pointer;
}

.btn-pending {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.btn-pending:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
}

.btn-approved {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-approved:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-cancel {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.btn-finished {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-finished:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

.btn-cancelbooking {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-cancelbooking:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.btn-equipment {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: white;
  font-size: 14px;
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.2);
}

.btn-equipment:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 45, 45, 0.3);
}

.no-equipment-text {
  color: #6c757d;
  font-style: italic;
  text-align: center;
  display: block;
}

.btn-review,
.btn-review-detail {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-review:hover,
.btn-review-detail:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-review:disabled {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-review:disabled:hover {
  transform: none;
}

/* Stars (ใช้ได้ทั้งตาราง/เขียน/อ่านอย่างเดียว) */
.stars {
  display: inline-flex;
  gap: 2px;
  line-height: 1;
}

.star {
  color: #ccc;
  font-size: 16px;
}

.star.filled,
.star.active {
  color: #fbc02d;
}

/* Star picker (เขียนรีวิว) */
.star-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 10px;
}

.star-picker .star {
  appearance: none;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  color: #ccc;
  padding: 0 2px;
  transition: transform 0.05s ease, color 0.15s ease;
}

.star-picker .star:hover {
  transform: translateY(-1px);
}

.star-picker .star.active {
  color: #fbc02d;
}

.star-score {
  margin-left: 6px;
  font-weight: 700;
  color: #444;
}

/* Readonly stars */
.star-readonly {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 10px;
}

.star-readonly .star {
  font-size: 22px;
  color: #ccc;
}

.star-readonly .star.active {
  color: #fbc02d;
}

.star-readonly .star-score {
  font-weight: 700;
  color: #444;
}

/* Pagination */
.pagination-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  text-align: center;
  z-index: 50;
  background: linear-gradient(180deg, rgba(245, 245, 245, 0), #f5f5f5 40%);
  padding: 12px 0;
}

.pagination {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.pagination button {
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: white;
  border: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(45, 45, 45, 0.2);
}

.pagination button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(45, 45, 45, 0.3);
}

.pagination button:disabled {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  box-shadow: none;
}

.pagination button:disabled:hover {
  transform: none;
}

.pagination button.active {
  background: #ffffff;
  color: #2d2d2d;
  font-weight: 700;
  border: 2px solid #2d2d2d;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.15);
}

.page-jump {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;
  color: #2d2d2d;
  font-weight: 600;
}

.page-jump input {
  width: 70px;
  padding: 8px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  text-align: center;
  transition: border-color 0.3s;
}

.page-jump input:focus {
  border-color: #2d2d2d;
}

/* Card/Table wrapper */
.booking-table-wrapper {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 2px solid #e0e0e0;
  padding: 20px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* Empty state */
.no-data {
  text-align: center;
  padding: 60px 20px;
  font-style: italic;
  color: #999;
  font-size: 16px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
}

.modal-content {
  position: relative;
  z-index: 2147483647;
  background: #fff;
  border-radius: 16px;
  padding: 32px 36px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  font-size: 22px;
  font-weight: 700;
  color: #2d2d2d;
  margin: 0 0 20px 0;
}

.textarea {
  width: 100%;
  margin-top: 12px;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  outline: none;
  font-size: 15px;
  line-height: 1.5;
  transition: border-color 0.3s;
}

.textarea:focus {
  border-color: #2d2d2d;
  box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1);
}

.modal-actions {
  margin-top: 24px;
  text-align: right;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-close {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  color: #fff;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-close:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

.review-detail-text {
  margin-top: 10px;
  white-space: pre-wrap;
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
  margin-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
  color: #2d2d2d;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-btn {
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 8px 10px;
  border-radius: 8px;
  transition: all 0.3s;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background-color: #2d2d2d;
  color: #fff;
  border-color: #2d2d2d;
  transform: rotate(90deg);
}

.modal-body {
  margin-bottom: 24px;
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
  color: #333;
  font-size: 15px;
  line-height: 1.6;
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
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
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
  color: #666;
  font-style: italic;
}

.equipment-quantity {
  font-size: 14px;
  font-weight: 600;
  color: #2d2d2d;
  background-color: #e9ecef;
  padding: 4px 12px;
  border-radius: 14px;
  white-space: nowrap;
}

.no-equipment {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-style: italic;
  font-size: 16px;
}

.no-equipment i {
  font-size: 60px;
  margin-bottom: 16px;
  display: block;
  color: #ddd;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 2px solid #e0e0e0;
  padding-top: 20px;
}
</style>
