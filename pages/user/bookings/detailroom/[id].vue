
<script setup>
import { useRoute, useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import LoadingPage from "~/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";

definePageMeta({
  middleware: ["load-user", "user-only"],
});

const route = useRoute();
const router = useRouter();
const roomId = route.params.id;
const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);

const room = ref({});
onMounted(async () => {
  try {
    const data = await roomStore.getById(roomId);
    room.value = data || {};
  } catch (error) {
    console.error("Error fetching room details:", error);
  }
});

const goToRoomBooking = () => {
  router.push(`/user/bookings/bookingroom/${roomId}`);
};
</script>

<template>
<LoadingPage v-if="isLoading" />
  <div class="room-details-bg">
    <div class="room-details-card">
      <div class="header-row">
        <div>
          <h2>
            <i class="fa-solid fa-house-chimney"></i>
            รายละเอียดห้อง {{ room.name }}
          </h2>
          <h3>
            <i class="fa-solid fa-building"></i>
            {{ room.building }}
          </h3>
        </div>
      </div>
      <div class="image-container">
        <img :src="room.image_url || '/images/default-room.jpg'" alt="Room Image" />
      </div>
      <div class="info-row">
        <div class="info-box">
          <div class="info-title">
            <i class="fa-solid fa-align-left"></i> รายละเอียด
          </div>
          <div class="info-content">{{ room.description || '-' }}</div>
        </div>
        <div class="info-box">
          <div class="info-title">
            <i class="fa-solid fa-users"></i> จำนวนที่เข้าได้
          </div>
          <div class="info-content">{{ room.capacity || '-' }} คน</div>
        </div>
      </div>
      <div class="button-row">
        <button class="button-calendar" @click="goToRoomBooking">
          <i class="fa-solid fa-calendar-days"></i> ปฏิทินการจอง {{ room.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-details-bg {
  min-height: 65vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 8px;
}
.room-details-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(88,176,224,0.15), 0 1.5px 6px rgba(67,73,85,0.07);
  max-width: 540px;
  width: 100%;
  padding: 32px 28px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  position: relative;
  animation: fadeIn 0.5s;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(24px);}
  to { opacity: 1; transform: translateY(0);}
}
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0;
}
.header-row h2 {
  font-size: 1.5rem;
  color: #222f3e;
  margin-bottom: 4px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-row h3 {
  font-size: 1.1rem;
  color: #13131f;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 7px;
}
.image-container {
  text-align: center;
  margin-bottom: 0;
}
.image-container img {
  max-width: 340px;
  width: 100%;
  height: 220px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(88,176,224,0.08);
  background: #f4f8fb;
}
.info-row {
  display: flex;
  gap: 18px;
  margin-bottom: 0;
  flex-wrap: wrap;
}
.info-box {
  flex: 1 1 180px;
  background: #f4f8fb;
  border-radius: 10px;
  padding: 18px 20px 14px 20px;
  min-width: 0;
  box-shadow: 0 1px 4px rgba(88,176,224,0.07);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.info-title {
  font-size: 1rem;
  color: #13131f;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 2px;
}
.info-content {
  color: #222f3e;
  font-size: 1.05rem;
  font-weight: 500;
  word-break: break-word;
}
.button-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.button-calendar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border: none;
  border-radius: 7px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  box-shadow: 0 1px 4px rgba(88,176,224,0.07);
}
.button-calendar {
  background: #13131f;
  color: #fff;
}
.button-calendar:hover {
  background: #4a4a4a;
}
@media (max-width: 700px) {
  .room-details-card {
    padding: 18px 6px 18px 6px;
  }
  .info-row {
    flex-direction: column;
    gap: 12px;
  }
  .image-container img {
    max-width: 100%;
    height: 180px;
  }
}
</style>