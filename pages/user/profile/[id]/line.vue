<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

// === runtime config ===
const {
  public: { apiBase, lineInviteUrl, lineBotBasicId }
} = useRuntimeConfig()

// === states ===
const code      = ref('')
const lineUserId = ref('')

const chatLink  = ref<string>('')        // ลิงก์เปิดแชท OA พร้อมข้อความโค้ด

const loading   = ref(false)
const errorMsg  = ref('')

// ทำให้ href เป็น string แน่นอน (กัน TS บ่น)
const inviteUrlHref = computed<string>(() => String(lineInviteUrl || ''))
const chatLinkHref  = computed<string>(() => chatLink.value || '')

// route param: profile user id from URL
const route = useRoute()
const profileUserId = computed<string>(() => String(route.params.id || ''))

// current logged-in user id (viewer)
const currentUserId = ref<string>(localStorage.getItem('user_id') || '')

// storage key uses profile id to avoid leaking other users' codes to the whole browser
const storageKey = computed<string>(() => `line_pairing_code_${profileUserId.value || 'anonymous'}`)

// no expiry tracking: once code is present it is shown permanently

onMounted(async () => {
  // ถ้ามี code เก่าที่เก็บไว้ใน localStorage สำหรับ profile นี้ ให้ขึ้นก่อน เพื่อ UX ที่ไม่ต้องรอเครือข่าย
  const saved = localStorage.getItem(storageKey.value) || ''
  if (saved) {
    code.value = saved
    chatLink.value = `https://line.me/R/oaMessage/${lineBotBasicId}/?${encodeURIComponent(code.value)}`
  }

  // try to fetch pairing code for the profile user id (from route)
  const profileId = profileUserId.value
  if (profileId) {
    const found = await fetchPairingCodeByUserId(profileId)
    console.log('Fetched pairing code for profile user_id:', profileId, 'found:', found)
  }
})

// no qrcode generation: LINE QR not used

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
      // เก็บไว้ที่ localStorage ให้ขึ้นทันทีเมื่อ reload (key per profile)
      try { localStorage.setItem(storageKey.value, code.value) } catch (e) { /* ignore */ }
      // QR generation removed (LINE QR not approved)
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
    // เก็บไว้ที่ localStorage ให้ขึ้นทันทีเมื่อ reload (key per profile)
    try { localStorage.setItem(storageKey.value, code.value) } catch (e) { /* ignore */ }
    // QR generation removed (LINE QR not approved)
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
    // When clicking the button, we prefer to fetch for the profile being viewed.
    const profileId = profileUserId.value
    // If viewing a profile (profileId present), fetch that user's code. If not found,
    // only allow creating a new code when the viewer is the profile owner (i.e., currentUserId).
    if (profileId) {
      const found = await fetchPairingCodeByUserId(profileId)
      if (!found) {
        if (currentUserId.value && currentUserId.value === profileId) {
          // viewer is the owner — allow creating a code
          await fetchPairingCode()
        } else {
          // viewing someone else who has no code
          alert('ผู้ใช้ยังไม่มีรหัสเชื่อม LINE')
        }
      }
    } else {
      // no profile in URL: fallback to current user
      if (currentUserId.value) {
        const found = await fetchPairingCodeByUserId(currentUserId.value)
        if (!found) await fetchPairingCode()
      } else {
        alert('กรุณาล็อกอินก่อนเพื่อขอรหัส')
      }
    }
  } finally {
    loading.value = false
  }
}

function clearCode() {
  try { localStorage.removeItem(storageKey.value) } catch (e) {}
  code.value = ''
  chatLink.value = ''
}
</script>

