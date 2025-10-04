<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useRoute, useRouter } from "vue-router";
import LoadingPage from "~/components/Loading.vue";

import { useRoomStore } from "~/store/roomStore";

definePageMeta({
  middleware: ["load-user"],
});

const route = useRoute();
const router = useRouter();
const roomId = route.params.id;
const roomStore = useRoomStore();
const { isLoading } = storeToRefs(roomStore);

const room = ref(null);
const editableRoom = ref({
  name: "",
  description: "",
  capacity: 0,
  imageFile: null,
  // new fields for operations
  start_time_str: "", // HH:MM
  end_time_str: "", // HH:MM
  is_available: true,
  maintenance_note: "",
  maintenance_eta: "",
});

const previewImage = ref(null);
const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    editableRoom.value.imageFile = file;
    previewImage.value = URL.createObjectURL(file);
  }
};

const handleUpdate = async () => {
  if (!editableRoom.value.name?.trim()) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณากรอกชื่อห้อง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }

  if (!editableRoom.value.capacity) {
    await Swal.fire({
      icon: "warning",
      title: "กรุณากรอกจำนวนที่นั่ง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    return;
  }
  const confirmResult = await Swal.fire({
    title: `คุณต้องการอัปเดตข้อมูลห้อง <br>"${editableRoom.value.name}" ใช่ไหม?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "อัปเดต",
    cancelButtonText: "ยกเลิก",
    reverseButtons: true,
    customClass: {
      popup: "my-popup",
      confirmButton: "btn-confirm-update",
      cancelButton: "btn-cancel",
    },
  });
  if (!confirmResult.isConfirmed) return;

  const formData = new FormData();
  formData.append("name", editableRoom.value.name || "");
  formData.append("description", editableRoom.value.description || "");
  formData.append("capacity", (editableRoom.value.capacity ?? 0).toString());

  // convert HH:MM to seconds-of-day
  const toSecondsOfDay = (hhmm) => {
    if (!hhmm || typeof hhmm !== "string") return undefined;
    const [h, m] = hhmm.split(":").map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
    return h * 3600 + m * 60;
  };

  const startSecs = toSecondsOfDay(editableRoom.value.start_time_str);
  const endSecs = toSecondsOfDay(editableRoom.value.end_time_str);
  if (typeof startSecs === "number")
    formData.append("start_room", String(startSecs));
  if (typeof endSecs === "number") formData.append("end_room", String(endSecs));

  // availability and maintenance
  formData.append("is_available", String(!!editableRoom.value.is_available));
  formData.append(
    "maintenance_note",
    editableRoom.value.maintenance_note || ""
  );
  formData.append("maintenance_eta", editableRoom.value.maintenance_eta || "");

  if (editableRoom.value.imageFile) {
    formData.append("image_url", editableRoom.value.imageFile);
  }

  const updateResult = await roomStore.updateRoom(roomId, formData);

  if (updateResult) {
    await Swal.fire({
      icon: "success",
      title: "อัปเดตข้อมูลห้องเสร็จสิ้นแล้ว",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
    router.back();
  } else {
    await Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลห้อง",
      confirmButtonText: "ตกลง",
      customClass: {
        popup: "my-popup",
        confirmButton: "btn-ok",
      },
    });
  }
};

onMounted(async () => {
  room.value = await roomStore.getById(roomId);
  editableRoom.value = {
    name: room.value?.name || "",
    description: room.value?.description || "",
    capacity: room.value?.capacity || 0,
    imageFile: null,
    // prefill new fields
    start_time_str: (() => {
      const s = room.value?.start_room;
      if (s === null || s === undefined) return "";
      const n = Number(s);
      if (!Number.isFinite(n)) return "";
      const h = Math.floor(n / 3600) % 24;
      const m = Math.floor((n % 3600) / 60);
      const pad = (v) => (v < 10 ? `0${v}` : String(v));
      return `${pad(h)}:${pad(m)}`;
    })(),
    end_time_str: (() => {
      const e = room.value?.end_room;
      if (e === null || e === undefined) return "";
      const n = Number(e);
      if (!Number.isFinite(n)) return "";
      const h = Math.floor(n / 3600) % 24;
      const m = Math.floor((n % 3600) / 60);
      const pad = (v) => (v < 10 ? `0${v}` : String(v));
      return `${pad(h)}:${pad(m)}`;
    })(),
    is_available: (() => {
      const v = room.value?.is_available;
      if (v === true) return true;
      if (v === false) return false;
      if (v === 1 || v === "1") return true;
      if (v === 0 || v === "0") return false;
      if (typeof v === "string") return v.toLowerCase() === "true";
      return !!v;
    })(),
    maintenance_note: room.value?.maintenance_note || "",
    maintenance_eta: room.value?.maintenance_eta || "",
  };
  previewImage.value = room.value?.image_url || null;
});
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>
  <div class="container">
    <h1>แก้ไขข้อมูลห้อง</h1>
    <div class="form-group">
      <label for="name">ชื่อห้อง:</label>
      <input type="text" v-model="editableRoom.name" id="name" />
    </div>
    <div class="form-group">
      <label for="description">รายละเอียด:</label>
      <textarea v-model="editableRoom.description" id="description"></textarea>
    </div>
    <div class="form-group">
      <label for="capacity">จำนวนที่นั่ง:</label>
      <input type="number" v-model="editableRoom.capacity" id="capacity" />
    </div>
    <div class="form-row">
      <div class="form-group half">
        <label for="start_time">เวลาเปิด:</label>
        <input
          type="time"
          v-model="editableRoom.start_time_str"
          id="start_time"
        />
      </div>
      <div class="form-group half">
        <label for="end_time">เวลาปิด:</label>
        <input type="time" v-model="editableRoom.end_time_str" id="end_time" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group half">
        <label for="is_available">สถานะห้อง:</label>
        <select id="is_available" v-model="editableRoom.is_available">
          <option :value="true">พร้อมใช้งาน</option>
          <option :value="false">ไม่พร้อมใช้งาน</option>
        </select>
      </div>
      <div class="form-group half">
        <label for="maintenance_eta">คาดว่าจะเสร็จ (ชม. นาที):</label>
        <input
          id="maintenance_eta"
          type="text"
          placeholder="เช่น 2 ชม. 30 นาที"
          v-model="editableRoom.maintenance_eta"
        />
      </div>
    </div>
    <div class="form-group">
      <label for="maintenance_note">ปรับปรุงห้อง (หมายเหตุ):</label>
      <textarea
        id="maintenance_note"
        v-model="editableRoom.maintenance_note"
        rows="3"
      ></textarea>
    </div>
    <div class="form-group">
      <label for="image_upload">อัปโหลดรูปภาพ:</label>
      <input
        type="file"
        id="image_upload"
        accept="image/*"
        @change="handleImageUpload"
      />
      <div v-if="previewImage" style="margin-top: 10px">
        <img
          :src="previewImage"
          alt="Preview"
          style="max-width: 100%; max-height: 200px"
        />
      </div>
    </div>
    <button @click="handleUpdate" class="btn-comfirm">
      บันทึกการเปลี่ยนแปลง
    </button>
    <button @click="router.back()" class="btn-back">กลับ</button>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
.form-group {
  margin-bottom: 15px;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-group.half {
  flex: 1 1 50%;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  cursor: pointer;
  padding: 10px 15px;
  border: none;
  font-weight: bold;
  color: white;
  border-radius: 4px;
  margin-left: 10px;
}

.btn-comfirm {
  background-color: #28a745;
}
.btn-comfirm:hover {
  background-color: #218838;
  transition: border-color 0.3s;
}
.btn-back {
  background-color: #f94c31;
}
.btn-back:hover {
  background-color: #c82333;
  transition: border-color 0.3s;
}
</style>
