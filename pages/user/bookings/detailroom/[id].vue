<script setup>
import { useRoute } from "vue-router";
import LoadingPage from "@/components/Loading.vue";
import { useRoomStore } from "@/store/roomStore";
import { useBuilding_RoomStore } from "@/store/building_roomStore";
import { ref, onMounted } from "vue";

definePageMeta({
  middleware: ["load-user"],
});

const route = useRoute();
const roomId = route.params.id;
const roomStore = useRoomStore();
const buildingRoomStore = useBuilding_RoomStore();
const buildingRoom = ref(null);
const room = ref(null);

const { isLoading } = storeToRefs(roomStore, buildingRoomStore);

onMounted(async () => {
  try {
    // ดึงข้อมูลห้อง
    room.value = await roomStore.getById(roomId);
    // ดึงข้อมูล building+room
    buildingRoom.value = await buildingRoomStore.getByRoomId(roomId);

    // Debug log
    console.log("room:", room.value);
    console.log("buildingRoom:", buildingRoom.value);
  } catch (error) {
    console.error("Error fetching room details:", error);
  }
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="room-details-container" v-if="buildingRoom">
    <!-- แถวบนสุด -->
    <div class="header-row">
      <h1><i class="fa-solid fa-house-chimney"></i> รายละเอียดห้อง</h1>
      <h2>
        ห้อง: {{ buildingRoom.room_name || room?.name || "-" }}
        <span v-if="buildingRoom.building_name">
          อาคาร: {{ buildingRoom.building_name }}
        </span>
      </h2>
    </div>

    <!-- รูปภาพตรงกลาง -->
    <div class="image-container">
      <img
        :src="buildingRoom.image_url || room?.image_url || '/images/default-room.jpg'"
        alt="Room Image"
        width="400px"
        height="400px"
      />
    </div>

    <!-- แถวล่างที่มีรายละเอียด -->
    <div class="info-row">
      <div class="info-box">
        รายละเอียด : {{ buildingRoom.description || room?.description || "-" }}
      </div>
      <div class="info-box">
        จำนวนที่เข้าได้ : {{ buildingRoom.capacity || room?.capacity || "-" }} คน
      </div>
    </div>

    <!-- ปุ่ม -->
    <div class="button-row">
      <button class="button-calendar" @click="$router.push('/')">
        ไปยังหน้าปฏิทินการจอง
      </button>
    </div>
  </div>
  <div v-else class="room-details-container">
    <h2>ไม่พบข้อมูลห้องนี้</h2>
    <div class="button-row">
      <button class="button-calendar" @click="$router.push('/')">
        กลับหน้าหลัก
      </button>
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
  background-color: #4caf50;
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
