<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// === runtime config ===
const {
  public: { apiBase, lineInviteUrl, lineBotBasicId }
} = useRuntimeConfig()

// === states ===
const code      = ref('')
const lineUserId = ref('')

const chatLink  = ref<string>('')        // ลิงก์เปิดแชท OA พร้อมข้อความโค้ด
const chatQR    = ref<string | null>(null)
const inviteQR  = ref<string | null>(null)

const loading   = ref(false)
const errorMsg  = ref('')

// ทำให้ href เป็น string แน่นอน (กัน TS บ่น)
const inviteUrlHref = computed<string>(() => String(lineInviteUrl || ''))
const chatLinkHref  = computed<string>(() => chatLink.value || '')

// no expiry tracking: once code is present it is shown permanently

onMounted(async () => {
  // ถ้ามี code เก่าที่เก็บไว้ใน localStorage ให้ขึ้นก่อน เพื่อ UX ที่ไม่ต้องรอเครือข่าย
  const saved = localStorage.getItem('line_pairing_code') || ''
  if (saved) {
    code.value = saved
    chatLink.value = `https://line.me/R/oaMessage/${lineBotBasicId}/?${encodeURIComponent(code.value)}`
    try {
      // @ts-ignore
      const QRCode = (await import('qrcode')).default as any
      chatQR.value = await toDataURL(QRCode, chatLinkHref.value)
      if (inviteUrlHref.value) {
        inviteQR.value = await toDataURL(QRCode, inviteUrlHref.value)
      }
    } catch (e) {
      // ignore QR generation errors here
    }
  }

  let userId = localStorage.getItem('user_id') || ''
  if (!userId && lineUserId.value) userId = lineUserId.value
  if (userId) {
    await fetchPairingCodeByUserId(userId)
    console.log('Fetched pairing code for user_id:', userId)
  }
})

// helper: บังคับใช้ version callback ของ qrcode -> Promise<string>
function toDataURL(qrcode: any, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    qrcode.toDataURL(String(text), (err: any, url: string) => {
      if (err) reject(err); else resolve(url)
    })
  })
}

async function fetchPairingCodeByUserId(userId: string) {
  loading.value = true
  errorMsg.value = ''
  try {
    // token
    const tokenRef = useCookie<string | null>('token')
    const token = tokenRef.value ?? localStorage.getItem('token') ?? ''
    if (!token) { alert('กรุณาล็อกอินก่อน'); loading.value = false; return }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    // GET pairing code by user_id
    const res = await $fetch<{ data: { code: string; expires_at: number; user_id: string } }>(
      `${apiBase}/api/v1/line/pairing-code/${userId}`,
      { method: 'GET', headers }
    )
    console.log('GET /api/v1/line/pairing-code/{userId} response:', res)
    if (res.data && res.data.code) {
      code.value = res.data.code
      lineUserId.value = res.data.user_id
      chatLink.value = `https://line.me/R/oaMessage/${lineBotBasicId}/?${encodeURIComponent(code.value)}`
  // เก็บไว้ที่ localStorage ให้ขึ้นทันทีเมื่อ reload
  try { localStorage.setItem('line_pairing_code', code.value) } catch (e) { /* ignore */ }
      // 3) สร้าง QR ด้วย qrcode
      // @ts-ignore
      const QRCode = (await import('qrcode')).default as any
      chatQR.value = await toDataURL(QRCode, chatLinkHref.value)
      if (inviteUrlHref.value) {
        inviteQR.value = await toDataURL(QRCode, inviteUrlHref.value)
      }
      return true
    }
    return false
  } catch (e: any) {
    // ถ้า 404 ไม่ต้องแสดง errorMsg (ถือว่าไม่มีรหัส ไม่ใช่ error)
    if (e?.response?.status === 404) {
      return false
    }
    errorMsg.value = e?.message || 'เกิดข้อผิดพลาด'
    return false
  } finally {
    loading.value = false
  }
}


