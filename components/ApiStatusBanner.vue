<script setup>
import { onMounted, ref } from 'vue';

const config = useRuntimeConfig();
const isApiOnline = ref(true);
const isChecking = ref(false);
const showBanner = ref(false);

const checkApi = async () => {
  isChecking.value = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${config.public.apiBase}/health`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    isApiOnline.value = response?.ok || false;
    showBanner.value = !isApiOnline.value;
  } catch (error) {
    isApiOnline.value = false;
    showBanner.value = true;
  } finally {
    isChecking.value = false;
  }
};

const retry = () => {
  checkApi();
};

onMounted(() => {
  checkApi();
  // Check every 30 seconds
  setInterval(checkApi, 30000);
});
</script>

<template>
  <transition name="slide-down">
    <div v-if="showBanner" class="api-status-banner">
      <div class="banner-content">
        <div class="banner-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="banner-text">
          <h4>ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์</h4>
          <p>กรุณาตรวจสอบว่า API Server ทำงานที่ {{ config.public.apiBase }}</p>
        </div>
        <button @click="retry" class="btn-retry" :disabled="isChecking">
          <i class="fa-solid fa-rotate-right" :class="{ spinning: isChecking }"></i>
          {{ isChecking ? 'กำลังตรวจสอบ...' : 'ลองอีกครั้ง' }}
        </button>
        <button @click="showBanner = false" class="btn-close">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.api-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.banner-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.banner-icon {
  font-size: 32px;
  color: #ffffff;
  animation: pulse 2s infinite;
}

.banner-text {
  flex: 1;
  color: #ffffff;
}

.banner-text h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 700;
}

.banner-text p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.btn-retry {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.btn-retry:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.btn-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-close {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.btn-close:hover {
  opacity: 1;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .banner-content {
    flex-wrap: wrap;
    padding: 12px 16px;
    gap: 12px;
  }

  .banner-icon {
    font-size: 24px;
  }

  .banner-text h4 {
    font-size: 14px;
  }

  .banner-text p {
    font-size: 12px;
  }

  .btn-retry {
    width: 100%;
    justify-content: center;
    order: 3;
  }

  .btn-close {
    position: absolute;
    top: 8px;
    right: 8px;
  }
}
</style>
