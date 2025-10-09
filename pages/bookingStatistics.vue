<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

import { useBookingStore } from "@/store/bookingStore";
import { useRoomStore } from "@/store/roomStore";
import { useReviewStore } from "@/store/reviewStore";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import localeData from "dayjs/plugin/localeData";
import advancedFormat from "dayjs/plugin/advancedFormat";
import weekday from "dayjs/plugin/weekday";

import "dayjs/locale/th"; // <-- เพิ่มนี้

// 🕓 Setup DayJS Plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(advancedFormat);
dayjs.extend(weekday);

dayjs.tz.setDefault("Asia/Bangkok");
dayjs.locale("th"); // <-- ตั้ง locale เป็นไทย

// ✅ Register ChartJS components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);

// 🏪 Pinia Stores
const bookingStore = useBookingStore();
const roomStore = useRoomStore();
const reviewStore = useReviewStore();

// 📊 Refs for stats and chart data
const weeklyStats = ref([]);
const monthlyStats = ref([]);
const yearlyStats = ref([]);

const weeklyChartData = ref({});
const monthlyChartData = ref({});
const yearlyChartData = ref({});

// แผนที่คะแนนรีวิวเฉลี่ยต่อห้อง { [roomId]: { sum, count, avg } }
const ratingsByRoom = ref({});

const buildRatingsByRoom = () => {
  const map = {};
  const reviews = Array.isArray(reviewStore.reviews) ? reviewStore.reviews : [];
  const bookings = Array.isArray(bookingStore.bookings)
    ? bookingStore.bookings
    : [];
  for (const r of reviews) {
    const bookingId =
      typeof reviewStore.getBookingId === "function"
        ? reviewStore.getBookingId(r)
        : r?.booking_id ?? r?.bookingId;
    if (!bookingId && !r?.booking) continue;
    const bk =
      bookings.find((b) => String(b?.id) === String(bookingId)) || r?.booking;
    const roomId = bk?.room_id;
    const rating = Number(r?.rating);
    if (!roomId || !Number.isFinite(rating)) continue;
    if (!map[roomId]) map[roomId] = { sum: 0, count: 0, avg: 0 };
    map[roomId].sum += rating;
    map[roomId].count += 1;
  }
  for (const k of Object.keys(map)) {
    const node = map[k];
    node.avg = node.count > 0 ? Number((node.sum / node.count).toFixed(2)) : 0;
  }
  ratingsByRoom.value = map;
};

// แสดงวันที่เป็นแบบเต็ม ภาษาไทย
const currentDate = ref(
  dayjs().tz().locale("th").format("D MMMM YYYY เวลา HH:mm:ss")
);

let timerId = null;

// 🧠 Core logic: calculate top rooms
const calculateStats = (period) => {
  const now = dayjs().tz();
  let start, end;

  if (period === "week") {
    start = now.startOf("week"); // Sunday
    end = now.endOf("week"); // Saturday 23:59:59
  } else if (period === "month") {
    start = now.startOf("month");
    end = now.endOf("month");
  } else if (period === "year") {
    start = now.startOf("year");
    end = now.endOf("year");
  }

  console.log(
    `🧾 [${period.toUpperCase()}] ช่วงเวลา:`,
    start.format(),
    "→",
    end.format()
  );

  const countMap = {};

  bookingStore.bookings.forEach((booking) => {
    const bookingTime = dayjs.unix(booking.start_time).tz();

    if (
      (booking.status === "Approved" || booking.status === "Finished") &&
      bookingTime.isSameOrAfter(start) &&
      bookingTime.isSameOrBefore(end)
    ) {
      const room = roomStore.rooms.find(
        (r) => String(r.id) === String(booking.room_id)
      );

      if (!room) {
        console.warn(
          `❗ ไม่พบห้องใน roomStore.rooms ที่ id = ${booking.room_id}`
        );
        return;
      }

      const key = room.id;
      if (!countMap[key]) {
        countMap[key] = {
          count: 0,
          name: room.name,
          image: room.image_url || "/default-room.jpg",
        };
      }
      countMap[key].count++;
      console.log(`✅ Booking นับในสถิติ (${period}):`, room.name);
    } else {
      console.log(`⛔ ไม่ผ่านช่วงเวลา (${period}) หรือสถานะไม่ตรงเงื่อนไข`);
    }
  });

  // ผูกค่าเฉลี่ยเรตติ้งเข้ากับห้อง
  for (const key of Object.keys(countMap)) {
    const rid = key;
    const ratingInfo = ratingsByRoom.value[rid];
    if (ratingInfo) {
      countMap[key].ratingAvg = ratingInfo.avg;
      countMap[key].ratingCount = ratingInfo.count;
    } else {
      countMap[key].ratingAvg = null;
      countMap[key].ratingCount = 0;
    }
  }

  const sortedRooms = Object.values(countMap).sort((a, b) => b.count - a.count);
  return sortedRooms.slice(0, 3);
};

