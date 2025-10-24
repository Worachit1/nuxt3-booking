<script setup>
import { onMounted, ref, computed } from "vue";
import { Bar, Line, Doughnut } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
} from "chart.js";

import { useBookingStore } from "@/store/bookingStore";
import { useRoomStore } from "@/store/roomStore";
import { useReviewStore } from "@/store/reviewStore";
import { useUserStore } from "@/store/userStore";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import "dayjs/locale/th";

// Setup DayJS
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.tz.setDefault("Asia/Bangkok");
dayjs.locale("th");

// Register ChartJS components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement
);

// Pinia Stores
const bookingStore = useBookingStore();
const roomStore = useRoomStore();
const reviewStore = useReviewStore();
const userStore = useUserStore();

// Loading state
const isLoading = ref(true);

// Overview Stats
const totalBookings = computed(() => bookingStore.bookings.length);
const pendingBookings = computed(
  () => bookingStore.bookings.filter((b) => b.status === "Pending").length
);
const approvedBookings = computed(
  () => bookingStore.bookings.filter((b) => b.status === "Approved").length
);
const finishedBookings = computed(
  () => bookingStore.bookings.filter((b) => b.status === "Finished").length
);
const canceledBookings = computed(
  () => bookingStore.bookings.filter((b) => b.status === "Canceled").length
);
const totalRooms = computed(() => roomStore.rooms.length);
const totalUsers = computed(() => userStore.users.length);

// Today's bookings
const todayBookings = computed(() => {
  const today = dayjs().tz().startOf("day");
  return bookingStore.bookings.filter((b) => {
    const bookingDate = dayjs.unix(b.start_time).tz();
    return bookingDate.isSame(today, "day");
  }).length;
});

// This week's bookings
const weekBookings = computed(() => {
  const start = dayjs().tz().startOf("week");
  const end = dayjs().tz().endOf("week");
  return bookingStore.bookings.filter((b) => {
    const bookingDate = dayjs.unix(b.start_time).tz();
    return bookingDate.isSameOrAfter(start) && bookingDate.isSameOrBefore(end);
  }).length;
});

// This month's bookings
const monthBookings = computed(() => {
  const start = dayjs().tz().startOf("month");
  const end = dayjs().tz().endOf("month");
  return bookingStore.bookings.filter((b) => {
    const bookingDate = dayjs.unix(b.start_time).tz();
    return bookingDate.isSameOrAfter(start) && bookingDate.isSameOrBefore(end);
  }).length;
});

// Status distribution chart data
const statusChartData = computed(() => ({
  labels: ["รออนุมัติ", "อนุมัติแล้ว", "เสร็จสิ้น", "ปฏิเสธ"],
  datasets: [
    {
      label: "สถานะการจอง",
      data: [
        pendingBookings.value,
        approvedBookings.value,
        finishedBookings.value,
        canceledBookings.value,
      ],
      backgroundColor: [
        "rgba(251, 191, 36, 0.85)",
        "rgba(16, 185, 129, 0.85)",
        "rgba(59, 130, 246, 0.85)",
        "rgba(220, 53, 69, 0.85)",
      ],
      borderColor: [
        "rgb(251, 191, 36)",
        "rgb(16, 185, 129)",
        "rgb(59, 130, 246)",
        "rgb(220, 53, 69)",
      ],
      borderWidth: 3,
    },
  ],
}));

