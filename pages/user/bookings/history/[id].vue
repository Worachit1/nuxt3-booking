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
  middleware: ["load-user"],
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

                  <!-- มีรีวิวแล้ว: แสดงดาว + กดดูรายละเอียด -->
                  <button
                    v-else
                    class="btn-review-detail"
                    @click="openReviewDetailModal(booking)"
                    title="ดูรายละเอียดการรีวิว"
                  >
                    <span class="stars">
                      <i
                        v-for="i in 5"
                        :key="i"
                        class="star"
                        :class="{
                          filled: i <= getReviewRating(booking),
                          active: i <= getReviewRating(booking),
                        }"
                        >★</i
                      >
                    </span>
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
}

.container {
  flex-grow: 1;
  margin: 10px;
}

.mb-2 {
  text-decoration: underline;
}

/* Filter */
.status-filter {
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  display: inline-block;
}

.filter-title {
  font-weight: 700;
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
  font-weight: 700;
}

/* Table */
.table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f4f4f6;
  color: #13131f;
  font-weight: 800;
}

tr:hover {
  background-color: #fafafa;
  transition: background-color 0.2s ease;
}

/* Buttons */
button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: #fff;
}

.btn-pending {
  background-color: #f9c749;
  color: #1a1a1a;
}

.btn-pending:hover {
  background-color: #e3b83f;
}

.btn-approved {
  background-color: #73ea8d;
  color: #0f3a1c;
}

.btn-approved:hover {
  background-color: #5bd577;
}

.btn-cancel {
  background-color: #f06666;
}

.btn-cancel:hover {
  background-color: #d9534f;
}

.btn-finished {
  background-color: #6c757d;
}

.btn-finished:hover {
  background-color: #5a6268;
}

.btn-cancelbooking {
  background-color: #ef2727;
  cursor: pointer;
}

.btn-cancelbooking:hover {
  background-color: #d9534f;
}

.btn-equipment {
  background-color: #17a2b8;
  color: white;
  cursor: pointer;
  font-size: 12px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.btn-equipment:hover {
  background-color: #138496;
  transition: background-color 0.3s ease;
}

.no-equipment-text {
  color: #6c757d;
  font-style: italic;
  text-align: center;
  display: block;
}

.btn-reviewed {
  background-color: #4caf50;
  /* เขียว */
  color: #fff;
  border-radius: 8px;
  padding: 7px 16px;
  font-weight: 700;
  font-size: 14px;
  margin: 0 4px;
  cursor: pointer;
  border: none;
  transition: background 0.2s ease;
}

.btn-reviewed:hover {
  background-color: #388e3c;
}

.btn-review,
.btn-review-detail {
  background-color: #4caf50;
  /* สีเขียว */
  color: #fff;
  border-radius: 8px;
  padding: 7px 16px;
  font-weight: 700;
  font-size: 14px;
  margin: 0 4px;
  cursor: pointer;
  border: none;
  transition: transform 0.05s ease, background 0.2s ease;
}

.btn-review-detail:hover {
  background-color: #388e3c;
  /* สีเขียวเข้มเมื่อ hover */
}

.btn-review-detail:active {
  transform: translateY(1px);
}

.btn-review-detail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), #fff 40%);
  padding-top: 8px;
}

.pagination {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #eaeaea;
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
}

.pagination button {
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  background-color: #13131f;
  color: white;
  border: none;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.pagination button:hover:not(:disabled) {
  background-color: #444760;
}

.pagination button:disabled {
  background-color: #e0e0e0;
  color: #777;
  cursor: not-allowed;
}

.pagination button.active {
  background-color: #f5f5f5;
  color: #13131f;
  font-weight: 800;
  border: 1px solid #ccc;
}

.page-jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
  color: #333;
}

.page-jump input {
  width: 64px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  outline: none;
}

/* Card/Table wrapper */
.booking-table-wrapper {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #eee;
  padding: 16px;
  background-color: #fff;
  border-radius: 12px;
}

/* Empty state */
.no-data {
  text-align: center;
  padding: 20px;
  font-style: italic;
  color: #888;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647; /* max to ensure on top of any stacking context */
}

.modal-content {
  position: relative;
  z-index: 2147483647;
  background: #fff;
  border-radius: 14px;
  padding: 28px 32px;
  min-width: 360px;
  max-width: 440px;
  box-shadow: 0 8px 32px rgba(33, 150, 243, 0.12);
}

.textarea {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  outline: none;
}

.textarea:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.25);
}

.modal-actions {
  margin-top: 18px;
  text-align: right;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-close {
  background-color: #bdbdbd;
  color: #222;
  border-radius: 8px;
  padding: 7px 18px;
  font-weight: 700;
  font-size: 14px;
}

.btn-close:hover {
  background-color: #757575;
  color: #fff;
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
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}

.modal-header h3 {
  margin: 0;
  color: #13131f;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 5px;
  border-radius: 3px;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #13131f;
}

.modal-body {
  margin-bottom: 20px;
}

.booking-info {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #17a2b8;
}

.booking-info p {
  margin: 5px 0;
  color: #495057;
}

.equipment-list {
  max-height: 400px;
  overflow-y: auto;
}

.equipment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin: 8px 0;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #17a2b8;
  gap: 12px;
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
