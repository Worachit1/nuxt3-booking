<script setup>
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import LoadingPage from "@/components/Loading.vue";
import dayjs from "dayjs";

import { useReviewStore } from "@/store/reviewStore";
import { useRoomStore } from "@/store/roomStore";

definePageMeta({ middleware: ["load-user"] });

const reviewStore = useReviewStore();
const roomStore = useRoomStore();

const { isLoading: reviewsLoading } = storeToRefs(reviewStore);
const { isLoading: roomsLoading } = storeToRefs(roomStore);
const isLoading = computed(() => reviewsLoading.value || roomsLoading.value);

const search = ref("");

const normalizeRating = (r) => {
  const val = r?.rating ?? r?.score ?? r?.stars ?? r?.point ?? 0;
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
};
const normalizeComment = (r) =>
  r?.comment ?? r?.review ?? r?.text ?? r?.message ?? "";
const getRoomId = (r) => r?.room_id ?? r?.roomId ?? r?.room?.id;
const getCreatedAt = (r) => {
  const raw = r?.created_at ?? r?.create_at ?? r?.createdAt ?? r?.createAt;
  if (raw == null) return null;
  const num = Number(raw);
  if (Number.isFinite(num)) {
    const ms = num < 10000000000 ? num * 1000 : num; // seconds->ms
    return new Date(ms);
  }
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const roomNameById = (id) => {
  const r = roomStore.rooms.find((x) => String(x.id) === String(id));
  return r?.name || `Room #${id}`;
};

onMounted(async () => {
  await Promise.all([
    reviewStore.fetchReviews(),
    roomStore.fetchAllRooms(1, 1000),
  ]);
});

const grouped = computed(() => {
  const list = Array.isArray(reviewStore.reviews) ? reviewStore.reviews : [];
  const map = new Map();
  for (const r of list) {
    const roomId = getRoomId(r);
    if (!roomId) continue;
    const entry = map.get(String(roomId)) || { room_id: roomId, reviews: [] };
    entry.reviews.push(r);
    map.set(String(roomId), entry);
  }
  const arr = Array.from(map.values()).map((entry) => {
    const ratings = entry.reviews.map((r) => normalizeRating(r));
    const avg = ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;
    return {
      room_id: entry.room_id,
      room_name: roomNameById(entry.room_id),
      count: entry.reviews.length,
      avg: Math.round(avg * 10) / 10,
      reviews: entry.reviews.slice().sort((a, b) => {
        const da = getCreatedAt(a)?.getTime?.() || 0;
        const db = getCreatedAt(b)?.getTime?.() || 0;
        return db - da;
      }),
    };
  });
  // filter by room name search
  const q = search.value.trim().toLowerCase();
  const filtered = q
    ? arr.filter(
        (g) =>
          (g.room_name || "").toLowerCase().includes(q) ||
          String(g.room_id).includes(q)
      )
    : arr;
  // sort by avg desc then count desc
  return filtered.sort((a, b) => b.avg - a.avg || b.count - a.count);
});

const formatDate = (d) => (d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "-");
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="admin-reviews">
    <div class="header">
      <h2>รีวิวห้องประชุม</h2>
      <div class="search">
        <input v-model="search" type="text" placeholder="ค้นหาตามชื่อห้อง..." />
      </div>
    </div>

    <div v-if="grouped.length === 0" class="empty">ยังไม่มีรีวิว</div>

    <div v-else class="rooms">
      <div v-for="g in grouped" :key="g.room_id" class="room-card">
        <div class="room-header">
          <div class="room-title">
            <div class="name">{{ g.room_name }}</div>
            <div class="meta">
              <span class="stars">
                <i
                  v-for="i in 5"
                  :key="'s-' + g.room_id + '-' + i"
                  class="star"
                  :class="{ active: i <= Math.round(g.avg) }"
                  >★</i
                >
              </span>
              <span class="avg">{{ g.avg.toFixed(1) }}/5</span>
              <span class="count">• {{ g.count }} รีวิว</span>
            </div>
          </div>
        </div>
        <div class="reviews">
          <div
            v-for="rev in g.reviews"
            :key="rev.id || rev.booking_id"
            class="review-item"
          >
            <div class="rating">
              <i
                v-for="i in 5"
                :key="'r-' + (rev.id || rev.booking_id) + '-' + i"
                class="star"
                :class="{ active: i <= Math.round(normalizeRating(rev)) }"
                >★</i
              >
              <span class="score">{{ normalizeRating(rev) }}/5</span>
            </div>
            <div class="comment">{{ normalizeComment(rev) }}</div>
            <div class="created">{{ formatDate(getCreatedAt(rev)) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-reviews {
  max-width: 1400px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  padding: 40px 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #2d2d2d;
}

.search input {
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 15px;
  transition: all 0.3s;
  min-width: 280px;
}

.search input:focus {
  outline: none;
  border-color: #2d2d2d;
  box-shadow: 0 2px 8px rgba(45, 45, 45, 0.1);
}
.empty {
  padding: 40px;
  text-align: center;
  color: #999;
  font-size: 16px;
}

.rooms {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 0;
}

.room-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.room-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.room-header {
  padding: 18px 20px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-bottom: none;
}

.room-title .name {
  font-weight: 700;
  font-size: 18px;
  color: #ffffff;
  margin-bottom: 8px;
}

.room-title .meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #e0e0e0;
  font-size: 14px;
}
.stars {
  display: inline-flex;
  gap: 3px;
}

.star {
  color: #d1d5db;
  font-size: 16px;
}

.star.active {
  color: #fbbf24;
}

.avg {
  font-weight: 700;
  color: #ffffff;
}

.count {
  color: #b0b0b0;
}

.reviews {
  padding: 20px;
  display: grid;
  gap: 14px;
  background: #f8f9fa;
}

.review-item {
  border: 2px solid #e0e0e0;
  border-left: 4px solid #2d2d2d;
  border-radius: 10px;
  padding: 16px;
  background: #ffffff;
  transition: all 0.3s;
}

.review-item:hover {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transform: translateX(4px);
}

.rating {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rating .star {
  font-size: 18px;
}

.score {
  font-weight: 700;
  color: #2d2d2d;
  font-size: 15px;
}

.comment {
  margin-top: 10px;
  white-space: pre-wrap;
  line-height: 1.6;
  color: #333;
  font-size: 15px;
}

.created {
  margin-top: 10px;
  color: #999;
  font-size: 13px;
}
</style>