async function fetchPairingCode() {
  loading.value = true
  errorMsg.value = ''
  try {
    // token
    const tokenRef = useCookie<string | null>('token')
    const token = tokenRef.value ?? localStorage.getItem('token') ?? ''
    if (!token) { alert('กรุณาล็อกอินก่อน'); loading.value = false; return }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    // POST ขอ pairing code ใหม่
    const res = await $fetch<{ data: { code: string; expires_at: number; user_id: string } }>(
      `${apiBase}/api/v1/line/pairing-code`,
      { method: 'POST', headers }
    )
  code.value = res.data.code
    lineUserId.value = res.data.user_id
    chatLink.value = `https://line.me/R/oaMessage/${lineBotBasicId}/?${encodeURIComponent(code.value)}`
  // เก็บไว้ที่ localStorage ให้ขึ้นทันทีเมื่อ reload
  try { localStorage.setItem('line_pairing_code', code.value) } catch (e) { /* ignore */ }
    // 3) สร้าง QR ด้วย qrcode
    // @ts-ignore
    const QRCode = (await import('qrcode')).default as any
    chatQR.value = await toDataURL(QRCode, chatLinkHref.value)
    if (inviteUrlHref.value) {
      inviteQR.value = await toDataURL(QRCode, inviteUrlHref.value)
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'เกิดข้อผิดพลาด'
  } finally {
    loading.value = false
  }
}

async function handlePairingButton() {
  loading.value = true
  errorMsg.value = ''
  try {
    // หา user_id
    let userId = localStorage.getItem('user_id') || ''
    if (!userId && lineUserId.value) userId = lineUserId.value
    if (userId) {
      const stillValid = await fetchPairingCodeByUserId(userId)
      if (!stillValid) {
        await fetchPairingCode()
      }
    } else {
      await fetchPairingCode()
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <h1>เชื่อม LINE เพื่อรับการแจ้งเตือน</h1>
    <section class="card">
      <h2>กรุณาเพิ่มเพื่อนใน LINE @505stoag </h2>
        <div class="pairing-code-box">
          <button
            class="btn-gold"
            :disabled="!!loading || !!code"
            :style="(loading || code) ? 'background: #dc2626; color: #fff;' : ''"
            @click="handlePairingButton"
          >
            <template v-if="!code">ขอรหัสเชื่อม LINE</template>
            <template v-else>โค้ดพร้อมใช้งาน</template>
          </button>
          <span v-if="code" class="pairing-label">โค้ดของคุณ:</span>
          <span v-if="code" class="pairing-code">{{ code }}</span>
        </div>
      <p v-if="errorMsg" style="color:#dc2626; font-weight:600;">{{ errorMsg }}</p>
  <img v-if="chatQR && code" :src="chatQR" width="220" height="220" alt="Chat QR">
      <p class="hint">เมื่อส่งข้อความสำเร็จ ระบบจะเชื่อมบัญชี LINE ให้อัตโนมัติ</p>
    </section>
  </div>
</template>

<style scoped>
.wrap { max-width: 720px; margin: 24px auto; padding: 16px; }
.card { background: #fff; padding: 24px 24px 32px 24px; margin: 18px 0; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
.hint { color: #6b7280; font-size: 13px; margin-top: 16px; }
.btn-gold {
  display: inline-block;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #fff;
  font-weight: 700;
  padding: 10px 24px;
  border-radius: 10px;
  text-decoration: none;
  font-size: 1rem;
  box-shadow: 0 4px 12px rgba(251,191,36,0.18);
  transition: all 0.2s;
  margin-top: 8px;
  border: none;
  cursor: pointer;
}
.btn-gold[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-gold:hover:enabled {
  background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
  color: #fff;
  transform: translateY(-2px);
}
.pairing-code-box {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.2rem;
  margin: 12px 0 0 0;
  flex-wrap: wrap;
}
.pairing-label {
  font-weight: 600;
  color: #2d2d2d;
}
.pairing-code {
  font-family: 'Kanit', 'Roboto Mono', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: #f59e0b;
  letter-spacing: 2px;
  background: #fffbe8;
  border-radius: 8px;
  padding: 4px 16px;
  box-shadow: 0 2px 8px rgba(251,191,36,0.08);
}
.pairing-expire {
  color: #6b7280;
  font-size: 0.95rem;
  margin-left: 8px;
}
@media (max-width: 600px) {
  .card { padding: 14px 6px 20px 6px; border-radius: 10px; }
  .pairing-code-box { font-size: 1rem; gap: 6px; }
  .pairing-code { font-size: 1.1rem; padding: 2px 8px; }
}
</style>