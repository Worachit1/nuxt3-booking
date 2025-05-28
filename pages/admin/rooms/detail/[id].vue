<script setup>
import { useRoute, useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import LoadingPage from "~/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";

definePageMeta({
  middleware: ["load-user"]
});

const route = useRoute();
const router = useRouter();
const roomId = route.params.id;
const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);

const room = ref({});

const goToEditRoom = () => {
  router.push(`/admin/rooms/edit/${roomId}`);
};

onMounted(async () => {
  try {
    // ดึงข้อมูลห้องตาม id
    const data = await roomStore.getById(roomId);
    room.value = data || {};
  } catch (error) {
    console.error("Error fetching room details:", error);
  }
});
</script>

<template>
  <template v-if="isLoading">
    <teleport to="body">
      <LoadingPage />
    </teleport>
  </template>
  <div v-else class="room-details-container">
    <div class="header-row">
      <h1><i class="fa-solid fa-house-chimney "></i> รายละเอียดห้อง</h1>
      <h2>{{ room.name }} &nbsp; {{ room.building }}</h2>
    </div>
    <div class="image-container">
      <img :src="room.image_url || '/images/default-room.jpg'" alt="Room Image" width="400px" height="400px"/>
    </div>
    <div class="info-row">
      <div class="info-box">รายละเอียด : {{ room.description }}</div>
      <div class="info-box">จำนวนที่เข้าได้ : {{ room.capacity }} คน</div>
    </div>
    <div class="button-row">
      <button class="button-calendar" @click="$router.push('/')">ไปยังหน้าปฏิทินการจอง</button>
      <button class="button-edit" @click="goToEditRoom">แก้ไขข้อมูลห้อง</button>
      <button class="button-back" @click="$router.back()">กลับ</button>
    </div>
  </div>
</template>


<style scoped>
.room-details-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    text-decoration: underline;
}

.image-container {
    text-align: center;
    margin-bottom: 24px;
}

.image-container img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
}

.info-box {
    background-color: #eae8e8;
    padding: 12px 20px;
    border-radius: 8px;
    flex: 1;
    margin: 0 10px;
    text-align: center;
    font-weight: bold;
}

.button-row {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
.button-calendar {
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}
.button-calendar:hover {
    background-color: #45a049;
    transition: background-color 0.3s ease;
}
.button-edit {
    background-color: #008CBA;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}
.button-edit:hover {
    background-color: #007bb5;
    transition: background-color 0.3s ease;
}

.button-back {
    background-color: #f44336;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}
.button-back:hover {
    background-color: #e53935;
    transition: background-color 0.3s ease;
}
</style>