<template>
  <div class="wrap">
    <h1>เชื่อม LINE เพื่อรับการแจ้งเตือน</h1>
    <section class="card">
      <h2>กรุณาเพิ่มเพื่อนใน LINE @505stoag </h2>
        <div class="pairing-center">
          <div class="pairing-code-box">
            <div>
              <!-- If viewer is profile owner, allow requesting a code. Otherwise only show fetch for profile user. -->
              <template v-if="currentUserId === profileUserId">
                <button
                  class="btn-gold"
                  :disabled="!!loading || !!code"
                  :style="(loading || code) ? 'background: #dc2626; color: #fff;' : ''"
                  @click="handlePairingButton"
                >
                  <template v-if="!code">ขอรหัสเชื่อม LINE</template>
                  <template v-else>โค้ดพร้อมใช้งาน</template>
                </button>
              </template>
              <template v-else>
                <!-- viewing another user's profile -->
                <button class="btn-gold" disabled v-if="!code">ผู้ใช้ยังไม่มีรหัส</button>
              </template>
            </div>

            <div class="code-badge" v-if="code">
              <div class="pairing-label">โค้ดของคุณ</div>
              <div class="pairing-code-large">{{ code }}</div> 
            </div>
          </div>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <p class="hint">เมื่อส่งข้อความสำเร็จ ระบบจะเชื่อมบัญชี LINE ให้อัตโนมัติ</p>
        </div>
    </section>
    <section class="card examples">
      <h3>ตัวอย่างการนำโค้ดไปใช้</h3>
      <div class="examples-grid">
        <div class="example example-addfriend">
          <div class="mock-phone css-mock">
            <div class="banner">
              <div class="banner-text">BOOK<br/>ROOM</div>
            </div>
            <div class="avatar">BR</div>
            <div class="bot-name">BookingRoom <span class="bot-sub">@505stoag</span></div>
            <div class="chat-btn">แชท</div>
          </div>
          <p class="caption">1) เปิดหน้าบอทบน LINE แล้วกด "แชท" หรือกดปุ่มสีเขียวเพื่อส่งข้อความ</p>
        </div>

        <div class="example example-chat">
          <div class="mock-chat">
            <div class="bubble bot">ขอบคุณที่เพิ่มบอท! พิมพ์ PAIR-&lt;โค้ด&gt; เพื่อเชื่อมบัญชี</div>
            <div class="bubble user">PAIR-C1C2AC</div>
            <div class="bubble bot success">เชื่อมบัญชีเรียบร้อย ✅</div>
          </div>
          <p class="caption">2) ส่งข้อความรูปแบบ <strong>PAIR-โค้ด</strong> ในแชทกับบอทเพื่อเชื่อมบัญชี</p>
        </div>
      </div>
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
.pairing-center { text-align: center; }
.pairing-code-box { justify-content: center; }
.code-badge { margin-top: 18px; display: inline-block; text-align: center; }
.pairing-code-large { font-family: 'Kanit', 'Roboto Mono', monospace; font-size: 2.2rem; font-weight: 900; color: #b45309; background: #fff7ed; padding: 12px 28px; border-radius: 12px; box-shadow: 0 8px 24px rgba(180,83,9,0.08); margin-top: 8px; }
.actions { display:flex; gap:10px; justify-content:center; margin-top:10px; }
.btn-outline { display:inline-block; padding:8px 14px; border-radius:8px; border:2px solid #f59e0b; color:#b45309; background:transparent; font-weight:700; text-decoration:none; }
.btn-clear { background:#ef4444; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:700; }
.error { color:#dc2626; font-weight:700; margin-top:12px; }
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
  display:none;
}
.examples { margin-top: 18px; }
.examples-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.example { background: #f9fafb; padding: 14px; border-radius: 12px; }
.mock-phone { position: relative; height: 300px; background: linear-gradient(#0b1220, #0b1a2a); border-radius: 12px; overflow: hidden; display:flex; align-items:center; justify-content:center; }
.mock-phone img { max-width:100%; opacity:0.95 }
.mock-phone .cta { position: absolute; bottom: 18px; left: 12px; right:12px; background: #10b981; color:#fff; text-align:center; padding:12px; border-radius:8px; font-weight:700 }
.mock-phone .brand { position:absolute; top: 18px; left: 18px; color:#fff; font-weight:800 }
.css-mock { background: linear-gradient(135deg,#071125 0%, #071a2a 100%); padding: 0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; position:relative }
.css-mock .banner { width:100%; height:110px; background: linear-gradient(90deg,#002244,#004466); display:flex; align-items:center; justify-content:center }
.css-mock .banner-text { color:#8fd3ff; font-weight:900; font-size:32px; letter-spacing:2px }
.css-mock .avatar { width:84px; height:84px; border-radius:50%; background:linear-gradient(90deg,#032  ,#026); color:#9ee7ff; display:flex; align-items:center; justify-content:center; font-weight:900; position:relative; top:-36px; box-shadow:0 8px 20px rgba(0,0,0,0.3) }
.css-mock .bot-name { margin-top:-18px; color:#fff; font-weight:800 }
.css-mock .bot-sub { display:block; color:#cbd5e1; font-weight:600; font-size:12px }
.css-mock .chat-btn { margin-top:18px; background:#10b981; color:#fff; padding:12px 28px; border-radius:10px; font-weight:800 }
.mock-chat { background: #fff; border-radius: 12px; padding: 12px; height:300px; overflow:auto; display:flex; flex-direction:column; gap:8px }
.bubble { padding: 10px 12px; border-radius: 12px; max-width: 78%; }
.bubble.bot { background: #f3e8ff; align-self:flex-start; color:#312e81 }
.bubble.user { background: #fff; border:1px solid #e5e7eb; align-self:flex-end }
.bubble.success { background:#ecfdf5; color:#065f46 }
.caption { font-size: 0.95rem; color:#6b7280; margin-top:10px }
@media (max-width: 900px) { .examples-grid { grid-template-columns: 1fr } }
@media (max-width: 600px) {
  .card { padding: 14px 6px 20px 6px; border-radius: 10px; }
  .pairing-code-box { font-size: 1rem; gap: 6px; }
  .pairing-code { font-size: 1.1rem; padding: 2px 8px; }
}
</style>