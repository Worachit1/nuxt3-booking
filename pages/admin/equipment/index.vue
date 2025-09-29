<script setup>
import { ref, onMounted } from "vue";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import LoadingPage from "@/components/Loading.vue";
import { useEquipmentStore } from "@/store/equipmentStore";

definePageMeta({ middleware: ["load-user"] });

const equipmentStore = useEquipmentStore();
const { isLoading } = storeToRefs(equipmentStore);

const editableEquipments = ref([]);
const showModal = ref(false);

// ฟอร์มเพิ่มอุปกรณ์ใหม่
const newEquipment = ref({
    name: "",
    quantity: "",
    status: "Available",
    image: null,
    imagePreview: null,
});

// โหลดข้อมูลอุปกรณ์
const loadEquipments = async () => {
    await equipmentStore.fetchEquipments();
    editableEquipments.value = equipmentStore.equipments.map((e) => ({
        id: e.id,
        name: e.name || "",
        image_url: e.image_url || "",
        quantity: e.quantity || 0,
        status: e.status || "Available",
        imageFile: null,
        newImagePreview: null,
        isEditing: false,
    }));
};

onMounted(loadEquipments);

// เริ่มแก้ไข
const startEdit = (index) => {
    const e = editableEquipments.value[index];
    e.isEditing = true;
    e.imageFile = null;
    e.newImagePreview = null;
};

// อัปโหลดรูปใหม่ (edit)
const handleImageUpload = (event, index) => {
    const file = event.target.files[0];
    if (file) {
        editableEquipments.value[index].imageFile = file;
        editableEquipments.value[index].newImagePreview = URL.createObjectURL(file);
    } else {
        editableEquipments.value[index].imageFile = null;
        editableEquipments.value[index].newImagePreview = null;
    }
};

// อัปโหลดรูปใหม่ (create)
const handleNewImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        newEquipment.value.image = file;
        newEquipment.value.imagePreview = URL.createObjectURL(file);
    } else {
        newEquipment.value.image = null;
        newEquipment.value.imagePreview = null;
    }
};

