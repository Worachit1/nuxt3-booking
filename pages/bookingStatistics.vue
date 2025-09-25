<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'

import { useBookingStore } from '@/store/bookingStore'
import { useRoomStore } from '@/store/roomStore'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import localeData from 'dayjs/plugin/localeData'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import weekday from 'dayjs/plugin/weekday'

import 'dayjs/locale/th'  // <-- เพิ่มนี้

// 🕓 Setup DayJS Plugins
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(localeData)
dayjs.extend(advancedFormat)
dayjs.extend(weekday)

dayjs.tz.setDefault('Asia/Bangkok')
dayjs.locale('th') // <-- ตั้ง locale เป็นไทย

// ✅ Register ChartJS components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// 🏪 Pinia Stores
const bookingStore = useBookingStore()
const roomStore = useRoomStore()

// 📊 Refs for stats and chart data
const weeklyStats = ref([])
const monthlyStats = ref([])
const yearlyStats = ref([])

const weeklyChartData = ref({})
const monthlyChartData = ref({})
const yearlyChartData = ref({})

// แสดงวันที่เป็นแบบเต็ม ภาษาไทย
const currentDate = ref(dayjs().tz().locale('th').format('D MMMM YYYY เวลา HH:mm:ss'))

let timerId = null

// 🧠 Core logic: calculate top rooms
const calculateStats = (period) => {
  const now = dayjs().tz()
  let start, end

  if (period === 'week') {
    start = now.startOf('week') // Sunday
    end = now.endOf('week')     // Saturday 23:59:59
  } else if (period === 'month') {
    start = now.startOf('month')
    end = now.endOf('month')
  } else if (period === 'year') {
    start = now.startOf('year')
    end = now.endOf('year')
  }

  console.log(`🧾 [${period.toUpperCase()}] ช่วงเวลา:`, start.format(), '→', end.format())

  const countMap = {}

  bookingStore.bookings.forEach(booking => {
    const bookingTime = dayjs.unix(booking.start_time).tz()

    if (
      (booking.status === 'Approved' || booking.status === 'Finished') &&
      bookingTime.isSameOrAfter(start) &&
      bookingTime.isSameOrBefore(end)
    ) {
      const room = roomStore.rooms.find(r => String(r.id) === String(booking.room_id))

      if (!room) {
        console.warn(`❗ ไม่พบห้องใน roomStore.rooms ที่ id = ${booking.room_id}`)
        return
      }

      const key = room.id
      if (!countMap[key]) {
        countMap[key] = {
          count: 0,
          name: room.name,
          image: room.image_url || '/default-room.jpg'
        }
      }
      countMap[key].count++
      console.log(`✅ Booking นับในสถิติ (${period}):`, room.name)
    } else {
      console.log(`⛔ ไม่ผ่านช่วงเวลา (${period}) หรือสถานะไม่ตรงเงื่อนไข`)
    }
  })

  const sortedRooms = Object.values(countMap).sort((a, b) => b.count - a.count)
  return sortedRooms.slice(0, 3)
}

// 🧰 Chart options
const chartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: context => `จำนวน: ${context.parsed.y} ครั้ง`
      }
    }
  }
}

// 🚀 Load data on mount
onMounted(async () => {
  await Promise.all([
    bookingStore.fetchAllBookings(),
    roomStore.fetchAllRooms()
  ])

  currentDate.value = dayjs().tz().locale('th').format('D MMMM YYYY เวลา HH:mm:ss')

  weeklyStats.value = calculateStats('week')
  monthlyStats.value = calculateStats('month')
  yearlyStats.value = calculateStats('year')

  weeklyChartData.value = {
    labels: weeklyStats.value.map(item => item.name),
    datasets: [
      {
        label: 'จำนวนการจอง',
        data: weeklyStats.value.map(item => item.count),
        backgroundColor: '#2d6cdf'
      }
    ]
  }

  monthlyChartData.value = {
    labels: monthlyStats.value.map(item => item.name),
    datasets: [
      {
        label: 'จำนวนการจอง',
        data: monthlyStats.value.map(item => item.count),
        backgroundColor: '#28a745'
      }
    ]
  }

  yearlyChartData.value = {
    labels: yearlyStats.value.map(item => item.name),
    datasets: [
      {
        label: 'จำนวนการจอง',
        data: yearlyStats.value.map(item => item.count),
        backgroundColor: '#dc3545'
      }
    ]
  }

  // เริ่ม setInterval อัพเดตเวลาปัจจุบันทุกวินาที
  timerId = setInterval(() => {
    currentDate.value = dayjs().tz().locale('th').format('D MMMM YYYY เวลา HH:mm:ss')
  }, 1000)
})

// เคลียร์ interval เมื่อละทิ้ง component
onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})
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
          <div v-for="(room, index) in weeklyStats" :key="room.name" class="room-image-box">
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>{{ room.name }}<br><strong>{{ room.count }} ครั้ง</strong></p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">
        ไม่มีข้อมูลการจองในช่วงนี้
      </div>
    </div>

    <!-- รายเดือน -->
    <div class="stats-section">
      <h2>📅 รายเดือน (เดือนปัจจุบัน)</h2>
      <div v-if="monthlyStats.length > 0">
        <div class="chart-wrapper">
          <Bar :data="monthlyChartData" :options="chartOptions" />
        </div>
        <div class="room-images">
          <div v-for="(room, index) in monthlyStats" :key="room.name" class="room-image-box">
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>{{ room.name }}<br><strong>{{ room.count }} ครั้ง</strong></p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">
        ไม่มีข้อมูลการจองในช่วงนี้
      </div>
    </div>

    <!-- รายปี -->
    <div class="stats-section">
      <h2>📊 รายปี (ปีปัจจุบัน)</h2>
      <div v-if="yearlyStats.length > 0">
        <div class="chart-wrapper">
          <Bar :data="yearlyChartData" :options="chartOptions" />
        </div>
        <div class="room-images">
          <div v-for="(room, index) in yearlyStats" :key="room.name" class="room-image-box">
            <div class="rank">{{ index + 1 }}</div>
            <img :src="room.image" :alt="room.name" />
            <p>{{ room.name }}<br><strong>{{ room.count }} ครั้ง</strong></p>
          </div>
        </div>
      </div>
      <div v-else class="no-data">
        ไม่มีข้อมูลการจองในช่วงนี้
      </div>
    </div>
  </div>
</template>


<style scoped>
.debug-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border-left: 4px solid #007bff;
}

.debug-info p {
  margin: 0.5rem 0;
  color: #495057;
}

.stats-container {
  max-width: 1000px;
  margin: 2rem auto;
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.05);
}

h1 {
  text-align: center;
  color: #2d6cdf;
  margin-bottom: 2rem;
  font-size: 2rem;
}

.stats-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: #fafafa;
}

.stats-section h2 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  border-bottom: 2px solid #2d6cdf;
  padding-bottom: 0.5rem;
}

.chart-wrapper {
  max-width: 100%;
  margin-bottom: 2rem;
}

.room-images {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.room-image-box {
  position: relative;
  text-align: center;
  width: 140px;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.rank {
  position: absolute;
  top: -10px;
  left: -10px;
  background: #2d6cdf;
  color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
}

.room-image-box img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.room-image-box p {
  margin: 0;
  color: #333;
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem;
}
</style>