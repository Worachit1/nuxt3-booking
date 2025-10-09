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
  max-width: 1100px;
  margin: 24px auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.header h2 {
  margin: 0;
  font-size: 22px;
  color: #13131f;
}
.search input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}
.empty {
  padding: 16px;
  color: #6b7280;
}
.rooms {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 16px;
}
.room-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.room-header {
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}
.room-title .name {
  font-weight: 800;
  color: #111827;
}
.room-title .meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
}
.stars {
  display: inline-flex;
  gap: 2px;
}
.star {
  color: #d1d5db;
}
.star.active {
  color: #f59e0b;
}
.avg {
  font-weight: 700;
}
.count {
  color: #6b7280;
}
.reviews {
  padding: 12px 14px;
  display: grid;
  gap: 10px;
}
.review-item {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
}
.rating {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.score {
  font-weight: 700;
}
.comment {
  margin-top: 6px;
  white-space: pre-wrap;
}
.created {
  margin-top: 6px;
  color: #6b7280;
  font-size: 12px;
}
</style>