// 🧰 Chart options - ปรับให้สวยงามและมีแอนิเมชั่น
const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  animation: {
    duration: 1500,
    easing: "easeInOutQuart",
  },
  plugins: {
    legend: {
      display: true,
      position: "top",
      labels: {
        font: {
          size: 14,
          weight: "600",
          family: "'Kanit', sans-serif",
        },
        color: "#2d2d2d",
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: "rgba(45, 45, 45, 0.95)",
      titleColor: "#ffffff",
      bodyColor: "#ffffff",
      borderColor: "#2d2d2d",
      borderWidth: 2,
      padding: 12,
      cornerRadius: 8,
      titleFont: {
        size: 15,
        weight: "700",
        family: "'Kanit', sans-serif",
      },
      bodyFont: {
        size: 14,
        weight: "600",
        family: "'Kanit', sans-serif",
      },
      callbacks: {
        title: (context) => context[0].label,
        label: (context) => `จำนวนการจอง: ${context.parsed.y} ครั้ง`,
        afterLabel: (context) => {
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = ((context.parsed.y / total) * 100).toFixed(1);
          return `สัดส่วน: ${percentage}%`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        font: {
          size: 13,
          weight: "600",
          family: "'Kanit', sans-serif",
        },
        color: "#666",
        callback: (value) => value + " ครั้ง",
      },
      grid: {
        color: "rgba(0, 0, 0, 0.05)",
        drawBorder: false,
      },
    },
    x: {
      ticks: {
        font: {
          size: 13,
          weight: "600",
          family: "'Kanit', sans-serif",
        },
        color: "#2d2d2d",
      },
      grid: {
        display: false,
      },
    },
  },
};

// 🚀 Load data on mount
onMounted(async () => {
  await Promise.all([
    bookingStore.fetchAllBookings(),
    roomStore.fetchAllRooms(),
    reviewStore.fetchReviews(),
  ]);

  // สร้างค่าเฉลี่ยเรตติ้งต่อห้องจากข้อมูลรีวิวทั้งหมด (ตลอดเวลา)
  // หมายเหตุ: หากต้องการจำกัดช่วงเวลา ให้ปรับมาคำนวณเฉพาะรีวิวที่อยู่ในช่วงเดียวกับ period
  buildRatingsByRoom();

  currentDate.value = dayjs()
    .tz()
    .locale("th")
    .format("D MMMM YYYY เวลา HH:mm:ss");

  weeklyStats.value = calculateStats("week");
  monthlyStats.value = calculateStats("month");
  yearlyStats.value = calculateStats("year");

  // ฟังก์ชันสร้างสีแบบไล่โทนตามจำนวนการจอง
  const generateGradientColors = (data) => {
    const maxCount = Math.max(...data);
    return data.map((count) => {
      const intensity = maxCount > 0 ? count / maxCount : 0;
      // ใช้ไล่สีจากอ่อนไปเข้ม (RGB gradient)
      const r = Math.floor(45 + (220 - 45) * (1 - intensity)); // สีแดง
      const g = Math.floor(45 + (100 - 45) * (1 - intensity)); // สีเขียว
      const b = Math.floor(45 + (240 - 45) * (1 - intensity)); // สีน้ำเงิน
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    });
  };

  weeklyChartData.value = {
    labels: weeklyStats.value.map((item) => item.name),
    datasets: [
      {
        label: "จำนวนการจอง",
        data: weeklyStats.value.map((item) => item.count),
        backgroundColor: generateGradientColors(
          weeklyStats.value.map((item) => item.count)
        ),
        borderColor: "#2d2d2d",
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: generateGradientColors(
          weeklyStats.value.map((item) => item.count)
        ).map((color) => color.replace("0.85", "1")),
      },
    ],
  };

  monthlyChartData.value = {
    labels: monthlyStats.value.map((item) => item.name),
    datasets: [
      {
        label: "จำนวนการจอง",
        data: monthlyStats.value.map((item) => item.count),
        backgroundColor: generateGradientColors(
          monthlyStats.value.map((item) => item.count)
        ),
        borderColor: "#2d2d2d",
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: generateGradientColors(
          monthlyStats.value.map((item) => item.count)
        ).map((color) => color.replace("0.85", "1")),
      },
    ],
  };

  yearlyChartData.value = {
    labels: yearlyStats.value.map((item) => item.name),
    datasets: [
      {
        label: "จำนวนการจอง",
        data: yearlyStats.value.map((item) => item.count),
        backgroundColor: generateGradientColors(
          yearlyStats.value.map((item) => item.count)
        ),
        borderColor: "#2d2d2d",
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: generateGradientColors(
          yearlyStats.value.map((item) => item.count)
        ).map((color) => color.replace("0.85", "1")),
      },
    ],
  };

  // เริ่ม setInterval อัพเดตเวลาปัจจุบันทุกวินาที
  timerId = setInterval(() => {
    currentDate.value = dayjs()
      .tz()
      .locale("th")
      .format("D MMMM YYYY เวลา HH:mm:ss");
  }, 1000);
});

// เคลียร์ interval เมื่อละทิ้ง component
onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});
</script>

