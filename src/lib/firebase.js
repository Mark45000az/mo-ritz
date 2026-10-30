/**
 * firebase.js — Firebase Realtime Database config
 * ================================================
 * วิธีตั้งค่า Firebase (ฟรี ไม่มีค่าใช้จ่าย):
 *
 * 1. ไปที่ https://console.firebase.google.com/
 * 2. สร้าง Project ใหม่ (ตั้งชื่ออะไรก็ได้)
 * 3. เปิด Realtime Database → Create Database → เลือก "Start in test mode"
 * 4. ไปที่ Project Settings (⚙️) → Your apps → Add app → Web (</>)
 * 5. Copy firebaseConfig แล้วแทนที่ค่าด้านล่างนี้
 * 6. กลับไปที่ Realtime Database → Rules → วางกฎด้านล่าง → Publish:
 *
 * {
 *   "rules": {
 *     "presence": { ".read": true, ".write": true },
 *     "clicks": { ".read": true, ".write": true }
 *   }
 * }
 */

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyB3bVL-kuWsWm9B9axRqRCLUn3xwwHC-Fs",
  authDomain: "moritz-community.firebaseapp.com",
  projectId: "moritz-community",
  storageBucket: "moritz-community.firebasestorage.app",
  messagingSenderId: "220646924565",
  appId: "1:220646924565:web:62ee68408212038c37c91c",
  measurementId: "G-0Y78Y83T0J"
}

export const isConfigured = Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_'))

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const firestore = getFirestore(app)
export const storage = getStorage(app)

// Realtime Database (สำหรับ LivePresence ถ้าเปิดใช้งาน)
let db = null
try {
  db = getDatabase(app)
} catch {
  // Graceful fallback if RTDB is not initialized
}

export { app, db }

