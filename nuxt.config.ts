export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'ระบบจองห้องประชุม',
      meta: [
        { name: 'description', content: 'รายละเอียดเว็บไซต์จองห้องประชุม' },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap', 
        },
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        },
      ],
    },
  },

  modules: ['@pinia/nuxt',

  ],
  build: {
    transpile: ['@pinia/nuxt'], // ทำการ transpile pinia module ให้ถูกต้อง
  },

  ssr: false, // หากปัญหายังคงอยู่ อาจจะลองปิด SSR เพื่อทดสอบว่าเกิดจาก SSR หรือไม่

  css: [
    '@/assets/css/main.css'  // รวมไฟล์ CSS ที่สร้างขึ้น
  ],
  runtimeConfig: {
    public: {
      apiBase: '', // can be overridden by NUXT_PUBLIC_API_BASE environment variable
    }
  },
  routeRules: {
    // ไม่ต้องใส่ ถ้าใช้ global middleware
  },
  imports: {
    dirs: ["middleware"]
  },
  
});