<template>
  <div class="stats-container">
    <h1>สถิติห้องที่ถูกจองมากสุด 3 อันดับแรก</h1>

    <!-- รายสัปดาห์ -->
    <div class="stats-section">
      <h2>🗓️ รายสัปดาห์ ตั้งแต่วันอาทิตย์ - วันเสาร์</h2>
      <div v-if="weeklyStats.length > 0">
        <div class="chart-wrapper">
          <Bar :data="weeklyChartData" :options="chartOptions" />
        </div>
        <div class="room-images">
          <div
            v-for="(room, index) in weeklyStats"
            :key="room.name"
            class="room-image-box"
          >
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>
              {{ room.name }}<br />
              <strong>{{ room.count }} ครั้ง</strong>
              <br />
              <span v-if="room.ratingAvg != null"
                >⭐ {{ room.ratingAvg }} ({{ room.ratingCount }} รีวิว)</span
              >
            </p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">ไม่มีข้อมูลการจองในช่วงนี้</div>
    </div>

    <!-- รายเดือน -->
    <div class="stats-section">
      <h2>📅 รายเดือน (เดือนปัจจุบัน)</h2>
      <div v-if="monthlyStats.length > 0">
        <div class="chart-wrapper">
          <Bar :data="monthlyChartData" :options="chartOptions" />
        </div>
        <div class="room-images">
          <div
            v-for="(room, index) in monthlyStats"
            :key="room.name"
            class="room-image-box"
          >
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>
              {{ room.name }}<br />
              <strong>{{ room.count }} ครั้ง</strong>
              <br />
              <span v-if="room.ratingAvg != null"
                >⭐ {{ room.ratingAvg }} ({{ room.ratingCount }} รีวิว)</span
              >
            </p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">ไม่มีข้อมูลการจองในช่วงนี้</div>
    </div>

    <!-- รายปี -->
    <div class="stats-section">
      <h2>📊 รายปี (ปีปัจจุบัน)</h2>
      <div v-if="yearlyStats.length > 0">
        <div class="chart-wrapper">
          <Bar :data="yearlyChartData" :options="chartOptions" />
        </div>
        <div class="room-images">
          <div
            v-for="(room, index) in yearlyStats"
            :key="room.name"
            class="room-image-box"
          >
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>
              {{ room.name }}<br />
              <strong>{{ room.count }} ครั้ง</strong>
              <br />
              <span v-if="room.ratingAvg != null"
                >⭐ {{ room.ratingAvg }} ({{ room.ratingCount }} รีวิว)</span
              >
            </p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">ไม่มีข้อมูลการจองในช่วงนี้</div>
    </div>
  </div>
</template>

<style scoped>
.debug-info {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 2rem;
  border-left: 4px solid #2d2d2d;
}

.debug-info p {
  margin: 0.5rem 0;
  color: #333;
}

.stats-container {
  max-width: 1400px;
  margin: 0 auto;
  background: #ffffff;
  padding: 40px 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

h1 {
  text-align: center;
  color: #2d2d2d;
  margin: 0 0 30px 0;
  padding-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
  font-size: 28px;
  font-weight: 700;
}

.stats-section {
  margin-bottom: 32px;
  padding: 28px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stats-section h2 {
  color: #2d2d2d;
  margin: 0 0 24px 0;
  font-size: 22px;
  font-weight: 700;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.chart-wrapper {
  max-width: 100%;
  margin-bottom: 28px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
}

.room-images {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
}

.room-image-box {
  position: relative;
  text-align: center;
  width: 180px;
  background: #ffffff;
  padding: 18px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.room-image-box:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border-color: #2d2d2d;
}

.rank {
  position: absolute;
  top: -12px;
  left: -12px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  color: white;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.3);
  border: 3px solid #ffffff;
}

.room-image-box img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 12px;
  border: 2px solid #e0e0e0;
}

.room-image-box p {
  margin: 0;
  color: #2d2d2d;
  font-size: 14px;
  line-height: 1.6;
}

.room-image-box p strong {
  color: #2d2d2d;
  font-size: 15px;
  font-weight: 700;
}

.room-image-box p span {
  color: #fbbf24;
  font-weight: 600;
  font-size: 13px;
}

.no-data {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 60px 20px;
  font-size: 16px;
}
</style>