// Top 5 most booked rooms
const topRooms = computed(() => {
  const roomCounts = {};
  bookingStore.bookings.forEach((booking) => {
    if (booking.status === "Approved" || booking.status === "Finished") {
      const roomId = booking.room_id;
      roomCounts[roomId] = (roomCounts[roomId] || 0) + 1;
    }
  });

  const roomsWithCounts = Object.entries(roomCounts)
    .map(([roomId, count]) => {
      const room = roomStore.rooms.find((r) => String(r.id) === String(roomId));
      return {
        name: room?.name || "ไม่ทราบชื่อห้อง",
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return roomsWithCounts;
});

const topRoomsChartData = computed(() => ({
  labels: topRooms.value.map((r) => r.name),
  datasets: [
    {
      label: "จำนวนครั้งที่ถูกจอง",
      data: topRooms.value.map((r) => r.count),
      backgroundColor: [
        "rgba(255, 99, 132, 0.8)",
        "rgba(54, 162, 235, 0.8)",
        "rgba(255, 206, 86, 0.8)",
        "rgba(75, 192, 192, 0.8)",
        "rgba(153, 102, 255, 0.8)",
      ],
      borderColor: [
        "rgb(255, 99, 132)",
        "rgb(54, 162, 235)",
        "rgb(255, 206, 86)",
        "rgb(75, 192, 192)",
        "rgb(153, 102, 255)",
      ],
      borderWidth: 2,
    },
  ],
}));

// Weekly trend chart (last 7 days)
const weeklyTrendData = computed(() => {
  const last7Days = [];
  const counts = [];

  for (let i = 6; i >= 0; i--) {
    const day = dayjs().tz().subtract(i, "day");
    last7Days.push(day.format("DD MMM"));

    const dayBookings = bookingStore.bookings.filter((b) => {
      const bookingDate = dayjs.unix(b.start_time).tz();
      return bookingDate.isSame(day, "day");
    }).length;

    counts.push(dayBookings);
  }

  return {
    labels: last7Days,
    datasets: [
      {
        label: "จำนวนการจอง",
        data: counts,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
        fill: true,
      },
    ],
  };
});

// Recent bookings (include Pending, Approved, Finished). Limit for performance
const recentBookings = computed(() => {
  return bookingStore.bookings
    .filter((b) => ["Pending", "Approved", "Finished"].includes(b.status))
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    // limit to a reasonable number; UI will scroll if too many
    .slice(0, 50);
});

// Filter controls for recent bookings
const allStatuses = ["Pending", "Approved", "Finished"];
const selectedStatuses = ref(["Pending", "Approved", "Finished"]);
const filteredRecentBookings = computed(() =>
  recentBookings.value.filter((b) => selectedStatuses.value.includes(b.status))
);

// Reviews grouped by room with average rating
const reviewsByRoom = computed(() => {
  const reviews = Array.isArray(reviewStore.reviews) ? reviewStore.reviews : [];
  const rooms = roomStore.rooms || [];
  
  // Group reviews by room_id
  const grouped = {};
  
  reviews.forEach((review) => {
    const roomId = review.room_id;
    if (!grouped[roomId]) {
      grouped[roomId] = {
        room_id: roomId,
        reviews: [],
        totalRating: 0,
        count: 0
      };
    }
    grouped[roomId].reviews.push(review);
    grouped[roomId].totalRating += Number(review.rating || 0);
    grouped[roomId].count += 1;
  });
  
  // Calculate average and add room info
  // Sort each group's reviews by created_at desc so index 0 is the latest
  Object.values(grouped).forEach(item => {
    item.reviews.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  });

  const result = Object.values(grouped).map((item) => {
    const room = rooms.find(r => r.id === item.room_id);
    return {
      room_id: item.room_id,
      room_name: room?.name || 'ไม่ระบุห้อง',
      room_image: room?.image_url || '/images/default-picture.png',
      review_count: item.count,
      average_rating: (item.totalRating / item.count).toFixed(1),
      latest_review: item.reviews[0] || null, // รีวิวล่าสุดของห้องนี้
      reviews: item.reviews // include full reviews array for display
    };
  });
  
  // Sort by review count (descending)
  return result.sort((a, b) => b.review_count - a.review_count);
});

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: "bottom",
    },
  },
};

// Load data
onMounted(async () => {
  try {
    await Promise.all([
      bookingStore.fetchAllBookings().catch((err) => {
        console.error("Error fetching bookings:", err);
        return Promise.resolve();
      }),
      roomStore.fetchAllRooms().catch((err) => {
        console.error("Error fetching rooms:", err);
        return Promise.resolve();
      }),
      reviewStore.fetchReviews().catch((err) => {
        console.error("Error fetching reviews:", err);
        return Promise.resolve();
      }),
      userStore.fetchUsers().catch((err) => {
        console.error("Error fetching users:", err);
        return Promise.resolve();
      }),
    ]);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  } finally {
    isLoading.value = false;
  }
});