// เพิ่มอุปกรณ์ใหม่
const createEquipment = async () => {
    if (!newEquipment.value.name?.trim() || !newEquipment.value.quantity) {
        Swal.fire("กรุณากรอกข้อมูลให้ครบ", "", "warning");
        return;
    }

    const formData = new FormData();
    formData.append("name", newEquipment.value.name.trim());
    formData.append("quantity", newEquipment.value.quantity);
    formData.append("status", "Available");

    if (newEquipment.value.image) {
        formData.append("image_url", newEquipment.value.image);
    }

    try {
        await equipmentStore.addEquipment(formData);
        newEquipment.value = { name: "", quantity: "",  status: "Available", image: null, imagePreview: null };
        showModal.value = false;
        await loadEquipments();
        Swal.fire("เพิ่มอุปกรณ์เรียบร้อย", "", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถเพิ่มอุปกรณ์ได้", "error");
    }
};

// บันทึกการแก้ไข
const saveEdit = async (index) => {
    const e = editableEquipments.value[index];
    if (!e.name?.trim()) {
        Swal.fire("กรุณากรอกชื่ออุปกรณ์", "", "warning");
        return;
    }

    const formData = new FormData();
    formData.append("name", e.name.trim());
    formData.append("quantity", e.quantity);
    formData.append("status", e.status);

    formData.append("existing_image_url", e.image_url);
    if (e.imageFile) {
        formData.append("image_url", e.imageFile);
    }

    try {
        await equipmentStore.updateEquipment(e.id, formData);
        e.isEditing = false;
        e.imageFile = null;
        e.newImagePreview = null;
        await loadEquipments();
        Swal.fire("แก้ไขเรียบร้อย", "", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถแก้ไขอุปกรณ์ได้", "error");
    }
};

// ลบอุปกรณ์
const deleteEquipment = async (e) => {
    const result = await Swal.fire({
        title: `คุณต้องการลบ "${e.name}" ใช่ไหม?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;

    equipmentStore.isLoading = true;
    await equipmentStore.deleteEquipment(e.id);
    await loadEquipments();
    equipmentStore.isLoading = false;
    Swal.fire("ลบเรียบร้อย", "", "success");
};

// ปิด modal
const closeModals = () => {
    showModal.value = false;
    newEquipment.value = { name: "", quantity: "",  status: "Available", image: null, imagePreview: null };
};
</script>

<template>
  <teleport to="body">
    <LoadingPage v-if="isLoading" />
  </teleport>

  <div class="container">
    <div class="header">
      <h1>รายการอุปกรณ์</h1>
      <button class="createequipment" @click="showModal = true">
        <i class="fa-solid fa-circle-plus"></i> เพิ่มอุปกรณ์
      </button>
    </div>

    <table v-if="editableEquipments.length" class="equipment-table">
      <thead>
        <tr>
          <th>รูปภาพ</th>
          <th>ชื่ออุปกรณ์</th>
          <th>จำนวนทั้งหมด</th>
          <th>สถานะ</th>
          <th>การดำเนินการ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(eq, index) in editableEquipments" :key="eq.id">
          <!-- รูป -->
          <td>
            <img
              v-if="eq.image_url"
              :src="eq.image_url"
              style="width:80px;height:60px;object-fit:cover;border-radius:6px;"
            />
            <span v-else style="color:#aaa;">ไม่มีรูป</span>
          </td>

          <!-- ชื่อ -->
          <td>
            <span v-if="!eq.isEditing">{{ eq.name }}</span>
            <input
              v-else
              v-model="eq.name"
              type="text"
              placeholder="ชื่ออุปกรณ์"
            />
          </td>

          <!-- จำนวน -->
          <td>
            <span v-if="!eq.isEditing">{{ eq.quantity }}</span>
            <input
              v-else
              v-model="eq.quantity"
              type="number"
              min="0"
              placeholder="จำนวน"
            />
          </td>

          <!-- สถานะ -->
          <td>
            <span
              v-if="!eq.isEditing"
              :class="{
                'equipment-available': eq.status === 'Available',
                'equipment-broken': eq.status === 'Broken'
              }"
            >
              {{ eq.status === 'Available'
                ? 'พร้อมใช้งาน'
                : eq.status === 'Broken'
                ? 'ชำรุด'
                : eq.status }}
            </span>
            <select v-else v-model="eq.status">
              <option value="Available">พร้อมใช้งาน</option>
              <option value="Broken">ชำรุด</option>
            </select>
          </td>

          <!-- ปุ่มการดำเนินการ -->
          <td class="action-buttons">
            <button v-if="!eq.isEditing" class="edit" @click="startEdit(index)">
              <i class="fa-solid fa-pen"></i> แก้ไข
            </button>
            <button v-if="eq.isEditing" class="confirm" @click="saveEdit(index)">
              <i class="fa-solid fa-check"></i> บันทึก
            </button>
            <button class="delete" @click="deleteEquipment(eq)">
              <i class="fa-solid fa-trash"></i> ลบ
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else>
      <p>ยังไม่มีอุปกรณ์</p>
    </div>
  </div>

  <!-- Modal เพิ่มอุปกรณ์ -->
  <teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <h3>เพิ่มอุปกรณ์ใหม่</h3>
        <input v-model="newEquipment.name" type="text" placeholder="ชื่ออุปกรณ์" />
        <input v-model="newEquipment.quantity" type="number" placeholder="จำนวนทั้งหมด" />
        <input type="file" accept="image/*" @change="handleNewImageUpload" style="margin-top:10px" />

        <div v-if="newEquipment.imagePreview" style="margin-bottom:10px;">
          <img
            :src="newEquipment.imagePreview"
            style="width:80px;height:60px;object-fit:cover;border-radius:6px;"
          />
        </div>

        <div class="modal-actions">
          <button @click="createEquipment" class="modal-confirm">บันทึก</button>
          <button @click="closeModals" class="modal-cancel">ยกเลิก</button>
        </div>
      </div>
    </div>
  </teleport>
</template>


<style scoped>
.container {
    padding: 3vw 4vw;
    background-color: #f9f9f9;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    margin: 5vw auto;
    max-width: 1200px;
    width: 100%;
    box-sizing: border-box;
}

.header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
    align-items: flex-start;
    margin-bottom: 20px;
}

@media (min-width: 640px) {
    .header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }
}

h1 {
    margin: 0;
    font-size: 6vw;
    color: #333;
    text-decoration: underline;
}

@media (min-width: 640px) {
    h1 {
        font-size: 28px;
    }
}

.createequipment {
    background-color: #13131f;
    color: white;
    border: 1px solid #13131f;
    padding: 10px 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: bold;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.createequipment:hover {
    background-color: #4a4a4a;
}

.equipment-table {
    width: 100%;
    border-collapse: collapse;
    word-break: break-word;
}

.equipment-table th,
.equipment-table td {
    padding: 12px 8px;
    text-align: left;
    vertical-align: middle;
}

.equipment-table input[type="text"] {
    width: 80%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.edit,
.confirm,
.delete {
    padding: 8px 12px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
}

.edit {
    background-color: #00b7ff;
    color: white;
}

.edit:hover {
    background-color: #0088cc;
}

.confirm {
    background-color: #ffb700;
    color: white;
}

.confirm:hover {
    background-color: #cc9a00;
}

.delete {
    background-color: #f13c3c;
    color: white;
}

.delete:hover {
    background-color: #cc0000;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    backdrop-filter: blur(3px);
}

.modal {
    background: #ffffff;
    padding: 30px 40px;
    border-radius: 12px;
    width: 90vw;
    max-width: 400px;
    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.2);
    animation: scaleFadeIn 0.3s ease forwards;
    transform-origin: center;
    box-sizing: border-box;
}

.modal h3 {
    margin-bottom: 20px;
    font-size: 22px;
    font-weight: bold;
    text-align: center;
    color: #333;
}

.modal input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 16px;
    margin-bottom: 20px;
    outline: none;
    transition: border-color 0.2s;
}

.modal input:focus {
    border-color: #00b7ff;
    box-shadow: 0 0 3px rgba(0, 183, 255, 0.4);
}

.modal-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
}

.modal-confirm,
.modal-cancel {
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border: none;
}

.modal-confirm {
    background-color: #00c853;
    color: white;
}

.modal-confirm:hover {
    background-color: #009c3b;
}

.modal-cancel {
    background-color: #4e555b;
    color: white;
}

.modal-cancel:hover {
    background-color: #7d878f;
}

@keyframes scaleFadeIn {
    0% {
        opacity: 0;
        transform: scale(0.5);
    }

    100% {
        opacity: 1;
        transform: scale(1);
    }
}

/* ✅ status class สำหรับ equipment */
.equipment-available {
  color: green;
  font-weight: bold;
}

.equipment-broken {
  color: red;
  font-weight: bold;
}
</style>
