/**
 * contentFilter.js — ระบบกรองเนื้อหาและป้องกัน spam
 * ครอบคลุม: rate limiting, ชื่อ reserved, URL injection, bad words
 */

// ============================================================
// 1. RESERVED NAMES (ป้องกันการแอบอ้างเป็น admin)
// ============================================================
const RESERVED_NAMES = [
  'moritz', 'มอริทส์', 'คิดถึงคนเก่า', 'big boss', 'bigboss',
  'admin', 'แอดมิน', 'ผู้ดูแล', 'administrator', 'mod', 'moderator',
  'system', 'ระบบ', 'official', 'ทางการ',
]

export function isReservedName(name) {
  if (!name) return false
  const lower = name.toLowerCase().replace(/\s+/g, '')
  return RESERVED_NAMES.some((r) => lower.includes(r.replace(/\s+/g, '')))
}

// ============================================================
// 2. BAD WORDS FILTER (ไทย + อังกฤษ พื้นฐาน)
// ============================================================
const BAD_WORDS = [
  // ภาษาไทย — คำหยาบ / ด่าทอ
  'ไอสัตว์', 'ไอ้สัตว์', 'แม่ง', 'เหี้ย', 'ควย', 'หี', 'เย็ด',
  'อีสัตว์', 'ไอ้หน้าหี', 'อีดอก', 'สัตว์', 'ไอ้บ้า', 'อีบ้า',
  'ไอ้ระยำ', 'อีระยำ', 'มึง', 'กู', 'ไอ้โง่', 'อีโง่',
  // English — basic profanity
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'cock',
  'nigger', 'faggot', 'whore', 'bastard',
]

export function containsBadWord(text) {
  if (!text) return false
  const lower = text.toLowerCase().replace(/\s+/g, '')
  return BAD_WORDS.some((w) => lower.includes(w.replace(/\s+/g, '')))
}

export function filterBadWords(text) {
  if (!text) return text
  let result = text
  BAD_WORDS.forEach((word) => {
    const regex = new RegExp(word.split('').join('\\s*'), 'gi')
    result = result.replace(regex, (match) => '*'.repeat(match.length))
  })
  return result
}

// ============================================================
// 3. URL / INJECTION PROTECTION
// ============================================================
export function isSafeURL(url) {
  if (!url) return true
  try {
    const parsed = new URL(url)
    // อนุญาตเฉพาะ http: https: data: (รูปที่ upload เป็น base64)
    return ['https:', 'http:', 'data:'].includes(parsed.protocol)
  } catch {
    // ถ้า parse ไม่ได้เลย อาจเป็น relative path — อนุญาต
    return !url.toLowerCase().startsWith('javascript:')
  }
}

export function sanitizeText(text) {
  if (!text) return ''
  // ตัด leading/trailing whitespace และ null bytes
  return text.trim().replace(/\0/g, '')
}

// ============================================================
// 4. RATE LIMITER (client-side, per-action)
// ============================================================
const _timestamps = {}

/**
 * ตรวจสอบว่าสามารถส่งได้หรือยัง
 * @param {string} key  - ชื่อ action เช่น 'generalChat', 'dm', 'comment'
 * @param {number} cooldownMs - cooldown เป็น ms (เช่น 1500)
 * @returns {{ allowed: boolean, remainingSec: number }}
 */
export function checkRateLimit(key, cooldownMs) {
  const now = Date.now()
  const last = _timestamps[key] || 0
  const elapsed = now - last
  if (elapsed < cooldownMs) {
    return { allowed: false, remainingSec: Math.ceil((cooldownMs - elapsed) / 1000) }
  }
  _timestamps[key] = now
  return { allowed: true, remainingSec: 0 }
}

/**
 * ป้องกัน spam ข้อความซ้ำ
 * @param {string} key
 * @param {string} text
 * @returns {boolean} true ถ้าเป็น spam (ซ้ำเหมือนเดิม)
 */
const _lastTexts = {}
export function isDuplicateMessage(key, text) {
  const last = _lastTexts[key]
  if (last && last === text.trim()) return true
  _lastTexts[key] = text.trim()
  return false
}

// ============================================================
// 5. SPAM PATTERN DETECTION
// ============================================================
export function isSpamText(text) {
  if (!text) return false
  const t = text.trim()
  // ตรวจสอบการซ้ำตัวอักษรเกิน 12 ตัว เช่น "aaaaaaaaaaaaaa"
  if (/(.)\1{11,}/.test(t)) return true
  // ตรวจสอบข้อความที่สั้นมากและซ้ำ (เช่น "555555555555")
  if (/^(\d)\1{8,}$/.test(t)) return true
  // ตรวจสอบ URL ที่อาจเป็น phishing
  const urlPattern = /https?:\/\/[^\s]+/g
  const urls = t.match(urlPattern) || []
  if (urls.length > 3) return true
  return false
}