// Format date
const formatDate = (timestamp) => {
  return dayjs.unix(timestamp).tz().format("DD/MM/YYYY HH:mm");
};

// Navigate to booking detail
const router = useRouter();
const viewBooking = (bookingId) => {
  router.push("/admin/bookings");
};

// (users section removed — list was empty; restored to previous layout)
</script>

<template>
  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <i class="fa-solid fa-chart-line"></i>
        </div>
        <div class="header-text">
          <h1>Dashboard - ภาพรวมระบบจองห้อง</h1>
          <p class="subtitle">{{ dayjs().tz().format("วันdddd ที่ D MMMM YYYY") }}</p>
        </div>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>กำลังโหลดข้อมูล...</p>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Overview Cards -->
        <div class="overview-cards">
          <div class="card card-primary">
            <div class="card-icon">📅</div>
            <div class="card-content">
              <h3>{{ totalBookings }}</h3>
              <p>การจองทั้งหมด</p>
            </div>
          </div>

          <div class="card">
            <div class="card-icon">⏳</div>
            <div class="card-content">
              <h3>{{ pendingBookings }}</h3>
              <p>รออนุมัติ</p>
            </div>
          </div>

          <div class="card card-success">
            <div class="card-icon">✅</div>
            <div class="card-content">
              <h3>{{ approvedBookings }}</h3>
              <p>อนุมัติแล้ว</p>
            </div>
          </div>

          <div class="card card-info">
            <div class="card-icon">🏁</div>
            <div class="card-content">
              <h3>{{ finishedBookings }}</h3>
              <p>เสร็จสิ้น</p>
            </div>
          </div>

          <div class="card card-danger">
            <div class="card-icon">❌</div>
            <div class="card-content">
              <h3>{{ canceledBookings }}</h3>
              <p>ปฏิเสธ</p>
            </div>
          </div>

          <div class="card card-secondary">
            <div class="card-icon">🚪</div>
            <div class="card-content">
              <h3>{{ totalRooms }}</h3>
              <p>ห้องทั้งหมด</p>
            </div>
          </div>

          <div class="card card-secondary">
            <div class="card-icon">👥</div>
            <div class="card-content">
              <h3>{{ totalUsers }}</h3>
              <p>ผู้ใช้ทั้งหมด</p>
            </div>
          </div>
        </div>

        <!-- Time Period Stats -->
        <div class="period-stats">
          <div class="period-card">
            <h4>📆 วันนี้</h4>
            <p class="period-count">{{ todayBookings }}</p>
            <span>การจอง</span>
          </div>
          <div class="period-card">
            <h4>📅 สัปดาห์นี้</h4>
            <p class="period-count">{{ weekBookings }}</p>
            <span>การจอง</span>
          </div>
          <div class="period-card">
            <h4>📊 เดือนนี้</h4>
            <p class="period-count">{{ monthBookings }}</p>
            <span>การจอง</span>
          </div>
        </div>

        <!-- Charts Row 1 -->
        <div class="charts-row">
          <div class="chart-card">
            <h3>📈 แนวโน้มการจอง (7 วันที่ผ่านมา)</h3>
            <div class="chart-wrapper">
              <Line :data="weeklyTrendData" :options="chartOptions" />
            </div>
          </div>

          <div class="chart-card">
            <h3>📊 สถานะการจอง</h3>
            <div class="chart-wrapper">
              <Doughnut :data="statusChartData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Charts Row 2 -->
        <div class="charts-row">
          <div class="chart-card full-width">
            <h3>🏆 ห้องที่ถูกจองมากที่สุด Top 5</h3>
            <div class="chart-wrapper">
              <Bar :data="topRoomsChartData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Recent Activities -->
        <div class="recent-section">
          <div class="recent-card">
            <h3>🔔 การจองล่าสุด (รออนุมัติ / อนุมัติ / เสร็จสิ้น)</h3>
            <div class="recent-filters">
              <label v-for="s in allStatuses" :key="s" class="filter-chip">
                <input type="checkbox" :value="s" v-model="selectedStatuses" />
                <span :class="s.toLowerCase()">{{ s }}</span>
              </label>
            </div>

            <div v-if="filteredRecentBookings.length > 0" class="recent-list">
              <div
                v-for="booking in filteredRecentBookings"
                :key="booking.id"
                class="recent-item"
                @click="viewBooking(booking.id)"
              >
                <div class="recent-info">
                  <p class="recent-title">{{ booking.title }}</p>
                  <p class="recent-detail">
                    ห้อง: {{ booking.room_name }} | ผู้จอง: {{ booking.user_name }} {{ booking.user_lastname }}
                  </p>
                  <p class="recent-time">{{ formatDate(booking.start_time) }}</p>
                </div>
                <div class="recent-badge" :class="booking.status ? booking.status.toLowerCase() : ''">
                  {{ booking.status }}
                </div>
              </div>
            </div>
            <div v-else class="no-data">ไม่มีการจองล่าสุด</div>
          </div>

          <div class="recent-card">
            <h3>⭐ คะแนนรีวิวแต่ละห้อง</h3>
            <div v-if="reviewsByRoom.length > 0" class="recent-list">
              <div
                v-for="roomReview in reviewsByRoom"
                :key="roomReview.room_id"
                class="recent-item room-review-item"
              >
                <div class="room-review-header">
                  <div class="room-image-small">
                    <img
                      :src="roomReview.room_image"
                      :alt="roomReview.room_name"
                      @error="$event.target.src = '/images/default-picture.png'"
                    />
                  </div>
                  <div class="room-review-info">
                    <h4 class="room-name">{{ roomReview.room_name }}</h4>
                    <div class="review-stats">
                      <div class="average-rating">
                        <span class="rating-number">{{ roomReview.average_rating }}</span>
                        <span class="rating-stars">
                          <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(roomReview.average_rating) }">★</span>
                        </span>
                      </div>
                      <span class="review-count">({{ roomReview.review_count }} รีวิว)</span>
                    </div>
                  </div>
                </div>

                <div v-if="roomReview.review_count === 2" class="latest-review multiple-comments">
                  <div v-for="(rv, idx) in roomReview.reviews" :key="idx" class="review-row">
                    <p class="review-comment">
                      <i class="fa-solid fa-quote-left"></i>
                      {{ rv.comment || 'ไม่มีความคิดเห็น' }}
                      <i class="fa-solid fa-quote-right"></i>
                    </p>
                  </div>
                </div>

                <div v-else-if="roomReview.latest_review" class="latest-review">
                  <p class="review-comment">
                    <i class="fa-solid fa-quote-left"></i>
                    {{ roomReview.latest_review.comment || "ไม่มีความคิดเห็น" }}
                    <i class="fa-solid fa-quote-right"></i>
                  </p>
                </div>
              </div>
            </div>
            <div v-else class="no-data">
              <i class="fa-solid fa-star"></i> ยังไม่มีรีวิว
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page Container */
.page-container {
  background: #f5f5f5;
  min-height: 100vh;
  padding: 20px 20px 40px 20px;
}

