/**
 * LivePresence.jsx
 * ─────────────────────────────────────────────────────────
 * สองฟีเจอร์ในไฟล์เดียว:
 *
 * 1) 👁 Viewer Badge — แสดงจำนวนคนที่กำลังดูเว็บไซต์ตอนนี้ (real-time)
 * 2) ✨ Click Ripple — animation ตรงที่คลิก/แตะ มองเห็นได้ทุกคน
 *
 * ทำงานใน 2 โหมด:
 * - Demo mode (ไม่มี Firebase): ripple เฉพาะตัวเอง, count = 1
 * - Live mode (มี Firebase):    ripple มองเห็นกันทุกคน, count จริง
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { db, isConfigured } from '../lib/firebase'
import {
  ref, set, remove, onDisconnect,
  onValue, onChildAdded,
  query, orderByChild, startAt, push,
} from 'firebase/database'
import '../styles/LivePresence.css'

// ─── Helpers ─────────────────────────────────────────────
/** ID เฉพาะสำหรับ session นี้ (ใหม่ทุกครั้งที่เปิดหน้า) */
const SESSION_ID = Math.random().toString(36).slice(2, 11)

/** สีประจำแต่ละ visitor — hash จาก SESSION_ID */
const PALETTE = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#a3e635',
]
function colorFor(id) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const MY_COLOR = colorFor(SESSION_ID)

// ─── Ripple Component ─────────────────────────────────────
/** แต่ละ ripple ลบตัวเองออกหลัง animation จบ */
function Ripple({ id, x, y, color, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 950)
    return () => clearTimeout(t)
  }, [id, onDone])

  return (
    <div
      className="lp-ripple"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        '--rcolor': color,
      }}
    >
      <div className="lp-ripple-dot" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────
export default function LivePresence() {
  const [viewerCount, setViewerCount] = useState(1)
  const [ripples, setRipples] = useState([])
  const [isLive, setIsLive] = useState(false)
  const lastTouchTime = useRef(0)
  const rippleSeq = useRef(0)

  /** เพิ่ม ripple เข้า state */
  const addRipple = useCallback((x, y, color, key) => {
    const id = key ?? `r-${++rippleSeq.current}-${Date.now()}`
    setRipples(prev => [...prev, { id, x, y, color }])
  }, [])

  /** ลบ ripple ออก state */
  const removeRipple = useCallback((id) => {
    setRipples(prev => prev.filter(r => r.id !== id))
  }, [])

  /** เมื่อผู้ใช้คลิก/แตะ — แสดงผลทันที + broadcast */
  const handleInteraction = useCallback((clientX, clientY) => {
    const x = clientX / window.innerWidth
    const y = clientY / window.innerHeight

    // แสดง ripple ของตัวเองทันที
    addRipple(x, y, MY_COLOR)

    // Broadcast ไปยัง Firebase (ถ้า configured)
    if (!isConfigured || !db) return

    const newRef = push(ref(db, 'clicks'), {
      x, y,
      color: MY_COLOR,
      uid: SESSION_ID,
      ts: Date.now(),
    })
    // ลบออกจาก DB หลัง 4 วินาที (ป้องกัน DB โต)
    setTimeout(() => remove(newRef), 4000)
  }, [addRipple])

  // ─── Event Listeners ─────────────────────────────────────
  const onWindowClick = useCallback((e) => {
    // ป้องกัน double-fire บน mobile (touchstart → click)
    if (Date.now() - lastTouchTime.current < 350) return
    handleInteraction(e.clientX, e.clientY)
  }, [handleInteraction])

  const onWindowTouch = useCallback((e) => {
    const touch = e.touches[0]
    if (!touch) return
    lastTouchTime.current = Date.now()
    handleInteraction(touch.clientX, touch.clientY)
  }, [handleInteraction])

  useEffect(() => {
    window.addEventListener('click', onWindowClick)
    window.addEventListener('touchstart', onWindowTouch, { passive: true })
    return () => {
      window.removeEventListener('click', onWindowClick)
      window.removeEventListener('touchstart', onWindowTouch)
    }
  }, [onWindowClick, onWindowTouch])

  // ─── Firebase: Presence + Click Sync ─────────────────────
  useEffect(() => {
    if (!isConfigured || !db) return

    setIsLive(true)
    const startTs = Date.now()
    const cleanups = []

    // 1. Register presence
    const presRef = ref(db, `presence/${SESSION_ID}`)
    set(presRef, { ts: startTs })
    onDisconnect(presRef).remove()

    // 2. Count all active viewers
    const unsubCount = onValue(ref(db, 'presence'), (snap) => {
      setViewerCount(snap.exists() ? Object.keys(snap.val()).length : 1)
    })
    cleanups.push(() => { unsubCount(); remove(presRef) })

    // 3. Listen for OTHERS' clicks (only those after page load)
    const clicksQ = query(
      ref(db, 'clicks'),
      orderByChild('ts'),
      startAt(startTs),
    )
    const unsubClicks = onChildAdded(clicksQ, (snap) => {
      const d = snap.val()
      if (!d || d.uid === SESSION_ID) return
      if (Date.now() - d.ts > 3000) return
      addRipple(d.x, d.y, d.color, snap.key)
    })
    cleanups.push(unsubClicks)

    return () => cleanups.forEach(fn => fn())
  }, [addRipple])

  // ─── Render ───────────────────────────────────────────────
  return (
    <>
      {/* ── Viewer Count Badge ─────────────────────────── */}
      <div
        className="lp-badge"
        aria-label={`${viewerCount} คนกำลังดูอยู่`}
        title={isLive ? 'ผู้ชมสด (Firebase)' : 'ผู้ชม (demo mode)'}
      >
        <span className="lp-eye" aria-hidden="true">👁</span>
        <span className="lp-count">{viewerCount}</span>
        {isLive && <span className="lp-live-dot" aria-hidden="true" />}
      </div>

      {/* ── Ripple Effects Layer ───────────────────────── */}
      <div className="lp-ripples-layer" aria-hidden="true">
        {ripples.map(r => (
          <Ripple
            key={r.id}
            id={r.id}
            x={r.x}
            y={r.y}
            color={r.color}
            onDone={removeRipple}
          />
        ))}
      </div>
    </>
  )
}
