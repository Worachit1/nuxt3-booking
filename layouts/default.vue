<script setup>
import { ref } from "vue";
import Sidebar from "@/components/sidebar.vue";
import Header from "@/components/header.vue";

const isSidebarOpen = ref(false);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
  // On small screens we keep the previous behavior (prevent body scroll),
  // but on larger screens allow the page to scroll even when the sidebar is open.
  try {
    if (typeof window !== "undefined") {
      if (window.innerWidth <= 768) {
        document.body.style.overflow = isSidebarOpen.value ? "hidden" : "";
      } else {
        // ensure body is scrollable on desktop
        document.body.style.overflow = "";
      }
    }
  } catch (e) {
    // ignore any DOM exceptions in SSR context
  }
};
</script>

<template>
  <Header />
  <div class="flex">
    <!-- Sidebar -->
    <Sidebar :isSidebarOpen="isSidebarOpen" @toggleSidebar="toggleSidebar" />

    <!-- Main Content -->
    <div class="main-wrapper" :class="{ 'sidebar-open': isSidebarOpen }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.flex {
  display: flex;
  width: 100%;
  margin: 0;
  padding: 0;
}

.main-wrapper {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  padding-top: 50px;
  background: #f5f5f5;
  transition: transform 0.3s ease;
  transform: translateX(0);
}

.main-wrapper.sidebar-open {
  transform: translateX(220px);
}
</style>