/* Page Header */
.page-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border-radius: 16px;
  padding: 32px 40px;
  margin: 0 auto 32px auto;
  max-width: 1400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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

/* Content Wrapper */
.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
}

.dashboard-header h1 {
  margin: 0 0 10px 0;
  font-size: 32px;
  font-weight: 700;
}

.current-time {
  margin: 0;
  font-size: 16px;
  opacity: 0.9;
}

/* Loading */
.loading {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
}

.spinner {
  border: 4px solid #e0e0e0;
  border-top: 4px solid #fbbf24;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading p {
  color: #2d2d2d;
  font-weight: 600;
}

/* Overview Cards */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  transition: width 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

.card:hover::before {
  width: 6px;
}

.card-icon {
  font-size: 32px;
  line-height: 1;
  min-width: 48px;
  text-align: center;
}

.card-content h3 {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  color: #2d2d2d;
}

.card-content p {
  margin: 5px 0 0 0;
  font-size: 14px;
  color: #6b7280;
  font-weight: 600;
}

/* Period Stats */
.period-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.period-card {
  background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid transparent;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.period-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
}

.period-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-color: #fbbf24;
}

.period-card h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #cbd5e0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.period-count {
  margin: 0 0 12px 0;
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.period-card span {
  font-size: 14px;
  color: #cbd5e0;
  font-weight: 500;
}

/* Charts */
.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.chart-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.chart-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.chart-card h3 {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 700;
  color: #2d2d2d;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.chart-wrapper {
  position: relative;
  height: 320px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 12px;
}

/* Recent Activities */
.recent-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.recent-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.recent-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  border-color: #fbbf24;
}

.recent-card h3 {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 700;
  color: #2d2d2d;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  /* make list scrollable when content is long */
  max-height: 360px;
  overflow-y: auto;
  padding-right: 8px;
}

.recent-list::-webkit-scrollbar {
  width: 10px;
}
.recent-list::-webkit-scrollbar-track {
  background: transparent;
}
.recent-list::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 10px;
}

.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #fbbf24;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid #e0e0e0;
  border-left: 4px solid #fbbf24;
}

.recent-item:hover {
  background: #ffffff;
  transform: translateX(6px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);
  border-color: #fbbf24;
}

.recent-info {
  flex: 1;
}

.recent-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 700;
  color: #2d2d2d;
}

.recent-detail {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: #6b7280;
}

.recent-time {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.recent-badge {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-badge.pending {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.recent-badge.approved {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.recent-badge.finished {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.recent-badge.canceled {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.recent-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  padding: 6px 10px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  font-weight: 600;
}

.filter-chip input {
  width: 14px;
  height: 14px;
}

.filter-chip .pending { color: #974a06 }
.filter-chip .approved { color: #065f46 }
.filter-chip .finished { color: #1e3a8a }
.filter-chip .canceled { color: #7f1d1d }

/* Users section removed */

/* Room Review Item */
.room-review-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-review-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.room-image-small {
  width: 70px;
  height: 70px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #e0e0e0;
}

.room-image-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-review-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #2d2d2d;
}

.review-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.average-rating {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-number {
  font-size: 24px;
  font-weight: 700;
  color: #fbbf24;
}

.rating-stars {
  display: flex;
  align-items: center;
}

.review-count {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.latest-review {
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #fbbf24;
}

.review-comment {
  margin: 0;
  font-size: 13px;
  color: #374151;
  font-style: italic;
  line-height: 1.6;
}

.review-comment i {
  color: #fbbf24;
  font-size: 10px;
  margin: 0 4px;
}
.multiple-comments .review-row { padding: 6px 0; border-bottom: 1px dashed #eee }
.multiple-comments .review-row:last-child { border-bottom: none }

.recent-rating {
  margin: 0 0 10px 0;
}

.star {
  color: #e0e0e0;
  font-size: 18px;
  margin-right: 2px;
}

.star.filled {
  color: #fbbf24;
  text-shadow: 0 0 2px rgba(251, 191, 36, 0.3);
}

.no-data {
  text-align: center;
  padding: 48px 20px;
  color: #9ca3af;
  font-style: italic;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.no-data i {
  font-size: 32px;
  opacity: 0.5;
}

/* Responsive */
@media (max-width: 1200px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 80px 16px 32px 16px;
  }

  .page-header {
    padding: 24px;
    margin-bottom: 24px;
  }

  .header-content {
    flex-direction: column;
    text-align: center;
  }

  .header-icon {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }

  .header-text h1 {
    font-size: 22px !important;
  }

  .subtitle {
    font-size: 13px;
  }

  .overview-cards {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
  }

  .card {
    padding: 20px;
  }

  .card-icon {
    font-size: 28px;
  }

  .card-content h3 {
    font-size: 28px;
  }

  .period-stats {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .period-card {
    padding: 24px;
  }

  .period-count {
    font-size: 44px;
  }

  .charts-row,
  .recent-section {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .chart-card {
    padding: 20px;
  }

  .chart-wrapper {
    height: 280px;
  }

  .recent-card {
    padding: 20px;
  }

  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
